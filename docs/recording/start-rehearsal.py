#!/usr/bin/env python3
"""Reuse the retained demo database on 3307 without changing Homebrew MySQL."""
from pathlib import Path
import argparse,importlib.util
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[2])
ROOT=parser.parse_args().project.resolve()
spec=importlib.util.spec_from_file_location('freshmart_demo',ROOT/'scripts/demo-runtime.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.prepare();m.provision_mysql()
if not m.owned('mysql'):
 if not m.port_available(3307):m.fail('3307 occupied; no process changed.')
 cmd=[m.MYSQL/'bin/mysqld','--no-defaults',f'--basedir={m.MYSQL}',f'--datadir={m.DATA}',f'--socket={m.SOCKET}',f'--pid-file={m.RUNTIME / "mysql.pid"}','--mysqlx=OFF','--bind-address=127.0.0.1','--port=3307','--default-time-zone=+00:00','--character-set-server=utf8mb4','--collation-server=utf8mb4_0900_ai_ci','--skip-log-bin',f'--log-error={m.RUNTIME / "mysql.log"}']
 m.launch('mysql',cmd,str(m.MYSQL/'bin/mysqld'))
 m.wait_for(m.mysql_ready,'mysql')
actual=m.mysql('SELECT @@port,@@datadir;',root=True).split('\t')
if actual[0]!='3307' or Path(actual[1]).resolve()!=m.DATA.resolve():m.fail('Unexpected database identity; no application launched.')
original=m.java_environment
def environment():
 env,java=original();env['DB_URL']=env['DB_URL'].replace('127.0.0.1:3306/','127.0.0.1:3307/');return env,java
m.java_environment=environment
m.start_backend(no_build=True)
# Existing data only. Do not call seed(), change credentials or reset rows.
print('Retained demo counts:',m.mysql('SELECT COUNT(*) FROM fm_user; SELECT COUNT(*) FROM fm_product;'))
m.start_frontend()
print('Rehearsal ready: http://localhost:5173/ ; database isolated on 3307. No rows reset.')
