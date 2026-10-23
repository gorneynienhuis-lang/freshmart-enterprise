#!/usr/bin/env python3
"""Local recording helper. Never prints credentials or sends requests to Railway."""
import argparse,datetime,http.cookiejar,importlib.util,json,time,urllib.error,urllib.parse,urllib.request,uuid
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('scene',choices=['status','permissions','throttle','idempotency'])
parser.add_argument('--project',type=Path,default=Path(__file__).resolve().parents[2])
args=parser.parse_args();root=args.project.resolve();base='http://127.0.0.1:8080'
spec=importlib.util.spec_from_file_location('fm_demo',root/'scripts/demo-runtime.py');demo=importlib.util.module_from_spec(spec);spec.loader.exec_module(demo)
clients=[];responses=[]
class Client:
 def __init__(self,role):
  self.role=role;self.token=None;self.csrf=None;self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(self.jar));clients.append(self)
 def api(self,method,path,body=None,key=None,show=True):
  assert path.startswith(('/api/v1/','/actuator/health')) and '://' not in path
  headers={'Origin':'http://localhost:5173'}
  if self.token:headers['Authorization']='Bearer '+self.token
  if self.csrf:headers['X-CSRF-Token']=self.csrf
  if method!='GET' and not path.startswith('/api/v1/auth/'):headers['Idempotency-Key']=key or str(uuid.uuid4())
  if body is not None:headers['Content-Type']='application/json'
  request=urllib.request.Request(base+path,method=method,headers=headers,data=None if body is None else json.dumps(body).encode())
  try:r=self.http.open(request,timeout=20)
  except urllib.error.HTTPError as e:r=e
  obj=json.loads(r.read());entry={'role':self.role,'method':method,'path':path.split('?')[0],'http':r.status,'code':obj.get('code'),'message':obj.get('message'),'traceId':obj.get('traceId')}
  if r.headers.get('Retry-After'):entry['Retry-After']=r.headers.get('Retry-After')
  responses.append(entry)
  if show:print(json.dumps(entry,ensure_ascii=False),flush=True)
  return r.status,obj
 def login(self,phone):
  code,obj=self.api('GET','/api/v1/auth/csrf',show=False);self.csrf=obj['data']['csrfToken']
  code,obj=self.api('POST','/api/v1/auth/login',{'phone':phone,'password':demo.load_env()['APP_DEMO_PASSWORD']},show=False)
  if code!=200:raise RuntimeError('Local demo login failed. Check private local credentials; no password reset or retry guessing was attempted.')
  self.token=obj['data']['accessToken']
 def data(self,method,path,body=None,key=None,show=False):
  status,obj=self.api(method,path,body,key,show)
  if status not in (200,201):raise RuntimeError('API rejected operation: '+str(status)+' '+str(obj.get('message')))
  return obj.get('data')
created=None;member=None;outcome='INCOMPLETE'
try:
 print('LOCAL COURSE SANDBOX · '+args.scene+' · '+datetime.datetime.now().astimezone().isoformat(timespec='seconds'),flush=True)
 if args.scene=='status':
  c=Client('GUEST');status,obj=c.api('GET','/actuator/health');print('Backend health:',obj.get('status'))
  for name in ['mysql','backend','frontend']:print(name+':', 'owned and running' if demo.owned(name) else 'not owned/running')
  print('商城 http://localhost:5173/ ; 工作台 http://localhost:5173/#/operations')
 elif args.scene=='permissions':
  c=Client('GUEST');code,_=c.api('GET','/api/v1/orders');assert code==401
  for role,phone,path in [('MEMBER','13800000001','/api/v1/admin/pick-tasks'),('PICKER','13800000002','/api/v1/admin/refunds'),('COURIER','13800000003','/api/v1/admin/employees'),('ADMIN','13800000007','/api/v1/admin/refunds')]:
   c=Client(role);c.login(phone);code,_=c.api('GET',path);assert code==403
  print('PASS: 401 + four role-based 403 responses. Tokens/cookies/passwords are not printed.')
 elif args.scene=='throttle':
  # A new nonexistent synthetic subject avoids locking any real demo user.
  phone='199'+str(time.time_ns()%100000000).zfill(8)
  if demo.mysql("SELECT COUNT(*) FROM fm_user WHERE phone='"+phone+"';")!='0':raise RuntimeError('Synthetic subject unexpectedly exists; nothing attempted.')
  c=Client('NONEXISTENT_SYNTHETIC_SUBJECT');_,o=c.api('GET','/api/v1/auth/csrf',show=False);c.csrf=o['data']['csrfToken']
  for i in range(1,7):
   print('Attempt',i,flush=True)
   code,_=c.api('POST','/api/v1/auth/login',{'phone':phone,'password':'Deliberately-Wrong-Demo-Only'})
   assert code==(401 if i<=5 else 429)
  print('PASS: attempts 1-5 are 401, attempt 6 is 429. No existing member/staff account was used.')
 elif args.scene=='idempotency':
  member=Client('MEMBER');member.login('13800000001')
  addresses=member.data('GET','/api/v1/addresses')['items']
  if not addresses:raise RuntimeError('Prepare a synthetic member address in the UI first.')
  addr=next((a for a in addresses if a.get('isDefault')),addresses[0]);date=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat()
  slots=member.data('GET','/api/v1/delivery-slots?'+urllib.parse.urlencode({'date':date,'addressId':addr['addressId']}))['items']
  slot=next((s for s in slots if s['available']),None)
  if not slot:raise RuntimeError('No available slot today. Record before the last cutoff, or prepare tomorrow\'s slot; no order created.')
  products=member.data('GET','/api/v1/products?size=100')['items'];sku=next((s for p in products for s in p['skus']if s['baseUnit']=='PIECE' and s['stockStatus']=='IN_STOCK'),None)
  if not sku:raise RuntimeError('No sellable piece SKU; no order created.')
  quote=member.data('POST','/api/v1/orders/quote',{'items':[{'skuId':sku['skuId'],'quantity':1}],'addressId':addr['addressId'],'slotId':slot['slotId'],'couponId':None})
  key=str(uuid.uuid4());body={'quoteId':quote['quoteId'],'quoteToken':quote['quoteToken'],'buyerNote':'录制辅助：单笔未支付幂等演示'}
  created=member.data('POST','/api/v1/orders',body,key=key,show=True)
  replay=member.data('POST','/api/v1/orders',body,key=key,show=True)
  assert replay['orderId']==created['orderId'];print('SAME_ORDER_ID:',created['orderId'],flush=True)
  code,_=member.api('POST','/api/v1/orders',{**body,'buyerNote':'录制辅助：同键不同请求体'},key=key);assert code==409
  print('PASS: one order only, same-key replay reused it, changed body returned 409.')
 outcome='PASS'
finally:
 if created and member:
  current=member.data('GET','/api/v1/orders/'+created['orderId'])
  if current['status']=='PENDING_PAY' and current['paidAmount']==0:
   member.data('POST','/api/v1/orders/'+created['orderId']+'/cancel',{'version':current['version'],'reason':'录制辅助结束，正常取消释放预占和名额'},show=True)
   print('Cleanup: the sole unpaid demonstration order was canceled normally.')
  else:print('Cleanup did not change an unexpected order state. Inspect the reported order ID.')
 for c in clients:
  if c.token:
   try:c.api('POST','/api/v1/auth/logout',{},show=False)
   except Exception:print('Warning: could not log out one helper-created session.')
   c.token=None
 runtime=root/'.runtime/defense-guide-20261023';runtime.mkdir(exist_ok=True,parents=True)
 (runtime/(args.scene+'-recording-result.json')).write_text(json.dumps({'scene':args.scene,'result':outcome,'responses':responses},ensure_ascii=False,indent=2))
