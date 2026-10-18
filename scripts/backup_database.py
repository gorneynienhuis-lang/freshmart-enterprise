#!/usr/bin/env python3
"""MySQL transport used by local and Compose complete-backup drivers."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import tempfile

from backup_bundle import BackupError, regular_reader, require, sql_details

SCHEMA = re.compile(r'^fresh_mall_restore_[a-z0-9_]{6,45}$')
IDENT = re.compile(r'^[A-Za-z0-9_]{1,64}$')


def grant_schema(schema):
    require(IDENT.fullmatch(schema), 'Unsafe database privilege identifier.')
    # Database-level GRANT treats '_' as a pattern even inside backticks.
    # Escaping it prevents a restore user from matching other future schemas.
    return '`' + schema.replace('_', '\\_') + '`'


class MysqlDatabase:
    def __init__(self, client, dumper, schema, *, root_client=None):
        require(IDENT.fullmatch(schema), 'Unsafe database identifier.')
        self.client, self.dumper, self.schema = list(client), list(dumper), schema
        self.root_client = list(root_client or client)

    def query(self, sql, *, server=False):
        command = (self.root_client if server else self.client) + ['--batch', '--raw', '--skip-column-names', '--connect-timeout=5']
        if not server:
            command.append(self.schema)
        result = subprocess.run(command, input=sql, capture_output=True, text=True)
        require(result.returncode == 0, 'MySQL query failed. Credentials and database content were not printed.')
        return result.stdout.strip()

    def json_rows(self, sql):
        output = self.query(sql)
        return [json.loads(line) for line in output.splitlines()] if output else []

    def metadata(self):
        tables = self.json_rows("SELECT JSON_OBJECT('name',TABLE_NAME,'engine',ENGINE,'kind',TABLE_TYPE) FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY TABLE_NAME;")
        require(tables and any(row['name'] == 'flyway_schema_history' for row in tables), 'Expected migrated application database; never back up an unrelated schema.')
        for row in tables:
            require(IDENT.fullmatch(row['name']) and row['kind'] == 'BASE TABLE' and row['engine'] == 'InnoDB', 'Consistent bundle supports InnoDB application tables only, with no views.')
            row['rows'] = int(self.query('SELECT COUNT(*) FROM `' + row['name'] + '`;'))
        code_objects = self.query("SELECT (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE())+(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE())+(SELECT COUNT(*) FROM information_schema.events WHERE event_schema=DATABASE());")
        require(code_objects == '0', 'Stored routines/triggers/events require a separately reviewed recovery procedure.')
        migrations = self.json_rows("SELECT JSON_OBJECT('installedRank',installed_rank,'version',version,'description',description,'type',type,'script',script,'checksum',checksum,'success',success) FROM flyway_schema_history ORDER BY installed_rank;")
        require(migrations and all(row['success'] == 1 for row in migrations), 'Flyway contains incomplete/failed migrations.')
        require(any(row['name'] == 'fm_media' for row in tables), 'Media migration is required for complete backup.')
        media = self.json_rows("SELECT JSON_OBJECT('mediaId',media_id,'purpose',purpose,'status',status,'storageKey',storage_key,'publicKey',public_key,'sha256',content_sha256,'sizeBytes',size_bytes,'mimeType',mime_type) FROM fm_media ORDER BY media_id;")
        return {'schema': self.schema, 'mysqlVersion': self.query('SELECT VERSION();'), 'tables': tables, 'migrations': migrations, 'mediaRows': media}

    def dump(self, destination):
        command = self.dumper + ['--single-transaction', '--quick', '--skip-lock-tables', '--hex-blob', '--set-gtid-purged=OFF', '--no-tablespaces', '--column-statistics=0', '--skip-add-drop-table', '--skip-add-locks', '--skip-comments', '--skip-dump-date', '--order-by-primary', self.schema]
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as output:
            result = subprocess.run(command, stdout=output, stderr=subprocess.PIPE)
        require(result.returncode == 0, 'mysqldump failed; private partial file retained. No database contents or credentials were printed.')
        return sql_details(destination)

    @contextmanager
    def read_lock(self):
        """A persistent, separate root connection owns and releases the global lock."""
        command = self.root_client + ['--batch', '--raw', '--skip-column-names', '--unbuffered', '--connect-timeout=5']
        with tempfile.TemporaryFile() as errors:
            proc = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True)
            try:
                proc.stdin.write("SET SESSION lock_wait_timeout=15; FLUSH TABLES WITH READ LOCK; SELECT 'FRESH_MALL_READ_LOCK_HELD';\n")
                proc.stdin.flush()
                with selectors.DefaultSelector() as ready:
                    ready.register(proc.stdout, selectors.EVENT_READ)
                    require(ready.select(timeout=20), 'Timed out acquiring the consistent database read lock.')
                require(proc.stdout.readline().strip() == 'FRESH_MALL_READ_LOCK_HELD' and proc.poll() is None, 'Could not acquire the consistent database read lock.')
                yield
                require(proc.poll() is None, 'Database lock connection was lost; bundle must not be accepted.')
            finally:
                if proc.poll() is None:
                    try:
                        proc.communicate('UNLOCK TABLES;\nquit\n', timeout=10)
                    except (subprocess.TimeoutExpired, BrokenPipeError):
                        proc.terminate()  # Only the child created immediately above, never the database server.
                        proc.wait(timeout=10)

    def new_schema(self, schema):
        require(SCHEMA.fullmatch(schema), 'Recovery requires a new fresh_mall_restore_<unique> schema, never an existing application database.')
        count = self.query("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='" + schema + "';", server=True)
        require(count == '0', 'Recovery schema already exists. No data was dropped, overwritten or imported.')
        self.query('CREATE DATABASE `' + schema + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;', server=True)
        return MysqlDatabase(self.root_client, self.dumper, schema, root_client=self.root_client)

    def import_sql(self, sql):
        with regular_reader(sql, private=True) as source:
            # The driver must supply a newly created schema-scoped client here;
            # root is only for new-schema/account setup, never replaying dump SQL.
            require(self.client != self.root_client, 'Refuse to replay a backup through unrestricted root credentials.')
            result = subprocess.run(self.client + ['--binary-mode=1', '--connect-timeout=5', self.schema], stdin=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        require(result.returncode == 0, 'Recovery SQL import failed. The new isolated schema was retained for inspection; no original schema was changed.')

    def verify_restored(self, manifest, work):
        expected, actual = manifest['database'], self.metadata()
        for name in ('tables', 'migrations', 'mediaRows'):
            require(actual[name] == expected[name], 'Restored database ' + name + ' differs from the authenticated snapshot.')
        verification_dump = Path(work) / 'recovered-verification.sql'
        details = self.dump(verification_dump)
        require(details == manifest['sql'], 'Restored SQL round-trip hash differs; recovery is not accepted.')
        return actual
