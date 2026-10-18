#!/usr/bin/env python3
"""Isolated same-JAR package probe. Private configuration never leaves runtime logs."""
from pathlib import Path
import hashlib, http.client, http.server, json, os, re, secrets, shlex, shutil, socket, ssl, subprocess, threading, time, urllib.request, urllib.error, zipfile

root = Path(__file__).resolve().parents[3]
probe = root / '.runtime/showcase-package-probe'
out = root / 'docs/evidence/showcase-package'
out.mkdir(parents=True, exist_ok=True)
report = {'startedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'scope': 'Isolated local non-Docker same-JAR package and HTTP/browser checks, with local self-signed HTTPS forwarding. No public deployment, public CA, cloud platform or login validation.', 'profile': 'showcase', 'host': '127.0.0.1', 'port': 8181, 'security': {'secureCookies': True, 'allowedOrigin': 'https://localhost:8182', 'independentSigningSecrets': True, 'existingSessionsUsed': False, 'commerceJobsDisabledForProbe': True, 'flywayDisabledForProbe': True}, 'httpChecks': [], 'status': 'RUNNING'}
process = None
proxy = None
class LocalTLSProxy(http.server.BaseHTTPRequestHandler):
    def forward(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length) if length else None
        headers = {key: value for key, value in self.headers.items() if key.lower() not in ('connection','proxy-connection','transfer-encoding')}
        connection = http.client.HTTPConnection('127.0.0.1', 8181, timeout=15)
        try:
            connection.request(self.command, self.path, body, headers)
            response = connection.getresponse(); payload = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() not in ('connection','transfer-encoding','content-length'): self.send_header(key, value)
            self.send_header('Content-Length', str(len(payload))); self.end_headers(); self.wfile.write(payload)
        finally: connection.close()
    do_GET = forward
    do_POST = forward
    def log_message(self, *args): pass
def sha(file): return hashlib.sha256(file.read_bytes()).hexdigest()
def snapshot(directory): return {str(p.relative_to(directory)): sha(p) for p in sorted(directory.rglob('*')) if p.is_file()}
def get(path):
    try:
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open('http://127.0.0.1:8181' + path, timeout=12) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()
def check(path, expected):
    status, headers, body = get(path)
    value = {'path': path, 'status': status, 'bytes': len(body), 'contentType': headers.get('Content-Type'), 'sha256': hashlib.sha256(body).hexdigest()}
    report['httpChecks'].append(value)
    if status not in expected: raise RuntimeError(f'{path}: expected {expected}, got {status}')
    return headers, body
try:
    for port in (8181,8182):
        with socket.socket() as sock:
            if sock.connect_ex(('127.0.0.1', port)) == 0: raise RuntimeError(f'Port {port} already in use; no process was touched')
    if probe.exists(): raise RuntimeError('Isolated directory exists; refusing to overwrite previous probe')
    dist_before = snapshot(root / 'frontend/dist')
    shutil.copytree(root / 'backend', probe / 'backend', ignore=shutil.ignore_patterns('target'))
    shutil.copytree(root / 'database/migrations', probe / 'database/migrations')
    shutil.copytree(root / 'frontend/dist', probe / 'frontend/dist')
    shutil.copytree(probe / 'frontend/dist', probe / 'backend/src/main/resources/static', dirs_exist_ok=True)
    copied_dist = snapshot(probe / 'frontend/dist')
    if dist_before != copied_dist or snapshot(root / 'frontend/dist') != copied_dist: raise RuntimeError('Frontend dist changed while copying; no runtime launched')
    report['copiedFrontendSha256'] = copied_dist
    report['copiedBackendSourceSha256'] = snapshot(probe / 'backend/src')
    report['copiedMigrationSha256'] = snapshot(probe / 'database/migrations')
    print(json.dumps({'progress': 'copied', 'frontendFiles': len(copied_dist)}), flush=True)
    env = os.environ.copy()
    env['JAVA_HOME'] = subprocess.check_output(['/usr/libexec/java_home', '-v', '21'], text=True).strip()
    with (root / '.runtime/showcase-package-build.log').open('w') as log:
        built = subprocess.run([str(probe / 'backend/mvnw'), '-B', '-ntp', '-DskipTests', 'package'], cwd=probe / 'backend', env=env, stdout=log, stderr=subprocess.STDOUT)
    if built.returncode: raise RuntimeError('Isolated Maven build failed; inspect .runtime/showcase-package-build.log')
    jar = probe / 'backend/target/fresh-mall-backend-0.1.0-SNAPSHOT.jar'
    report['jarSha256'] = sha(jar)
    with zipfile.ZipFile(jar) as archive:
        names = set(archive.namelist())
        required = ['BOOT-INF/classes/static/index.html', 'BOOT-INF/classes/application-showcase.yml', 'BOOT-INF/classes/db/migration/V006__employee_governance.sql']
        if not all(name in names for name in required): raise RuntimeError('Expected static/profile/migration resources absent from JAR')
        report['jarResources'] = {'checked': required, 'staticResources': sum(n.startswith('BOOT-INF/classes/static/') and not n.endswith('/') for n in names)}
    values = {}
    for line in (root / '.runtime/demo.env').read_text().splitlines():
        if line.startswith('export '):
            key, _, value = line[7:].partition('=')
            values[key] = shlex.split(value)[0]
    for key in ('DB_URL', 'DB_USERNAME', 'DB_PASSWORD'): env[key] = values[key]
    env.update({'SPRING_PROFILES_ACTIVE': 'showcase', 'SERVER_ADDRESS': '127.0.0.1', 'SERVER_PORT': '8181', 'PORT': '8181', 'APP_ALLOWED_ORIGINS': 'https://localhost:8182', 'APP_SECURE_COOKIES': 'true', 'APP_TOKEN_SECRET': secrets.token_hex(32), 'SANDBOX_SECRET': secrets.token_hex(32), 'APP_COMMERCE_JOBS_ENABLED': 'false', 'SPRING_FLYWAY_ENABLED': 'false'})
    with (root / '.runtime/showcase-package-server.log').open('w') as log:
        process = subprocess.Popen([str(Path(env['JAVA_HOME']) / 'bin/java'), '-jar', str(jar)], cwd=probe, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(json.dumps({'progress': 'built-and-launched', 'pid': process.pid}), flush=True)
    for _ in range(120):
        if process.poll() is not None: raise RuntimeError('Probe application exited; inspect .runtime/showcase-package-server.log')
        try:
            status, _, _ = get('/actuator/health')
            if status == 200: break
        except (OSError, urllib.error.URLError): pass
        time.sleep(.5)
    else: raise RuntimeError('Probe application not ready')
    _, index = check('/index.html', [200])
    asset_paths = re.findall(r'(?:src|href)="(/assets/[^\"]+)"', index.decode())
    if not any(path.endswith('.js') for path in asset_paths) or not any(path.endswith('.css') for path in asset_paths): raise RuntimeError('Built JS/CSS references absent')
    for path in asset_paths: check(path, [200])
    wrong_origin = urllib.request.Request('http://127.0.0.1:8181'+asset_paths[0], headers={'Origin':'http://127.0.0.1:8181'})
    try:
        urllib.request.build_opener(urllib.request.ProxyHandler({})).open(wrong_origin, timeout=5)
        raise RuntimeError('Wrong HTTP origin was not rejected')
    except urllib.error.HTTPError as error:
        report['httpChecks'].append({'path':asset_paths[0], 'requestOrigin':'http://127.0.0.1:8181', 'status':error.code})
        if error.code != 403: raise RuntimeError('Wrong origin expected HTTP 403')
    generated = [p for p in sorted((probe / 'frontend/dist/generated').rglob('*')) if p.is_file() and p.suffix.lower() in ('.jpg', '.png', '.svg')][:3]
    for path in generated: check('/generated/' + str(path.relative_to(probe / 'frontend/dist/generated')), [200])
    check('/catalog/S001.jpg', [200])
    _, home_body = check('/api/v1/home', [200])
    if json.loads(home_body).get('code') != 0: raise RuntimeError('Home API returned non-success envelope')
    check('/api/v1/admin/employees', [401])
    check('/api/v1/package-probe-unknown', [401,404])
    check('/actuator/prometheus', [401])
    csrf_headers, _ = check('/api/v1/auth/csrf', [200])
    cookies = csrf_headers.get_all('Set-Cookie') or []
    report['csrfCookie'] = {'cookieName': 'csrf_context', 'secure': any(value.startswith('csrf_context=') and '; Secure' in value for value in cookies), 'tokenValueSaved': False}
    if not report['csrfCookie']['secure']: raise RuntimeError('CSRF cookie missing Secure attribute')
    certificate = root / '.runtime/showcase-package-cert.pem'
    key = root / '.runtime/showcase-package-key.pem'
    with (root / '.runtime/showcase-package-certificate.log').open('w') as log:
        generated = subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',str(key),'-out',str(certificate),'-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],stdout=log,stderr=subprocess.STDOUT)
    if generated.returncode: raise RuntimeError('Local self-signed certificate creation failed')
    key.chmod(0o600)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); context.load_cert_chain(certificate,key)
    proxy = http.server.ThreadingHTTPServer(('127.0.0.1',8182),LocalTLSProxy)
    proxy.socket = context.wrap_socket(proxy.socket,server_side=True)
    threading.Thread(target=proxy.serve_forever,daemon=True).start()
    report['localTLS'] = {'url':'https://localhost:8182','certificate':'self-signed, one-day local test certificate','certificateSha256':sha(certificate),'upstream':'http://127.0.0.1:8181','requestOriginUnchanged':True,'publicCAValidated':False}
    with (root / '.runtime/showcase-package-browser.log').open('w') as log:
        browser = subprocess.run(['node', str(Path(__file__).with_name('browser-probe.mjs'))], cwd=root, stdout=log, stderr=subprocess.STDOUT)
    if browser.returncode: raise RuntimeError('Anonymous packaged browser check failed; inspect .runtime/showcase-package-browser.log')
    report['browser'] = json.loads((out / 'browser.json').read_text())
    if report['browser']['status'] != 'PASSED': raise RuntimeError('Browser check reported failure')
    report['status'] = 'PASSED'
except Exception as error:
    report['status'] = 'FAILED'; report['failure'] = str(error)
finally:
    if proxy is not None:
        proxy.shutdown(); proxy.server_close()
        report['localTLSProxyStopped'] = True
    if process is not None:
        process.terminate()
        try: process.wait(timeout=15)
        except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)
        report['cleanup'] = {'onlyProbePidStopped': process.pid, 'exitCode': process.returncode}
    report['portsAfterCleanup'] = {}
    for port in (5173,8080,3306,8181,8182):
        with socket.socket() as sock:
            sock.settimeout(1)
            report['portsAfterCleanup'][str(port)] = sock.connect_ex(('127.0.0.1',port)) == 0
    report['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    (out / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'httpChecks': len(report['httpChecks']), 'cleanup': report.get('cleanup'), 'failure': report.get('failure')}), flush=True)
