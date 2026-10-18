"""Database guard tests using no server and no external executable."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from backup_bundle import BackupError, private_dir, private_write
from backup_database import MysqlDatabase, grant_schema


class DatabaseGuards(unittest.TestCase):
    def setUp(self):
        self.database = MysqlDatabase(['mysql', '--private-root-config'], ['mysqldump'], 'fresh_mall_demo')
        self.database.query = Mock(return_value='0')

    def test_schema_grant_escapes_literal_underscores(self):
        self.assertEqual(grant_schema('fresh_mall_restore_abc123'), '`fresh\\_mall\\_restore\\_abc123`')
        with self.assertRaises(BackupError):
            grant_schema('fresh_mall_restore_%')

    def test_live_arbitrary_or_injected_schema_never_reaches_query(self):
        for schema in ('fresh_mall_demo', 'fresh_mall', 'mysql', 'fresh_mall_restore_x', 'fresh_mall_restore_valid_123;DROP DATABASE x', 'fresh_mall_restore_../target'):
            with self.assertRaises(BackupError):
                self.database.new_schema(schema)
        self.database.query.assert_not_called()

    def test_existing_target_schema_never_reaches_create(self):
        self.database.query.return_value = '1'
        with self.assertRaises(BackupError):
            self.database.new_schema('fresh_mall_restore_test_123')
        self.assertEqual(self.database.query.call_count, 1)
        self.assertNotIn('CREATE DATABASE', self.database.query.call_args.args[0])

    def test_root_cannot_replay_dump_even_with_explicit_new_target(self):
        base = private_dir(SCRIPTS.parent / '.runtime/backup-unit-tests')
        with tempfile.TemporaryDirectory(dir=base) as temp:
            file = Path(temp) / 'dump.sql'
            private_write(file, 'CREATE TABLE example(id int);\n')
            with self.assertRaisesRegex(BackupError, 'unrestricted root'):
                self.database.import_sql(file)

    def test_failed_counts_or_migrations_never_claim_round_trip_success(self):
        target = MysqlDatabase(['mysql', '--scoped-user'], ['mysqldump'], 'fresh_mall_restore_test_123', root_client=['mysql', '--root-only-setup'])
        target.metadata = Mock(return_value={'tables': [{'name': 'fm_user', 'rows': 2}], 'migrations': [], 'mediaRows': []})
        target.dump = Mock()
        expected = {'database': {'tables': [{'name': 'fm_user', 'rows': 1}], 'migrations': [], 'mediaRows': []}}
        with self.assertRaises(BackupError):
            target.verify_restored(expected, '.')
        target.dump.assert_not_called()


if __name__ == '__main__':
    unittest.main()
