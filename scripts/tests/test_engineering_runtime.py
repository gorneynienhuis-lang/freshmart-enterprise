"""Offline target/build/process guards. No Java, services, SQL connections or Git mutations."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch
import zipfile

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('engineering_runtime', SCRIPTS / 'engineering-runtime.py')
runtime = importlib.util.module_from_spec(spec); spec.loader.exec_module(runtime)
from backup_bundle import BackupError, canonical, private_dir, private_write, file_hash


class EngineeringGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=private_dir(SCRIPTS.parent / '.runtime/engineering-offline-tests'))
        self.root = Path(self.temp.name); self.base = private_dir(self.root / '.runtime')
        self.engineering = private_dir(self.base / 'engineering/v030'); self.private = private_dir(self.engineering / 'private')
        self.recovery = private_dir(self.base / 'recoveries/engineering-v030-unit-1234')
        self.media = private_dir(self.recovery / 'media')
        self.build_parent = private_dir(self.base / 'builds'); self.build = private_dir(self.build_parent / '20261018T120000Z-1234abcd')
        self.mysql = self.base / 'mysql-client'; private_write(self.mysql, b'not executable during offline tests')
        self.patches = patch.multiple(runtime, ROOT=self.root, RUNTIME=self.base, ENGINEERING=self.engineering,
                PRIVATE=self.private, ENV_FILE=self.private / 'backend.env.json', PURPOSE_FILE=self.private / 'purpose.json',
                STATE_FILE=self.private / 'process.json', SESSION_INIT=self.private / 'session-safety-init.json',
                SESSION_ATTEMPT=self.private / 'session-safety-init-attempt.json', BUILD_PARENT=self.build_parent, MYSQL=self.mysql)
        self.patches.start()
        self.schema = 'fresh_mall_restore_engineering_unit_test_1234'
        self.env = {'APP_TOKEN_SECRET': 'x' * 64, 'SANDBOX_SECRET': 'y' * 64,
                'DB_URL': 'jdbc:mysql://127.0.0.1:3306/' + self.schema + '?serverTimezone=UTC',
                'DB_USERNAME': 'fmrec_' + 'a' * 16, 'DB_PASSWORD': 'b' * 48,
                'APP_MEDIA_DIR': str(self.media), 'SERVER_PORT': '18081', 'SERVER_ADDRESS': '127.0.0.1',
                'APP_PUBLIC_ORIGIN': 'http://127.0.0.1:18081', 'APP_ALLOWED_ORIGINS': 'http://127.0.0.1:18081',
                'APP_SECURE_COOKIES': 'false', 'SPRING_PROFILES_ACTIVE': 'demo', 'APP_COMMERCE_JOBS_ENABLED': 'false'}
        self.purpose = {'purpose': runtime.PURPOSE, 'schema': self.schema, 'port': 18081,
                        'sourceRecovery': str(self.recovery), 'sourceDatabaseChanged': False}
        self.original = {'status': 'RESTORED_VERIFIED', 'schema': self.schema, 'port': 18081,
                         'mediaDirectory': str(self.media), 'sourceJarSha256': 'c' * 64, 'migrationVersions': ['001']}
        private_write(self.private / 'purpose.json', canonical(self.purpose))
        private_write(self.private / 'backend.env.json', canonical(self.env))
        private_write(self.recovery / 'recovery.json', canonical(self.original))
        private_write(self.recovery / 'mysql-recovery.cnf', '[client]\nuser=' + self.env['DB_USERNAME'] + '\npassword=' + self.env['DB_PASSWORD'] + '\nprotocol=socket\nsocket=' + str(self.base / 'mysql.sock') + '\ndefault-character-set=utf8mb4\n')
        sources = {'backend/pom.xml': b'<project/>', 'backend/src/main/java/com/freshmart/FreshMartApplication.java': b'class FreshMartApplication {}',
                   'database/migrations/V001__initial.sql': b'CREATE TABLE example(id int);'}
        self.hashes = {}
        for name, content in sources.items():
            file = self.build / name; private_dir(file.parent); private_write(file, content); self.hashes[name] = file_hash(file)
        self.jar = self.build / 'backend/target/fresh-mall-backend-0.1.0-SNAPSHOT.jar'; private_dir(self.jar.parent)
        with zipfile.ZipFile(self.jar, 'w') as archive:
            archive.writestr('BOOT-INF/classes/db/migration/V001__initial.sql', sources['database/migrations/V001__initial.sql'])
        os.chmod(self.jar, 0o600)
        self.source = {'sourceSha256': self.hashes, 'baseCommit': 'd' * 40, 'copiedAt': '2026-10-18T12:00:00Z'}
        self.verification = {'status': 'PASSED', 'mavenExitCode': 0, 'directory': str(self.build), 'selectedTests': None,
                'mainJarChanged': False, 'tests': {'tests': 192, 'failures': 0, 'errors': 0},
                'jar': str(self.jar), 'jarSha256': file_hash(self.jar), 'liveSourceChangedDuringBuild': False}
        private_write(self.build / 'source.json', canonical(self.source)); private_write(self.build / 'verification.json', canonical(self.verification))

    def tearDown(self):
        self.patches.stop(); self.temp.cleanup()

    def rewrite(self, file, value):
        file.write_bytes(canonical(value)); os.chmod(file, 0o600)

    def test_valid_target_jobs_flag_can_change_without_replacing_credentials_or_recovery_report(self):
        original_sha = file_hash(self.recovery / 'recovery.json')
        target = runtime.load_target(); self.assertEqual(target['env']['APP_COMMERCE_JOBS_ENABLED'], 'false')
        self.env['APP_COMMERCE_JOBS_ENABLED'] = 'true'; self.rewrite(runtime.ENV_FILE, self.env)
        self.assertEqual(runtime.load_target()['env']['APP_COMMERCE_JOBS_ENABLED'], 'true')
        self.assertEqual(file_hash(self.recovery / 'recovery.json'), original_sha)
        self.assertEqual(runtime.load_target()['env']['DB_PASSWORD'], self.env['DB_PASSWORD'])

    def test_main_schema_main_port_wildcard_bind_and_prod_are_refused(self):
        for field, value in [('DB_URL', 'jdbc:mysql://127.0.0.1:3306/fresh_mall_demo'), ('SERVER_PORT', '8080'),
                             ('SERVER_ADDRESS', '0.0.0.0'), ('SPRING_PROFILES_ACTIVE', 'production')]:
            self.rewrite(runtime.ENV_FILE, dict(self.env, **{field: value}))
            with self.assertRaises(BackupError): runtime.load_target()

    def test_unknown_spring_java_options_and_jdbc_session_overrides_are_refused(self):
        for field in ('SPRING_DATASOURCE_URL', 'JAVA_TOOL_OPTIONS', 'SPRING_CONFIG_LOCATION'):
            self.rewrite(runtime.ENV_FILE, dict(self.env, **{field: 'unapproved'}))
            with self.assertRaises(BackupError): runtime.load_target()
        for suffix in ('&sessionVariables=sql_mode=ANSI', '&serverTimezone=UTC', '&allowLoadLocalInfile=true'):
            self.rewrite(runtime.ENV_FILE, dict(self.env, DB_URL=self.env['DB_URL'] + suffix))
            with self.assertRaises(BackupError): runtime.load_target()

    def test_cors_only_accepts_isolated_loopback_origins(self):
        self.rewrite(runtime.ENV_FILE, dict(self.env, APP_ALLOWED_ORIGINS='http://127.0.0.1:18081,http://localhost:15173'))
        runtime.load_target()
        for origins in ('*', 'https://example.com,http://127.0.0.1:18081', 'http://localhost:5173,http://127.0.0.1:18081'):
            self.rewrite(runtime.ENV_FILE, dict(self.env, APP_ALLOWED_ORIGINS=origins))
            with self.assertRaises(BackupError): runtime.load_target()

    def test_wrong_purpose_recovery_media_or_credentials_are_refused(self):
        self.rewrite(runtime.PURPOSE_FILE, dict(self.purpose, purpose='main-demo'))
        with self.assertRaises(BackupError): runtime.load_target()
        self.rewrite(runtime.PURPOSE_FILE, self.purpose)
        for field, value in [('APP_MEDIA_DIR', str(self.base / 'media')), ('DB_PASSWORD', 'f' * 48)]:
            self.rewrite(runtime.ENV_FILE, dict(self.env, **{field: value}))
            with self.assertRaises(BackupError): runtime.load_target()

    def test_world_readable_and_symlink_environment_are_refused(self):
        os.chmod(runtime.ENV_FILE, 0o644)
        with self.assertRaises(BackupError): runtime.load_target()
        runtime.ENV_FILE.rename(self.private / 'original.json')
        runtime.ENV_FILE.symlink_to(self.private / 'original.json')
        with self.assertRaises(BackupError): runtime.load_target()

    def test_media_symlink_and_inconsistent_redis_aliases_are_refused(self):
        link = self.media / 'private'; link.symlink_to(self.root)
        with self.assertRaises(BackupError): runtime.load_target()
        link.unlink()
        env = dict(self.env, REDIS_HOST='127.0.0.1', REDIS_PORT='16379', REDIS_USERNAME='catalog_app', REDIS_PASSWORD='one',
                   SPRING_DATA_REDIS_HOST='127.0.0.1', SPRING_DATA_REDIS_PORT='16379', SPRING_DATA_REDIS_USERNAME='catalog_app', SPRING_DATA_REDIS_PASSWORD='two')
        self.rewrite(runtime.ENV_FILE, env)
        with self.assertRaises(BackupError): runtime.load_target()

    def test_verified_source_snapshot_has_matching_jar_and_packaged_migrations(self):
        data = runtime.build_snapshot(self.build)
        self.assertEqual(data['jar'], self.jar); self.assertEqual(data['migrationVersions'], ['001'])

    def test_failed_selected_or_missing_test_builds_are_refused(self):
        for changes in ({'status': 'FAILED'}, {'selectedTests': 'OnlyOneTest'}, {'tests': {'tests': 0, 'failures': 0, 'errors': 0}},
                        {'tests': {'tests': 192, 'failures': 0, 'errors': 1}}, {'mainJarChanged': True}):
            self.rewrite(self.build / 'verification.json', dict(self.verification, **changes))
            with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_main_jar_build_path_and_world_readable_manifest_are_refused(self):
        with self.assertRaises(BackupError): runtime.build_snapshot(self.root / 'backend/target')
        self.rewrite(self.build / 'verification.json', dict(self.verification, jar=str(self.root / 'backend/target/main.jar')))
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)
        self.rewrite(self.build / 'verification.json', self.verification); os.chmod(self.build / 'source.json', 0o644)
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_modified_jar_source_and_unlisted_extra_source_are_refused(self):
        self.jar.write_bytes(b'tampered')
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)
        self.rewrite(self.build / 'verification.json', dict(self.verification, jarSha256=file_hash(self.jar)))
        (self.build / 'backend/pom.xml').write_bytes(b'modified')
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_unlisted_extra_and_traversal_source_manifest_are_refused(self):
        extra = self.build / 'backend/src/unlisted.txt'; private_write(extra, 'unlisted')
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)
        extra.unlink()
        self.rewrite(self.build / 'source.json', dict(self.source, sourceSha256=dict(self.hashes, **{'backend/src/../unlisted.txt': 'a' * 64})))
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_packaged_migration_must_match_copied_source_not_just_a_valid_zip(self):
        with zipfile.ZipFile(self.jar, 'w') as archive: archive.writestr('BOOT-INF/classes/db/migration/V001__initial.sql', b'wrong migration')
        self.rewrite(self.build / 'verification.json', dict(self.verification, jarSha256=file_hash(self.jar)))
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_extra_packaged_migration_is_rejected_before_any_application_start(self):
        with zipfile.ZipFile(self.jar, 'a') as archive: archive.writestr('BOOT-INF/classes/db/migration/V999__unlisted.sql', b'unlisted')
        self.rewrite(self.build / 'verification.json', dict(self.verification, jarSha256=file_hash(self.jar)))
        with self.assertRaises(BackupError): runtime.build_snapshot(self.build)

    def test_preflight_validates_without_querying_database_or_starting_process(self):
        with patch.object(runtime, 'listeners', return_value=[]), patch.object(runtime, 'migrations') as query, patch.object(runtime.subprocess, 'Popen') as launch, patch('builtins.print'):
            runtime.preflight(Mock(build=self.build)); query.assert_not_called(); launch.assert_not_called()

    def test_occupied_port_start_never_queries_or_launches_or_signals(self):
        with patch.object(runtime, 'listeners', return_value=[{'pid': 9, 'address': '*:18081'}]), patch.object(runtime, 'migrations') as query, patch.object(runtime.subprocess, 'Popen') as launch, patch.object(runtime.os, 'kill') as kill:
            with self.assertRaises(BackupError): runtime.start(Mock(build=self.build))
            query.assert_not_called(); launch.assert_not_called(); kill.assert_not_called()

    def test_actual_listener_pid_and_address_must_both_match_owned_process(self):
        for listening in ([{'pid': 2, 'address': '127.0.0.1:18081'}], [{'pid': 1, 'address': '*:18081'}],
                          [{'pid': 1, 'address': '127.0.0.1:18081'}, {'pid': 2, 'address': '127.0.0.1:18081'}], []):
            with patch.object(runtime, 'listeners', return_value=listening):
                with self.assertRaises(BackupError): runtime.require_listener({'pid': 1})

    def test_pid_reuse_and_changed_start_command_never_receive_a_signal(self):
        command = ['/java', '-jar', str(self.jar), '--server.address=127.0.0.1', '--server.port=18081',
                   '--spring.config.location=classpath:/application.yml', '--profile=demo']
        state = {'purpose': runtime.PURPOSE, 'schema': self.schema, 'port': 18081, 'host': '127.0.0.1',
                 'jar': str(self.jar), 'jarSha256': file_hash(self.jar), 'command': command, 'expectedCommand': ' '.join(command),
                 'pid': 123, 'identity': 'old start time /java'}
        private_write(runtime.STATE_FILE, canonical(state))
        with patch.object(runtime, 'process_identity', return_value='different start time /java'), patch.object(runtime.os, 'kill') as kill:
            with self.assertRaises(BackupError): runtime.stop(Mock())
            kill.assert_not_called()

    def test_restart_invalid_build_is_rejected_before_stopping_owned_process(self):
        with patch.object(runtime, 'build_snapshot', side_effect=BackupError('not passed')), patch.object(runtime, 'stop') as stop:
            with self.assertRaises(BackupError): runtime.restart(Mock(build=self.build))
            stop.assert_not_called()

    def test_migration_query_uses_scoped_defaults_and_select_only_without_secret_arguments(self):
        target = runtime.load_target()
        output = json.dumps({'schema': self.schema, 'user': self.env['DB_USERNAME']}) + '\n' + json.dumps({'version': '001', 'script': 'V001__initial.sql', 'checksum': 7, 'success': 1}) + '\n'
        with patch.object(runtime.subprocess, 'run', return_value=Mock(returncode=0, stdout=output)) as run:
            self.assertEqual(runtime.migrations(target)[0]['version'], '001')
        arguments, options = run.call_args.args[0], run.call_args.kwargs
        self.assertIn('--defaults-file=' + str(self.recovery / 'mysql-recovery.cnf'), arguments)
        self.assertNotIn(self.env['DB_PASSWORD'], ' '.join(arguments)); self.assertEqual(arguments[-1], self.schema)
        self.assertNotIn('INSERT', options['input']); self.assertNotIn('UPDATE', options['input']); self.assertNotIn('DELETE', options['input'])
        self.assertTrue(options['input'].startswith('SELECT'))

    def test_first_start_revokes_imported_opaque_sessions_exactly_once_and_preserves_raw_restore(self):
        target = runtime.load_target(); original_sha = file_hash(self.recovery / 'recovery.json')
        result = Mock(returncode=0, stdout='{"revokedSessions":7}\n')
        with patch.object(runtime.subprocess, 'run', return_value=result) as run:
            marker = runtime.initialize_sessions(target)
            self.assertEqual(marker['revokedSessions'], 7)
            self.assertEqual(runtime.initialize_sessions(target), marker)
            self.assertEqual(run.call_count, 1)
        command, options = run.call_args.args[0], run.call_args.kwargs
        self.assertEqual(command[-1], self.schema)
        self.assertNotIn(self.env['DB_PASSWORD'], ' '.join(command))
        self.assertIn("UPDATE fm_auth_session SET status='REVOKED' WHERE status='ACTIVE'", options['input'])
        self.assertNotIn('fm_user', options['input']); self.assertNotIn('DELETE', options['input'])
        self.assertEqual(file_hash(self.recovery / 'recovery.json'), original_sha)
        self.assertEqual(runtime.SESSION_INIT.stat().st_mode & 0o777, 0o600)

    def test_failed_or_uncertain_session_initialization_is_not_automatically_retried(self):
        target = runtime.load_target()
        with patch.object(runtime.subprocess, 'run', return_value=Mock(returncode=1, stdout='')) as run:
            with self.assertRaises(BackupError): runtime.initialize_sessions(target)
            self.assertTrue(runtime.SESSION_ATTEMPT.exists()); self.assertFalse(runtime.SESSION_INIT.exists())
            with self.assertRaises(BackupError): runtime.initialize_sessions(target)
            self.assertEqual(run.call_count, 1)

    def test_session_marker_cannot_be_reused_for_another_schema_or_forged_count(self):
        private_write(runtime.SESSION_INIT, canonical({'status': 'INITIALIZED', 'binding': {'schema': 'fresh_mall_demo'},
                                                      'revokedSessions': 0, 'completedAt': '2026-10-18'}))
        with patch.object(runtime.subprocess, 'run') as run:
            with self.assertRaises(BackupError): runtime.initialize_sessions(runtime.load_target())
            run.assert_not_called()

    def test_lifecycle_mutation_lock_refuses_parallel_start_without_changing_state(self):
        with runtime.mutation_lock():
            with self.assertRaises(BackupError):
                with runtime.mutation_lock(): self.fail('Must not obtain a second nonblocking lifecycle lock')
        self.assertFalse(runtime.STATE_FILE.exists())


if __name__ == '__main__':
    unittest.main()
