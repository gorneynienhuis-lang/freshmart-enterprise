"""Offline integrity/hostile archive tests. No database, service stop or network."""
import gzip
import hashlib
import hmac
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile
import unittest
import uuid

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))
from backup_bundle import (BackupError, canonical, extract_media, file_hash, inspect_media,
                           integrity_key, make_bundle, private_dir, private_write, verify_bundle)


class BundleTests(unittest.TestCase):
    def setUp(self):
        base = private_dir(SCRIPTS.parent / '.runtime/backup-unit-tests')
        self.temporary = tempfile.TemporaryDirectory(dir=base)
        self.root = private_dir(Path(self.temporary.name))
        self.key = bytes(range(32))
        self.media = private_dir(self.root / 'media')
        self.rows = []
        for purpose in ('PRODUCT', 'REVIEW', 'AFTERSALE'):
            contents = b'unit-test-sanitized-raster-' + purpose.encode()
            storage = ('product/' if purpose == 'PRODUCT' else 'private/') + str(uuid.uuid4()) + '.raster'
            public = storage if purpose == 'PRODUCT' else 'review-public/' + str(uuid.uuid4()) + '.raster' if purpose == 'REVIEW' else None
            for key in set(value for value in (storage, public) if value):
                private_dir((self.media / key).parent)
                private_write(self.media / key, contents)
            self.rows.append({'mediaId': str(uuid.uuid4()), 'purpose': purpose, 'status': 'READY',
                              'storageKey': storage, 'publicKey': public, 'sha256': hashlib.sha256(contents).hexdigest(),
                              'sizeBytes': len(contents), 'mimeType': 'image/png'})
        self.sql = self.root / 'database.sql'
        private_write(self.sql, b'CREATE TABLE `sample` (`id` int NOT NULL PRIMARY KEY);\nINSERT INTO `sample` VALUES (1);\n')
        self.metadata = {'createdAt': '2026-10-18T00:00:00Z', 'source': {'gitCommit': 'abc1234'},
                         'database': {'schema': 'fresh_mall_demo', 'mediaRows': self.rows,
                                      'migrations': [{'version': '011', 'success': 1}], 'tables': [{'name': 'sample', 'rows': 1}]},
                         'consistency': {'applicationWriters': 'offline test fixture'}}
        self.bundle = self.root / 'backup'

    def tearDown(self):
        self.temporary.cleanup()

    def good(self):
        return make_bundle(self.bundle, self.sql, self.media, self.metadata, self.key)

    def resign(self, mutate=None):
        manifest = json.loads((self.bundle / 'manifest.json').read_text())
        for name in ('database.sql.gz', 'media.tar.gz'):
            manifest['artifacts'][name] = {'sizeBytes': (self.bundle / name).stat().st_size, 'sha256': file_hash(self.bundle / name)}
        if mutate:
            mutate(manifest)
        data = canonical(manifest)
        (self.bundle / 'manifest.json').write_bytes(data)
        (self.bundle / 'manifest.hmac').write_text(hmac.new(self.key, data, hashlib.sha256).hexdigest() + '\n')

    def archive(self, entries):
        with tarfile.open(self.bundle / 'media.tar.gz', 'w:gz') as tar:
            for name, kind, contents in entries:
                info = tarfile.TarInfo(name)
                if kind == 'file':
                    info.size = len(contents)
                    tar.addfile(info, io.BytesIO(contents))
                else:
                    info.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
                    info.linkname = '../../outside'
                    tar.addfile(info)
        self.resign()

    def test_round_trip_all_scopes_and_private_permissions(self):
        expected = self.good()
        actual = verify_bundle(self.bundle, self.key)
        self.assertEqual(actual, expected)
        destination = self.root / 'recovered-media'
        extract_media(self.bundle, destination, actual)
        self.assertEqual(inspect_media(destination, self.rows), actual['mediaFiles'])
        self.assertEqual(len(actual['mediaFiles']), 4)
        for parent, dirs, files in os.walk(self.bundle):
            self.assertEqual(Path(parent).stat().st_mode & 0o777, 0o700)
            for file in files:
                self.assertEqual((Path(parent) / file).stat().st_mode & 0o777, 0o600)
        self.assertNotIn('integrity.key', [p.name for p in self.bundle.iterdir()])

    def test_wrong_key_or_modified_manifest_rejected(self):
        self.good()
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, b'X' * 32)
        data = (self.bundle / 'manifest.json').read_bytes().replace(b'abc1234', b'bad4321')
        (self.bundle / 'manifest.json').write_bytes(data)
        with self.assertRaisesRegex(BackupError, 'authentication'):
            verify_bundle(self.bundle, self.key)

    def test_missing_and_extra_bundle_artifacts_rejected(self):
        self.good()
        private_write(self.bundle / 'extra.txt', 'untrusted')
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)
        (self.bundle / 'extra.txt').unlink()
        (self.bundle / 'media.tar.gz').unlink()
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)

    def test_artifact_bytes_changed_rejected(self):
        self.good()
        with (self.bundle / 'media.tar.gz').open('ab') as file:
            file.write(b'corrupted')
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)

    def test_path_traversal_rejected_even_if_manifest_authenticated(self):
        self.good()
        self.archive([('../escape.raster', 'file', b'evil')])
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)
        self.assertFalse((self.root / 'escape.raster').exists())

    def test_symlink_and_hardlink_archives_rejected(self):
        manifest = self.good()
        key = manifest['mediaFiles'][0]['path']
        for kind in ('symlink', 'hardlink'):
            self.archive([(key, kind, b'')])
            with self.assertRaises(BackupError):
                verify_bundle(self.bundle, self.key)

    def test_duplicate_extra_missing_and_wrong_hash_archive_entries(self):
        manifest = self.good()
        entries = [(file['path'], 'file', (self.media / file['path']).read_bytes()) for file in manifest['mediaFiles']]
        variants = [entries + [entries[0]], entries + [('private/' + str(uuid.uuid4()) + '.raster', 'file', b'extra')], entries[:-1],
                    [(entries[0][0], 'file', b'X' * len(entries[0][2]))] + entries[1:]]
        for variant in variants:
            self.archive(variant)
            with self.assertRaises(BackupError):
                verify_bundle(self.bundle, self.key)

    def test_hidden_payload_after_tar_end_marker_is_rejected(self):
        self.good()
        payload = gzip.decompress((self.bundle / 'media.tar.gz').read_bytes())
        # A generic tar reader stops at the first zero block and could overlook
        # this appended second stream; this format requires an exact zero tail.
        (self.bundle / 'media.tar.gz').write_bytes(gzip.compress(payload + b'hidden unlisted data'))
        self.resign()
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)

    def test_database_reference_scope_mismatch_rejected(self):
        self.rows[0]['storageKey'] = self.rows[1]['storageKey']
        with self.assertRaises(BackupError):
            self.good()

    def test_missing_extra_or_corrupt_source_media_rejected(self):
        file = self.media / self.rows[0]['storageKey']
        contents = file.read_bytes()
        file.unlink()
        with self.assertRaises(BackupError):
            self.good()
        private_write(file, contents)
        extra = self.media / ('private/' + str(uuid.uuid4()) + '.raster')
        private_write(extra, b'extra')
        with self.assertRaises(BackupError):
            self.good()
        extra.unlink()
        file.write_bytes(b'wrong')
        with self.assertRaises(BackupError):
            self.good()

    def test_source_and_destination_symlinks_and_nonempty_target_rejected(self):
        self.good()
        link = self.root / 'linked-bundle'; link.symlink_to(self.bundle, target_is_directory=True)
        with self.assertRaises(BackupError):
            verify_bundle(link, self.key)
        destination = private_dir(self.root / 'existing-media')
        private_write(destination / 'keep', 'existing user file')
        with self.assertRaises(BackupError):
            extract_media(self.bundle, destination, self.good_manifest())
        self.assertEqual((destination / 'keep').read_text(), 'existing user file')
        target = self.root / 'linked-media'; target.symlink_to(destination, target_is_directory=True)
        with self.assertRaises(BackupError):
            extract_media(self.bundle, target, self.good_manifest())

    def good_manifest(self):
        return verify_bundle(self.bundle, self.key)

    def test_source_hardlink_and_source_directory_symlink_rejected(self):
        source = self.media / self.rows[0]['storageKey']
        os.link(source, self.root / 'hardlinked-raster')
        with self.assertRaises(BackupError):
            inspect_media(self.media, self.rows)
        (self.root / 'hardlinked-raster').unlink()
        shutil.rmtree(self.media / 'review-public')
        (self.media / 'review-public').symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(BackupError):
            inspect_media(self.media, self.rows)

    def test_sql_selecting_live_database_rejected_before_bundle(self):
        self.sql.write_bytes(b'USE fresh_mall_demo;\nDROP TABLE fm_user;\n')
        with self.assertRaises(BackupError):
            self.good()

    def test_changed_sql_rejected_even_with_artifact_checksum_resigned(self):
        self.good()
        with gzip.open(self.bundle / 'database.sql.gz', 'wb') as target:
            target.write(b'CREATE TABLE changed(id int);\n')
        self.resign()
        with self.assertRaises(BackupError):
            verify_bundle(self.bundle, self.key)

    def test_integrity_key_is_separate_immutable_and_private(self):
        key = self.root / 'integrity.key'
        generated = integrity_key(key, create=True)
        self.assertEqual(len(generated), 32)
        self.assertEqual(integrity_key(key, create=True), generated)
        os.chmod(key, 0o644)
        with self.assertRaises(BackupError):
            integrity_key(key)


if __name__ == '__main__':
    unittest.main()
