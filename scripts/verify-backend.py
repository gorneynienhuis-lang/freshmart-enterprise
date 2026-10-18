#!/usr/bin/env python3
"""Build a private source snapshot; never overwrite the JAR of a live demo."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(value, output, indent=2)
        output.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tests', help='Optional Maven test selection; omits packaging and the whole-project coverage gate.')
    parser.add_argument('--coverage', action='store_true', help='Full verify with the real JaCoCo report and 60%% backend line gate.')
    args = parser.parse_args()
    if args.tests and args.coverage:
        parser.error('Do not apply a whole-project coverage gate to a selected subset of tests.')
    parent = ROOT / '.runtime/builds'
    parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any(path.is_symlink() for path in (parent, *parent.parents)):
        raise RuntimeError('Refuse a linked private build path.')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    work = parent / (stamp + '-' + uuid.uuid4().hex[:8])
    work.mkdir(mode=0o700)
    protected_jars = {p.as_posix(): digest(p) for p in (ROOT / 'backend/target').glob('*-SNAPSHOT.jar')}
    sources = ['backend/pom.xml', 'backend/mvnw', 'backend/.mvn', 'backend/src', 'database/migrations']
    hashes = {}
    for selected in sources:
        base = ROOT / selected
        paths = sorted(base.rglob('*')) if base.is_dir() else [base]
        for path in paths:
            if path.is_symlink():
                raise RuntimeError('Refuse linked source inputs.')
            if not path.is_file():
                continue
            relative = path.relative_to(ROOT)
            output = work / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, output)
            hashes[relative.as_posix()] = digest(output)
    marker = {
        'sourceState': 'working tree copied at invocation; not a clean-install or remote-CI claim',
        'baseCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'copiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sourceSha256': hashes,
    }
    private_json(work / 'source.json', marker)
    command = [str(work / 'backend/mvnw'), '-B', '-ntp', '-f', str(work / 'backend/pom.xml')]
    if args.tests:
        command += ['-Dtest=' + args.tests, 'test']
    else:
        command += (['-Pcoverage'] if args.coverage else []) + ['verify']
    print(json.dumps({'status': 'RUNNING', 'directory': str(work), 'selectedTests': args.tests,
                      'coverage': args.coverage, 'mainJarChanged': False}), flush=True)
    log = work / 'maven.log'
    fd = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as output:
        result = subprocess.run(command, cwd=work, stdout=output, stderr=subprocess.STDOUT)
    totals = {key: 0 for key in ('tests', 'failures', 'errors', 'skipped')}
    suites = []
    for path in sorted((work / 'backend/target/surefire-reports').glob('TEST-*.xml')):
        suite = ET.parse(path).getroot()
        suites.append({key: suite.attrib[key] for key in ('name', 'tests', 'failures', 'errors', 'skipped', 'time')})
        for key in totals:
            totals[key] += int(suite.attrib[key])
    report = {'status': 'PASSED' if result.returncode == 0 and totals['tests'] > 0 and not any(totals[k] for k in ('failures','errors','skipped')) else 'FAILED',
              'mavenExitCode': result.returncode, 'directory': str(work), 'command': command,
              'selectedTests': args.tests, 'coverageEnabled': args.coverage,
              'tests': totals, 'suites': suites,
              'finishedAt': datetime.datetime.now(datetime.timezone.utc).isoformat()}
    coverage = work / 'backend/target/site/jacoco/jacoco.xml'
    if coverage.exists():
        report['coverage'] = {row.attrib['type']: {key: int(row.attrib[key]) for key in ('missed', 'covered')}
                              for row in ET.parse(coverage).getroot().findall('counter')}
    jars = list((work / 'backend/target').glob('*-SNAPSHOT.jar'))
    if len(jars) == 1:
        report['jar'] = str(jars[0]); report['jarSha256'] = digest(jars[0])
    for relative, original in hashes.items():
        if digest(ROOT / relative) != original:
            report['liveSourceChangedDuringBuild'] = True
            break
    else:
        report['liveSourceChangedDuringBuild'] = False
    report['mainJarChanged'] = protected_jars != {p.as_posix(): digest(p) for p in (ROOT / 'backend/target').glob('*-SNAPSHOT.jar')}
    if report['mainJarChanged']:
        report['status'] = 'FAILED'
    private_json(work / 'verification.json', report)
    print(json.dumps({key: report[key] for key in ('status', 'directory', 'mavenExitCode', 'tests', 'liveSourceChangedDuringBuild', 'mainJarChanged')}))
    return 0 if report['status'] == 'PASSED' else 1


if __name__ == '__main__':
    sys.exit(main())
