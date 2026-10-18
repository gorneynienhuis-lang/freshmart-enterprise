#!/usr/bin/env python3
"""Complete local demo backup and isolated recovery. Never resets the main schema.

Only backup --pause-backend may stop the verified managed demo backend; it
restarts it iff it was running. Recovery owns a separate schema, credentials,
media directory, port and process record. No default restore destination exists.
"""
import argparse
import datetime as dt
import hashlib
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import signal
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlparse
import urllib.request
import uuid

from backup_bundle import (BackupError, canonical, extract_media, file_hash, inspect_media, integrity_key,
                           make_bundle, no_symlink_ancestors, private_dir, private_write, require,
                           publish_bundle, regular_reader, unpack_sql, verify_bundle)
from backup_database import MysqlDatabase, SCHEMA, grant_schema

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
DEFAULT_KEY = RUNTIME / 'backup-integrity.key'


def runtime():
    spec = importlib.util.spec_from_file_location('owned_demo_runtime', ROOT / 'scripts/demo-runtime.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def local_database():
    demo = runtime()
    require(demo.owned('mysql') is not None, 'The source MySQL must be the verified managed local demo process.')
    for file in ('mysql-root.cnf', 'demo.env'):
        require((RUNTIME / file).is_file() and not (RUNTIME / file).is_symlink() and (RUNTIME / file).stat().st_mode & 0o777 == 0o600, 'Private local database configuration is missing or has unsafe permissions.')
    root = [str(demo.MYSQL / 'bin/mysql'), '--defaults-file=' + str(RUNTIME / 'mysql-root.cnf')]
    dump = [str(demo.MYSQL / 'bin/mysqldump'), '--defaults-file=' + str(RUNTIME / 'mysql-root.cnf')]
    db = MysqlDatabase(root, dump, 'fresh_mall_demo')
    require(Path(db.query('SELECT @@datadir;')).resolve() == demo.DATA.resolve(), 'Database identity does not match the managed local data directory.')
    return demo, db


def media_root(demo):
    configured = demo.load_env().get('APP_MEDIA_DIR', str(RUNTIME / 'media'))
    path = Path(configured)
    return no_symlink_ancestors(path if path.is_absolute() else ROOT / path)


def version_metadata():
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True)
    tracked = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=ROOT, capture_output=True, text=True)
    jar = runtime().JAR
    require(jar.is_file(), 'Build artifact missing; no backup may claim a reproducible application version.')
    return {'gitCommit': commit.stdout.strip() if commit.returncode == 0 else None,
            'trackedChangesPresent': bool(tracked.stdout.strip()), 'jarSha256': file_hash(jar),
            'migrationSourceSha256': {p.name: file_hash(p) for p in sorted((ROOT / 'database/migrations').glob('V*.sql'))}}


def inspect(args):
    demo, db = local_database()
    metadata = db.metadata()
    files = inspect_media(media_root(demo), metadata['mediaRows'])
    counts = {scope: sum(file['path'].startswith(scope + '/') for file in files) for scope in ('product', 'private', 'review-public')}
    print(json.dumps({'status': 'PREFLIGHT_ONLY_NOT_A_BACKUP', 'backendManagedRunning': bool(demo.owned('backend')),
                      'tables': len(metadata['tables']), 'migrationVersions': [row['version'] for row in metadata['migrations']],
                      'mediaFilesByScope': counts, 'databaseRows': sum(row['rows'] for row in metadata['tables']),
                      'writesStopped': False, 'databaseReadLockHeld': False}, ensure_ascii=False))


def backup(args):
    demo, db = local_database()
    existing = demo.owned('backend')
    require(existing is not None or demo.port_available(8080), 'An unowned backend occupies the source port; no process was stopped.')
    require(not existing or args.pause_backend, 'Backend is running. Use --pause-backend only in an explicitly reserved maintenance window.')
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = no_symlink_ancestors(args.output or RUNTIME / 'backups' / ('fresh-mall-' + stamp))
    require(not destination.exists(), 'Backup destination already exists; no source process was paused.')
    key = integrity_key(args.integrity_key, create=True)
    paused = False
    try:
        if existing:
            # Preserve existing stop/start identity checks and never stop MySQL or Vite.
            demo.stop('backend')
            paused = True
        require(demo.owned('backend') is None and demo.port_available(8080), 'Backend did not remain stopped; consistent backup refused.')
        work = private_dir(RUNTIME / 'backup-work' / ('capture-' + uuid.uuid4().hex), new=True)
        with db.read_lock():
            before = db.metadata()
            sql = work / 'database.sql'
            db.dump(sql)
            metadata = {'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'source': version_metadata(),
                        'database': before, 'consistency': {'applicationWriters': 'verified managed backend stopped',
                        'database': 'global read lock held across metadata, dump and media capture',
                        'mediaScopes': ['product', 'private', 'review-public']}}
            manifest = make_bundle(work / 'bundle', sql, media_root(demo), metadata, key)
            require(db.metadata() == before and demo.owned('backend') is None and demo.port_available(8080), 'Source changed during capture; private partial bundle is not accepted.')
            publish_bundle(work / 'bundle', destination)
        print(json.dumps({'status': 'BACKUP_VERIFIED_NOT_YET_RESTORED', 'bundle': str(destination),
                          'mediaFiles': len(manifest['mediaFiles']), 'tables': len(before['tables']),
                          'integrityKeyStoredSeparately': True, 'mainDatabaseChanged': False}))
    finally:
        if paused:
            demo.start_backend(True)  # Original running state only; no build, seed import or frontend change.


def verify(args):
    manifest = verify_bundle(args.bundle, integrity_key(args.integrity_key))
    print(json.dumps({'status': 'AUTHENTICATED_BUNDLE_VALID_NOT_YET_RESTORED', 'mediaFiles': len(manifest['mediaFiles']),
                      'migrationVersions': [row['version'] for row in manifest['database']['migrations']]}))


def read_report(directory):
    directory = no_symlink_ancestors(directory)
    require(directory.is_dir() and (directory / 'recovery.json').is_file(), 'Select an existing isolated recovery directory.')
    with regular_reader(directory / 'recovery.json', private=True) as source:
        data = json.load(source)
    require(data['status'] == 'RESTORED_VERIFIED' and SCHEMA.fullmatch(data['schema']), 'Recovery has not passed database/media verification.')
    require(Path(data['mediaDirectory']).parent == directory, 'Recovery media directory was moved or changed.')
    return data


def recovery_environment(directory, record):
    with regular_reader(directory / 'backend.env.json', private=True) as source:
        env = json.load(source)
    origin = 'http://127.0.0.1:' + str(record['port'])
    require(env['DB_URL'].split('?', 1)[0] == 'jdbc:mysql://127.0.0.1:3306/' + record['schema']
            and re.fullmatch(r'fmrec_[a-f0-9]{16}', env['DB_USERNAME'])
            and re.fullmatch(r'[a-f0-9]{48}', env['DB_PASSWORD'])
            and env['APP_MEDIA_DIR'] == str(directory / 'media')
            and env['APP_PUBLIC_ORIGIN'] == env['APP_ALLOWED_ORIGINS'] == origin
            and env['SPRING_PROFILES_ACTIVE'] == 'demo'
            and env['SERVER_ADDRESS'] == '127.0.0.1' and env['SERVER_PORT'] == str(record['port']),
            'Recovery environment differs from its isolated schema, user, media or loopback endpoint; no process was started.')
    return env


def restore(args):
    require(args.confirm_isolated_schema == args.schema and SCHEMA.fullmatch(args.schema), 'Explicit matching --confirm-isolated-schema is required for a fresh_mall_restore_<unique> target.')
    key = integrity_key(args.integrity_key)
    manifest = verify_bundle(args.bundle, key)  # Authenticate and check all bytes before touching any target.
    require(isinstance(manifest.get('source', {}).get('jarSha256'), str), 'Local recovery runtime validation requires the local captured JAR fingerprint; cloud image bundles need a separately matched immutable image runtime.')
    demo, source = local_database()
    directory = no_symlink_ancestors(args.recovery_directory)
    media = no_symlink_ancestors(args.media_directory)
    require(media == directory / 'media' and media != media_root(demo), 'Use the explicit new recovery-directory/media target, never the live media store.')
    require(not directory.exists(), 'Recovery directory exists; credentials and files were not overwritten.')
    require(1024 <= args.port <= 65535 and args.port not in (3306, 5173, 8080) and demo.port_available(args.port), 'Choose an unused independent loopback port.')
    private_dir(directory, new=True)
    record = {'status': 'RESTORE_IN_PROGRESS', 'startedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'schema': args.schema, 'bundle': str(no_symlink_ancestors(args.bundle)), 'mediaDirectory': str(media),
              'port': args.port, 'sourceJarSha256': manifest['source']['jarSha256'], 'mainDatabaseChanged': False}
    try:
        source.new_schema(args.schema)
        user, password = 'fmrec_' + secrets.token_hex(8), secrets.token_hex(24)
        # Root creates a fresh scope, but never replays the SQL. Even a signed
        # dump cannot alter the original database through the import credential.
        source.query("CREATE USER '" + user + "'@'localhost' IDENTIFIED BY '" + password + "'; GRANT ALL PRIVILEGES ON " + grant_schema(args.schema) + ".* TO '" + user + "'@'localhost';", server=True)
        cnf = directory / 'mysql-recovery.cnf'
        private_write(cnf, '[client]\nuser=' + user + '\npassword=' + password + '\nprotocol=socket\nsocket=' + str(demo.SOCKET) + '\ndefault-character-set=utf8mb4\n')
        target = MysqlDatabase([str(demo.MYSQL / 'bin/mysql'), '--defaults-file=' + str(cnf)],
                               [str(demo.MYSQL / 'bin/mysqldump'), '--defaults-file=' + str(cnf)], args.schema, root_client=source.root_client)
        sql = directory / 'restore.sql'
        unpack_sql(args.bundle, sql)
        extract_media(args.bundle, media, manifest)
        target.import_sql(sql)
        target.verify_restored(manifest, directory)
        origin = 'http://127.0.0.1:' + str(args.port)
        env = {'DB_URL': 'jdbc:mysql://127.0.0.1:3306/' + args.schema + '?serverTimezone=UTC&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true',
               'DB_USERNAME': user, 'DB_PASSWORD': password, 'APP_TOKEN_SECRET': secrets.token_hex(32), 'SANDBOX_SECRET': secrets.token_hex(32),
               'APP_MEDIA_DIR': str(media), 'APP_PUBLIC_ORIGIN': origin, 'APP_ALLOWED_ORIGINS': origin, 'APP_SECURE_COOKIES': 'false',
               'SPRING_PROFILES_ACTIVE': 'demo', 'SERVER_ADDRESS': '127.0.0.1', 'SERVER_PORT': str(args.port)}
        private_write(directory / 'backend.env.json', canonical(env))
        record.update(status='RESTORED_VERIFIED', verifiedAt=dt.datetime.now(dt.timezone.utc).isoformat(),
                      tables=len(manifest['database']['tables']), mediaFiles=len(manifest['mediaFiles']),
                      sqlRoundTripSha256=manifest['sql']['uncompressedSha256'], migrationVersions=[row['version'] for row in manifest['database']['migrations']],
                      browserSessions='New recovery signing keys intentionally invalidate backed-up bearer/refresh signatures.')
    except Exception:
        record['status'] = 'FAILED_ISOLATED_TARGET_RETAINED'
        raise
    finally:
        private_write(directory / 'recovery.json', canonical(record))
    print(json.dumps({'status': record['status'], 'recoveryDirectory': str(directory), 'schema': args.schema, 'mediaFiles': record['mediaFiles'],
                      'mainDatabaseChanged': False, 'next': 'start-recovery, verify-http, then stop-recovery; no main-service switch is automatic'}))


def recovery_process(directory, demo):
    file = directory / 'process.json'
    if not file.exists():
        return None
    record = json.loads(file.read_text())
    identity = demo.process_identity(record['pid'])
    return record if identity and identity == record['identity'] and record['marker'] in identity and str(directory / 'media') in identity else None


def start_recovery(args):
    directory = no_symlink_ancestors(args.recovery_directory)
    record = read_report(directory)
    demo, _ = local_database()
    require(not recovery_process(directory, demo), 'Recovery backend is already running.')
    require(demo.port_available(record['port']), 'Recovery port is occupied by another process; nothing was stopped.')
    require(file_hash(demo.JAR) == record['sourceJarSha256'], 'Recovery JAR differs from the captured version. Do not silently test a different schema/application pair.')
    env = os.environ.copy()
    env.update(recovery_environment(directory, record))
    for secret in ('DB_ROOT_PASSWORD', 'APP_DEMO_PASSWORD', 'MYSQL_PWD'):
        env.pop(secret, None)
    if not env.get('JAVA_HOME') and sys.platform == 'darwin':
        result = subprocess.run(['/usr/libexec/java_home', '-v', '21'], capture_output=True, text=True)
        require(result.returncode == 0, 'Java 21 not found.')
        env['JAVA_HOME'] = result.stdout.strip()
    java = str(Path(env['JAVA_HOME']) / 'bin/java') if env.get('JAVA_HOME') else 'java'
    version = subprocess.run([java, '-version'], capture_output=True, text=True)
    require(version.returncode == 0 and 'version "21.' in version.stderr, 'Java 21 is required for the isolated recovery backend.')
    origin = env['APP_PUBLIC_ORIGIN']
    command = [java, '-jar', str(demo.JAR), '--server.address=127.0.0.1', '--server.port=' + str(record['port']),
               '--spring.profiles.active=demo', '--app.allowed-origins=' + origin, '--app.public-origin=' + origin,
               '--app.media-dir=' + str(directory / 'media'), '--app.secure-cookies=false']
    log = directory / 'backend.log'
    fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    with os.fdopen(fd, 'ab') as output:
        child = subprocess.Popen(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    time.sleep(0.2)
    identity = demo.process_identity(child.pid)
    marker = '--server.port=' + str(record['port'])
    require(child.poll() is None and marker in identity and str(directory / 'media') in identity, 'Recovery process failed its ownership identity check; inspect private recovery log.')
    file = directory / 'process.json'
    if file.exists():
        file.unlink()  # A stale record only, after confirming no owned process and unused port.
    private_write(file, canonical({'pid': child.pid, 'identity': identity, 'marker': marker}))
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    end = time.monotonic() + 120
    while time.monotonic() < end:
        require(recovery_process(directory, demo) is not None, 'Recovery backend exited; inspect its private log.')
        try:
            with opener.open(origin + '/actuator/health', timeout=2) as response:
                if json.load(response).get('status') == 'UP':
                    print(json.dumps({'status': 'RECOVERY_BACKEND_UP', 'origin': origin, 'schema': record['schema'], 'mainServicesUntouched': True}))
                    return
        except Exception:
            pass
        time.sleep(0.5)
    raise BackupError('Recovery backend health timed out. Its owned process remains available for inspection or stop-recovery.')


def stop_recovery(args):
    directory = no_symlink_ancestors(args.recovery_directory)
    read_report(directory)
    demo = runtime()
    record = recovery_process(directory, demo)
    require(record is not None, 'No matching owned recovery process; no signal was sent.')
    os.kill(record['pid'], signal.SIGTERM)
    end = time.monotonic() + 30
    while time.monotonic() < end and recovery_process(directory, demo):
        time.sleep(0.25)
    require(not recovery_process(directory, demo), 'Owned recovery did not stop; no forced kill was sent.')
    (directory / 'process.json').unlink()
    print('Owned recovery backend stopped. Main services, original credentials and both database schemas were retained.')


class HttpClient:
    def __init__(self, origin):
        self.origin, self.token, self.csrf = origin, None, None
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def request(self, method, route, body=None, *, expected=200, bearer=True):
        url = self.origin + route
        headers = {'Origin': self.origin}
        if self.token and bearer:
            headers['Authorization'] = 'Bearer ' + self.token
        if method == 'POST' and self.csrf:
            headers['X-CSRF-Token'] = self.csrf
        if body is not None:
            headers['Content-Type'] = 'application/json'
        req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            response = self.opener.open(req, timeout=10)
        except HTTPError as error:
            response = error
        data = response.read()
        require(response.status in ((expected,) if isinstance(expected, int) else expected), 'Recovery HTTP verification failed: ' + method + ' ' + route.split('?')[0] + ' status ' + str(response.status))
        if response.headers.get('Content-Type', '').startswith('image/'):
            return data, response.headers
        return json.loads(data), response.headers

    def login(self, phone, password):
        self.csrf = self.request('GET', '/api/v1/auth/csrf', bearer=False)[0]['data']['csrfToken']
        value = self.request('POST', '/api/v1/auth/login', {'phone': phone, 'password': password}, bearer=False)[0]['data']
        require(not value['user']['mustChangePassword'], 'Recovery verification account requires password change; do not change the original account.')
        self.token = value['accessToken']


def verify_http(args):
    directory = no_symlink_ancestors(args.recovery_directory)
    record = read_report(directory)
    demo, source = local_database()
    require(recovery_process(directory, demo), 'Start the owned isolated recovery backend first.')
    env = recovery_environment(directory, record)
    origin = env['APP_PUBLIC_ORIGIN']
    db = MysqlDatabase(source.root_client, source.dumper, record['schema'])
    rows = db.json_rows("SELECT JSON_OBJECT('id',media_id,'purpose',purpose,'owner',owner_id,'public',public_key,'sha256',content_sha256) FROM fm_media WHERE status='READY' ORDER BY media_id;")
    private = next((row for row in rows if row['purpose'] == 'AFTERSALE' and row['owner'] != 'demo-member'), None)
    product = next((row for row in rows if row['purpose'] == 'PRODUCT'), None)
    review = next((row for row in rows if row['purpose'] == 'REVIEW' and row['public']), None)
    assigned = db.json_rows("SELECT JSON_OBJECT('id',m.media_id,'sha256',m.content_sha256) FROM fm_media m JOIN fm_aftersale_evidence e ON e.media_id=m.media_id JOIN fm_aftersale a ON a.aftersale_id=e.aftersale_id WHERE a.assignee_id='demo-service' AND m.purpose='AFTERSALE' AND m.status='READY' AND m.owner_id<>'demo-service' ORDER BY m.media_id LIMIT 1;")
    require(product and review and private and assigned, 'Full image/permission acceptance needs recovered product, published review, private evidence and a demo-service assigned evidence. Create synthetic fixtures in the source before the next backup; do not fabricate them in recovery.')
    accounts = (RUNTIME / 'demo-accounts.txt').read_text()
    match = re.search(r'^Password\s*:\s*(.+)$', accounts, re.M)
    require(match is not None, 'Private local demo account password unavailable.')
    guest, member, service = HttpClient(origin), HttpClient(origin), HttpClient(origin)
    # Prove the import/runtime account cannot even SELECT the live source schema.
    command = [str(demo.MYSQL / 'bin/mysql'), '--defaults-file=' + str(directory / 'mysql-recovery.cnf'), record['schema']]
    own = subprocess.run(command, input='SELECT 1;', capture_output=True, text=True)
    denied = subprocess.run(command, input='SELECT COUNT(*) FROM fresh_mall_demo.fm_user;', capture_output=True, text=True)
    require(own.returncode == 0 and denied.returncode != 0 and ('1142' in denied.stderr or '1044' in denied.stderr), 'Recovery database account isolation did not deny source-schema access.')
    checks = ['schema-scoped recovery database account is explicitly denied SELECT on the original application schema']
    for name, row, scope in [('product', product, 'products'), ('published-review', review, 'reviews')]:
        pixels, headers = guest.request('GET', '/api/v1/media/' + scope + '/' + row['id'] + '/content', bearer=False)
        require(hashlib.sha256(pixels).hexdigest() == row['sha256'] and headers.get('X-Content-Type-Options') == 'nosniff', 'Restored public image bytes or content headers differ from authenticated metadata.')
        checks.append(name + ': actual recovered pixels match original DB SHA-256')
    guest.request('GET', '/api/v1/media/' + private['id'] + '/access', expected=401, bearer=False)
    member.login('13800000001', match[1].strip())
    member.request('GET', '/api/v1/media/' + private['id'] + '/access', expected=404)
    service.login('13800000004', match[1].strip())
    assigned = assigned[0]
    access = service.request('GET', '/api/v1/media/' + assigned['id'] + '/access')[0]['data']
    parsed = urlparse(access['url'])
    require(parsed.scheme + '://' + parsed.netloc == origin, 'Recovered signed media URL escaped the isolated recovery origin.')
    route = parsed.path + '?' + parsed.query
    pixels, headers = service.request('GET', route)
    require(hashlib.sha256(pixels).hexdigest() == assigned['sha256'] and 'no-store' in headers.get('Cache-Control', ''), 'Recovered authorized private bytes/hash/cache policy failed.')
    member.request('GET', route, expected=404)
    guest.request('GET', route, expected=401, bearer=False)
    checks += ['private evidence: anonymous401 and unrelated MEMBER404', 'assigned SERVICE obtains session-bound signed access and correct recovered SHA-256 pixels', 'signed URL cannot be reused by unrelated member or anonymous client']
    result = {'status': 'RESTORED_HTTP_PERMISSION_VERIFIED', 'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
              'schema': record['schema'], 'origin': origin, 'checks': checks, 'mainDatabaseChanged': False,
              'mutations': 'Login sessions and media-access audit events only in the isolated recovered schema; no source writes.'}
    destination = directory / ('http-verification-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
    private_write(destination, canonical(result))
    print(json.dumps(result, ensure_ascii=False))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--integrity-key', type=Path, default=DEFAULT_KEY, help='Original 0600 HMAC key stored separately from the bundle.')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('inspect')
    capture = sub.add_parser('backup')
    capture.add_argument('--pause-backend', action='store_true')
    capture.add_argument('--output', type=Path)
    check = sub.add_parser('verify'); check.add_argument('bundle', type=Path)
    recover = sub.add_parser('restore'); recover.add_argument('bundle', type=Path)
    recover.add_argument('--schema', required=True)
    recover.add_argument('--confirm-isolated-schema', required=True)
    recover.add_argument('--recovery-directory', required=True, type=Path)
    recover.add_argument('--media-directory', required=True, type=Path)
    recover.add_argument('--port', type=int, default=18080)
    for command in ('start-recovery', 'stop-recovery', 'verify-http'):
        child = sub.add_parser(command)
        child.add_argument('--recovery-directory', required=True, type=Path)
    args = parser.parse_args()
    try:
        {'inspect': inspect, 'backup': backup, 'verify': verify, 'restore': restore,
         'start-recovery': start_recovery, 'stop-recovery': stop_recovery, 'verify-http': verify_http}[args.command](args)
    except (BackupError, subprocess.SubprocessError, OSError, ValueError, KeyError) as error:
        # Do not echo subprocess stderr, SQL, environment, cookie, password or tokens.
        message = str(error) if isinstance(error, BackupError) else 'Backup/recovery failed; inspect private files. Original data/credentials were not reset.'
        print(message, file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
