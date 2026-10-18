#!/usr/bin/env python3
"""Explicit isolated source checks; never overwrites live node_modules, generated assets or backend/target."""
import argparse,datetime,hashlib,json,os,shutil,subprocess,sys,urllib.request,uuid,xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2];CI=ROOT/'deploy/ci';LOCK=json.loads((CI/'dependencies.lock.json').read_text())
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def private(path):
    if any(p.is_symlink() for p in (path,*path.parents)):raise RuntimeError('Private CI output refuses linked paths')
    path.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(path,0o700);return path
def write(path,data):
    with os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600),'w') as stream:stream.write(data)
def snapshot():
    base=private(CI/'.work');work=private(base/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]));source=private(work/'source')
    ignore=shutil.ignore_patterns('.git','.runtime','.work','reports','node_modules','target','dist','coverage','__pycache__','.env','.env.*','private','screens','*.log')
    for name in ['backend','database/migrations','frontend','contracts','design/v2','design/r04','scripts','deploy']:
        if any(p.is_symlink() for p in (ROOT/name).rglob('*') if not any(part in {'node_modules','target','.work','reports','.runtime'} for part in p.parts)):
            raise RuntimeError('Source snapshot refuses symbolic links')
        shutil.copytree(ROOT/name,source/name,ignore=ignore,symlinks=False)
    shutil.copyfile(ROOT/'.dockerignore',source/'.dockerignore')
    files={str(p.relative_to(source)):digest(p) for p in source.rglob('*') if p.is_file()}
    return work,source,files
def pin_wrapper(source,work):
    # Source wrapper has an exact version, but no checksum. Harden only this disposable copy.
    with urllib.request.urlopen(LOCK['maven_distribution_url'],timeout=30) as response:
        sha256=hashlib.sha256();sha512=hashlib.sha512();total=0
        while chunk:=response.read(1024*1024):
            total+=len(chunk)
            if total>30*1024*1024:raise RuntimeError('Maven archive exceeded bounded size')
            sha256.update(chunk);sha512.update(chunk)
    if sha512.hexdigest()!=LOCK['maven_distribution_sha512']:raise RuntimeError('Maven distribution failed pinned official SHA512')
    props=source/'backend/.mvn/wrapper/maven-wrapper.properties';text=props.read_text()
    text='\n'.join(line for line in text.splitlines() if not line.startswith('distributionSha256Sum='))
    props.write_text(text+'\ndistributionSha256Sum='+sha256.hexdigest()+'\n')
    return {'version':LOCK['runtime']['maven'],'official_sha512':sha512.hexdigest(),'derived_wrapper_sha256':sha256.hexdigest(),'bytes':total,'override':'Disposable source copy only; tracked backend properties unchanged.'}
def environment():
    return {key:value for key,value in os.environ.items() if not key.startswith(('APP_','DB_','REDIS_','SANDBOX_'))}
def run(command,cwd,log,timeout=1200):
    with log.open('wb') as stream:result=subprocess.run([str(c) for c in command],cwd=cwd,env=environment(),stdout=stream,stderr=subprocess.STDOUT,timeout=timeout)
    return {'command':[str(c) for c in command],'cwd':str(cwd),'exit_code':result.returncode,'log':log.name}
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--scope',choices=['all','contract','frontend','backend','scripts'],default='all');parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    if not args.execute:print('NOT EXECUTED: pass --execute to build/test a disposable source copy. No service is started.');return 2
    work,source,hashes=snapshot();report_dir=private(CI/'reports'/work.name);report={'scope':args.scope,'status':'RUNNING','source_sha256':hashes,'source_copy':str(source),'steps':[],'service_start_stop':False,'platform':sys.platform,'clean_linux_or_remote_ci_claim':False}
    protected={str(p):digest(p) for p in (ROOT/'backend/target').glob('*-SNAPSHOT.jar')}
    def step(name,command,cwd):
        record=run(command,cwd,report_dir/(name+'.log'));report['steps'].append(record)
        if record['exit_code']:raise RuntimeError('Check failed: '+name)
    try:
        if args.scope in ['all','contract']:step('contract',['node','scripts/validate-contract.mjs'],source)
        if args.scope in ['all','frontend']:
            front=source/'frontend';step('npm-ci',['npm','ci','--no-audit','--no-fund'],front);step('frontend-verify',['npm','run','verify'],front);step('frontend-coverage',['npm','run','test:coverage'],front);step('frontend-build',['npm','run','build'],front)
            for name in ['coverage/coverage-summary.json','coverage/lcov.info']:
                file=front/name
                if file.is_file():shutil.copyfile(file,report_dir/Path(name).name)
        if args.scope in ['all','backend']:
            report['maven_distribution']=pin_wrapper(source,work);wrapper=source/'backend/mvnw';wrapper.chmod(0o700)
            step('backend-verify-coverage',[wrapper,'-B','-ntp','-Pcoverage','verify'],source/'backend')
            suites=[ET.parse(p).getroot() for p in (source/'backend/target/surefire-reports').glob('TEST-*.xml')]
            report['backend_tests']={key:sum(int(s.get(key,'0')) for s in suites) for key in ['tests','failures','errors','skipped']}
            if report['backend_tests']['tests']==0 or any(report['backend_tests'][k] for k in ['failures','errors','skipped']):raise RuntimeError('Actual backend test reports are missing or unsuccessful')
            shutil.copytree(source/'backend/target/surefire-reports',report_dir/'surefire-reports',dirs_exist_ok=True)
            shutil.copytree(source/'backend/target/site/jacoco',report_dir/'jacoco',dirs_exist_ok=True)
        if args.scope in ['all','scripts']:
            step('offline-script-tests',['python3','-m','unittest','discover','-s','scripts/tests','-p','test_*.py'],source)
            step('monitoring-controller-tests',['python3','deploy/monitoring/test_runtime.py'],source)
            step('ci-controller-tests',['python3','deploy/ci/test_guards.py'],source)
        report['status']='PASSED'
    except Exception as error:report['status']='FAILED';report['error_type']=type(error).__name__
    finally:
        report['main_jar_unchanged']=protected=={str(p):digest(p) for p in (ROOT/'backend/target').glob('*-SNAPSHOT.jar')}
        if not report['main_jar_unchanged']:report['status']='FAILED'
        # Preserve reports even when a preceding step failed; private source/runtime is never uploaded.
        for folder,target in [(source/'backend/target/surefire-reports',report_dir/'surefire-reports'),(source/'backend/target/site/jacoco',report_dir/'jacoco')]:
            if folder.is_dir():shutil.copytree(folder,target,dirs_exist_ok=True)
        write(report_dir/'result.json',json.dumps(report,indent=2)+'\n')
        print(json.dumps({'status':report['status'],'report':str(report_dir/'result.json'),'main_jar_unchanged':report['main_jar_unchanged']}))
    return 0 if report['status']=='PASSED' else 1
if __name__=='__main__':sys.exit(main())
