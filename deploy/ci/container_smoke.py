#!/usr/bin/env python3
"""Optional Linux-only, CI-owned Docker smoke. Never reuses production Compose or credentials."""
import argparse,datetime,json,os,re,secrets,shutil,subprocess,sys,urllib.error,urllib.request,uuid
from pathlib import Path
import verify

ROOT=verify.ROOT;CI=verify.CI;LOCK=verify.LOCK
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute:print('NOT EXECUTED: explicit --execute and Linux Docker Compose v2 are required.');return 2
    reports=verify.private(CI/'reports'/('containers-'+uuid.uuid4().hex[:12]));report={'status':'RUNNING','scope':'Owned Linux Docker build, anonymous real app health/static/API, application/database recreation with preserved volumes. Not public TLS, Railway or full business E2E.','checks':[],'external_deployment':False}
    if sys.platform!='linux' or not shutil.which('docker'):
        report.update(status='NOT_RUN',reason='Native Linux with Docker and Compose v2 is unavailable; no tool installed or service started.')
        verify.write(reports/'result.json',json.dumps(report,indent=2)+'\n');print(json.dumps(report));return 1
    work,source,hashes=verify.snapshot();private=verify.private(work/'private');project='fmci'+uuid.uuid4().hex[:16]
    report.update(project=project,source_sha256=hashes);sensitive=[secrets.token_hex(32) for _ in range(4)]
    root_password,app_password,token_key,sandbox_key=sensitive
    for name,value in [('root-password',root_password),('app-password',app_password),('app-client.cnf','[client]\nuser=fresh_mall_ci\npassword='+app_password+'\ndatabase=fresh_mall_ci\n'),('backend.env','DB_PASSWORD='+app_password+'\nAPP_TOKEN_SECRET='+token_key+'\nSANDBOX_SECRET='+sandbox_key+'\n')]:verify.write(private/name,value+'\n')
    app_image=project+'-app:test';env={**verify.environment(),'MYSQL_IMAGE':LOCK['images']['MYSQL_IMAGE']['ref'],'CI_APP_IMAGE':app_image,'CI_PRIVATE':str(private)}
    compose=['docker','compose','--project-name',project,'-f',str(CI/'compose.smoke.yaml')]
    started=False
    def execute(arguments,label,timeout=900,input_text=None):
        result=subprocess.run([str(x) for x in arguments],cwd=source,env=env,capture_output=True,text=True,timeout=timeout,input=input_text)
        text=result.stdout+'\n'+result.stderr
        for secret in sensitive:text=text.replace(secret,'[redacted-generated-ci-secret]')
        verify.write(reports/(label+'.log'),text)
        if result.returncode:raise RuntimeError('Owned container step failed: '+label)
        return result.stdout.strip()
    def command(*arguments,label,timeout=900):return execute(compose+list(arguments),label,timeout)
    def assert_owned():
        ids=command('ps','--all','--quiet',label='owned-ids').splitlines()
        for identity in ids:
            actual=execute(['docker','inspect','--format','{{ index .Config.Labels "com.docker.compose.project" }}',identity],'owned-label')
            if actual!=project:raise RuntimeError('Container project identity changed; refuse cleanup')
    def query(sql,label):return execute(compose+['exec','-T','db','mysql','--defaults-extra-file=/run/secrets/app-client','-Nse',sql],label)
    def http_checks(label):
        address=command('port','app','8080',label=label+'-port')
        if not re.fullmatch(r'127\.0\.0\.1:[0-9]{4,5}',address):raise RuntimeError('App port was not bound solely to loopback')
        base='http://'+address;opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
        index=None
        for path,expected in [('/actuator/health',200),('/index.html',200),('/api/v1/home',200),('/api/v1/auth/csrf',200),('/api/v1/admin/employees',401),('/actuator/prometheus',401)]:
            try:response=opener.open(base+path,timeout=7)
            except urllib.error.HTTPError as error:response=error
            body=response.read(6*1024*1024);assert response.status==expected,(path,response.status)
            if path=='/actuator/health':assert json.loads(body)['status']=='UP'
            if path=='/index.html':index=body.decode()
            if path=='/api/v1/auth/csrf':assert all('Secure' in value for value in response.headers.get_all('Set-Cookie',[])) and response.headers.get_all('Set-Cookie',[])
            report['checks'].append({'phase':label,'path':path,'status':response.status})
        assets=re.findall(r'(?:src|href)="(/assets/[^"<>]+\.(?:js|css))"',index)
        assert any(x.endswith('.js') for x in assets) and any(x.endswith('.css') for x in assets)
        for path in assets:
            with opener.open(base+path,timeout=7) as response:assert response.status==200 and response.read(1)
        report['checks'].append({'phase':label,'built_js_css_200':len(assets)})
    try:
        execute(['docker','compose','version'],'compose-version')
        if execute(['docker','version','--format','{{.Server.Os}}/{{.Server.Arch}}'],'docker-platform')!='linux/amd64':raise RuntimeError('This reviewed smoke requires a Linux amd64 Docker daemon')
        report['maven_distribution']=verify.pin_wrapper(source,work)
        build=['docker','build','--platform','linux/amd64','--file',str(source/'deploy/railway/Dockerfile'),'--tag',app_image]
        for key in ['JAVA_BUILD_IMAGE','JAVA_RUNTIME_IMAGE','NODE_BUILD_IMAGE']:build+=['--build-arg',key+'='+LOCK['images'][key]['ref']]
        execute(build+[str(source)],'single-jar-linux-build',1800)
        # Also compile the separate backend/web variants; no ACME/public deployment is started.
        for kind,keys in [('backend',['JAVA_BUILD_IMAGE','JAVA_RUNTIME_IMAGE']),('web',['NODE_BUILD_IMAGE','CADDY_IMAGE'])]:
            build=['docker','build','--platform','linux/amd64','--file',str(source/('deploy/Dockerfile.'+kind)),'--tag',project+'-'+kind+':test']
            for key in keys:build+=['--build-arg',key+'='+LOCK['images'][key]['ref']]
            execute(build+[str(source)],kind+'-linux-build',1800)
        command('config','--quiet',label='compose-config');started=True
        command('up','--detach','--wait','--wait-timeout','240',label='initial-up',timeout=300);http_checks('initial')
        marker=uuid.uuid4().hex;query("CREATE TABLE ci_persistence_probe(marker CHAR(32) PRIMARY KEY); INSERT INTO ci_persistence_probe VALUES('"+marker+"')",'create-isolated-marker')
        execute(compose+['exec','-T','app','sh','-c','cat > /app/media/ci_persistence_probe'],'write-owned-media-marker',input_text=marker)
        migrations=query('SELECT COUNT(*) FROM flyway_schema_history WHERE success=1','migration-count')
        assert_owned();command('down',label='recreate-without-dropping-volumes');command('up','--detach','--wait','--wait-timeout','240',label='recreated-up',timeout=300)
        assert query('SELECT marker FROM ci_persistence_probe','read-persisted-marker')==marker
        assert execute(compose+['exec','-T','app','cat','/app/media/ci_persistence_probe'],'read-persisted-media-marker')==marker
        assert query('SELECT COUNT(*) FROM flyway_schema_history WHERE success=1','migration-count-after')==migrations
        http_checks('recreated');report.update(status='PASSED',mysql_volume_marker_survived=True,media_volume_marker_survived=True,migration_count=int(migrations),fresh_linux_dependencies=True)
    except Exception as error:report.update(status='FAILED',error_type=type(error).__name__)
    finally:
        if started:
            try:command('logs','--no-color','--tail','250',label='owned-container-logs',timeout=30)
            except Exception as error:report['log_collection_error_type']=type(error).__name__
            try:
                assert_owned();command('down','--volumes','--remove-orphans',label='owned-cleanup',timeout=90);report['owned_cleanup']='COMPLETED'
            except Exception as error:report.update(status='FAILED',owned_cleanup='UNCERTAIN_DO_NOT_PRUNE_UNRELATED_RESOURCES',cleanup_error_type=type(error).__name__)
        report['private_files_not_uploaded']=True
        verify.write(reports/'result.json',json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'report':str(reports/'result.json')}))
    return 0 if report['status']=='PASSED' else 1
if __name__=='__main__':sys.exit(main())
