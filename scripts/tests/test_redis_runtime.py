"""Offline lifecycle/security checks; these do not claim a Redis cache hit."""
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('local_redis_runtime', SCRIPTS / 'redis-runtime.py')
redis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(redis)
from backup_bundle import BackupError, private_dir, private_write, canonical


class RedisRuntimeGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=private_dir(SCRIPTS.parent / '.runtime/redis-offline-tests'))
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_namespace_matches_java_fixed_vector_and_changes_for_restore(self):
        values = {'APP_TOKEN_SECRET': '01234567890123456789012345678901', 'DB_URL': 'jdbc:mysql://127.0.0.1/test', 'APP_PUBLIC_ORIGIN': 'http://localhost:18080'}
        self.assertEqual(redis.namespace(values), 'freshmall:cache:v1:ebd18ca31b25fd4aee5d5d0969a8c0955badbdffb0c69ba9a5fef2e5b1f18003')
        changed = dict(values, DB_URL=values['DB_URL'] + '_restore')
        self.assertNotEqual(redis.namespace(values), redis.namespace(changed))
        self.assertNotIn(values['DB_URL'], redis.namespace(values))

    def test_prepare_keeps_unicode_paths_and_acl_secrets_private(self):
        base = private_dir(self.root / '中文目录')
        source = self.root / 'backend.env.json'
        private_write(source, canonical({'APP_TOKEN_SECRET': 'private-test-key', 'DB_URL': 'jdbc:mysql://localhost/test'}))
        binary = self.root / 'redis-server'; private_write(binary, b'verified binary for offline test')
        with patch.object(redis, 'BASE', base), patch.object(redis, 'BINARY', binary), patch.object(redis, 'provision'), patch('builtins.print'):
            redis.prepare(Mock(source_env=source))
        instance = next(base.glob('instance-*'))
        config = (instance / 'redis.conf').read_text()
        self.assertIn('中文目录', config); self.assertNotIn('\\u', config)
        credentials = json.loads((instance / 'credentials.json').read_text())
        app_password = credentials['app']['password']
        self.assertNotIn(app_password, (instance / 'users.acl').read_text())
        self.assertEqual(len(app_password), 64)
        for name in ('credentials.json', 'redis.conf', 'users.acl', 'instance.json', 'client.env.json'):
            self.assertEqual((instance / name).stat().st_mode & 0o777, 0o600)

    def test_source_exports_are_parsed_as_literals_never_executed(self):
        file = self.root / 'source.env'
        private_write(file, "export APP_TOKEN_SECRET='$(touch should-never-exist)'\nexport DB_URL='jdbc:mysql://localhost/test?a=1&b=2'\n")
        self.assertEqual(redis.source_env(file)['APP_TOKEN_SECRET'], '$(touch should-never-exist)')
        self.assertFalse((self.root / 'should-never-exist').exists())

    def test_source_rejects_commands_duplicate_keys_json_nonstring_and_world_readable(self):
        for index, text in enumerate(("source other.env\n", "export APP_TOKEN_SECRET=x\nexport APP_TOKEN_SECRET=y\n", "export APP_TOKEN_SECRET=x y\n")):
            path = self.root / str(index); private_write(path, text)
            with self.assertRaises(BackupError): redis.source_env(path)
        path = self.root / 'bad.json'; private_write(path, canonical({'APP_TOKEN_SECRET': 7, 'DB_URL': 'x'}))
        with self.assertRaises(BackupError): redis.source_env(path)
        path = self.root / 'world.json'; private_write(path, canonical({'APP_TOKEN_SECRET': 'x', 'DB_URL': 'x'})); os.chmod(path, 0o644)
        with self.assertRaises(BackupError): redis.source_env(path)

    def test_source_symlink_and_hardlink_are_rejected(self):
        file = self.root / 'source'; private_write(file, '{}')
        link = self.root / 'link'; link.symlink_to(file)
        with self.assertRaises(BackupError): redis.source_env(link)
        hard = self.root / 'hard'; os.link(file, hard)
        with self.assertRaises(BackupError): redis.source_env(hard)

    def archive(self, name, kind=tarfile.REGTYPE, linkname='', payload=b'int main(){}'):
        file = self.root / ('source-' + str(len(list(self.root.iterdir()))) + '.tar.gz')
        with tarfile.open(file, 'w:gz') as tar:
            entry = tarfile.TarInfo(name); entry.type = kind; entry.linkname = linkname
            entry.size = len(payload) if kind == tarfile.REGTYPE else 0
            tar.addfile(entry, io.BytesIO(payload) if entry.size else None)
        return file

    def test_source_extraction_checks_paths_and_links_before_creating_destination(self):
        for index, file in enumerate((self.archive('../outside'), self.archive('/absolute'), self.archive('wrong-version/file'),
                self.archive('redis-8.2.10/link', tarfile.SYMTYPE, '../outside'), self.archive('redis-8.2.10/hard', tarfile.LNKTYPE, 'file'))):
            target = self.root / ('reject-' + str(index))
            with self.assertRaises(BackupError): redis.extract_source(file, target)
            self.assertFalse(target.exists())

    def test_source_extraction_is_private_and_never_overwrites_existing_directory(self):
        target = self.root / 'source'
        redis.extract_source(self.archive('redis-8.2.10/src/test.c'), target)
        self.assertEqual((target / 'src/test.c').read_bytes(), b'int main(){}')
        self.assertEqual(target.stat().st_mode & 0o777, 0o700)
        self.assertEqual((target / 'src/test.c').stat().st_mode & 0o777, 0o600)
        with self.assertRaises(BackupError): redis.extract_source(self.archive('redis-8.2.10/file'), target)

    def test_download_hash_failure_never_extracts_or_executes_make(self):
        def download(command, **kwargs):
            self.assertEqual(command[0], 'curl')
            output = Path(command[command.index('--output') + 1]); output.write_bytes(b'untrusted source')
            return Mock(returncode=0)
        with patch.object(redis, 'BASE', self.root), patch.object(redis, 'extract_source') as extract, patch.object(redis.subprocess, 'run', side_effect=download) as run:
            with self.assertRaises(BackupError): redis.provision()
            extract.assert_not_called(); self.assertEqual(run.call_count, 1)

    def test_ownership_pid_reuse_and_wrong_marker_are_never_signaled(self):
        private_write(self.root / 'process.json', canonical({'pid': 12345, 'identity': 'old process', 'command': str(redis.BINARY) + ' ' + str(self.root / 'redis.conf')}))
        with patch.object(redis, 'process_identity', return_value='different process'), patch.object(redis.os, 'kill') as kill:
            with self.assertRaises(BackupError): redis.owned(self.root)
            kill.assert_not_called()

    def test_stop_requires_verified_owned_instance_and_does_not_kill_on_verification_failure(self):
        args = Mock(instance=self.root)
        with patch.object(redis, 'verified_instance', side_effect=BackupError('changed config')), patch.object(redis.os, 'kill') as kill:
            with self.assertRaises(BackupError): redis.stop(args)
            kill.assert_not_called()

    def test_occupied_port_refuses_start_before_spawning(self):
        with patch.object(redis, 'verified_instance', return_value=(self.root, {})), patch.object(redis, 'owned', return_value=None), patch.object(redis, 'port_available', return_value=False), patch.object(redis.subprocess, 'Popen') as spawn:
            with self.assertRaises(BackupError): redis.start(Mock(instance=self.root))
            spawn.assert_not_called()

    def test_resp_parser_bounds_and_redacts_error_arguments(self):
        self.assertEqual(redis.resp_read(io.BytesIO(b'-NOPERM cannot access secret-key\r\n')), {'error': 'NOPERM'})
        self.assertEqual(redis.resp_read(io.BytesIO(b'$3\r\nabc\r\n')), 'abc')
        self.assertIsNone(redis.resp_read(io.BytesIO(b'$-1\r\n')))
        for value in (b'$1048577\r\n', b'$3\r\na\r\n', b'*2\r\n', b'+incomplete'):
            with self.assertRaises(BackupError): redis.resp_read(io.BytesIO(value))


if __name__ == '__main__':
    unittest.main()
