"""Recovery session safety initialization; no server and no business credentials."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from backup_bundle import BackupError, private_dir, private_write
spec = importlib.util.spec_from_file_location('recovery_sessions_driver', SCRIPTS / 'demo-backup.py')
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)


class RecoverySessions(unittest.TestCase):
    def setUp(self):
        self.base = private_dir(SCRIPTS.parent / '.runtime/backup-unit-tests')
        self.temp = tempfile.TemporaryDirectory(dir=self.base)
        self.directory = Path(self.temp.name)
        self.record = {'schema': 'fresh_mall_restore_test_abcdef', 'sqlRoundTripSha256': 'a' * 64}
        self.env = {'DB_USERNAME': 'fmrec_' + 'a' * 16}
        self.demo = SimpleNamespace(MYSQL=Path('/nonexistent-local-mysql'))
        self.database = Mock()

    def tearDown(self):
        self.temp.cleanup()

    def initialize(self):
        return driver.initialize_recovery_sessions(self.directory, self.record, self.demo, self.env)

    def test_valid_initialization_is_separate_and_restart_never_repeats_revocation(self):
        original = dict(self.record)
        self.database.query.side_effect = [self.record['schema'], self.env['DB_USERNAME'] + '@localhost', '4']
        with patch.object(driver, 'MysqlDatabase', return_value=self.database) as factory:
            self.initialize()
            marker = json.loads((self.directory / 'session-initialization.json').read_text())
            self.assertEqual(marker['revokedActiveSessions'], 4)
            self.assertEqual(marker['status'], 'COMPLETED')
            self.assertEqual(self.record, original)
            self.assertIn("WHERE status='ACTIVE'", self.database.query.call_args.args[0])
            self.initialize()
            self.assertEqual(factory.call_count, 1)
            self.assertEqual(self.database.query.call_count, 3)

    def test_main_database_is_rejected_before_any_connection(self):
        self.record['schema'] = 'fresh_mall_demo'
        with patch.object(driver, 'MysqlDatabase') as factory:
            with self.assertRaises(BackupError): self.initialize()
            factory.assert_not_called()

    def test_root_or_wrong_user_cannot_modify_sessions(self):
        self.database.query.side_effect = [self.record['schema'], 'root@localhost']
        with patch.object(driver, 'MysqlDatabase', return_value=self.database):
            with self.assertRaises(BackupError): self.initialize()
        self.assertEqual(self.database.query.call_count, 2)
        self.assertFalse((self.directory / 'session-initialization.json').exists())

    def test_uncertain_sql_blocks_start_and_is_never_automatically_replayed(self):
        self.database.query.side_effect = [self.record['schema'], self.env['DB_USERNAME'] + '@localhost', BackupError('uncertain')]
        with patch.object(driver, 'MysqlDatabase', return_value=self.database):
            with self.assertRaises(BackupError): self.initialize()
        marker = json.loads((self.directory / 'session-initialization.json').read_text())
        self.assertEqual(marker['status'], 'PENDING')
        with patch.object(driver, 'MysqlDatabase') as factory:
            with self.assertRaises(BackupError): self.initialize()
            factory.assert_not_called()

    def test_completed_marker_must_match_snapshot_and_schema(self):
        private_write(self.directory / 'session-initialization.json', json.dumps({'status': 'COMPLETED', 'schema': self.record['schema'], 'snapshotSqlSha256': 'b' * 64}))
        with patch.object(driver, 'MysqlDatabase') as factory:
            with self.assertRaises(BackupError): self.initialize()
            factory.assert_not_called()


if __name__ == '__main__':
    unittest.main()
