#!/usr/bin/env python3
"""Static template/config checks only. Never creates a workflow, runs Docker, or touches a database."""
import hashlib,json,re,shutil,subprocess,sys,tomllib
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]; CI=ROOT/'deploy/ci'
LOCK=json.loads((CI/'dependencies.lock.json').read_text())
def parse_yaml(path):
    if not shutil.which('ruby'):raise RuntimeError('Ruby Psych is required for offline YAML parsing; no dependency was installed')
    # Plain mappings/sequences only; reviewed templates need no YAML objects or aliases.
    ruby="text=File.read(ARGV[0]); modern=Psych.method(:safe_load).parameters.any?{|_,name|name==:permitted_classes}; value=modern ? Psych.safe_load(text, permitted_classes: [], permitted_symbols: [], aliases: false) : Psych.safe_load(text, [], [], false); puts JSON.generate(value)"
    command=['ruby','-rpsych','-rjson','-e',ruby,str(path)]
    return json.loads(subprocess.check_output(command,text=True))
def main():
    workflow=parse_yaml(CI/'workflow.yml.template')
    assert set(workflow['on'])=={'push','pull_request','workflow_dispatch'}
    assert workflow['permissions']=={'contents':'read'}
    actions=[]
    for name,job in workflow['jobs'].items():
        assert job['runs-on']=='ubuntu-24.04' and 0<job['timeout-minutes']<=35
        for step in job['steps']:
            if 'uses' in step:
                repository,sha=step['uses'].split('@');assert re.fullmatch('[a-f0-9]{40}',sha)
                assert sha==LOCK['actions'][repository]['sha'];actions.append(step['uses'])
                if repository=='actions/checkout':assert step['with']['persist-credentials'] is False
                if repository=='actions/upload-artifact':assert step['if']=='always()' and step['with']['path']=='deploy/ci/reports/' and step['with']['include-hidden-files'] is False
            if 'run' in step:assert not re.search(r'github\.event|secrets\.|git push|curl.*\|.*sh',step['run'])
    smoke=parse_yaml(CI/'compose.smoke.yaml');assert set(smoke['services'])=={'db','app'}
    assert 'ports' not in smoke['services']['db'];assert smoke['services']['app']['ports']==['127.0.0.1::8080']
    assert all('external' not in str(v) for v in smoke.get('volumes',{}).values())
    for data in LOCK['images'].values():assert re.fullmatch(r'docker\.io/library/[a-z-]+@sha256:[a-f0-9]{64}',data['ref'])
    railway=tomllib.loads((ROOT/'deploy/railway/railway.toml').read_text());assert railway['build']['dockerfilePath']=='deploy/railway/Dockerfile'
    assert railway['deploy']['healthcheckPath']=='/actuator/health'
    props=(ROOT/'backend/.mvn/wrapper/maven-wrapper.properties').read_text();assert LOCK['maven_distribution_url'] in props
    assert not any(p.is_symlink() for p in CI.rglob('*'))
    report={'status':'PASSED','scope':'Static YAML/TOML/JSON and reviewed security invariants only; no workflow engine, Linux/container build, service or database execution.','actions_checked':len(actions),'container_tools':{name:shutil.which(name) for name in ['docker','podman','colima','nerdctl','lima']},'local_versions':{},'files_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in CI.iterdir() if p.is_file() and p.name!='static-verification.json'}}
    for tool,args in [('node',['--version']),('npm',['--version']),('java',['-version']),('python3',['--version']),('ruby',['-rpsych','-e','puts Psych::VERSION'])]:
        command=subprocess.run([tool,*args],capture_output=True,text=True);report['local_versions'][tool]=(command.stdout+command.stderr).strip()
    (CI/'static-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    reports=CI/'reports';reports.mkdir(exist_ok=True,mode=0o700);(reports/'static.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'actions_checked':len(actions),'linux_executed':False,'container_executed':False}))
if __name__=='__main__':
    try:main()
    except Exception as error:
        reports=CI/'reports';reports.mkdir(exist_ok=True,mode=0o700);(reports/'static-failure.json').write_text(json.dumps({'status':'FAILED','scope':'Static template check only','error_type':type(error).__name__},indent=2)+'\n');raise
