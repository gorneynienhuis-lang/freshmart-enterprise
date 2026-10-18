#!/usr/bin/env python3
"""Project-local Redis core, fixed source digest, loopback ACL, and owned-process lifecycle.

No system install, service registration, database writes, main backend changes or secret output.
The only application data permitted by its ACL is one HMAC-namespaced public-category key.
"""
import argparse
import datetime as dt
import hashlib
import hmac
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shlex
import signal
import socket
import subprocess
import sys
import tarfile
import time

from backup_bundle import (BackupError, canonical, file_hash, no_symlink_ancestors, private_dir,
                           private_write, regular_reader, require)

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.runtime/redis-cache'
VERSION = '8.2.10'
SHA256 = 'd33935732f7fc15476295fe05f5ce740927bc14847798e47b3f67b4f27b8b478'
ARCHIVE = f'redis-{VERSION}.tar.gz'
URL = f'https://download.redis.io/releases/{ARCHIVE}'
HASH_URL = 'https://raw.githubusercontent.com/redis/redis-hashes/master/README'
SOURCE = BASE / f'redis-{VERSION}'
BINARY = SOURCE / 'src/redis-server'
PORT = 16379
MAX_ARCHIVE = 8 * 1024 * 1024


def read_json(path):
    with regular_reader(path, private=True) as file:
        raw = file.read(1024 * 1024 + 1)
    require(len(raw) <= 1024 * 1024, 'Private configuration is too large.')
    return json.loads(raw)


def write_json(path, value):
    private_write(path, canonical(value))


def source_env(path):
    with regular_reader(path, private=True) as file:
        raw = file.read(1024 * 1024 + 1)
    require(len(raw) <= 1024 * 1024, 'Source environment is too large.')
    if str(path).endswith('.json'):
        result = json.loads(raw)
    else:
        result = {}
        for line in raw.decode().splitlines():
            if not line.strip() or line.lstrip().startswith('#'):
                continue
            require(line.startswith('export '), 'Only explicit export KEY=literal source environment files are supported.')
            key, separator, value = line[7:].partition('=')
            require(separator and re.fullmatch('[A-Z][A-Z0-9_]*', key) and key not in result, 'Invalid or duplicate environment key.')
            tokens = shlex.split(value)
            require(len(tokens) == 1, 'Environment values must be one quoted literal; files are never executed.')
            result[key] = tokens[0]
    require(isinstance(result, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in result.items()), 'Invalid source environment structure.')
    for key in ('APP_TOKEN_SECRET', 'DB_URL'):
        require(bool(result.get(key)), 'Source application identity is incomplete.')
    return result


def namespace(values):
    message = 'freshmart:catalog-cache:v1\n' + values['DB_URL'] + '\n' + values.get('APP_PUBLIC_ORIGIN', 'http://localhost:8080')
    return 'freshmall:cache:v1:' + hmac.new(values['APP_TOKEN_SECRET'].encode(), message.encode(), hashlib.sha256).hexdigest()


def directory(path):
    path = no_symlink_ancestors(path)
    require(path.parent == BASE and re.fullmatch('instance-[a-f0-9]{16}', path.name), 'Select an existing project-local Redis instance directory.')
    require(path.is_dir() and path.stat().st_mode & 0o777 == 0o700, 'Redis instance directory must have mode 0700.')
    return path


def verified_instance(path):
    path = directory(path)
    info = read_json(path / 'instance.json')
    require(info.get('format') == 'freshmall-redis-instance-v1' and info.get('version') == VERSION
            and info.get('port') == PORT and info.get('host') == '127.0.0.1'
            and re.fullmatch('freshmall:cache:v1:[a-f0-9]{64}:public:categories', info.get('key', '')), 'Invalid Redis instance identity.')
    require(info.get('binarySha256') == file_hash(BINARY), 'Redis binary changed; process control is refused.')
    for name in ('redis.conf', 'users.acl', 'credentials.json', 'client.env.json'):
        require(file_hash(path / name) == info['files'].get(name), 'Redis private configuration changed; process control is refused.')
        with regular_reader(path / name, private=True):
            pass
    return path, info


def extract_source(archive, destination):
    require(not destination.exists(), 'Source destination exists; nothing was overwritten.')
    prefix = f'redis-{VERSION}'
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        require(0 < len(members) < 20000, 'Unexpected source archive entry count.')
        size, names = 0, set()
        for item in members:
            path = PurePosixPath(item.name)
            require(not path.is_absolute() and '..' not in path.parts and path.parts and path.parts[0] == prefix
                    and str(path) not in names and not item.issym() and not item.islnk()
                    and (item.isdir() or item.isfile()), 'Unsafe source archive member.')
            names.add(str(path)); size += item.size
            require(size < 100 * 1024 * 1024 and item.size < 20 * 1024 * 1024, 'Source archive expansion limit exceeded.')
        private_dir(destination, new=True)
        for item in members:
            relative = PurePosixPath(item.name).parts[1:]
            if not relative:
                continue
            target = destination.joinpath(*relative)
            if item.isdir():
                private_dir(target)
            else:
                private_dir(target.parent)
                source = tar.extractfile(item)
                require(source is not None, 'Source archive file cannot be read.')
                private_write(target, source.read())
                # Build scripts need their source-controlled executable bit; all files stay private.
                if item.mode & 0o111:
                    os.chmod(target, 0o700)


def provision():
    private_dir(BASE)
    build_record = BASE / 'build.json'
    if build_record.exists():
        record = read_json(build_record)
        require(record.get('version') == VERSION and record.get('archiveSha256') == SHA256
                and BINARY.is_file() and record.get('binarySha256') == file_hash(BINARY), 'Existing Redis build differs from the verified record; keep it for inspection.')
        return
    archive = BASE / ARCHIVE
    if not archive.exists():
        partial = BASE / ('download-' + secrets.token_hex(8) + '.partial')
        private_write(partial, b'')
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--proto', '=https',
                                 '--connect-timeout', '15', '--max-time', '120', '--max-filesize', str(MAX_ARCHIVE),
                                 '--output', str(partial), URL], capture_output=True)
        require(result.returncode == 0, 'Official Redis download failed; partial bytes retained privately, no code extracted or executed.')
        require(partial.stat().st_size <= MAX_ARCHIVE and file_hash(partial) == SHA256, 'Official Redis source digest mismatch; no code extracted or executed.')
        partial.rename(archive)
    require(file_hash(archive) == SHA256, 'Redis source digest mismatch; no extraction or build attempted.')
    extract_source(archive, SOURCE)
    log = BASE / 'build.log'
    private_write(log, b'')
    with log.open('ab') as output:
        result = subprocess.run(['/usr/bin/make', '-j2', 'MALLOC=libc', 'BUILD_TLS=no'], cwd=SOURCE,
                                stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT)
    require(result.returncode == 0, 'Redis core compilation failed; inspect the private build log. No system install performed.')
    result = subprocess.run([str(BINARY), '--version'], capture_output=True, text=True, check=True)
    require(f'v={VERSION} ' in result.stdout, 'Compiled Redis version does not match the pinned source.')
    write_json(build_record, {'version': VERSION, 'sourceUrl': URL, 'officialHashList': HASH_URL,
                             'archiveSha256': SHA256, 'binarySha256': file_hash(BINARY),
                             'buildCommand': ['make', '-j2', 'MALLOC=libc', 'BUILD_TLS=no'],
                             'compiledAt': dt.datetime.now(dt.timezone.utc).isoformat()})


def build(args):
    provision()
    print(json.dumps({'status': 'COMPILED_LOCAL_CORE', 'version': VERSION, 'archiveSha256': SHA256,
                      'binarySha256': file_hash(BINARY), 'globalInstallPerformed': False}))


def prepare(args):
    values = source_env(no_symlink_ancestors(args.source_env))
    ns = namespace(values)
    provision()
    path = BASE / ('instance-' + hashlib.sha256(ns.encode()).hexdigest()[:16])
    if path.exists():
        verified_instance(path)
        print(json.dumps({'status': 'PREPARED_EXISTING', 'instance': str(path), 'credentialValuesPrinted': False}))
        return
    private_dir(path, new=True); private_dir(path / 'data')
    key = ns + ':public:categories'
    app, auditor = secrets.token_hex(32), secrets.token_hex(32)
    credentials = {'app': {'username': 'catalog_app', 'password': app},
                   'auditor': {'username': 'catalog_auditor', 'password': auditor}}
    write_json(path / 'credentials.json', credentials)
    acl = 'user default off\n'
    acl += f'user catalog_app on #{hashlib.sha256(app.encode()).hexdigest()} resetkeys ~{key} -@all +get +set +del +ping\n'
    acl += f'user catalog_auditor on #{hashlib.sha256(auditor.encode()).hexdigest()} resetkeys ~{key} -@all +get +set +del +ping +pttl +info +acl|dryrun\n'
    private_write(path / 'users.acl', acl)
    config = '\n'.join(['bind 127.0.0.1', f'port {PORT}', 'protected-mode yes', 'daemonize no',
                        'set-proc-title no', 'save ""', 'appendonly no', 'maxmemory 32mb',
                        'maxmemory-policy allkeys-lru', 'databases 1', 'timeout 60', 'tcp-keepalive 30',
                        f'aclfile {json.dumps(str(path / "users.acl"), ensure_ascii=False)}',
                        f'dir {json.dumps(str(path / "data"), ensure_ascii=False)}', 'logfile ""', 'loglevel warning', ''])
    private_write(path / 'redis.conf', config)
    env = {'APP_CATALOG_CACHE_ENABLED': 'true', 'REDIS_HOST': '127.0.0.1', 'REDIS_PORT': str(PORT),
           'REDIS_USERNAME': 'catalog_app', 'REDIS_PASSWORD': app,
           'SPRING_DATA_REDIS_HOST': '127.0.0.1', 'SPRING_DATA_REDIS_PORT': str(PORT),
           'SPRING_DATA_REDIS_USERNAME': 'catalog_app', 'SPRING_DATA_REDIS_PASSWORD': app}
    write_json(path / 'client.env.json', env)
    write_json(path / 'instance.json', {'format': 'freshmall-redis-instance-v1', 'host': '127.0.0.1',
               'port': PORT, 'version': VERSION, 'key': key, 'binarySha256': file_hash(BINARY),
               'files': {name: file_hash(path / name) for name in ('redis.conf', 'users.acl', 'credentials.json', 'client.env.json')}})
    print(json.dumps({'status': 'PREPARED', 'instance': str(path), 'clientEnvironment': str(path / 'client.env.json'),
                      'compiledVersion': VERSION, 'credentialValuesPrinted': False}))


def process_identity(pid):
    require(type(pid) is int and pid > 1, 'Invalid Redis process ID.')
    result = subprocess.run(['/bin/ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ''


def owned(path):
    record_path = path / 'process.json'
    if not record_path.exists():
        return None
    record = read_json(record_path)
    expected = str(BINARY) + ' ' + str(path / 'redis.conf')
    require(record.get('command') == expected, 'Redis process command marker is invalid; no process signaled.')
    actual = process_identity(record.get('pid'))
    if not actual:
        return None
    require(actual == record.get('identity') and expected in actual, 'Redis process ownership differs; no process signaled.')
    return record


def port_available():
    try:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', PORT))
        return True
    except PermissionError:
        raise BackupError('Local socket access is not permitted in this execution environment; no service was changed.') from None
    except OSError:
        return False


def resp_read(stream):
    line = stream.readline(1024 * 1024 + 1)
    require(len(line) <= 1024 * 1024 and line.endswith(b'\r\n'), 'Invalid Redis protocol response.')
    kind, value = line[:1], line[1:-2]
    if kind == b'-':
        # Redis error text can include command arguments. Never return it to stdout/logs.
        return {'error': value.split(b' ', 1)[0].decode('ascii', 'replace')}
    if kind == b'+':
        return value.decode()
    if kind == b':':
        return int(value)
    if kind == b'$':
        size = int(value)
        if size == -1:
            return None
        require(0 <= size <= 1024 * 1024, 'Redis response exceeds size limit.')
        data = stream.read(size + 2)
        require(len(data) == size + 2 and data[-2:] == b'\r\n', 'Incomplete Redis response.')
        return data[:-2].decode()
    raise BackupError('Unexpected Redis protocol response type.')


def command(path, command_args, *, role='auditor'):
    credentials = read_json(path / 'credentials.json')[role]
    with socket.create_connection(('127.0.0.1', PORT), timeout=0.5) as sock:
        sock.settimeout(0.5)
        stream = sock.makefile('rb')
        def send(arguments):
            parts = [str(value).encode() for value in arguments]
            packet = b'*' + str(len(parts)).encode() + b'\r\n' + b''.join(b'$' + str(len(p)).encode() + b'\r\n' + p + b'\r\n' for p in parts)
            sock.sendall(packet)
            return resp_read(stream)
        require(send(['AUTH', credentials['username'], credentials['password']]) == 'OK', 'Redis private authentication failed.')
        return send(command_args)


def start(args):
    path, info = verified_instance(args.instance)
    existing = owned(path)
    if existing:
        require(command(path, ['PING']) == 'PONG', 'Owned Redis is not ready.')
        print(json.dumps({'status': 'ALREADY_RUNNING', 'pid': existing['pid'], 'port': PORT})); return
    require(port_available(), 'Port 16379 is occupied by an unowned process; nothing started or stopped.')
    if (path / 'process.json').exists():
        (path / 'process.json').rename(path / ('process-stopped-' + str(time.time_ns()) + '.json'))
    log = path / 'server.log'
    if not log.exists():
        private_write(log, b'')
    with regular_reader(log, private=True):
        pass
    with log.open('ab') as output:
        child = subprocess.Popen([str(BINARY), str(path / 'redis.conf')], cwd=path,
                                 stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    time.sleep(0.15)
    expected = str(BINARY) + ' ' + str(path / 'redis.conf')
    identity = process_identity(child.pid)
    require(child.poll() is None and expected in identity, 'Redis failed to start with the expected process identity; inspect its private log.')
    write_json(path / 'process.json', {'pid': child.pid, 'identity': identity, 'command': expected})
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            require(owned(path) is not None, 'Owned Redis exited during readiness check.')
            if command(path, ['PING']) == 'PONG':
                server = command(path, ['INFO', 'server'])
                require(f'redis_version:{VERSION}\r\n' in server, 'Redis server version mismatch.')
                print(json.dumps({'status': 'RUNNING', 'pid': child.pid, 'port': PORT, 'version': VERSION})); return
        except (OSError, BackupError):
            time.sleep(0.1)
    raise BackupError('Owned Redis did not become ready; retained process record for explicit inspection/stop.')


def stop(args):
    path, _ = verified_instance(args.instance)
    record = owned(path)
    if record is None:
        print(json.dumps({'status': 'ALREADY_STOPPED', 'unrelatedProcessesSignaled': False})); return
    os.kill(record['pid'], signal.SIGTERM)
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if not process_identity(record['pid']):
            print(json.dumps({'status': 'STOPPED', 'pid': record['pid'], 'unrelatedProcessesSignaled': False})); return
        time.sleep(0.1)
    raise BackupError('Owned Redis has not stopped; no forced kill or unrelated process signal was attempted.')


def status(args):
    path, info = verified_instance(args.instance)
    record = owned(path)
    print(json.dumps({'status': 'RUNNING' if record else 'STOPPED', 'pid': record['pid'] if record else None,
                      'host': '127.0.0.1', 'port': PORT, 'version': VERSION, 'credentialValuesPrinted': False}))


def probe(args):
    path, info = verified_instance(args.instance)
    require(owned(path) is not None, 'Only the owned Redis process may be probed.')
    stats = command(path, ['INFO', 'commandstats'])
    require(isinstance(stats, str), 'Cannot read Redis command statistics.')
    require(command(path, ['ACL', 'DRYRUN', 'catalog_app', 'GET', info['key']]) == 'OK'
            and command(path, ['ACL', 'DRYRUN', 'catalog_app', 'SET', info['key'], 'public-test', 'EX', '60']) == 'OK',
            'The auditor cannot validate application ACL permissions.')
    checks = {name: command(path, ['ACL', 'DRYRUN', 'catalog_app', *cmd]) for name, cmd in {
        'flushall': ['FLUSHALL'], 'config': ['CONFIG', 'GET', '*'], 'outside_key': ['GET', 'outside-namespace'],
        'select': ['SELECT', '1'], 'keys': ['KEYS', '*'], 'eval': ['EVAL', 'return 1', '0']}.items()}
    # DRYRUN only: prohibited destructive commands are never executed, even if ACL configuration is wrong.
    require(all(value != 'OK' for value in checks.values()), 'Application Redis ACL is broader than the permitted scope.')
    print(json.dumps({'status': 'PROBED', 'appPing': command(path, ['PING'], role='app'),
                      'ttlMillis': command(path, ['PTTL', info['key']]),
                      'commandstats': [line for line in stats.splitlines() if line.startswith(('cmdstat_get:', 'cmdstat_set:', 'cmdstat_del:'))],
                      'deniedByDryRun': {key: value != 'OK' for key, value in checks.items()},
                      'credentialValuesPrinted': False}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('build', help='Download and verify fixed official source; compile private core without starting Redis.')
    prep = sub.add_parser('prepare', help='Verify fixed Redis source, compile local core, generate a private one-key ACL.')
    prep.add_argument('--source-env', type=Path, default=ROOT / '.runtime/demo.env')
    for name in ('start', 'stop', 'status', 'probe'):
        action = sub.add_parser(name); action.add_argument('--instance', type=Path, required=True)
    args = parser.parse_args()
    try:
        globals()[args.action](args)
    except (BackupError, OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        # Raw network/subprocess/JSON exceptions might contain private input or URLs. Keep diagnostics bounded.
        print(str(error) if isinstance(error, BackupError) else 'Redis runtime operation failed (' + type(error).__name__ + '); no secret values printed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
