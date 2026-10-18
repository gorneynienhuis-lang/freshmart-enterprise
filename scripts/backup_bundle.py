#!/usr/bin/env python3
"""Authenticated, private database + media bundles. No process/database mutations.

Drivers must quiesce all application writers and hold the database read lock for
the complete metadata/dump/media capture. This module never calls extractall.
"""
from contextlib import contextmanager
import gzip
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shutil
import stat
import tarfile
import uuid

FORMAT = 'fresh-mall-consistent-backup-v1'
KEY = re.compile(r'^(private|product|review-public)/[a-f0-9-]{36}\.raster$')
SHA = re.compile(r'^[a-f0-9]{64}$')
MAX_MEDIA = 6 * 1024 * 1024
MAX_FILES = 50000
MAX_SQL = 2 * 1024 * 1024 * 1024
NAMES = {'manifest.json', 'manifest.hmac', 'database.sql.gz', 'media.tar.gz'}


class BackupError(Exception):
    pass


def require(condition, message):
    if not condition:
        raise BackupError(message)


def canonical(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n').encode()


def no_symlink_ancestors(path):
    """Check before resolve(), which would conceal an attacker-controlled link."""
    path = Path(os.path.abspath(path))
    for part in [path, *path.parents]:
        require(not part.is_symlink(), 'Symbolic links are not permitted in storage or backup paths.')
    return path


def private_dir(path, *, new=False):
    path = no_symlink_ancestors(path)
    if new:
        require(not path.exists(), 'Destination already exists; nothing was overwritten.')
    path.mkdir(mode=0o700, parents=True, exist_ok=not new)
    require(path.is_dir(), 'Expected a private directory.')
    os.chmod(path, 0o700)
    return path


def private_write(path, value):
    path = no_symlink_ancestors(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'wb') as output:
        output.write(value.encode() if isinstance(value, str) else value)
        output.flush()
        os.fsync(output.fileno())


@contextmanager
def regular_reader(path, *, private=False):
    path = no_symlink_ancestors(path)
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'Only non-linked regular files are permitted.')
        if private:
            require(stat.S_IMODE(info.st_mode) == 0o600, 'Backup and integrity-key files must have mode 0600.')
        yield handle


def integrity_key(path, *, create=False):
    path = no_symlink_ancestors(path)
    if not path.exists():
        require(create, 'Integrity key missing. Recover the separately stored original key; do not generate a replacement.')
        private_dir(path.parent)
        private_write(path, os.urandom(32))
    with regular_reader(path, private=True) as handle:
        value = handle.read(33)
    require(len(value) == 32, 'Integrity key must contain exactly 32 random bytes.')
    return value


def file_hash(path):
    digest = hashlib.sha256()
    with regular_reader(path) as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def publish_bundle(source, destination):
    """Atomically reserve a new destination; never replace a preexisting one."""
    destination = no_symlink_ancestors(destination)
    private_dir(destination.parent)
    private_dir(destination, new=True)
    Path(source).rename(destination)  # Only the empty directory this call just reserved.


def expectations(rows):
    require(isinstance(rows, list) and len(rows) <= MAX_FILES, 'Invalid media reference list.')
    result = {}
    seen = set()
    fields = {'mediaId', 'purpose', 'status', 'storageKey', 'publicKey', 'sha256', 'sizeBytes', 'mimeType'}
    for row in rows:
        require(isinstance(row, dict) and set(row) == fields, 'Malformed database media reference.')
        require(isinstance(row['mediaId'], str) and row['mediaId'] not in seen, 'Duplicate media database identity.')
        seen.add(row['mediaId'])
        require(row['purpose'] in ('PRODUCT', 'REVIEW', 'AFTERSALE') and row['status'] == 'READY', 'Only READY, recognised media can be restored; review other states explicitly.')
        require(row['mimeType'] in ('image/png', 'image/jpeg') and isinstance(row['sha256'], str) and SHA.fullmatch(row['sha256']), 'Invalid sanitized raster digest or MIME type.')
        require(type(row['sizeBytes']) is int and 0 < row['sizeBytes'] <= MAX_MEDIA, 'Invalid sanitized raster length.')
        storage, public = row['storageKey'], row['publicKey']
        require(isinstance(storage, str) and KEY.fullmatch(storage), 'Unsafe database storage key.')
        require(storage.startswith('product/' if row['purpose'] == 'PRODUCT' else 'private/'), 'Media purpose does not match private/product storage scope.')
        if row['purpose'] == 'PRODUCT':
            require(public == storage, 'Product media must publish its own sanitized public raster.')
        elif row['purpose'] == 'AFTERSALE':
            require(public is None, 'Aftersale evidence cannot have a public key.')
        else:
            require(public is None or isinstance(public, str) and KEY.fullmatch(public) and public.startswith('review-public/'), 'Review publication must use the separate public scope.')
        for key in dict.fromkeys(value for value in (storage, public) if value is not None):
            require(key not in result, 'Two media database rows refer to the same stored object.')
            result[key] = {'path': key, 'sizeBytes': row['sizeBytes'], 'sha256': row['sha256']}
    return result


def inspect_media(root, rows):
    root = no_symlink_ancestors(root)
    wanted = expectations(rows)
    actual = set()
    if root.exists():
        require(root.is_dir(), 'Media root is not a directory.')
        for parent, dirs, files in os.walk(root, followlinks=False):
            for name in dirs:
                item = Path(parent) / name
                require(not item.is_symlink() and item.relative_to(root).as_posix() in ('private', 'product', 'review-public'), 'Unexpected or linked media directory.')
            for name in files:
                item = Path(parent) / name
                relative = item.relative_to(root).as_posix()
                require(KEY.fullmatch(relative), 'Unexpected temporary, nested or non-raster file in media storage.')
                require(relative in wanted, 'Unreferenced extra media file found; no file was deleted.')
                with regular_reader(item) as handle:
                    length = 0
                    digest = hashlib.sha256()
                    for block in iter(lambda: handle.read(1024 * 1024), b''):
                        length += len(block)
                        require(length <= MAX_MEDIA, 'Stored raster exceeds the media size limit.')
                        digest.update(block)
                require(length == wanted[relative]['sizeBytes'] and digest.hexdigest() == wanted[relative]['sha256'], 'Media bytes do not match database size/hash metadata.')
                actual.add(relative)
    require(actual == set(wanted), 'Referenced media file is missing; incomplete backup refused.')
    return [wanted[key] for key in sorted(wanted)]


def sql_details(path, *, compressed=False):
    digest, size = hashlib.sha256(), 0
    with regular_reader(path, private=True) as source:
        stream = gzip.GzipFile(fileobj=source, mode='rb') if compressed else source
        try:
            for line in stream:
                size += len(line)
                require(size <= MAX_SQL, 'SQL exceeds the supported 2 GiB recovery limit.')
                require(not re.match(rb'^\s*(?:USE\s|(?:CREATE|DROP|ALTER)\s+DATABASE\b|(?:CREATE|ALTER|DROP)\s+USER\b|GRANT\s|REVOKE\s|SET\s+GLOBAL\b)', line, re.I), 'SQL must not select, create or alter databases/users/global settings.')
                digest.update(line)
        finally:
            if compressed:
                stream.close()
    require(size > 0, 'SQL dump is empty.')
    return {'uncompressedSha256': digest.hexdigest(), 'uncompressedSize': size}


def make_bundle(destination, sql, media_root, metadata, key):
    destination = no_symlink_ancestors(destination)
    require(not destination.exists(), 'Backup destination exists; no bundle was replaced.')
    parent = private_dir(destination.parent)
    work = private_dir(parent / ('.partial-' + uuid.uuid4().hex), new=True)
    try:
        inventory = inspect_media(media_root, metadata['database']['mediaRows'])
        dump_details = sql_details(sql)
        dump = work / 'database.sql.gz'
        fd = os.open(dump, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as zipped, regular_reader(sql, private=True) as source:
            shutil.copyfileobj(source, zipped)
        archive = work / 'media.tar.gz'
        fd = os.open(archive, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as zipped, tarfile.open(fileobj=zipped, mode='w|', format=tarfile.USTAR_FORMAT) as tar:
            for record in inventory:
                info = tarfile.TarInfo(record['path'])
                info.size = record['sizeBytes']
                info.mode, info.mtime = 0o600, 0
                with regular_reader(Path(media_root) / record['path']) as source:
                    tar.addfile(info, source)
        # Detect a storage mutation even when a driver was accidentally misconfigured.
        require(inspect_media(media_root, metadata['database']['mediaRows']) == inventory, 'Media changed during capture; consistent backup refused.')
        manifest = {'format': FORMAT, **metadata, 'integrityKeyId': hashlib.sha256(key).hexdigest()[:16],
                    'mediaFiles': inventory, 'sql': dump_details,
                    'artifacts': {name: {'sha256': file_hash(work / name), 'sizeBytes': (work / name).stat().st_size} for name in ('database.sql.gz', 'media.tar.gz')}}
        data = canonical(manifest)
        private_write(work / 'manifest.json', data)
        private_write(work / 'manifest.hmac', hmac.new(key, data, hashlib.sha256).hexdigest() + '\n')
        verify_bundle(work, key)
        publish_bundle(work, destination)
        return manifest
    except Exception:
        # A private incomplete directory is retained for inspection, never advertised as a valid backup.
        raise


def archive_records(path, inventory, *, extract_to=None):
    wanted = {record['path']: record for record in inventory}
    require(len(wanted) == len(inventory) <= MAX_FILES, 'Duplicate or excessive manifest media entries.')
    seen = set()
    payload_length = sum(512 + ((record['sizeBytes'] + 511) // 512) * 512 for record in inventory)
    expected_length = ((payload_length + 1024 + 10239) // 10240) * 10240
    # Our USTAR writer emits only file headers + raster blocks + zero trailer.
    # Parse exact blocks so concatenated/hidden archives after a zero marker are
    # rejected too, rather than silently ignored by a general extractall reader.
    with regular_reader(path, private=True) as raw, gzip.GzipFile(fileobj=raw, mode='rb') as stream:
        consumed = 0
        for _ in range(len(wanted)):
            header = stream.read(512)
            require(len(header) == 512, 'Truncated archive header.')
            member = tarfile.TarInfo.frombuf(header, 'utf-8', 'strict')
            require(member.isfile() and not member.issym() and not member.islnk() and KEY.fullmatch(member.name), 'Archive contains a link, directory, traversal path or unsupported entry.')
            require(member.name in wanted and member.name not in seen, 'Archive has an extra or duplicate media entry.')
            record = wanted[member.name]
            require(member.size == record['sizeBytes'] and 0 < member.size <= MAX_MEDIA, 'Archive raster size mismatch.')
            contents = stream.read(member.size)
            padding_size = (-member.size) % 512
            padding = stream.read(padding_size)
            require(len(padding) == padding_size and not any(padding), 'Nonzero or truncated TAR member padding.')
            require(len(contents) == record['sizeBytes'] and hashlib.sha256(contents).hexdigest() == record['sha256'], 'Archive media digest mismatch.')
            consumed += 512 + member.size + padding_size
            if extract_to is not None:
                target = Path(extract_to) / member.name
                private_dir(target.parent)
                private_write(target, contents)
            seen.add(member.name)
        trailer = stream.read(expected_length - consumed + 1)
        require(len(trailer) == expected_length - consumed and not any(trailer), 'Archive contains hidden/trailing files, excess data or an invalid end marker.')
    require(seen == set(wanted), 'Archive is missing a manifest media entry.')


def verify_bundle(directory, key):
    directory = no_symlink_ancestors(directory)
    require(directory.is_dir() and stat.S_IMODE(directory.stat().st_mode) == 0o700, 'Bundle directory must be private mode 0700.')
    require({entry.name for entry in directory.iterdir()} == NAMES, 'Bundle has missing or extra files.')
    with regular_reader(directory / 'manifest.json', private=True) as source:
        data = source.read(32 * 1024 * 1024 + 1)
    require(len(data) <= 32 * 1024 * 1024, 'Manifest is too large.')
    with regular_reader(directory / 'manifest.hmac', private=True) as source:
        signature = source.read(100).strip()
    require(hmac.compare_digest(signature, hmac.new(key, data, hashlib.sha256).hexdigest().encode()), 'Manifest authentication failed. Wrong key or altered manifest; nothing may be restored.')
    try:
        manifest = json.loads(data)
        require(manifest['format'] == FORMAT and manifest['integrityKeyId'] == hashlib.sha256(key).hexdigest()[:16], 'Unsupported bundle format or integrity-key identity.')
        wanted = expectations(manifest['database']['mediaRows'])
        require(manifest['mediaFiles'] == [wanted[key] for key in sorted(wanted)], 'Manifest media inventory does not match database references.')
        require(set(manifest['artifacts']) == {'database.sql.gz', 'media.tar.gz'}, 'Unexpected bundle artifact names.')
        for name, record in manifest['artifacts'].items():
            require(type(record['sizeBytes']) is int and record['sizeBytes'] > 0 and record['sha256'] == file_hash(directory / name) and record['sizeBytes'] == (directory / name).stat().st_size, 'Backup artifact size/checksum mismatch.')
        require(sql_details(directory / 'database.sql.gz', compressed=True) == manifest['sql'], 'SQL uncompressed checksum/length mismatch.')
        archive_records(directory / 'media.tar.gz', manifest['mediaFiles'])
        return manifest
    except (KeyError, TypeError, ValueError, OSError, tarfile.TarError, EOFError) as error:
        raise BackupError('Malformed, damaged or unsafe backup bundle.') from error


def extract_media(directory, destination, manifest):
    destination = no_symlink_ancestors(destination)
    require(not destination.exists() or destination.is_dir() and not any(destination.iterdir()), 'Recovery media directory must be new or completely empty.')
    private_dir(destination)
    archive_records(Path(directory) / 'media.tar.gz', manifest['mediaFiles'], extract_to=destination)
    require(inspect_media(destination, manifest['database']['mediaRows']) == manifest['mediaFiles'], 'Extracted media inventory mismatch.')


def unpack_sql(directory, destination):
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'wb') as target, regular_reader(Path(directory) / 'database.sql.gz', private=True) as raw, gzip.GzipFile(fileobj=raw, mode='rb') as source:
        shutil.copyfileobj(source, target)
