#!/usr/bin/env python3
"""Package an explicit committed source tree, never the working tree or running database."""
from __future__ import annotations
import argparse,datetime,hashlib,json,os,re,secrets,stat,subprocess,sys,tempfile,unicodedata,urllib.parse,zipfile
from dataclasses import dataclass
from pathlib import Path,PurePosixPath,PureWindowsPath

ROOT=Path(__file__).resolve().parents[1]
REPOSITORY='https://github.com/gorneynienhuis-lang/freshmart-enterprise'
PREFIX='freshmart-enterprise/'
MAX_FILES=20000;MAX_FILE=80*1024*1024;MAX_TOTAL=1024*1024*1024
ALLOWED_ROOTS={'assets','backend','collab','contracts','database','deploy','design','docs','frontend','scripts','tests','.github'}
ROOT_FILES={'.dockerignore','.gitattributes','.gitignore','AGENTS.md','CLAUDE.md','README.md'}
PRIVATE_PARTS={'.git','.runtime','node_modules','target','.tools','.aws','.ssh','.codex','.venv','private','secrets','.work','mysql-data'}
PRIVATE_NAMES={'token','token.txt','scrape-token','github-token','credentials.json','credentials.txt','accounts.txt','demo-accounts.txt','demo.env','backend.env','mysql-root.cnf','mysql-app.cnf'}
BAD_ENDINGS=('.pem','.key','.p12','.jks','.keystore','.sql.gz','.dump','.sqlite','.sqlite3','.db','.log','.mp4','.mov','.zip','.tgz','.tar.gz','.7z','.jar','.class','.pyc','.dmg','.pkg','.exe')
IMAGE_ENDINGS={'.png','.jpg','.jpeg','.webp','.gif'}
SECRET_PATTERNS=[re.compile(rb'gh[pousr]_[A-Za-z0-9]{36,255}'),re.compile(rb'github_pat_[A-Za-z0-9_]{60,255}'),re.compile(rb'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{32,}'),re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}')]
REQUIRED={'README.md','frontend/package.json','frontend/package-lock.json','frontend/src/main.tsx','backend/pom.xml','backend/mvnw','backend/.mvn/wrapper/maven-wrapper.properties','backend/src/main/resources/application.yml','contracts/openapi.yaml','scripts/demo-start.sh','scripts/demo-runtime.py','deploy/README.md','deploy/railway/Dockerfile','design/v2/V2-Home.dc.html'}
HISTORICAL_SCHEMA={'docs/evidence/demo-runtime/mysql-first-start-schema.sql':'12c4528f32dd878b57af5c02309128687bc435a91cf04c4718a4727498431fbe'}
HISTORICAL_LOGS={
    'docs/evidence/implementation-foundation/backend-maven-clean-package-retry.log':'8e30c597766203f3c0425a1544bdcc9a0a72d6ea2abad5f2d7f570f1880f9c44',
    'docs/evidence/implementation-foundation/backend-maven-clean-package.log':'1b79a0d6704f354820429da6b9b6c96a3e821e33a610d768a4d24b0cad35a35a',
    'docs/evidence/implementation-foundation/v001-constraint-probe.log':'d216b62d306c8ca35cff405bc87dab5f83d099a310932ca10eabbbbce4e8cf59',
}

class PackageError(RuntimeError):pass
@dataclass(frozen=True)
class Entry:
    path:str
    oid:str
    size:int
    mode:str='100644'

def stable_json(value):return (json.dumps(value,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode()
def sha256(data):return hashlib.sha256(data).hexdigest()
def blob_oid(data,algorithm='sha1'):return hashlib.new(algorithm,b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def path_key(path):
    if not isinstance(path,str) or not path or path.startswith('/') or '\\' in path or PureWindowsPath(path).drive or any(ord(c)<32 or ord(c)==127 for c in path):raise PackageError('Unsafe archive path')
    parts=path.split('/')
    if any(p in {'','.','..'} or p.rstrip(' .')!=p for p in parts):raise PackageError('Unsafe archive path')
    return unicodedata.normalize('NFC',path).casefold()
def validate_entry(entry):
    path_key(entry.path);parts=PurePosixPath(entry.path).parts;lower=[p.casefold() for p in parts];name=lower[-1]
    if entry.mode not in {'100644','100755'}:raise PackageError('Non-regular tracked object is forbidden: '+entry.path)
    if not re.fullmatch(r'[a-f0-9]{40}|[a-f0-9]{64}',entry.oid) or not 0<=entry.size<=MAX_FILE:raise PackageError('Invalid or oversized Git blob: '+entry.path)
    forbidden_suffix=name.endswith(BAD_ENDINGS) and entry.path not in HISTORICAL_LOGS
    if any(p in PRIVATE_PARTS for p in lower) or name in PRIVATE_NAMES or name=='.ds_store' or forbidden_suffix:raise PackageError('Dangerous tracked private/build/runtime file: '+entry.path)
    if name=='.env' or (name.startswith('.env.') and name!='.env.example'):raise PackageError('Real environment file is forbidden: '+entry.path)
    if len(parts)==1 and entry.path not in ROOT_FILES:raise PackageError('Unreviewed root source scope: '+entry.path)
    if len(parts)>1 and parts[0] not in ALLOWED_ROOTS:raise PackageError('Unreviewed source scope: '+entry.path)
    if name.endswith('.sql') and not entry.path.startswith('database/migrations/') and entry.path not in HISTORICAL_SCHEMA:raise PackageError('SQL outside reviewed migration scope is forbidden: '+entry.path)
    if name.endswith('.rar') and not entry.path.startswith('assets/reference/dhu/original/'):raise PackageError('Unreviewed source archive is forbidden: '+entry.path)
def validate_content(entry,data):
    if len(data)!=entry.size or blob_oid(data,'sha256' if len(entry.oid)==64 else 'sha1')!=entry.oid:raise PackageError('Git blob identity or size mismatch: '+entry.path)
    if data.startswith(b'version https://git-lfs.github.com/spec/v1'):raise PackageError('LFS pointer is not a complete source asset: '+entry.path)
    if any(pattern.search(data) for pattern in SECRET_PATTERNS):raise PackageError('Possible credential in tracked blob; value is not printed: '+entry.path)
    if entry.path.endswith('.sql') and re.search(rb'(?im)^\s*(?:-- MySQL dump|USE\s+[`A-Za-z_]|CREATE\s+DATABASE\b)',data):raise PackageError('Database dump/schema-switch SQL is forbidden: '+entry.path)
    if entry.path in HISTORICAL_SCHEMA and (sha256(data)!=HISTORICAL_SCHEMA[entry.path] or re.search(rb'(?im)^\s*(?:INSERT|UPDATE|DELETE|REPLACE|LOAD|CALL)\b',data)):raise PackageError('Historical schema evidence changed; review required: '+entry.path)
    if entry.path in HISTORICAL_LOGS and sha256(data)!=HISTORICAL_LOGS[entry.path]:raise PackageError('Historical build evidence changed; review required: '+entry.path)
    if entry.path.endswith('/.env.example'):
        for line in data.decode('utf8').splitlines():
            if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
            key,value=line.split('=',1)
            if re.search(r'PASSWORD|SECRET|TOKEN|PRIVATE_KEY',key,re.I) and value.strip() and not re.fullmatch(r'(?:REQUIRED_[A-Z0-9_]+|CHANGE_ME|<[^>]+>|\$\{[^}]+\})',value.strip()):raise PackageError('Non-placeholder secret in environment example: '+entry.path)
def omit_archived_image(path):
    parts=PurePosixPath(path).parts
    return path.startswith('docs/evidence/') and PurePosixPath(path).suffix.lower() in IMAGE_ENDINGS and any(p=='attempts' or re.fullmatch(r'attempt-[A-Za-z0-9_-]+',p) for p in parts)
def git_environment():
    env={k:v for k,v in os.environ.items() if k not in {'GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_CONFIG_COUNT'} and not k.startswith(('GIT_CONFIG_KEY_','GIT_CONFIG_VALUE_'))}
    env.update(GIT_OPTIONAL_LOCKS='0',GIT_NO_REPLACE_OBJECTS='1',GIT_NO_LAZY_FETCH='1',GIT_PAGER='cat');return env
def git(repo,*args):
    result=subprocess.run(['git','--no-pager','-C',str(repo),*args],env=git_environment(),capture_output=True)
    if result.returncode:raise PackageError('Read-only Git object command failed; no remote fetch/write was requested')
    return result.stdout
class GitBlobs:
    def __init__(self,repo):self.process=subprocess.Popen(['git','--no-pager','-C',str(repo),'cat-file','--batch'],env=git_environment(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    def read(self,entry):
        self.process.stdin.write(entry.oid.encode()+b'\n');self.process.stdin.flush();header=self.process.stdout.readline(200).split()
        if len(header)!=3 or header[0].decode()!=entry.oid or header[1]!=b'blob' or int(header[2])!=entry.size:raise PackageError('Missing or mismatched committed Git blob')
        data=self.process.stdout.read(entry.size)
        if self.process.stdout.read(1)!=b'\n':raise PackageError('Invalid Git batch framing')
        return data
    def close(self):
        self.process.stdin.close();self.process.stdout.close();self.process.wait(timeout=10)
def committed_tree(repo,reference):
    if not re.fullmatch(r'[a-fA-F0-9]{7,64}',reference):raise PackageError('An explicit hexadecimal commit ID is required, not a mutable branch/HEAD')
    commit=git(repo,'rev-parse','--verify','--end-of-options',reference+'^{commit}').decode().strip()
    entries=[];seen=set()
    for row in git(repo,'ls-tree','-rlz','--full-tree',commit).split(b'\0'):
        if not row:continue
        meta,raw_path=row.split(b'\t',1);mode,kind,oid,size=meta.decode('ascii').split()
        if kind!='blob':raise PackageError('Submodules/non-blob source is forbidden')
        entry=Entry(raw_path.decode('utf8'),oid,int(size),mode);validate_entry(entry);key=path_key(entry.path)
        if key in seen:raise PackageError('Case/Unicode-colliding source paths')
        seen.add(key);entries.append(entry)
    if not entries or len(entries)>MAX_FILES or sum(e.size for e in entries)>MAX_TOTAL:raise PackageError('Source tree is empty or exceeds package resource limits')
    names={e.path for e in entries}
    if not REQUIRED<=names or not any(e.path.startswith('database/migrations/') and e.path.endswith('.sql') for e in entries):raise PackageError('Required build, design, SQL or startup source is missing from the commit')
    timestamp=int(git(repo,'show','-s','--format=%ct',commit).strip())
    return commit,timestamp,sorted(entries,key=lambda e:e.path)
def repository_url(url):
    value=urllib.parse.urlsplit(url)
    if value.scheme!='https' or value.netloc!='github.com' or value.query or value.fragment or not re.fullmatch(r'/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',value.path):raise PackageError('Use a credential-free HTTPS GitHub repository URL')
    return url.rstrip('/')
def readme(commit,url,tool_present,omit):
    return f'''# 东华大学社区生鲜超市系统 · 源码/SQL/部署交付包

源码来自 Git 提交 `{commit}`，不是当前工作树、数据库快照或已经上线的平台。
完整提交与 Git 历史：{url}/tree/{commit} （私有仓库需访问权限）。

解压后的 `freshmart-enterprise/` 是项目根目录；先读其中 README.md、deploy/README.md、docs/登录与后台使用.md、deploy/公网部署.md。
本机已验证路径为 macOS ARM64 + Java 21 + Node 26 + Python 3.11+：在项目根目录运行 `./scripts/demo-start.sh`，再打开 http://localhost:5173。
初次运行会下载依赖、生成新的合成演示库和随机密码；启动成功不等于完整测试通过。同机已有实例时需先正常处理端口冲突。
Linux/容器/CI/云平台的实际验收范围以本提交文档为准，不能因本 ZIP 有部署文件就称已上线。支付仅为课程沙箱。

## 账号和数据

ZIP 不含当前数据库、运行媒体、已有账号密码、JWT/支付/监控/GitHub 凭据或 .runtime。
新环境初始化后用 `./scripts/demo-credentials.sh` 私下查看本机 `.runtime/demo-accounts.txt`；这些私有文件不得再打包或公开上传。
当前演示环境的账号密码由项目负责人单独私下交付，本包不复制它们。源码中的合成测试字面值不是当前登录密码。
数据库只提供版本化迁移与受审阅初始化脚本，不提供当前数据的 SQL dump。
`docs/evidence/demo-runtime/mysql-first-start-schema.sql` 是精确散列白名单内的历史 DDL 复核证据，不是运行库 dump，也不是初始化入口；初始化仅按当前 Flyway 迁移与启动说明进行。
`docs/evidence/implementation-foundation/` 中三份固定散列日志仅为历史 H2 构建/约束测试证据，不是当前运行日志。

## 完整性和复现

SOURCE-MANIFEST.json 列出完整提交、每文件 SHA256/Git blob OID、数量/字节及任何明确排除项。
SHA256SUMS 在交付目录外层校验 ZIP 和独立 manifest；校验值应从可信渠道取得。散列校验不是数字签名。
打包器在所选提交中：{'是' if tool_present else '否；这是旧提交试包，执行工具在后续工作树，未伪称工具属于本提交'}。
归档截图策略：{'仅省略 docs/evidence 下已归档 attempt(s) 子目录的图片，逐项在 manifest 中保留完整提交链接' if omit else '保留全部受审阅 tracked 证据，包括历史失败尝试'}。
重新打包时需同一 commit、同一打包器 SHA、相同选项及 Python/zlib 环境；工作树脏文件不会进入包。
完整历史仍保留在 GitHub，不因交付包缩减而删除。PPT、录屏和当前运行数据不在本源码打包任务范围。
'''.encode()
def zip_info(path,timestamp,mode=0o644):
    moment=datetime.datetime.fromtimestamp(max(315532800,min(timestamp,4354819198)),datetime.timezone.utc)
    info=zipfile.ZipInfo(path,moment.timetuple()[:6]);info.create_system=3;info.external_attr=(stat.S_IFREG|mode)<<16;info.compress_type=zipfile.ZIP_DEFLATED;return info
def build_zip(path,commit,timestamp,entries,store,url,tool_sha,omit=False):
    rows=[];excluded=[];total=0;seen=set()
    if not entries or len(entries)>MAX_FILES or sum(e.size for e in entries)>MAX_TOTAL:raise PackageError('Source tree exceeds package resource limits')
    # Preflight all committed blobs, including optional omitted evidence; fail before creating a ZIP.
    for entry in entries:
        validate_entry(entry);key=path_key(entry.path)
        if key in seen:raise PackageError('Case/Unicode-colliding source paths')
        seen.add(key);data=store.read(entry);validate_content(entry,data)
        if omit and omit_archived_image(entry.path):excluded.append({'path':entry.path,'bytes':entry.size,'reason':'Explicit opt-in omission of archived attempt screenshot; source and full Git evidence preserved','git_blob_url':url+'/blob/'+commit+'/'+urllib.parse.quote(entry.path,safe='/')});continue
        rows.append({'path':entry.path,'archive_path':PREFIX+entry.path,'bytes':entry.size,'sha256':sha256(data),'git_blob_oid':entry.oid,'git_mode':entry.mode});total+=entry.size
    tool=next((r for r in rows if r['path']=='scripts/package-source.py'),None);present=bool(tool and tool['sha256']==tool_sha)
    introduction=readme(commit,url,present,omit)
    manifest={'format_version':1,'source_commit':commit,'commit_timestamp_utc':datetime.datetime.fromtimestamp(timestamp,datetime.timezone.utc).isoformat(),'repository_url':url,'source_tree_url':url+'/tree/'+commit,'source_truth':'Only tracked regular Git blobs from the explicit commit; never working-tree contents','packager':{'path':'scripts/package-source.py','execution_script_sha256':tool_sha,'identical_tool_in_selected_commit':present},'source_file_count':len(rows),'source_bytes':total,'payload_file_count':len(rows)+1,'payload_bytes_excluding_manifest':total+len(introduction),'files':rows,'generated_files':[{'archive_path':'DELIVERY-README.md','bytes':len(introduction),'sha256':sha256(introduction)}],'excluded':excluded,'reviewed_historical_sql_evidence':[{'path':path,'sha256':value,'purpose':'Historical DDL evidence only; not a running-database dump or initialization entrypoint'} for path,value in HISTORICAL_SCHEMA.items() if any(r['path']==path for r in rows)],'reviewed_historical_build_evidence':[{'path':path,'sha256':value,'purpose':'Historical H2 build/constraint-test evidence only; not current application runtime logs'} for path,value in HISTORICAL_LOGS.items() if any(r['path']==path for r in rows)],'manifest_self_digest':'Manifest cannot contain its own hash; its SHA256 and the ZIP SHA256 are in the outer SHA256SUMS.','limits':{'files':MAX_FILES,'file_bytes':MAX_FILE,'total_source_bytes':MAX_TOTAL},'archive_options':{'archived_screenshots_omitted':omit,'compression':'DEFLATE level 6','mtime':'explicit commit timestamp (ZIP two-second resolution)','ordering':'sorted source paths, then generated README and manifest'}}
    content=stable_json(manifest)
    with zipfile.ZipFile(path,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
        for row in rows:
            entry=next(e for e in entries if e.path==row['path']);data=store.read(entry)
            if sha256(data)!=row['sha256']:raise PackageError('Git content changed between preflight and archive')
            archive.writestr(zip_info(row['archive_path'],timestamp,0o755 if row['git_mode']=='100755' else 0o644),data,compresslevel=6)
        archive.writestr(zip_info('DELIVERY-README.md',timestamp),introduction,compresslevel=6)
        archive.writestr(zip_info('SOURCE-MANIFEST.json',timestamp),content,compresslevel=6)
    return manifest,content,introduction
def verify_zip(path,expected_sha256=None):
    if path.is_symlink() or not path.is_file():raise PackageError('ZIP must be an ordinary file')
    digest=hashlib.sha256()
    with path.open('rb') as file:
        while chunk:=file.read(1024*1024):digest.update(chunk)
    if expected_sha256 and digest.hexdigest()!=expected_sha256:raise PackageError('ZIP SHA256 does not match trusted expected value')
    with zipfile.ZipFile(path) as archive:
        infos=archive.infolist();keys=[path_key(i.filename) for i in infos]
        if len(infos)>MAX_FILES+2 or len(set(keys))!=len(keys) or sum(i.file_size for i in infos)>MAX_TOTAL+16*1024*1024:raise PackageError('Duplicate/oversized archive contents')
        if any(i.is_dir() or not stat.S_ISREG(i.external_attr>>16) or i.file_size>MAX_FILE for i in infos):raise PackageError('Archive contains non-regular or oversized entries')
        raw=archive.read('SOURCE-MANIFEST.json')
        if len(raw)>16*1024*1024:raise PackageError('Oversized manifest')
        manifest=json.loads(raw)
        if manifest.get('format_version')!=1 or not re.fullmatch(r'[a-f0-9]{40}|[a-f0-9]{64}',manifest.get('source_commit','')):raise PackageError('Invalid manifest version/commit')
        rows=manifest['files'];generated=manifest['generated_files']
        if len(generated)!=1 or generated[0].get('archive_path')!='DELIVERY-README.md':raise PackageError('Required generated delivery README is missing')
        if len(rows)!=manifest['source_file_count'] or len(rows)+len(generated)!=manifest['payload_file_count']:raise PackageError('Manifest file-count mismatch')
        if len({r['archive_path'] for r in rows+generated})!=len(rows+generated):raise PackageError('Duplicate manifest entries')
        if set(archive.namelist())!={r['archive_path'] for r in rows+generated}|{'SOURCE-MANIFEST.json'}:raise PackageError('Unlisted or missing ZIP member')
        source_total=0;payload_total=0
        for row in rows+generated:
            name=row['archive_path'];path_key(name);data=archive.read(name)
            if len(data)!=row['bytes'] or sha256(data)!=row['sha256']:raise PackageError('ZIP file hash/size mismatch: '+name)
            if row in rows:
                if name!=PREFIX+row['path']:raise PackageError('Unexpected source archive prefix')
                entry=Entry(row['path'],row['git_blob_oid'],row['bytes'],row['git_mode']);validate_entry(entry);validate_content(entry,data);source_total+=len(data)
                actual_mode=(archive.getinfo(name).external_attr>>16)&0o777
                if actual_mode!=(0o755 if entry.mode=='100755' else 0o644):raise PackageError('Source executable mode mismatch')
            elif name!='DELIVERY-README.md':raise PackageError('Unexpected generated file')
            payload_total+=len(data)
        if source_total!=manifest['source_bytes'] or payload_total!=manifest['payload_bytes_excluding_manifest']:raise PackageError('Manifest byte-total mismatch')
    return {'status':'VERIFIED','source_commit':manifest['source_commit'],'zip_sha256':digest.hexdigest(),'zip_bytes':path.stat().st_size,'source_file_count':len(rows),'source_bytes':source_total,'archive_entries':len(infos),'manifest_sha256':sha256(raw),'excluded_file_count':len(manifest['excluded']),'tool_identical_in_selected_commit':manifest['packager']['identical_tool_in_selected_commit']}
def safe_output(base,repo):
    absolute=Path(os.path.abspath(base))
    if absolute==repo or absolute.is_relative_to(repo):raise PackageError('Output must be outside the source repository')
    if any(p.is_symlink() for p in (absolute,*absolute.parents)):raise PackageError('Output cannot contain symlink components')
    absolute.mkdir(parents=True,exist_ok=True,mode=0o700)
    if not absolute.is_dir():raise PackageError('Output base is not a directory')
    return absolute
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--commit');parser.add_argument('--repo',type=Path,default=ROOT);parser.add_argument('--output',type=Path);parser.add_argument('--repository-url',default=REPOSITORY);parser.add_argument('--omit-archived-screenshots',action='store_true');parser.add_argument('--verify',type=Path);parser.add_argument('--expected-sha256');args=parser.parse_args()
    if args.verify:
        print(json.dumps(verify_zip(args.verify,args.expected_sha256),ensure_ascii=False,indent=2));return 0
    if not args.commit:parser.error('--commit is required; mutable HEAD/default branches are not inferred')
    repo=args.repo.resolve();url=repository_url(args.repository_url);commit,timestamp,entries=committed_tree(repo,args.commit)
    base=safe_output(args.output or repo.parent/'交付成果',repo);stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');output=base/('freshmart-enterprise-'+commit[:12]+'-'+stamp+'-'+secrets.token_hex(4));output.mkdir(mode=0o700)
    store=GitBlobs(repo);temporary=output/'source.zip.partial'
    try:
        manifest,raw,introduction=build_zip(temporary,commit,timestamp,entries,store,url,sha256(Path(__file__).read_bytes()),args.omit_archived_screenshots)
        result=verify_zip(temporary);target=output/('freshmart-enterprise-'+commit[:12]+'-source.zip');temporary.rename(target)
        (output/'SOURCE-MANIFEST.json').write_bytes(raw);(output/'DELIVERY-README.md').write_bytes(introduction)
        (output/'SHA256SUMS').write_text(result['zip_sha256']+'  '+target.name+'\n'+sha256(raw)+'  SOURCE-MANIFEST.json\n')
        result.update(output_directory=str(output),zip_path=str(target),verified_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),uploaded=False,running_database_included=False)
        (output/'VERIFICATION.json').write_bytes(stable_json(result));print(json.dumps(result,ensure_ascii=False,indent=2));return 0
    except Exception:
        temporary.unlink(missing_ok=True)
        if not list(output.iterdir()):output.rmdir()
        raise
    finally:store.close()
if __name__=='__main__':
    try:sys.exit(main())
    except (PackageError,OSError,ValueError,KeyError,zipfile.BadZipFile) as error:
        print('Source package failed: '+(str(error) if isinstance(error,PackageError) else type(error).__name__),file=sys.stderr);sys.exit(1)
