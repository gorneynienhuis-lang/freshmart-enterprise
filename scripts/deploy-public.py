#!/usr/bin/env python3
"""Prepare a course showcase without creating cloud resources or printing secrets.

Railway is the preferred no-server path. Compose remains a portable single-host option.
All mutations are explicit subcommands. Existing secrets, business data and passwords are retained.
"""
import argparse
import datetime as dt
import hashlib
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
from types import SimpleNamespace
from urllib.parse import urlparse
import uuid
from backup_bundle import (BackupError, canonical, extract_media, file_hash, integrity_key, make_bundle,
                           no_symlink_ancestors, private_dir, publish_bundle, require, unpack_sql, verify_bundle)
from backup_database import MysqlDatabase, SCHEMA, grant_schema

ROOT = Path(__file__).resolve().parents[1]
DEPLOY = ROOT / 'deploy'
ROLES = ['MEMBER', 'PICKER', 'COURIER', 'SERVICE', 'FINANCE', 'OPERATOR', 'ADMIN']
IMAGE_TAGS = {
    'JAVA_BUILD_IMAGE': 'eclipse-temurin:21.0.12.1_1-jdk-jammy',
    'JAVA_RUNTIME_IMAGE': 'eclipse-temurin:21.0.12.1_1-jre-jammy',
    'NODE_BUILD_IMAGE': 'node:26.12.0-bookworm-slim',
    'CADDY_IMAGE': 'caddy:2.11.7-alpine',
    'MYSQL_IMAGE': 'mysql:8.4.11',
}
DIGEST = re.compile(r'^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$')
EMPTY_TABLES = ['fm_user', 'fm_category', 'fm_product', 'fm_sku', 'fm_inventory_batch',
                'fm_order', 'fm_payment', 'fm_refund', 'fm_aftersale', 'fm_inventory_movement']


def fail(message):
    raise SystemExit(message)


def private_write(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(value)


def run(command, **kwargs):
    return subprocess.run([str(x) for x in command], check=True, **kwargs)


def load_env(directory):
    path = directory / '.env'
    if not path.exists():
        fail('Run init first; no configuration exists.')
    values = {}
    for line in path.read_text().splitlines():
        if line and not line.startswith('#'):
            key, value = line.split('=', 1)
            if not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or '\n' in value:
                fail('Malformed deployment configuration.')
            values[key] = value
    return values


def public_origin(value):
    parsed = urlparse(value)
    host = parsed.hostname or ''
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        fail('Use a public DNS hostname for the HTTPS site, not an IP address.')
    if (parsed.scheme != 'https' or parsed.netloc != host or parsed.path not in ('', '/')
            or parsed.query or parsed.fragment or not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host)
            or '.' not in host or host.endswith(('.localhost', '.local', '.internal'))):
        fail('origin must be an exact public https://hostname, with no port, path, credentials or query.')
    return f'https://{host}'


def current_commit():
    return run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, capture_output=True, text=True).stdout.strip()


def generate_seed(directory, origin, install_id, passwords):
    spec = importlib.util.spec_from_file_location('existing_demo_seed', ROOT / 'scripts/generate-demo-seed.py')
    generator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(generator)
    private = directory / 'private'
    draft = private / 'catalog-seed.draft.sql'
    previous = os.environ.get('APP_DEMO_PASSWORD')
    os.environ['APP_DEMO_PASSWORD'] = secrets.token_urlsafe(24)
    try:
        # Reuse the established catalogue, stock rules and PBKDF2 helper, not any local demo password.
        generator.generate(SimpleNamespace(output=draft, base_url=origin, base_date=None))
    finally:
        if previous is None:
            os.environ.pop('APP_DEMO_PASSWORD', None)
        else:
            os.environ['APP_DEMO_PASSWORD'] = previous
    lines = draft.read_text().splitlines()
    original_users = [line for line in lines if line.startswith('INSERT INTO fm_user (')]
    original_roles = [line for line in lines if line.startswith('INSERT INTO fm_user_role (')]
    if len(original_users) != 7 or len(original_roles) != 7:
        fail('Seed generator account structure changed. Draft retained; review before continuing.')
    # A future local generator may also create employee markers; replace those together.
    lines = [line for line in lines if not line.startswith(('INSERT INTO fm_user (', 'INSERT INTO fm_user_role (', 'INSERT INTO fm_employee ('))]
    now = dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
    accounts = []
    for index, role in enumerate(ROLES, 1):
        uid = 'demo-' + role.lower()
        accounts.append(generator.insert('fm_user',
            ['user_id', 'phone', 'password_hash', 'display_name', 'status', 'must_change_password', 'version', 'created_at', 'updated_at'],
            [uid, f'1380000000{index}', generator.password_hash(passwords[role]), f'课程演示-{role}', 'ACTIVE', True, 0, now, now]))
        accounts.append(generator.insert('fm_user_role', ['user_id', 'role_code'], [uid, role]))
        if role != 'MEMBER':
            accounts.append(generator.insert('fm_employee', ['employee_id', 'user_id', 'created_at'], [uid, uid, now]))
    marker = generator.insert('fm_audit_event',
        ['event_id', 'actor_id', 'operation', 'resource_type', 'resource_id', 'reason', 'after_summary', 'trace_id', 'created_at'],
        ['deploy-seed-' + install_id, 'system-deploy', 'DEPLOY_SEED', 'DEPLOYMENT', install_id,
         '首次插入课程合成账号、商品与库存；不覆盖现有数据', json.dumps({'origin': origin, 'accounts': 7}, ensure_ascii=False), install_id, now])
    start = lines.index('START TRANSACTION;') + 1
    lines[start:start] = accounts
    end = lines.index('COMMIT;')
    lines[end:end] = [
        "UPDATE fm_coupon_campaign SET enabled=TRUE,version=version+1 WHERE campaign_id='NEW_MEMBER_V1' AND enabled=FALSE;",
        "INSERT INTO fm_coupon(coupon_id,user_id,campaign_id,name,discount_amount,min_goods_amount,status,expires_at,version,created_at) SELECT 'demo-member-newcomer','demo-member',campaign_id,name,discount_amount,min_goods_amount,'AVAILABLE',DATE_ADD(UTC_TIMESTAMP(6),INTERVAL validity_days DAY),0,UTC_TIMESTAMP(6) FROM fm_coupon_campaign WHERE campaign_id='NEW_MEMBER_V1';",
        marker,
    ]
    private_write(private / 'seed.sql', '\n'.join(lines) + '\n')
    draft.unlink()  # This script created the temporary draft; no user input is removed.


def initialize(args):
    directory = args.directory
    if (directory / '.env').exists() or (directory / 'private').exists():
        fail('Deployment configuration already exists. Secrets and data were not changed.')
    origin = public_origin(args.origin)
    if not re.fullmatch(r'[^\s@=]+@[^\s@=]+\.[^\s@=]+', args.email):
        fail('Supply a valid certificate contact email.')
    directory.mkdir(parents=True, exist_ok=True)
    private = directory / 'private'
    private.mkdir(mode=0o700)
    os.chmod(private, 0o700)
    root_password, app_password = secrets.token_hex(24), secrets.token_hex(24)
    token_secret, sandbox_secret = secrets.token_hex(32), secrets.token_hex(32)
    passwords = {role: 'Fresh-' + secrets.token_urlsafe(18) for role in ROLES}
    install_id = str(uuid.uuid4())
    env = {'COMPOSE_PROJECT_NAME': 'freshmall', 'SITE_HOST': urlparse(origin).hostname,
           'PUBLIC_ORIGIN': origin, 'ACME_EMAIL': args.email, 'RELEASE_ID': current_commit()[:12], 'INSTALL_ID': install_id}
    private_write(directory / '.env', '# Generated once. Contains public settings only; secrets are in private/.\n' + ''.join(f'{k}={v}\n' for k, v in env.items()))
    private_write(private / 'mysql-root-password', root_password + '\n')
    private_write(private / 'mysql-app-password', app_password + '\n')
    for name, user, password in [('root', 'root', root_password), ('app', 'fresh_mall', app_password)]:
        private_write(private / f'mysql-{name}.cnf', f'[client]\nuser={user}\npassword={password}\ndefault-character-set=utf8mb4\n')
    private_write(private / 'backend.env', f'DB_PASSWORD={app_password}\nAPP_TOKEN_SECRET={token_secret}\nSANDBOX_SECRET={sandbox_secret}\n')
    # Railway's MySQL root credentials stay on its DB service. The app gets only this schema's user.
    private_write(private / 'railway-bootstrap.sql',
        f"CREATE DATABASE IF NOT EXISTS fresh_mall CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\nCREATE USER IF NOT EXISTS 'fresh_mall'@'%' IDENTIFIED BY '{app_password}';\nGRANT ALL PRIVILEGES ON {grant_schema('fresh_mall')}.* TO 'fresh_mall'@'%';\n")
    private_write(private / 'railway-app.env',
        'RAILWAY_DOCKERFILE_PATH=deploy/railway/Dockerfile\nSPRING_PROFILES_ACTIVE=showcase\nSERVER_ADDRESS=0.0.0.0\nSERVER_PORT=8080\nPORT=8080\n'
        'DB_URL=jdbc:mysql://${{MySQL.MYSQLHOST}}:${{MySQL.MYSQLPORT}}/fresh_mall?serverTimezone=UTC&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true\n'
        f'DB_USERNAME=fresh_mall\nDB_PASSWORD={app_password}\nAPP_TOKEN_SECRET={token_secret}\nSANDBOX_SECRET={sandbox_secret}\nAPP_ALLOWED_ORIGINS={origin}\nAPP_PUBLIC_ORIGIN={origin}\nAPP_MEDIA_DIR=/app/media\nRAILWAY_RUN_UID=0\nAPP_SECURE_COOKIES=true\nAPP_BRAND_NAME=东华鲜集\n')
    private_write(private / 'accounts.txt',
        f'仅用于课程展示；合成登录标识，不发送短信。网址：{origin}\n每个账号首次登录必须修改密码；下面是初始密码，修改后此文件不会自动更新。\n不要公开员工/管理员密码。访客可自行注册 MEMBER。\n\n'
        + '\n'.join(f'1380000000{i}  {role:<8}  {passwords[role]}' for i, role in enumerate(ROLES, 1))
        + '\n\n登录入口：网址首页右上角登录；员工登录后进入工作台。ADMIN为人员权限管理，OPERATOR为运营，PICKER拣货、COURIER配送、SERVICE售后审核、FINANCE退款执行。\n')
    generate_seed(directory, origin, install_id, passwords)
    check_files(args)
    print(f'Prepared private deployment files in {private}. No cloud resources or database data were changed. Passwords were not printed.')


def check_files(args):
    env = load_env(args.directory)
    if public_origin(env['PUBLIC_ORIGIN']) != env['PUBLIC_ORIGIN'] or env['SITE_HOST'] != urlparse(env['PUBLIC_ORIGIN']).hostname:
        fail('Hostname and public origin do not match.')
    try:
        if str(uuid.UUID(env['INSTALL_ID'])) != env['INSTALL_ID']:
            raise ValueError()
    except (KeyError, ValueError):
        fail('Invalid installation id; seed audit identity was not changed.')
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', env['COMPOSE_PROJECT_NAME']) or not re.fullmatch(r'[a-f0-9]{7,40}', env['RELEASE_ID']):
        fail('Invalid deployment project name or release id.')
    private = args.directory / 'private'
    if stat.S_IMODE(private.stat().st_mode) != 0o700:
        fail('private/ must have mode 0700.')
    for path in [args.directory / '.env', *private.iterdir()]:
        if path.is_file() and stat.S_IMODE(path.stat().st_mode) != 0o600:
            fail(f'Private configuration must have mode 0600: {path.name}')
    for name in ['accounts.txt', 'seed.sql', 'backend.env', 'railway-app.env', 'railway-bootstrap.sql']:
        if not (private / name).is_file():
            fail(f'Missing prepared file: {name}')
    seed = (private / 'seed.sql').read_text()
    if seed.count('INSERT INTO fm_user (') != 7 or seed.count('INSERT INTO fm_employee (') != 6:
        fail('Expected seven synthetic accounts and six employee markers.')
    users = [line for line in seed.splitlines() if line.startswith('INSERT INTO fm_user (')]
    if any(",TRUE,0," not in line for line in users):
        fail('Every initial account must require a password change.')
    if 'localhost' in seed or '127.0.0.1' in seed or env['PUBLIC_ORIGIN'] + '/catalog/' not in seed:
        fail('Catalogue must use the selected public HTTPS origin.')
    for index in range(1, 8):
        if seed.count(f"'1380000000{index}'") != 1:
            fail('Synthetic login identifiers differ from the published account mapping.')
    if '1990000000' in seed:
        fail('Unexpected local generator login mapping.')
    print('Offline checks passed: exact HTTPS origin, private file modes, seven independent role accounts, forced first password change, six employee markers and public catalogue URLs.')


def compose(args, *command, **kwargs):
    if args.directory != DEPLOY:
        fail('Docker commands use the real deploy/ directory only. Custom directories are for offline preparation checks.')
    return run(['docker', 'compose', '--env-file', DEPLOY / '.env', '-f', DEPLOY / 'compose.yaml', *command], cwd=ROOT, **kwargs)


def lock_images(args):
    env = load_env(args.directory)
    lock = args.directory / 'images.lock.json'
    if lock.exists():
        fail('images.lock.json exists. Preserve the previous release lock before resolving another release.')
    if not shutil.which('docker'):
        fail('Docker is not installed; no image digest verification was performed.')
    records = {}
    for key, tag in IMAGE_TAGS.items():
        run(['docker', 'pull', tag])
        result = run(['docker', 'image', 'inspect', '--format', '{{json .RepoDigests}}', tag], capture_output=True, text=True)
        refs = json.loads(result.stdout)
        ref = next((ref for ref in refs if DIGEST.fullmatch(ref)), None)
        if not ref:
            fail(f'No immutable repository digest returned for {tag}. Configuration was not replaced.')
        env[key] = ref
        records[key] = {'requestedTag': tag, 'resolvedDigest': ref}
    temporary = args.directory / '.env.new'
    private_write(temporary, '# Generated public settings and immutable image references. No passwords.\n' + ''.join(f'{k}={v}\n' for k, v in env.items()))
    temporary.replace(args.directory / '.env')
    private_write(lock, json.dumps({'resolvedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'images': records}, indent=2) + '\n')
    print('Official images pulled and immutable digests recorded. No service was started.')


def require_images(args):
    env = load_env(args.directory)
    if any(not DIGEST.fullmatch(env.get(key, '')) for key in IMAGE_TAGS):
        fail('Immutable image references are missing. Run lock-images; do not deploy .env.example.')


def remote_mysql(args, sql):
    if args.transport == 'compose':
        return compose(args, 'exec', '-T', 'db', 'mysql', '--defaults-extra-file=/run/secrets/mysql-root.cnf',
                       '--batch', '--skip-column-names', 'fresh_mall', input=sql, capture_output=True, text=True).stdout.strip()
    if not args.project:
        fail('Railway commands require the explicit --project id; no implicit linked project is modified.')
    # Command contains no credentials. Secret values are expanded only inside the DB container.
    script = 'export MYSQL_PWD="${MYSQL_ROOT_PASSWORD:?Missing MySQL root environment}"; exec mysql --user=root --host=127.0.0.1 --batch --skip-column-names mysql'
    return run(['railway', 'ssh', '--project', args.project, '--service', args.service, '--', 'sh', '-c', script],
               input=sql, capture_output=True, text=True).stdout.strip()


def import_seed(args):
    check_files(args)
    env = load_env(args.directory)
    # Both transports explicitly select the project schema. Railway's transport initially connects to mysql.
    schema = 'USE fresh_mall;\n'
    marker = "SELECT COUNT(*) FROM fm_audit_event WHERE operation='DEPLOY_SEED' AND resource_id='" + env['INSTALL_ID'] + "';"
    if remote_mysql(args, schema + marker) == '1':
        print('This installation seed is already present. Passwords, stock, coupons and business records were retained.')
        return
    count_sql = schema + 'SELECT ' + '+'.join(f'(SELECT COUNT(*) FROM {table})' for table in EMPTY_TABLES) + ';'
    if remote_mysql(args, count_sql) != '0':
        fail('Database already contains business data without this installation marker. Nothing was imported or reset.')
    # Do not share this URL or allow registrations before seed import; initial tables must remain empty.
    remote_mysql(args, schema + (args.directory / 'private/seed.sql').read_text())
    if remote_mysql(args, schema + marker) != '1':
        fail('Seed completion marker was not returned. Inspect private logs; do not retry by deleting data.')
    print('Inserted seven synthetic accounts, independent password hashes, six employees and public-origin catalogue. No existing data was overwritten.')


def bootstrap_railway(args):
    check_files(args)
    args.transport = 'railway'
    count = remote_mysql(args, "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='fresh_mall';")
    if count != '0':
        fail('fresh_mall already has tables. Bootstrap did not alter users, grants or data; inspect the existing deployment.')
    remote_mysql(args, (args.directory / 'private/railway-bootstrap.sql').read_text())
    print('Prepared the application schema and its schema-scoped account over Railway SSH. The database TCP port stayed private.')


def up(args):
    check_files(args)
    require_images(args)
    if run(['git', 'status', '--porcelain', '--untracked-files=no'], cwd=ROOT, capture_output=True, text=True).stdout.strip():
        fail('Commit reviewed source changes before a public deployment. No containers were changed.')
    os.environ['RELEASE_ID'] = current_commit()[:12]
    compose(args, 'config', '--quiet')  # Never emit env_file contents.
    compose(args, 'build', 'backend', 'web')
    compose(args, 'run', '--rm', '--no-deps', 'web', 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile')
    compose(args, 'up', '-d', '--wait', '--wait-timeout', '240', 'db', 'backend')
    args.transport = 'compose'
    import_seed(args)
    compose(args, 'up', '-d', '--wait', '--wait-timeout', '180', 'web')
    print('Compose services are healthy. Public HTTPS, browser login, cookies, business flow and backup recovery still require explicit verification from another network.')


def compose_database(args):
    require(args.directory == DEPLOY, 'Database operations require the real deploy/ project directory.')
    prefix = ['docker', 'compose', '--env-file', DEPLOY / '.env', '-f', DEPLOY / 'compose.yaml', 'exec', '-T', 'db']
    return MysqlDatabase(prefix + ['mysql', '--defaults-extra-file=/run/secrets/mysql-root.cnf'],
                         prefix + ['mysqldump', '--defaults-extra-file=/run/secrets/mysql-root.cnf'], 'fresh_mall')


def container(args, name):
    ids = compose(args, 'ps', '-a', '-q', name, capture_output=True, text=True).stdout.split()
    require(len(ids) == 1 and re.fullmatch(r'[a-f0-9]{12,64}', ids[0]), 'Expected exactly one managed Compose ' + name + ' container.')
    identity = ids[0]
    labels = json.loads(run(['docker', 'inspect', '--format', '{{json .Config.Labels}}', identity], capture_output=True, text=True).stdout)
    require(labels.get('com.docker.compose.project') == load_env(args.directory)['COMPOSE_PROJECT_NAME'] and labels.get('com.docker.compose.service') == name, 'Container ownership labels do not match this deployment.')
    state = json.loads(run(['docker', 'inspect', '--format', '{{json .State}}', identity], capture_output=True, text=True).stdout)
    require(not state.get('Paused') and not state.get('Restarting'), 'Container is paused/restarting; no backup state change was attempted.')
    return identity, bool(state['Running'])


def backup(args):
    require(args.transport == 'compose', 'Railway complete-volume export has not been executed/validated. MySQL-only exports are not complete backups; use the paired maintenance procedure in deploy/备份恢复.md.')
    require_images(args)
    require(args.pause_application, 'Complete backup requires an explicit --pause-application maintenance window.')
    web, backend, db_container = container(args, 'web'), container(args, 'backend'), container(args, 'db')
    require(db_container[1], 'Database must already be running; backup never changes database startup state.')
    resume = [name for name, state in [('backend', backend), ('web', web)] if state[1]]
    key = integrity_key(args.directory / 'private/backup-integrity.key', create=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = args.directory / 'backups' / ('fresh-mall-' + stamp)
    work = private_dir(args.directory / 'backup-work' / ('capture-' + uuid.uuid4().hex), new=True)
    database = compose_database(args)
    try:
        if resume:
            compose(args, 'stop', '--timeout', '30', *reversed(resume), capture_output=True, text=True)
        require(not container(args, 'backend')[1] and not container(args, 'web')[1], 'Application containers did not remain stopped.')
        with database.read_lock():
            before = database.metadata()
            sql, media = work / 'database.sql', private_dir(work / 'media')
            database.dump(sql)
            # docker cp supports stopped containers and does not follow links without -L;
            # all copied entries are still independently validated before bundling.
            run(['docker', 'cp', backend[0] + ':/app/media/.', media], capture_output=True, text=True)
            metadata = {'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(),
                        'source': {'gitCommit': current_commit(), 'imageLockSha256': file_hash(args.directory / 'images.lock.json'),
                                   'publicOrigin': load_env(args.directory)['PUBLIC_ORIGIN']},
                        'database': before, 'consistency': {'applicationWriters': 'owned web/backend containers stopped',
                        'database': 'global read lock across SQL/metadata/media copy', 'mediaScopes': ['product', 'private', 'review-public']}}
            manifest = make_bundle(work / 'bundle', sql, media, metadata, key)
            require(database.metadata() == before and not container(args, 'backend')[1] and not container(args, 'web')[1], 'Source changed during capture; partial bundle not accepted.')
            publish_bundle(work / 'bundle', destination)
        print(json.dumps({'status': 'COMPLETE_BUNDLE_VERIFIED_NOT_RESTORED', 'bundle': str(destination), 'mediaFiles': len(manifest['mediaFiles']), 'mainDataChanged': False}))
    finally:
        if resume:
            compose(args, 'start', *resume, capture_output=True, text=True)


def restore(args):
    require(args.transport == 'compose', 'Railway paired restore transport is not yet validated. No resource, database or volume was changed.')
    require(args.confirm_isolated_schema == args.schema and SCHEMA.fullmatch(args.schema), 'Restore needs a matching explicit fresh_mall_restore_<unique> target, never fresh_mall.')
    manifest = verify_bundle(args.backup, integrity_key(args.directory / 'private/backup-integrity.key'))
    database = compose_database(args)
    directory = no_symlink_ancestors(args.recovery_directory)
    media = no_symlink_ancestors(args.media_directory)
    require(not directory.exists() and directory.parent == args.directory / 'recoveries' and media == directory / 'media', 'Select a new deploy/recoveries/<unique>/ directory and its empty media/ child.')
    private_dir(directory, new=True)
    record = {'status': 'RESTORE_IN_PROGRESS', 'schema': args.schema, 'mediaDirectory': str(media), 'mainServicesStopped': False}
    temporary_cnf = None
    try:
        database.new_schema(args.schema)
        user, password = 'fmrec_' + secrets.token_hex(8), secrets.token_hex(24)
        database.query("CREATE USER '" + user + "'@'%' IDENTIFIED BY '" + password + "'; GRANT ALL PRIVILEGES ON " + grant_schema(args.schema) + ".* TO '" + user + "'@'%';", server=True)
        cnf = directory / 'mysql-recovery.cnf'
        private_write(cnf, '[client]\nuser=' + user + '\npassword=' + password + '\ndefault-character-set=utf8mb4\n')
        db_container = container(args, 'db')
        require(db_container[1], 'Owned database container is not running.')
        temporary_cnf = '/tmp/fresh-mall-recovery-' + uuid.uuid4().hex + '.cnf'
        run(['docker', 'cp', cnf, db_container[0] + ':' + temporary_cnf], capture_output=True, text=True)
        prefix = ['docker', 'compose', '--env-file', DEPLOY / '.env', '-f', DEPLOY / 'compose.yaml', 'exec', '-T', 'db']
        run(prefix + ['chmod', '600', temporary_cnf], capture_output=True, text=True)
        target = MysqlDatabase(prefix + ['mysql', '--defaults-extra-file=' + temporary_cnf],
                               prefix + ['mysqldump', '--defaults-extra-file=' + temporary_cnf], args.schema, root_client=database.root_client)
        sql = directory / 'restore.sql'
        unpack_sql(args.backup, sql)
        extract_media(args.backup, media, manifest)
        target.import_sql(sql)
        target.verify_restored(manifest, directory)
        private_write(directory / 'database.env.json', canonical({'DB_USERNAME': user, 'DB_PASSWORD': password, 'DB_SCHEMA': args.schema, 'APP_TOKEN_SECRET': secrets.token_hex(32), 'SANDBOX_SECRET': secrets.token_hex(32)}).decode())
        record.update(status='RESTORED_DATABASE_MEDIA_VERIFIED_NOT_STARTED', tables=len(manifest['database']['tables']), mediaFiles=len(manifest['mediaFiles']),
                      sqlRoundTripSha256=manifest['sql']['uncompressedSha256'], migrationVersions=[row['version'] for row in manifest['database']['migrations']])
    except Exception:
        record['status'] = 'FAILED_ISOLATED_TARGET_RETAINED'
        raise
    finally:
        cleanup_error = None
        if temporary_cnf:
            # Only this invocation's unpredictable, exact temporary filename.
            try:
                compose(args, 'exec', '-T', 'db', 'rm', '-f', temporary_cnf, capture_output=True, text=True)
            except (subprocess.SubprocessError, OSError) as error:
                cleanup_error = error
                record['status'] = 'FAILED_TEMP_RECOVERY_CREDENTIAL_CLEANUP'
        private_write(directory / 'recovery.json', canonical(record).decode())
        if cleanup_error:
            raise BackupError('Temporary scoped recovery credential cleanup failed. Private failure record and isolated target retained; do not start or publish them.') from cleanup_error
    print(json.dumps(record))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DEPLOY, help='Offline preparation output; Docker commands require the default deploy/ directory.')
    sub = parser.add_subparsers(dest='command', required=True)
    init = sub.add_parser('init')
    init.add_argument('--origin', required=True)
    init.add_argument('--email', required=True)
    for name in ['check', 'lock-images', 'up', 'status', 'credentials']:
        sub.add_parser(name)
    capture = sub.add_parser('backup')
    capture.add_argument('--transport', choices=['compose', 'railway'], default='compose')
    capture.add_argument('--pause-application', action='store_true')
    seed = sub.add_parser('seed')
    seed.add_argument('--transport', choices=['compose', 'railway'], default='compose')
    seed.add_argument('--project')
    seed.add_argument('--service', default='MySQL')
    bootstrap = sub.add_parser('railway-bootstrap')
    bootstrap.add_argument('--project', required=True)
    bootstrap.add_argument('--service', default='MySQL')
    recovery = sub.add_parser('restore')
    recovery.add_argument('backup', type=Path)
    recovery.add_argument('--transport', choices=['compose', 'railway'], default='compose')
    recovery.add_argument('--schema', required=True)
    recovery.add_argument('--confirm-isolated-schema', required=True)
    recovery.add_argument('--recovery-directory', required=True, type=Path)
    recovery.add_argument('--media-directory', required=True, type=Path)
    args = parser.parse_args()
    args.directory = args.directory.resolve()
    if args.command == 'restore':
        args.recovery_directory = no_symlink_ancestors(args.recovery_directory)
    handlers = {'init': initialize, 'check': check_files, 'lock-images': lock_images, 'up': up,
                'seed': import_seed, 'railway-bootstrap': bootstrap_railway, 'backup': backup, 'restore': restore}
    try:
        if args.command == 'credentials':
            # Deliberate explicit command only; normal prepare/check/status never prints credentials.
            print((args.directory / 'private/accounts.txt').read_text(), end='')
        elif args.command == 'status':
            compose(args, 'ps')
        else:
            handlers[args.command](args)
    except BackupError as error:
        fail(str(error))
    except subprocess.CalledProcessError:
        fail('External command failed. No secret output was printed; inspect the target service privately before retrying.')


if __name__ == '__main__':
    main()
