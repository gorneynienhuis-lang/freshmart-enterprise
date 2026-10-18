#!/usr/bin/env python3
"""Own only the explicitly restored v030 engineering backend on loopback:18081.

No main JAR, main runtime record, seed reset, database creation, password reset or
credential-file update. Start requires a PASSED private source-snapshot build.
Its one-time imported-session revocation and application migration are recorded
separately from the immutable raw recovery report.
"""
import argparse
import configparser
from contextlib import contextmanager
import datetime as dt
import hashlib
import hmac
import fcntl
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import uuid
import zipfile

from backup_bundle import (BackupError, canonical, file_hash, no_symlink_ancestors,
                           private_dir, private_write, regular_reader, require)

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
ENGINEERING = RUNTIME / 'engineering/v030'
PRIVATE = ENGINEERING / 'private'
ENV_FILE = PRIVATE / 'backend.env.json'
PURPOSE_FILE = PRIVATE / 'purpose.json'
STATE_FILE = PRIVATE / 'process.json'
SESSION_INIT = PRIVATE / 'session-safety-init.json'
SESSION_ATTEMPT = PRIVATE / 'session-safety-init-attempt.json'
BUILD_PARENT = RUNTIME / 'builds'
MYSQL = RUNTIME / 'mysql-8.4.11-macos15-arm64/bin/mysql'
PORT = 18081
PURPOSE = 'engineering-refund-recovery'
SCHEMA = re.compile(r'^fresh_mall_restore_engineering_[a-z0-9_]{6,34}$')
SHA = re.compile(r'^[a-f0-9]{64}$')
BUILD_NAME = re.compile(r'^\d{8}T\d{6}Z-[a-f0-9]{8}$')
MIGRATION_NAME = re.compile(r'^V([0-9]{3,})__[^/]+\.sql$')
SAFE_ENV = {'PATH': '/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin', 'LANG': 'en_US.UTF-8', 'TZ': 'UTC'}
ENV_KEYS = set(('APP_ALLOWED_ORIGINS APP_CATALOG_CACHE_ENABLED APP_COMMERCE_JOBS_ENABLED APP_MEDIA_DIR '
    'APP_METRICS_SNAPSHOT_DELAY_MS APP_METRICS_TOKEN_FILE APP_MONITORING_ENABLED APP_PUBLIC_ORIGIN '
    'APP_REFUND_LEASE_SECONDS APP_REFUND_MAX_ATTEMPTS APP_REFUND_RETRY_BASE_SECONDS APP_REFUND_RETRY_MAX_SECONDS '
    'APP_SANDBOX_REFUND_FAULTS_ENABLED APP_SECURE_COOKIES APP_TOKEN_SECRET DB_PASSWORD DB_URL DB_USERNAME '
    'REDIS_HOST REDIS_PASSWORD REDIS_PORT REDIS_USERNAME SANDBOX_SECRET SERVER_ADDRESS SERVER_PORT '
    'SPRING_DATA_REDIS_HOST SPRING_DATA_REDIS_PASSWORD SPRING_DATA_REDIS_PORT SPRING_DATA_REDIS_USERNAME '
    'SPRING_PROFILES_ACTIVE').split())


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def read_json(path, *, private=True):
    with regular_reader(path, private=private) as source:
        raw = source.read(2 * 1024 * 1024 + 1)
    require(len(raw) <= 2 * 1024 * 1024, 'Engineering metadata exceeds the size bound.')
    return json.loads(raw)


def save_state(value):
    private_dir(PRIVATE)
    if STATE_FILE.exists():
        with regular_reader(STATE_FILE, private=True):
            pass
    temporary = PRIVATE / ('process-' + uuid.uuid4().hex + '.tmp')
    private_write(temporary, canonical(value))
    temporary.replace(STATE_FILE)


def event(value):
    directory = private_dir(ENGINEERING / 'events')
    path = directory / (dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-' + uuid.uuid4().hex[:8] + '.json')
    private_write(path, canonical(value))
    return path


@contextmanager
def mutation_lock():
    private_dir(PRIVATE)
    path = PRIVATE / 'runtime.lock'
    if not path.exists(): private_write(path, b'')
    with regular_reader(path, private=True) as handle:
        try: fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise BackupError('Another engineering lifecycle operation holds the lock; nothing was changed.') from None
        try: yield
        finally: fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def load_target():
    purpose = read_json(PURPOSE_FILE)
    env = read_json(ENV_FILE)
    require(isinstance(purpose, dict) and purpose.get('purpose') == PURPOSE
            and SCHEMA.fullmatch(purpose.get('schema', '')) and purpose.get('port') == PORT
            and purpose.get('sourceDatabaseChanged') is False, 'Engineering purpose does not identify the isolated target.')
    require(isinstance(env, dict) and all(isinstance(k, str) and isinstance(v, str) for k, v in env.items())
            and set(env) <= ENV_KEYS, 'Engineering environment contains an unapproved property or nonliteral value.')
    recovery = no_symlink_ancestors(purpose['sourceRecovery'])
    require(recovery.parent == RUNTIME / 'recoveries' and recovery.name.startswith('engineering-v030-'),
            'Engineering recovery directory is outside this dedicated rehearsal.')
    report = read_json(recovery / 'recovery.json')
    media = no_symlink_ancestors(recovery / 'media')
    require(report.get('status') == 'RESTORED_VERIFIED' and report.get('schema') == purpose['schema']
            and report.get('port') == PORT and report.get('mediaDirectory') == str(media)
            and SHA.fullmatch(report.get('sourceJarSha256', '')),
            'Original isolated recovery metadata is not verified or does not match purpose.')
    require(env.get('DB_URL', '').split('?', 1)[0] == 'jdbc:mysql://127.0.0.1:3306/' + purpose['schema']
            and re.fullmatch(r'fmrec_[a-f0-9]{16}', env.get('DB_USERNAME', ''))
            and re.fullmatch(r'[a-f0-9]{48}', env.get('DB_PASSWORD', ''))
            and env.get('APP_MEDIA_DIR') == str(media)
            and env.get('SERVER_ADDRESS') == '127.0.0.1' and env.get('SERVER_PORT') == str(PORT)
            and env.get('SPRING_PROFILES_ACTIVE') in ('demo', 'test')
            and env.get('APP_PUBLIC_ORIGIN') == f'http://127.0.0.1:{PORT}'
            and env.get('APP_SECURE_COOKIES') == 'false'
            and env.get('APP_COMMERCE_JOBS_ENABLED') in ('true', 'false')
            and len(env.get('APP_TOKEN_SECRET', '')) >= 32 and len(env.get('SANDBOX_SECRET', '')) >= 32,
            'Engineering environment differs from its isolated schema, credentials, media, profile or loopback endpoint.')
    allowed_origins = env.get('APP_ALLOWED_ORIGINS', '').split(',')
    require(len(set(allowed_origins)) == len(allowed_origins) and f'http://127.0.0.1:{PORT}' in allowed_origins
            and set(allowed_origins) <= {'http://127.0.0.1:18081', 'http://localhost:18081',
                                         'http://127.0.0.1:15173', 'http://localhost:15173'},
            'Engineering CORS must remain restricted to the isolated loopback backend/frontend origins.')
    permitted_query = {'serverTimezone': 'UTC', 'connectionTimeZone': 'UTC', 'forceConnectionTimeZoneToSession': 'true',
                       'characterEncoding': 'UTF-8', 'useSSL': 'false', 'allowPublicKeyRetrieval': 'true'}
    parameters = urllib.parse.parse_qsl(env['DB_URL'].partition('?')[2], keep_blank_values=True, strict_parsing=True)
    require(len({key for key, _ in parameters}) == len(parameters)
            and all(permitted_query.get(key) == value for key, value in parameters),
            'Engineering JDBC options contain an unapproved session, transport or schema override.')
    require(media.is_dir() and media.stat().st_mode & 0o777 == 0o700, 'Engineering media root must be private mode 0700.')
    for base, directories, files in os.walk(media, followlinks=False):
        for name in directories + files:
            no_symlink_ancestors(Path(base) / name)
    cnf = recovery / 'mysql-recovery.cnf'
    config = configparser.ConfigParser(interpolation=None)
    with regular_reader(cnf, private=True) as source:
        config.read_string(source.read().decode())
    require(config.sections() == ['client'] and set(config['client']) == {'user', 'password', 'protocol', 'socket', 'default-character-set'}
            and config['client']['user'] == env['DB_USERNAME']
            and hmac.compare_digest(config['client']['password'], env['DB_PASSWORD'])
            and config['client']['protocol'] == 'socket' and config['client']['socket'] == str(RUNTIME / 'mysql.sock')
            and config['client']['default-character-set'] == 'utf8mb4',
            'Recovery client credentials or local socket do not match the isolated target.')
    for prefix in ('REDIS_', 'SPRING_DATA_REDIS_'):
        if any(key.startswith(prefix) for key in env):
            require(env.get(prefix + 'HOST') == '127.0.0.1' and env.get(prefix + 'PORT') == '16379'
                    and env.get(prefix + 'USERNAME') == 'catalog_app' and bool(env.get(prefix + 'PASSWORD')),
                    'Engineering Redis must use the dedicated loopback cache endpoint and application ACL.')
    if 'REDIS_PASSWORD' in env and 'SPRING_DATA_REDIS_PASSWORD' in env:
        require(hmac.compare_digest(env['REDIS_PASSWORD'], env['SPRING_DATA_REDIS_PASSWORD']), 'Redis environment aliases disagree.')
    if env.get('APP_MONITORING_ENABLED') == 'true':
        token = no_symlink_ancestors(env.get('APP_METRICS_TOKEN_FILE', ''))
        require(token.is_relative_to(RUNTIME), 'Engineering scrape credential must stay in private project runtime storage.')
        with regular_reader(token, private=True): pass
    return {'purpose': purpose, 'env': env, 'recovery': recovery, 'report': report, 'media': media, 'cnf': cnf}


def build_snapshot(path):
    path = no_symlink_ancestors(path)
    require(path.parent == BUILD_PARENT and BUILD_NAME.fullmatch(path.name), 'Select a source-snapshot build below .runtime/builds, never backend/target.')
    report = read_json(path / 'verification.json')
    source = read_json(path / 'source.json')
    tests = report.get('tests', {})
    require(report.get('status') == 'PASSED' and report.get('mavenExitCode') == 0
            and report.get('directory') == str(path) and report.get('selectedTests') is None
            and report.get('mainJarChanged') is False and tests.get('tests', 0) > 0
            and tests.get('failures') == 0 and tests.get('errors') == 0,
            'Build has not passed the complete backend verification/package step.')
    jar = no_symlink_ancestors(report['jar'])
    require(jar.parent == path / 'backend/target' and re.fullmatch(r'fresh-mall-backend-[A-Za-z0-9.\-]+-SNAPSHOT\.jar', jar.name)
            and SHA.fullmatch(report.get('jarSha256', '')) and file_hash(jar) == report['jarSha256'],
            'Build JAR path or digest does not match its private verification record.')
    hashes = source.get('sourceSha256', {})
    require(isinstance(hashes, dict) and hashes and 'backend/pom.xml' in hashes
            and 'backend/src/main/java/com/freshmart/FreshMartApplication.java' in hashes,
            'Copied source manifest is incomplete.')
    for name, digest in hashes.items():
        relative = PurePosixPath(name)
        allowed = name in ('backend/pom.xml', 'backend/mvnw') or name.startswith(('backend/.mvn/', 'backend/src/', 'database/migrations/'))
        require(allowed and not relative.is_absolute() and '..' not in relative.parts and SHA.fullmatch(digest)
                and file_hash(path.joinpath(*relative.parts)) == digest, 'Copied source differs from the build manifest.')
    actual = set()
    for selected in ('backend/pom.xml', 'backend/mvnw', 'backend/.mvn', 'backend/src', 'database/migrations'):
        base = path / selected
        for file in (base.rglob('*') if base.is_dir() else [base]):
            no_symlink_ancestors(file)
            if file.is_file(): actual.add(file.relative_to(path).as_posix())
    require(actual == set(hashes), 'Copied source has missing or unlisted files.')
    migrations = []
    with zipfile.ZipFile(jar) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), 'Build JAR contains duplicate archive members.')
        expected_migrations = set()
        for name, digest in hashes.items():
            if name.startswith('database/migrations/'):
                match = MIGRATION_NAME.fullmatch(PurePosixPath(name).name)
                require(bool(match), 'Unrecognised source migration filename.')
                jar_name = 'BOOT-INF/classes/db/migration/' + PurePosixPath(name).name
                expected_migrations.add(jar_name)
                require(jar_name in names and hashlib.sha256(archive.read(jar_name)).hexdigest() == digest,
                        'Packaged migration differs from the verified copied source.')
                migrations.append(match.group(1))
        require({name for name in names if name.startswith('BOOT-INF/classes/db/migration/') and not name.endswith('/')} == expected_migrations,
                'Build JAR contains unlisted application migrations.')
    require(migrations, 'Verified JAR has no application migrations.')
    return {'directory': path, 'jar': jar, 'jarSha256': report['jarSha256'],
            'verificationSha256': file_hash(path / 'verification.json'), 'sourceManifestSha256': file_hash(path / 'source.json'),
            'baseCommit': source.get('baseCommit'), 'copiedAt': source.get('copiedAt'),
            'liveSourceChangedDuringBuild': report.get('liveSourceChangedDuringBuild'),
            'migrationVersions': sorted(migrations, key=int)}


def migrations(target):
    require(MYSQL.is_file() and not MYSQL.is_symlink(), 'Expected local portable MySQL client is missing.')
    sql = "SELECT JSON_OBJECT('schema',DATABASE(),'user',SUBSTRING_INDEX(CURRENT_USER(),'@',1));\n"
    sql += "SELECT JSON_OBJECT('version',version,'script',script,'checksum',checksum,'success',success) FROM flyway_schema_history ORDER BY installed_rank;\n"
    command = [str(MYSQL), '--defaults-file=' + str(target['cnf']), '--batch', '--raw', '--skip-column-names',
               '--connect-timeout=5', target['purpose']['schema']]
    result = subprocess.run(command, input=sql, capture_output=True, text=True, timeout=15, env=SAFE_ENV)
    require(result.returncode == 0, 'Scoped engineering migration query failed; database contents and credentials were not printed.')
    rows = [json.loads(line) for line in result.stdout.splitlines() if line]
    require(len(rows) > 1 and rows[0] == {'schema': target['purpose']['schema'], 'user': target['env']['DB_USERNAME']}
            and all(row.get('success') == 1 and isinstance(row.get('version'), str) for row in rows[1:]),
            'Scoped engineering database identity or successful migration history does not match.')
    return rows[1:]


def initialize_sessions(target):
    """A raw restore is already verified. This is one explicit, target-only security mutation.

    JWT/CSRF key rotation does not invalidate opaque refresh hashes. Do not change
    passwords, delete users, or rerun this action on subsequent engineering starts.
    """
    binding = {'purpose': PURPOSE, 'schema': target['purpose']['schema'],
               'databaseUser': target['env']['DB_USERNAME'],
               'originalRecoveryReportSha256': file_hash(target['recovery'] / 'recovery.json')}
    if SESSION_INIT.exists():
        marker = read_json(SESSION_INIT)
        require(marker.get('binding') == binding and marker.get('status') == 'INITIALIZED'
                and type(marker.get('revokedSessions')) is int and marker['revokedSessions'] >= 0
                and isinstance(marker.get('completedAt'), str),
                'Session safety initialization marker does not match this verified engineering restore.')
        return marker
    require(not SESSION_ATTEMPT.exists(), 'Session initialization has an incomplete prior attempt; inspect it explicitly rather than repeat a possible revocation.')
    private_write(SESSION_ATTEMPT, canonical({'status': 'REQUESTED', 'binding': binding, 'requestedAt': now(),
                    'scope': 'post-raw-restore security initialization; no original backup/recovery verification changed'}))
    sql = "START TRANSACTION;\nUPDATE fm_auth_session SET status='REVOKED' WHERE status='ACTIVE';\nSELECT JSON_OBJECT('revokedSessions',ROW_COUNT());\nCOMMIT;\n"
    command = [str(MYSQL), '--defaults-file=' + str(target['cnf']), '--batch', '--raw', '--skip-column-names',
               '--connect-timeout=5', target['purpose']['schema']]
    result = subprocess.run(command, input=sql, capture_output=True, text=True, timeout=15, env=SAFE_ENV)
    require(result.returncode == 0, 'Engineering session initialization failed or is uncertain; no backend started and no automatic retry is allowed.')
    value = json.loads(result.stdout)
    require(isinstance(value, dict) and set(value) == {'revokedSessions'}
            and type(value['revokedSessions']) is int and value['revokedSessions'] >= 0,
            'Engineering session initialization count is uncertain; inspect its private attempt before any retry.')
    marker = {'status': 'INITIALIZED', 'binding': binding, 'completedAt': now(),
              'revokedSessions': value['revokedSessions'],
              'operation': 'UPDATE fm_auth_session ACTIVE to REVOKED on this isolated schema only',
              'passwordsChanged': False, 'originalRecoveryReportModified': False}
    private_write(SESSION_INIT, canonical(marker))
    event(dict(marker, operation='FIRST_START_SESSION_REVOCATION'))
    return marker


def java_binary():
    if sys.platform == 'darwin':
        result = subprocess.run(['/usr/libexec/java_home', '-v', '21'], capture_output=True, text=True, env=SAFE_ENV)
        require(result.returncode == 0, 'Java 21 was not found; system installation was not changed.')
        java = (Path(result.stdout.strip()) / 'bin/java').resolve()
    else:
        executable = shutil.which('java', path=SAFE_ENV['PATH'])
        require(bool(executable), 'Java 21 was not found.')
        java = Path(executable).resolve()
    require(java.is_file(), 'Java executable is missing.')
    result = subprocess.run([str(java), '-version'], capture_output=True, text=True, env=SAFE_ENV)
    require(result.returncode == 0 and re.search(r'version "21\.', result.stderr), 'The isolated engineering backend requires Java 21.')
    return java


def process_identity(pid):
    require(type(pid) is int and pid > 1, 'Invalid engineering PID; no process signaled.')
    result = subprocess.run(['/bin/ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='],
                            capture_output=True, text=True, env=SAFE_ENV, timeout=5)
    if result.returncode:
        require(not result.stderr.strip(), 'Cannot inspect process ownership; no process signaled.')
        return ''
    return result.stdout.strip()


def listeners():
    executable = '/usr/sbin/lsof' if Path('/usr/sbin/lsof').is_file() else shutil.which('lsof', path=SAFE_ENV['PATH'])
    require(bool(executable), 'lsof is required to verify actual socket ownership.')
    result = subprocess.run([executable, '-nP', f'-iTCP:{PORT}', '-sTCP:LISTEN', '-Fpn'],
                            capture_output=True, text=True, env=SAFE_ENV, timeout=5)
    require(result.returncode in (0, 1) and not result.stderr.strip(), 'Socket ownership could not be inspected safely.')
    rows, pid = [], None
    for line in result.stdout.splitlines():
        if line.startswith('p'): pid = int(line[1:])
        elif line.startswith('n'):
            require(pid is not None, 'Invalid socket ownership response.')
            rows.append({'pid': pid, 'address': line[1:]})
    return rows


def owned():
    if not STATE_FILE.exists(): return None
    state = read_json(STATE_FILE)
    require(state.get('purpose') == PURPOSE and SCHEMA.fullmatch(state.get('schema', ''))
            and state.get('port') == PORT and state.get('host') == '127.0.0.1',
            'Engineering process record has an invalid target identity.')
    jar = no_symlink_ancestors(state['jar'])
    require(jar.parent.parent.parent.parent == BUILD_PARENT and jar.parent.name == 'target'
            and jar.parent.parent.name == 'backend' and BUILD_NAME.fullmatch(jar.parent.parent.parent.name)
            and file_hash(jar) == state.get('jarSha256'), 'Engineering process JAR ownership or digest changed.')
    command = state.get('command')
    require(isinstance(command, list) and len(command) >= 7 and command[1:3] == ['-jar', str(jar)]
            and '--server.port=18081' in command and '--server.address=127.0.0.1' in command
            and '--spring.config.location=classpath:/application.yml' in command
            and state.get('expectedCommand') == ' '.join(command), 'Engineering process command record is invalid.')
    actual = process_identity(state.get('pid'))
    if not actual: return None
    require(actual == state.get('identity') and state['expectedCommand'] in actual,
            'Engineering PID/start time/full command changed; no process signaled.')
    return state


def require_listener(state):
    require(listeners() == [{'pid': state['pid'], 'address': '127.0.0.1:18081'}],
            'Port 18081 listener PID/address does not belong exclusively to the owned engineering process.')


def port_available():
    try:
        with socket.socket() as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', PORT))
        return True
    except PermissionError:
        raise BackupError('This execution environment denies socket binding; no process was changed.') from None
    except OSError:
        return False


def preflight(args):
    target = load_target(); build = build_snapshot(args.build)
    require(not listeners() or owned() is not None, 'An unowned listener occupies 18081; nothing was changed.')
    print(json.dumps({'status': 'VALIDATED_NOT_STARTED', 'port': PORT, 'schema': target['purpose']['schema'],
                      'jarSha256': build['jarSha256'], 'sourceJarSha256': target['report']['sourceJarSha256'],
                      'packagedMigrationVersions': build['migrationVersions'], 'commerceJobsEnabled': target['env']['APP_COMMERCE_JOBS_ENABLED'] == 'true',
                      'databaseQueried': False, 'processStarted': False}))


def start(args):
    target = load_target(); build = build_snapshot(args.build)
    existing = owned()
    if existing:
        require(existing['jarSha256'] == build['jarSha256'] and existing.get('environmentSha256') == file_hash(ENV_FILE),
                'Owned engineering instance uses another build/environment; use explicit restart after validation.')
        require_listener(existing)
        print(json.dumps({'status': 'ALREADY_RUNNING', 'pid': existing['pid'], 'port': PORT})); return
    require(not listeners() and port_available(), 'Port 18081 is occupied by an unowned process; nothing was stopped.')
    before = migrations(target)
    before_versions = [row['version'] for row in before]
    require(build['migrationVersions'][:len(before_versions)] == before_versions,
            'Engineering migration history is not a prefix of the packaged application migrations.')
    java = java_binary()
    session_init = initialize_sessions(target)
    command = [str(java), '-jar', str(build['jar']), '--server.address=127.0.0.1', '--server.port=18081',
               '--spring.profiles.active=' + target['env']['SPRING_PROFILES_ACTIVE'],
               '--spring.config.location=classpath:/application.yml', '--spring.flyway.clean-disabled=true',
               '--app.media-dir=' + str(target['media'])]
    env = dict(SAFE_ENV, **target['env'])
    run_id = uuid.uuid4().hex
    log = PRIVATE / ('backend-' + run_id + '.log')
    private_write(log, b'')
    receipt = {'purpose': PURPOSE, 'operation': 'new-version-engineering-rehearsal-not-original-backup-verification',
               'runId': run_id, 'requestedAt': now(), 'host': '127.0.0.1', 'port': PORT,
               'schema': target['purpose']['schema'], 'sourceRecovery': str(target['recovery']),
               'originalRecoveryReportSha256': file_hash(target['recovery'] / 'recovery.json'),
               'sourceJarSha256': target['report']['sourceJarSha256'], 'jar': str(build['jar']), 'jarSha256': build['jarSha256'],
               'sourceManifestSha256': build['sourceManifestSha256'], 'verificationSha256': build['verificationSha256'],
               'buildBaseCommit': build['baseCommit'], 'sourceCopiedAt': build['copiedAt'],
               'liveSourceChangedDuringBuild': build['liveSourceChangedDuringBuild'], 'environmentSha256': file_hash(ENV_FILE),
               'commerceJobsEnabled': target['env']['APP_COMMERCE_JOBS_ENABLED'] == 'true',
               'sessionSafetyInitialization': session_init,
               'migrationHistoryBefore': before, 'packagedMigrationVersions': build['migrationVersions'],
               'command': command, 'expectedCommand': ' '.join(command), 'log': str(log),
               'mainRuntimeModified': False, 'originalRecoveryReportModified': False}
    request_event = event(dict(receipt, status='START_REQUESTED'))
    with log.open('ab') as output:
        child = subprocess.Popen(command, cwd=PRIVATE, env=env, stdin=subprocess.DEVNULL,
                                 stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    time.sleep(0.15)
    identity = process_identity(child.pid)
    require(child.poll() is None and receipt['expectedCommand'] in identity,
            'Engineering process did not retain the expected command identity; inspect its private launch event/log.')
    state = dict(receipt, pid=child.pid, identity=identity, status='STARTED_NOT_READY', requestEvent=str(request_event))
    save_state(state)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        require(owned() is not None, 'Engineering process exited during startup; its private log/event remains available.')
        try:
            require_listener(state)
            with opener.open(f'http://127.0.0.1:{PORT}/actuator/health', timeout=1) as response:
                healthy = response.status == 200 and json.load(response).get('status') == 'UP'
        except (OSError, ValueError, BackupError):
            healthy = False
        if healthy:
            after = migrations(target)
            require(after[:len(before)] == before and [row['version'] for row in after] == build['migrationVersions'],
                    'Engineering application migration verification failed; no success was recorded.')
            require_listener(state)
            state.update(status='UP', readyAt=now(), migrationHistoryAfter=after,
                         listenerOwnership={'pid': child.pid, 'address': '127.0.0.1:18081'})
            save_state(state)
            result_event = event(dict(state))
            print(json.dumps({'status': 'ENGINEERING_BACKEND_UP', 'origin': f'http://127.0.0.1:{PORT}', 'pid': child.pid,
                              'schema': state['schema'], 'migrationVersionsBefore': before_versions,
                              'migrationVersionsAfter': [row['version'] for row in after],
                              'jarSha256': build['jarSha256'], 'event': str(result_event), 'mainServicesUntouched': True})); return
        time.sleep(0.25)
    event(dict(state, status='STARTUP_TIMEOUT', failedAt=now()))
    raise BackupError('Engineering health readiness timed out; the owned process is retained for inspection or explicit stop.')


def stop(args):
    state = owned()
    if state is None:
        require(not listeners(), 'An unowned process occupies 18081; no signal sent.')
        print(json.dumps({'status': 'ALREADY_STOPPED', 'port': PORT, 'unrelatedProcessesSignaled': False})); return
    # Ownership of the exact process is mandatory; if a listener exists, it must also be ours.
    if listeners(): require_listener(state)
    os.kill(state['pid'], signal.SIGTERM)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if not process_identity(state['pid']):
            require(not listeners(), 'Owned process exited but another listener appeared; no unrelated signal sent.')
            state.update(status='STOPPED', stoppedAt=now())
            save_state(state); receipt = event(dict(state))
            print(json.dumps({'status': 'STOPPED', 'pid': state['pid'], 'port': PORT, 'event': str(receipt),
                              'unrelatedProcessesSignaled': False})); return
        time.sleep(0.2)
    raise BackupError('Owned engineering process did not stop; no forced kill or main-runtime signal was attempted.')


def restart(args):
    load_target(); build_snapshot(args.build)  # Reject unsafe replacement before stopping a running target.
    stop(args); start(args)


def status(args):
    state = owned()
    if state is None:
        require(not listeners(), 'Unowned listener on 18081; it was not signaled.')
        print(json.dumps({'status': 'STOPPED', 'port': PORT})); return
    listening = listeners()
    if listening: require_listener(state)
    print(json.dumps({'status': 'OWNED_LISTENING' if listening else 'OWNED_NOT_LISTENING', 'pid': state['pid'],
                      'port': PORT, 'jarSha256': state['jarSha256'], 'commerceJobsEnabled': state['commerceJobsEnabled']}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    for name in ('preflight', 'start', 'restart'):
        action = sub.add_parser(name); action.add_argument('--build', type=Path, required=True)
    for name in ('stop', 'status'): sub.add_parser(name)
    args = parser.parse_args()
    try:
        if args.action in ('start', 'stop', 'restart'):
            with mutation_lock(): globals()[args.action](args)
        else: globals()[args.action](args)
    except (BackupError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError, zipfile.BadZipFile) as error:
        print(str(error) if isinstance(error, BackupError) else 'Engineering runtime failed (' + type(error).__name__ + '); no private values printed.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
