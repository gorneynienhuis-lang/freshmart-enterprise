#!/usr/bin/env python3
"""Real classification-only Redis/HTTP evidence against the owned engineering backend.

Never launches/stops Java or sends business writes. Only its verified local Redis
may be stopped/restarted; finally restores it. Credentials stay in private files.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request

from backup_bundle import canonical, private_dir, private_write, regular_reader, require, BackupError

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / file)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value); return value


def main():
    engineering = module('owned_engineering', 'engineering-runtime.py')
    redis = module('owned_redis', 'redis-runtime.py')
    target = engineering.load_target()
    require(target['env']['APP_COMMERCE_JOBS_ENABLED'] == 'false', 'Live Redis checks require engineering commerce jobs to remain disabled.')
    state = engineering.owned(); require(state is not None, 'Engineering backend must already be owned/running.')
    engineering.require_listener(state)
    ns = redis.namespace(target['env']); instance = redis.BASE / ('instance-' + hashlib.sha256(ns.encode()).hexdigest()[:16])
    instance, info = redis.verified_instance(instance)
    require(redis.owned(instance) is not None, 'Expected dedicated Redis instance must already be owned/running.')
    token_path = Path(target['env']['APP_METRICS_TOKEN_FILE'])
    with regular_reader(token_path, private=True) as file: token = file.read().decode().strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    directory = private_dir(engineering.ENGINEERING / 'redis-evidence' / time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()), new=True)
    captures = []; initial_redis_pid = redis.owned(instance)['pid']; stopped = False

    def save(name, value): private_write(directory / name, canonical(value))
    def http(path, *, metrics=False):
        request = urllib.request.Request('http://127.0.0.1:18081' + path)
        if metrics: request.add_header('Authorization', 'Bearer ' + token)
        started = time.monotonic()
        with opener.open(request, timeout=3) as response:
            raw = response.read(2 * 1024 * 1024)
            result = {'path': path, 'httpStatus': response.status, 'elapsedMillis': round((time.monotonic()-started)*1000, 3),
                      'contentType': response.headers.get('Content-Type'), 'sha256': hashlib.sha256(raw).hexdigest()}
        captures.append(result)
        if metrics: return raw.decode(), result
        data = json.loads(raw); result['body'] = data; return data, result
    def metrics(label):
        raw, response = http('/actuator/prometheus', metrics=True)
        private_write(directory / (label + '-metrics.txt'), raw)
        result = {}
        for line in raw.splitlines():
            if line.startswith('freshmall_catalog_cache_total{'):
                found = re.search(r'result="([a-z_]+)"', line)
                if found: result[found.group(1)] = float(line.rsplit(' ', 1)[1])
        require(set(result) == {'hit','miss','invalid','redis_error','db_load','write','disabled','bypass'}, 'Classification metric labels are incomplete.')
        return result
    def stats():
        result = redis.command(instance, ['INFO', 'commandstats'])
        require(isinstance(result, str), 'Cannot observe real Redis command statistics.')
        return [line for line in result.splitlines() if line.startswith(('cmdstat_get:', 'cmdstat_set:', 'cmdstat_del:'))]
    def categories():
        data, response = http('/api/v1/categories')
        require(data.get('code') == 0 and isinstance(data.get('data', {}).get('items'), list) and data['data']['items'], 'Real category API returned no valid database rows.')
        for item in data['data']['items']:
            require(set(item) == {'categoryId','code','name','shortName','imageUrl','sortOrder'}, 'Cache API leaked or changed public category fields.')
        return data['data']['items'], response
    def process(action):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/redis-runtime.py'), action, '--instance', str(instance)], capture_output=True, text=True)
        require(result.returncode == 0, 'Owned Redis lifecycle action failed; private evidence preserves the stage.')
        return json.loads(result.stdout)
    def increment(after, before, field): return after[field] - before[field]

    result = {'status': 'INCOMPLETE', 'scope': 'real Redis8.2.10 classification cache only; no whole-shop hit-rate claim',
              'startedAt': engineering.now(), 'backendPort':18081,'backendPid':state['pid'],
              'schema':target['purpose']['schema'],'jarSha256':state['jarSha256'],
              'redisVersion':redis.VERSION,'redisBinarySha256':redis.file_hash(redis.BINARY),
              'redisInitialPid':initial_redis_pid,'namespaceKeySha256':hashlib.sha256(info['key'].encode()).hexdigest(),
              'commerceJobsEnabled':False, 'checks':{}, 'captures':captures, 'credentialsIncluded':False,
              'linuxDockerCloudValidated':False}
    try:
        # Exact-key deletion only; no FLUSHALL, FLUSHDB, KEYS, SCAN or global stat reset.
        require(redis.command(instance,['DEL',info['key']]) in (0,1), 'Exact-key cache preparation failed.')
        m0 = metrics('00-baseline'); redis0 = stats()
        rows, cold = categories(); m1 = metrics('01-cold'); ttl1 = redis.command(instance,['PTTL',info['key']])
        require(increment(m1,m0,'miss')==1 and increment(m1,m0,'db_load')==1 and increment(m1,m0,'write')==1
                and 54000 < ttl1 <= 65000,'Cold read did not actually load database and populate expiring Redis.')
        again, hit = categories(); m2 = metrics('02-hit')
        require(again==rows and increment(m2,m1,'hit')==1 and increment(m2,m1,'db_load')==0,'Redis hit did not bypass the database loader.')
        result['checks']['coldAndHit']={'passed':True,'categoryCount':len(rows),'remainingTtlMillis':ttl1,
               'metricsBefore':m0,'afterCold':m1,'afterHit':m2,'redisStatsBefore':redis0,'redisStatsAfter':stats()}

        valid = redis.command(instance,['GET',info['key']]); require(isinstance(valid,str),'Real cached JSON is missing.')
        for label, payload in [('malformed','not-json'),('wrong-identity',json.dumps(dict(json.loads(valid),identity='another-schema')))]:
            require(redis.command(instance,['SET',info['key'],payload,'EX',60])=='OK','Cannot prepare exact-key corruption test.')
            before=metrics('03-'+label+'-before'); got,_=categories(); after=metrics('03-'+label+'-after')
            require(got==rows and increment(after,before,'invalid')==1 and increment(after,before,'db_load')==1
                    and increment(after,before,'write')==1,'Invalid typed cache did not recover from the real database.')
            require(categories()[0]==rows,'Repaired cache response differs from database data.')
            result['checks'][label]={'passed':True,'before':before,'after':after}

        before=metrics('04-outage-before'); result['redisStop']=process('stop'); stopped=True
        outage=[]
        for _ in range(4):
            got,response=categories();require(got==rows,'Redis outage changed real classification data.');outage.append(response['elapsedMillis'])
        after=metrics('04-outage-after'); health,_=http('/actuator/health')
        require(health.get('status')=='UP' and increment(after,before,'redis_error')==1
                and increment(after,before,'db_load')==4 and increment(after,before,'bypass')==3,
                'Optional Redis outage did not preserve UP/database fallback/short breaker behavior.')
        result['checks']['redisDown']={'passed':True,'health':health,'latencyMillis':outage,'before':before,'after':after}
        result['redisRestart']=process('start'); stopped=False
        # Let the deliberately short breaker cool down; Redis contains no persisted cache.
        time.sleep(3.1)
        before=metrics('05-restart-before');got,_=categories();after=metrics('05-restart-cold')
        require(got==rows and increment(after,before,'miss')==1 and increment(after,before,'db_load')==1,
                'Redis recovery did not rebuild from MySQL.')
        got,_=categories();afterhit=metrics('05-restart-hit')
        require(got==rows and increment(afterhit,after,'hit')==1 and increment(afterhit,after,'db_load')==0,'Redis recovery did not return to real cache hits.')
        result['checks']['restart']={'passed':True,'before':before,'afterCold':after,'afterHit':afterhit}

        ttl_start=redis.command(instance,['PTTL',info['key']]);require(54000<ttl_start<=65000,'Restarted cache lacks expected 60±5 second TTL.')
        wait_started=time.monotonic();deadline=wait_started+70
        while time.monotonic()<deadline:
            current=redis.command(instance,['PTTL',info['key']])
            if current==-2:break
            require(isinstance(current,int) and current>=0,'Cache became non-expiring during natural TTL validation.')
            time.sleep(min(1,max(0.02,current/1000)))
        require(current==-2,'Real cache did not naturally expire within configured TTL bounds.')
        before=metrics('06-expiry-before');got,_=categories();after=metrics('06-expiry-after')
        require(got==rows and increment(after,before,'miss')==1 and increment(after,before,'db_load')==1
                and increment(after,before,'write')==1,'Natural expiry did not rebuild cache from the database.')
        result['checks']['naturalTtl']={'passed':True,'initialRemainingMillis':ttl_start,'waitedSeconds':round(time.monotonic()-wait_started,3),
                                       'observedExpiredPttl':current,'before':before,'after':after}
        probe=subprocess.run([sys.executable,str(ROOT/'scripts/redis-runtime.py'),'probe','--instance',str(instance)],capture_output=True,text=True)
        require(probe.returncode==0,'Final Redis ACL/PING proof failed.')
        result['finalRedisProbe']=json.loads(probe.stdout)
        require(engineering.owned()['pid']==state['pid'],'Engineering Java changed during Redis-only checks.')
        engineering.require_listener(state)
        result['status']='PASSED';result['completedAt']=engineering.now();result['redisFinalPid']=redis.owned(instance)['pid']
    except Exception as error:
        result['failureType']=type(error).__name__
        result['failureStageMessage']=str(error) if isinstance(error,BackupError) else 'Private evidence retained; no secret exception text included.'
        raise
    finally:
        if stopped:
            try: result['finallyRedisRestore']=process('start')
            except Exception as restore_error: result['finallyRedisRestoreFailureType']=type(restore_error).__name__
        result['captures']=captures
        save('summary.json',result)
        print(json.dumps({'status':result['status'],'evidence':str(directory/'summary.json'),'backendPort':18081,
                          'backendPid':state['pid'],'javaStopped':False,'mainServicesTouched':False}))
    return 0


if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:
        print(str(error) if isinstance(error,BackupError) else 'Live Redis verification failed ('+type(error).__name__+'); no secret values printed.',file=sys.stderr)
        sys.exit(1)
