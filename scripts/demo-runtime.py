#!/usr/bin/env python3
"""Isolated, loopback-only MySQL demo. Never resets data or kills unowned processes."""
import argparse
import errno
import hashlib
import json
import os
from pathlib import Path
import platform
import secrets
import shlex
import signal
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
VERSION = '8.4.11'
ARCHIVE = f'mysql-{VERSION}-macos15-arm64.tar.gz'
URL = f'https://cdn.mysql.com/Downloads/MySQL-8.4/{ARCHIVE}'
SHA256 = 'b96e00493bc3499b9ffd7f08d65c5d64933af0383a8287d9873b64f94c2d6009'
MYSQL = RUNTIME / f'mysql-{VERSION}-macos15-arm64'
DATA = RUNTIME / 'mysql-data'
SOCKET = RUNTIME / 'mysql.sock'
ENV_FILE = RUNTIME / 'demo.env'
PID_FILE = RUNTIME / 'demo-processes.json'
JAR = ROOT / 'backend/target/fresh-mall-backend-0.1.0-SNAPSHOT.jar'
ROLES = ['MEMBER', 'PICKER', 'COURIER', 'SERVICE', 'FINANCE', 'OPERATOR', 'ADMIN']
GENERATOR_ROLES = ['MEMBER', 'OPERATOR', 'PICKER', 'COURIER', 'SERVICE', 'FINANCE', 'ADMIN']


def fail(message):
    raise SystemExit(message)


def run(command, **kwargs):
    return subprocess.run([str(x) for x in command], check=True, **kwargs)


def private_write(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(value)


def prepare():
    RUNTIME.mkdir(mode=0o700, exist_ok=True)
    os.chmod(RUNTIME, 0o700)
    if not ENV_FILE.exists():
        values = {
            'APP_TOKEN_SECRET': secrets.token_hex(32),
            'SANDBOX_SECRET': secrets.token_hex(32),
            'DB_ROOT_PASSWORD': secrets.token_hex(24),
            'DB_USERNAME': 'fresh_mall_demo',
            'DB_PASSWORD': secrets.token_hex(24),
            'DB_URL': 'jdbc:mysql://127.0.0.1:3306/fresh_mall_demo?serverTimezone=UTC&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true',
            'APP_DEMO_PASSWORD': 'Demo-' + secrets.token_hex(10),
            'APP_SECURE_COOKIES': 'false',
            'APP_ALLOWED_ORIGINS': 'http://localhost:5173,http://127.0.0.1:5173',
            'SPRING_PROFILES_ACTIVE': 'demo',
            'SERVER_PORT': '8080',
            'SERVER_ADDRESS': '127.0.0.1',
        }
        private_write(ENV_FILE, '# Local demo only; do not publish or commit. Generated once, retained across restarts.\n' + ''.join(f'export {key}={shlex.quote(value)}\n' for key, value in values.items()))
    values = load_env()
    accounts = RUNTIME / 'demo-accounts.txt'
    if not accounts.exists():
        private_write(accounts, 'LOCAL DEMO ONLY — synthetic accounts, never real phone numbers.\nPassword: ' + values['APP_DEMO_PASSWORD'] + '\n' + '\n'.join(f'1380000000{i}  demo-{role.lower()}  {role}' for i, role in enumerate(ROLES, 1)) + '\n')
    for kind, username, password in [('root', 'root', values['DB_ROOT_PASSWORD']), ('app', values['DB_USERNAME'], values['DB_PASSWORD'])]:
        path = RUNTIME / f'mysql-{kind}.cnf'
        if not path.exists():
            # Generated passwords contain only hex; config never receives shell input.
            private_write(path, f'[client]\nuser={username}\npassword={password}\nprotocol=socket\nsocket={SOCKET}\ndefault-character-set=utf8mb4\n')
    return values


def load_env():
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        if not line.startswith('export '):
            continue
        key, _, value = line[7:].partition('=')
        values[key] = shlex.split(value)[0]
    return values


def provision_mysql():
    if MYSQL.exists():
        result = run([MYSQL / 'bin/mysqld', '--version'], capture_output=True, text=True)
        if f'Ver {VERSION} ' not in result.stdout:
            fail('Portable MySQL version differs from pinned version; do not overwrite it.')
        return
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        fail('Automatic portable install currently supports macOS ARM64 only. See deploy/README.md for the supported demo environment.')
    downloads = RUNTIME / 'downloads'
    downloads.mkdir(exist_ok=True)
    archive = downloads / ARCHIVE
    if not archive.exists():
        partial = archive.with_suffix('.gz.partial')
        run(['curl', '--fail', '--location', '--connect-timeout', '15', '--max-time', '300', '--output', partial, URL])
        if hashlib.file_digest(partial.open('rb'), 'sha256').hexdigest() != SHA256:
            fail('MySQL download checksum mismatch. No archive was executed or extracted.')
        partial.rename(archive)
    if hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest() != SHA256:
        fail('MySQL archive checksum mismatch. Keep the file for inspection; no extraction performed.')
    run(['tar', '-xzf', archive, '-C', RUNTIME])
    provision_mysql()


def records():
    return json.loads(PID_FILE.read_text()) if PID_FILE.exists() else {}


def save_records(value):
    temporary = PID_FILE.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    os.chmod(temporary, 0o600)
    temporary.replace(PID_FILE)


def process_identity(pid):
    result = subprocess.run(['/bin/ps', '-p', str(pid), '-o', 'lstart=', '-o', 'command='], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else ''


def owned(name):
    record = records().get(name)
    if not record:
        return None
    identity = process_identity(record['pid'])
    return record if identity and identity == record['identity'] and record['marker'] in identity else None


def port_available(port):
    try:
        with socket.socket() as probe:
            # A stopped listener may leave TIME_WAIT sockets. Like the actual
            # servers, allow rebinding those while still refusing a live listener.
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            probe.bind(('127.0.0.1', port))
        return True
    except OSError as error:
        if error.errno in (errno.EPERM, errno.EACCES):
            fail('This execution environment denies local socket binding. Run in an approved local-service terminal; no port was changed.')
        return False


def launch(name, command, marker, env=None, cwd=ROOT):
    log = RUNTIME / f'{name}.log'
    with log.open('ab') as output:
        child = subprocess.Popen([str(x) for x in command], cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
    time.sleep(0.15)
    if child.poll() is not None:
        fail(f'{name} exited; inspect {log}. No unrelated process was changed.')
    identity = process_identity(child.pid)
    if marker not in identity:
        fail(f'Cannot verify {name} process identity. Inspect {log} and process {child.pid}; no unverified process is signaled.')
    value = records()
    value[name] = {'pid': child.pid, 'marker': marker, 'identity': identity}
    save_records(value)


def mysql(sql, root=False, bootstrap=False):
    if bootstrap:
        command = [MYSQL / 'bin/mysql', '--no-defaults', '--protocol=socket', f'--socket={SOCKET}', '--user=root', '--batch', '--skip-column-names']
    else:
        command = [MYSQL / 'bin/mysql', f'--defaults-file={RUNTIME / ("mysql-root.cnf" if root else "mysql-app.cnf")}', '--batch', '--skip-column-names']
        if not root:
            command.append('fresh_mall_demo')
    try:
        result = run(command, input=sql, text=True, capture_output=True)
    except subprocess.CalledProcessError as error:
        (RUNTIME / 'mysql-client-error.log').write_text(error.stderr or 'MySQL client failed.\n')
        raise
    return result.stdout.strip()


def mysql_ready(bootstrap=False):
    try:
        return mysql('SELECT 1;', root=True, bootstrap=bootstrap) == '1'
    except subprocess.CalledProcessError:
        return False


def wait_for(predicate, name, timeout=90):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if predicate():
            return
        if not owned(name):
            fail(f'{name} stopped before readiness; inspect .runtime/{name}.log.')
        time.sleep(0.5)
    fail(f'Timed out waiting for {name}; inspect .runtime/{name}.log. Data is retained.')


def start_mysql():
    values = prepare()
    provision_mysql()
    if owned('mysql'):
        if mysql_ready():
            print('MySQL already running (owned demo process).')
            return
        fail('Owned MySQL process is not ready; inspect .runtime/mysql.log before retrying.')
    if not port_available(3306):
        fail('127.0.0.1:3306 is occupied by an unowned service. Nothing was stopped or overwritten.')
    initialized = DATA / 'mysql'
    if not initialized.exists():
        DATA.mkdir(mode=0o700, exist_ok=True)
        run([MYSQL / 'bin/mysqld', '--no-defaults', f'--basedir={MYSQL}', f'--datadir={DATA}', '--initialize-insecure', f'--log-error={RUNTIME / "mysql-initialize.log"}'])
    base_command = [MYSQL / 'bin/mysqld', '--no-defaults', f'--basedir={MYSQL}', f'--datadir={DATA}', f'--socket={SOCKET}', f'--pid-file={RUNTIME / "mysql.pid"}', '--mysqlx=OFF', '--bind-address=127.0.0.1', '--port=3306', '--default-time-zone=+00:00', '--character-set-server=utf8mb4', '--collation-server=utf8mb4_0900_ai_ci', '--skip-log-bin', f'--log-error={RUNTIME / "mysql.log"}']
    secured = RUNTIME / 'mysql-secured'
    if not secured.exists():
        # An initial passwordless server is reachable only through the private Unix socket.
        launch('mysql', base_command + ['--skip-networking'], str(MYSQL / 'bin/mysqld'))
        wait_for(lambda: mysql_ready(bootstrap=True) or mysql_ready(), 'mysql')
        if mysql_ready(bootstrap=True):
            mysql(f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{values['DB_ROOT_PASSWORD']}';", bootstrap=True)
        mysql(f"CREATE DATABASE IF NOT EXISTS fresh_mall_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE USER IF NOT EXISTS 'fresh_mall_demo'@'localhost' IDENTIFIED BY '{values['DB_PASSWORD']}'; GRANT ALL PRIVILEGES ON fresh_mall_demo.* TO 'fresh_mall_demo'@'localhost';", root=True)
        private_write(secured, f'Portable MySQL {VERSION}; initial credentials protected before TCP startup.\n')
        stop('mysql')
    launch('mysql', base_command, str(MYSQL / 'bin/mysqld'))
    wait_for(mysql_ready, 'mysql')
    actual = mysql('SELECT @@version,@@bind_address,@@port,@@datadir;', root=True)
    if str(DATA) not in actual or not actual.startswith(VERSION):
        fail('Database identity differs from the isolated demo; do not import seed.')
    print(f'MySQL {VERSION} ready on 127.0.0.1:3306, isolated data retained in .runtime/mysql-data.')


def java_environment():
    env = os.environ.copy()
    env.update(prepare())
    # Initialization and account-distribution secrets never enter the backend process.
    env.pop('DB_ROOT_PASSWORD', None)
    env.pop('APP_DEMO_PASSWORD', None)
    # Even an older --no-build JAR lacking application-demo.yml must stay local.
    env['SERVER_ADDRESS'] = '127.0.0.1'
    if not env.get('JAVA_HOME') and platform.system() == 'Darwin':
        env['JAVA_HOME'] = run(['/usr/libexec/java_home', '-v', '21'], capture_output=True, text=True).stdout.strip()
    java = Path(env['JAVA_HOME']) / 'bin/java' if env.get('JAVA_HOME') else Path('java')
    result = run([java, '-version'], capture_output=True, text=True)
    if 'version "21.' not in result.stderr:
        fail('Java 21 is required. Set JAVA_HOME without changing the system installation.')
    return env, java


def backend_healthy():
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open('http://127.0.0.1:8080/actuator/health', timeout=2) as response:
            return json.load(response).get('status') == 'UP'
    except Exception:
        return False


def start_backend(no_build):
    if owned('backend'):
        wait_for(backend_healthy, 'backend')
        print('Backend already running (owned demo process); stop before rebuilding.')
        return
    if not port_available(8080):
        fail('127.0.0.1:8080 is occupied by an unowned service; no process was stopped.')
    env, java = java_environment()
    if not no_build:
        with (RUNTIME / 'backend-build.log').open('wb') as output:
            result = subprocess.run([str(ROOT / 'backend/mvnw'), '-B', '-ntp', '-DskipTests', 'package'], cwd=ROOT / 'backend', env=env, stdout=output, stderr=subprocess.STDOUT)
        if result.returncode != 0:
            fail('Backend build failed; inspect .runtime/backend-build.log. This startup build does not run tests.')
    if not JAR.exists():
        fail('Backend JAR missing. Run without --no-build to build it.')
    launch('backend', [java, '-jar', JAR], str(JAR), env=env)
    wait_for(backend_healthy, 'backend', timeout=120)
    print('Backend health UP at http://127.0.0.1:8080/actuator/health.')


def seed():
    values = prepare()
    if not owned('mysql') or not mysql_ready():
        fail('Start the owned demo MySQL before importing seed.')
    if not mysql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='fresh_mall_demo' AND table_name='fm_user';") == '1':
        fail('Run backend Flyway migrations before importing seed.')
    marker = RUNTIME / 'demo-seed-imported'
    count = int(mysql('SELECT COUNT(*) FROM fm_user;'))
    if count == 0:
        if int(mysql('SELECT COUNT(*) FROM fm_product;')) != 0:
            fail('Demo database contains products but no users. No seed was imported; inspect existing data.')
        destination = RUNTIME / f'demo-seed-{time.time_ns()}.sql'
        env = os.environ.copy()
        env['APP_DEMO_PASSWORD'] = values['APP_DEMO_PASSWORD']
        run([sys.executable, ROOT / 'scripts/generate-demo-seed.py', '--environment', 'demo', '--output', destination, '--base-url', 'http://localhost:8080'], env=env)
        content = destination.read_text()
        for original, role in enumerate(GENERATOR_ROLES, 1):
            phone_index = ROLES.index(role) + 1
            content = content.replace(f"'1990000000{original}'", f"'1380000000{phone_index}'")
        destination.write_text(content)
        mysql(content)
        if not marker.exists():
            private_write(marker, 'Inserted synthetic accounts, catalog, and stock; never reset automatically.\n')
        print('Imported 7 synthetic role accounts, 40 products, 45 SKUs and 136 inventory batches.')
    elif not marker.exists():
        fail('Database is populated without this script\'s seed marker. Existing data is preserved; no import or update performed.')
    else:
        print('Existing demo seed retained; accounts, orders, stock and passwords were not reset.')
    # Explicitly enable the DEMO-only new member campaign after V003 exists.
    campaign_exists = mysql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='fresh_mall_demo' AND table_name='fm_coupon_campaign';") == '1'
    campaign_marker = RUNTIME / 'demo-campaign-imported'
    if campaign_exists and not campaign_marker.exists():
        mysql("UPDATE fm_coupon_campaign SET enabled=TRUE,version=version+1 WHERE campaign_id='NEW_MEMBER_V1' AND enabled=FALSE;")
        mysql("INSERT INTO fm_coupon(coupon_id,user_id,campaign_id,name,discount_amount,min_goods_amount,status,expires_at,version,created_at) SELECT 'demo-member-newcomer','demo-member',campaign_id,name,discount_amount,min_goods_amount,'AVAILABLE',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL validity_days DAY),0,UTC_TIMESTAMP(6) FROM fm_coupon_campaign WHERE campaign_id='NEW_MEMBER_V1' AND NOT EXISTS(SELECT 1 FROM fm_coupon WHERE user_id='demo-member' AND campaign_id='NEW_MEMBER_V1');")
        private_write(campaign_marker, 'Demo campaign enabled and member coupon inserted once. Later configuration is retained.\n')


def start_frontend():
    if owned('frontend'):
        print('Frontend already running (owned demo process).')
        return
    if not port_available(5173):
        fail('127.0.0.1:5173 is occupied by an unowned service; no process was stopped.')
    vite = ROOT / 'frontend/node_modules/vite/bin/vite.js'
    if not vite.exists():
        run(['npm', 'ci'], cwd=ROOT / 'frontend')
    if not (ROOT / 'frontend/index.html').exists():
        fail('Frontend entry is not yet present. Backend and MySQL are ready; add frontend/index.html before restarting.')
    run(['npm', 'run', 'import:design'], cwd=ROOT / 'frontend')
    launch('frontend', ['node', vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], str(vite), cwd=ROOT / 'frontend')
    def ready():
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open('http://127.0.0.1:5173/', timeout=2) as response:
                return response.status == 200
        except Exception:
            return False
    wait_for(ready, 'frontend', timeout=30)
    print('Frontend ready at http://localhost:5173. This is a local sandbox; no real charges.')


def stop(name):
    record = owned(name)
    if not record:
        print(f'{name}: no matching owned process; nothing stopped.')
        return
    os.kill(record['pid'], signal.SIGTERM)
    end = time.monotonic() + 30
    while time.monotonic() < end and owned(name):
        time.sleep(0.25)
    if owned(name):
        fail(f'{name} did not stop within 30 seconds. No forced kill was sent; inspect .runtime/{name}.log.')
    value = records()
    value.pop(name, None)
    save_records(value)
    print(f'{name}: stopped owned process; all data retained.')


def status():
    for name in ['mysql', 'backend', 'frontend']:
        record = owned(name)
        print(f'{name}: ' + (f'running (owned PID {record["pid"]})' if record else 'not running as an owned process'))
    print('backend health: ' + ('UP' if backend_healthy() else 'not ready'))
    print(f'Private demo account instructions: {RUNTIME / "demo-accounts.txt"}')


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'start', 'stop', 'status', 'seed', 'credentials'])
    parser.add_argument('--no-build', action='store_true', help='Use the existing backend JAR; migrations come from that JAR.')
    parser.add_argument('--database-only', action='store_true')
    parser.add_argument('--backend-only', action='store_true', help='Start DB and backend, import seed, but skip frontend.')
    arguments = parser.parse_args()
    try:
        if arguments.command == 'prepare':
            prepare()
            provision_mysql()
            print('Runtime and private stable credentials prepared; no service started.')
        elif arguments.command == 'start':
            start_mysql()
            if not arguments.database_only:
                start_backend(arguments.no_build)
                seed()
                if not arguments.backend_only:
                    start_frontend()
        elif arguments.command == 'stop':
            for name in ['frontend', 'backend', 'mysql']:
                stop(name)
        elif arguments.command == 'seed':
            seed()
        elif arguments.command == 'credentials':
            if not (RUNTIME / 'demo-accounts.txt').exists():
                fail('Run demo-start.sh or demo-runtime.py prepare first.')
            print((RUNTIME / 'demo-accounts.txt').read_text(), end='')
        else:
            status()
    except subprocess.CalledProcessError as error:
        # Do not print command inputs/environment: they may contain generated secrets.
        fail(f'Runtime command failed (exit {error.returncode}). Inspect the relevant .runtime log; existing data was retained.')
