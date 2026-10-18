/** Isolated MySQL-only three-phase acceptance. Never run against the main demo.
 * REFUND_RECOVERY_PHASE=prepare|verify|cleanup
 * REFUND_RECOVERY_CONFIG=/absolute/private/config.json node scripts/e2e-refund-recovery.mjs
 * prepare requires jobs disabled. Root then restarts ONLY the isolated instance with jobs enabled.
 * No public fault API, no forged refund FAILED status, no automatic write replay.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {validateRuntimeResponse} from './validate-contract.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const phase=process.env.REFUND_RECOVERY_PHASE;
const configPath=process.env.REFUND_RECOVERY_CONFIG;
const assert=(test,message)=>{if(!test)throw new Error(message);};
assert(['prepare','verify','cleanup'].includes(phase),'Explicit REFUND_RECOVERY_PHASE is required.');
assert(configPath&&path.isAbsolute(configPath),'Absolute private config path is required.');
const info=await fs.stat(configPath);assert(!(info.mode&0o077),'Private config must have mode0600.');
const cfg=JSON.parse(await fs.readFile(configPath,'utf8'));
const base=new URL(cfg.baseUrl);assert(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)&&Number(base.port)>=18080&&Number(base.port)<=18999&&!base.username&&!base.password&&!base.search&&!base.hash&&base.pathname==='/','Only isolated loopback backend ports18080..18999 are allowed.');
assert(cfg.purpose==='engineering-refund-recovery','Private config must explicitly identify engineering-refund-recovery.');
assert(/^(fresh_mall_refund_recovery_|fresh_mall_restore_engineering_)[a-zA-Z0-9_]{5,70}$/.test(cfg.schema),'Dedicated engineering/refund schema required.');
assert(Number.isInteger(cfg.maxAttempts)&&cfg.maxAttempts>=1&&cfg.maxAttempts<=5,'Explicit isolated attempt count1..5 required.');
assert(path.isAbsolute(cfg.mysqlBinary)&&path.isAbsolute(cfg.mysqlDefaultsFile),'Private mysql paths must be absolute.');
const privateDir=path.join(root,'.runtime/refund-recovery',cfg.schema);await fs.mkdir(privateDir,{recursive:true,mode:0o700});
const stateFile=path.join(privateDir,'state.json');
if(phase==='prepare'){let existing=false;try{await fs.access(stateFile);existing=true;}catch{}assert(!existing,'A prepared/private run already exists for this schema; refuse overwrite or duplicate business writes.');}
let state=phase==='prepare'?{runId:new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex'),schema:cfg.schema,baseUrl:base.origin,purpose:cfg.purpose,scenarios:[],complete:false}:JSON.parse(await fs.readFile(stateFile,'utf8'));
assert(state.schema===cfg.schema&&state.baseUrl===base.origin&&state.purpose===cfg.purpose,'Config and prepared run do not match.');
const output=path.join(root,'docs/evidence/refund-recovery-v022',state.runId);await fs.mkdir(output,{recursive:true});
const report={runId:state.runId,phase,startedAt:new Date().toISOString(),status:'RUNNING',target:{schema:cfg.schema,baseUrl:base.origin,purpose:cfg.purpose},dataSource:'Real isolated MySQL and real HTTP business APIs. Only private per-refund fault plans are changed through SQL; no refund/order/payment/outbox state is forged.',responses:[],checkedResponses:0,schemaErrors:[],checks:[],snapshots:[],notExercised:['Browser UI is a separate acceptance window; this script verifies actual HTTP/SQL facts only.']};
const secrets=new Set([cfg.finance?.password]);
function clean(error){let text=String(error?.message??error);for(const secret of secrets)if(secret)text=text.split(secret).join('[redacted]');return text.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[redacted-token]');}
const run=promisify(execFile);
async function sql(statement){
 try{const {stdout}=await run(cfg.mysqlBinary,['--defaults-file='+cfg.mysqlDefaultsFile,'--database='+cfg.schema,'--batch','--raw','--skip-column-names','--execute',statement],{maxBuffer:2*1024*1024});return stdout.trim();}
 catch{throw new Error('Isolated mysql operation failed; credentials and SQL output suppressed.');}
}
// IDs originate only from validated API envelopes. This is not a generic SQL tool.
function id(value){assert(typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value),'Unexpected resource identifier.');return "'"+value+"'";}
async function persist(){await fs.writeFile(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});}
function handle(role){return{role,cookies:new Map(),token:null,csrf:null,user:null};}
async function api(h,method,route,body,{expected=200,key=crypto.randomUUID()}={}){
 const headers={Origin:base.origin};if(h.token)headers.Authorization='Bearer '+h.token;if(h.cookies.size)headers.Cookie=[...h.cookies].map(([k,v])=>k+'='+v).join(';');
 if(method!=='GET'&&!route.startsWith('/api/v1/auth/'))headers['Idempotency-Key']=key;
 if(method!=='GET'&&route.startsWith('/api/v1/auth/')&&h.csrf)headers['X-CSRF-Token']=h.csrf;
 if(body!==undefined)headers['Content-Type']='application/json';
 const response=await fetch(base.origin+route,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 for(const cookie of response.headers.getSetCookie()){const part=cookie.split(';',1)[0],at=part.indexOf('=');if(at>0)h.cookies.set(part.slice(0,at),part.slice(at+1));}
 const envelope=await response.json();const validation=validateRuntimeResponse(method,base.origin+route,response.status,envelope);assert(validation.covered,'Response has no contract schema: '+method+' '+route.split('?')[0]);report.checkedResponses++;report.schemaErrors.push(...validation.errors);report.responses.push({role:h.role,method,path:new URL(base.origin+route).pathname,status:response.status,traceId:envelope.traceId??null,at:new Date().toISOString()});
 assert(!validation.errors.length,'Contract response schema mismatch.');assert(response.status===expected,h.role+' '+method+' '+route.split('?')[0]+' expected '+expected+', got '+response.status);
 if(envelope.data?.accessToken){h.token=envelope.data.accessToken;secrets.add(h.token);h.user=envelope.data.user;assert(!h.user.mustChangePassword,'Account requires initial password change; original seed accounts will not be changed.');}
 return envelope.data;
}
async function csrf(h){h.csrf=(await api(h,'GET','/api/v1/auth/csrf')).csrfToken;}
async function login(h,credentials){assert(credentials?.phone&&credentials?.password,'Private login configuration missing.');secrets.add(credentials.password);await csrf(h);await api(h,'POST','/api/v1/auth/login',credentials);}
async function snapshot(s,label){
 const value=JSON.parse(await sql("SELECT JSON_OBJECT('refundId',r.refund_id,'orderId',r.order_id,'paymentId',r.payment_id,'amount',r.amount,'refundStatus',r.status,'executorId',r.executor_id,'reviewerId',r.reviewer_id,'refundVersion',r.version,'refundReserved',p.refund_reserved,'refundedAmount',p.refunded_amount,'orderRefundedAmount',o.refunded_amount,'outboxStatus',b.status,'attemptCount',b.attempt_count,'cycleAttemptCount',b.cycle_attempt_count,'leaseGeneration',b.lease_generation,'availableAt',CAST(b.available_at AS CHAR),'failedAt',CAST(b.failed_at AS CHAR),'lastErrorCode',b.last_error_code,'receiptCount',(SELECT COUNT(*) FROM fm_sandbox_refund_receipt c WHERE c.refund_id=r.refund_id),'receiptAmount',(SELECT c.amount FROM fm_sandbox_refund_receipt c WHERE c.refund_id=r.refund_id),'receiptBindingValid',(SELECT COUNT(*) FROM fm_sandbox_refund_receipt c WHERE c.refund_id=r.refund_id AND c.payment_id=r.payment_id AND c.amount=r.amount AND c.channel_refund_no=r.refund_id),'faultTriggered',f.triggered_count,'faultRemaining',f.remaining_failures) FROM fm_refund r JOIN fm_payment p ON p.payment_id=r.payment_id JOIN fm_order o ON o.order_id=r.order_id JOIN fm_outbox b ON b.aggregate_id=r.refund_id AND b.business_key=CONCAT('refund:',r.refund_id) LEFT JOIN fm_sandbox_refund_fault f ON f.refund_id=r.refund_id WHERE r.refund_id="+id(s.refundId)));
 report.snapshots.push({label,scenario:s.name,at:new Date().toISOString(),...value});return value;
}
async function wait(s,predicate,label){for(let n=0;n<180;n++){const value=await snapshot(s,label);if(predicate(value))return value;await new Promise(resolve=>setTimeout(resolve,500));}throw new Error('Timed out waiting for '+s.name+' '+label);}
async function refund(finance,s){const list=await api(finance,'GET','/api/v1/admin/refunds?orderId='+s.orderId+'&page=1&size=100');assert(list.total===1&&list.items.length===1&&list.items[0].refundId===s.refundId,'Expected exactly one original refund.');return list.items[0];}
try{
 assert(await sql('SELECT DATABASE();')===cfg.schema,'MySQL schema binding mismatch.');assert(await sql("SELECT COUNT(*) FROM flyway_schema_history WHERE version='013' AND success=1 OR version='13' AND success=1;")==='1','V013 must already be migrated by the isolated backend.');
 report.databaseVersion=await sql('SELECT VERSION();');assert(report.databaseVersion.startsWith('8.4.'),'Acceptance requires actual MySQL8.4, not H2.');
 for(const file of ['backend/src/main/java/com/freshmart/commerce/RefundProcessor.java','backend/src/main/java/com/freshmart/commerce/SandboxRefundReceiptStore.java','database/migrations/V013__refund_recovery.sql']){report.sourceSha256??={};report.sourceSha256[file]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex');}
 if(phase==='prepare'){
  assert(cfg.jobsDisabledForPrepare===true,'prepare requires explicit private confirmation that isolated jobs are disabled.');assert(!state.member&&!state.scenarios.length,'prepare will not overwrite an existing synthetic run.');
  const member=handle('MEMBER');state.member={phone:'139'+crypto.randomInt(10000000,100000000),password:'Recovery-'+crypto.randomUUID()};secrets.add(state.member.password);await persist();await csrf(member);await api(member,'POST','/api/v1/auth/register',{...state.member,displayName:'退款恢复合成验收'},{expected:201});state.memberId=member.user.userId;
  assert(await sql('SELECT COUNT(*) FROM fm_user WHERE user_id='+id(state.memberId))==='1','HTTP backend does not use the configured isolated schema.');
  const finance=handle('FINANCE');await login(finance,cfg.finance);state.financeId=finance.user.userId;assert(finance.user.userId!==state.memberId&&finance.user.permissions.includes('refund.retry'),'An independent FINANCE account is required.');
  const address=await api(member,'POST','/api/v1/addresses',{recipientName:'合成验收会员',phone:state.member.phone,province:'上海市',city:'上海市',district:'松江区',detail:'退款故障隔离验收地址，不用于配送',isDefault:true},{expected:201});state.addressId=address.addressId;await persist();
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));const slots=(await api(member,'GET','/api/v1/delivery-slots?date='+date+'&addressId='+address.addressId)).items;const slot=slots.find(s=>s.available&&s.remaining>=1);assert(slot,'No real future slot.');
  const products=(await api(member,'GET','/api/v1/products?size=100')).items;const product=products.find(p=>p.skus.some(s=>s.priceMode==='BY_PIECE'&&s.stockStatus!=='SOLD_OUT'));const sku=product?.skus.find(s=>s.priceMode==='BY_PIECE'&&s.stockStatus!=='SOLD_OUT');assert(sku,'No real sellable piece SKU.');
  for(const [name,mode,count] of [['transient','TRANSIENT_BEFORE_COMMIT',cfg.maxAttempts],['rejected','REJECT_BEFORE_COMMIT',1],['lost-ack','ACK_LOST_AFTER_COMMIT',1],['ui-retry','REJECT_BEFORE_COMMIT',1]]){
   const quote=await api(member,'POST','/api/v1/orders/quote',{items:[{skuId:sku.skuId,quantity:1}],addressId:address.addressId,slotId:slot.slotId,couponId:null});let order=await api(member,'POST','/api/v1/orders',{quoteId:quote.quoteId,quoteToken:quote.quoteToken,buyerNote:'隔离退款故障验收 '+state.runId+' '+name},{expected:201});const s={name,orderId:order.orderId,orderNo:order.orderNo,mode};state.scenarios.push(s);await persist();
   const payment=await api(member,'POST','/api/v1/payments/prepay',{orderId:order.orderId,purpose:'ORDER',adjustmentId:null},{expected:201});s.paymentId=payment.paymentId;await api(member,'POST','/api/v1/payments/'+payment.paymentId+'/sandbox-simulate',{outcome:'SUCCESS',version:payment.version});order=await api(member,'GET','/api/v1/orders/'+order.orderId);order=await api(member,'POST','/api/v1/orders/'+order.orderId+'/cancel',{reason:'真实取消产生故障演练退款',version:order.version});assert(order.status==='CANCELED'&&order.refunds.length===1,'Real cancellation did not produce one refund.');s.refundId=order.refunds[0].refundId;s.amount=order.refunds[0].amount;await persist();
   assert(await sql("SELECT attempt_count FROM fm_outbox WHERE aggregate_id="+id(s.refundId))==='0','Worker was active during prepare; do not fabricate or reset its state.');await sql("INSERT INTO fm_sandbox_refund_fault(refund_id,mode,remaining_failures,triggered_count,updated_at) VALUES("+id(s.refundId)+",'"+mode+"',"+count+",0,UTC_TIMESTAMP(6));");const row=await snapshot(s,'prepared-with-jobs-disabled');assert(row.outboxStatus==='PENDING'&&row.attemptCount===0&&row.refundReserved===s.amount&&row.receiptCount===0,'Prepare already raced with a worker.');
  }
  state.prepared=true;await persist();report.checks.push('Four cancellations used real API; per-refund faults armed while isolated jobs disabled, no financial state forged.');report.next='Root may now restart ONLY the isolated instance with jobs enabled and faults explicitly enabled; then run verify.';
 }else{
  assert(state.prepared&&state.scenarios.length===4,'A complete prepared isolated run is required.');const member=handle('MEMBER');await login(member,state.member);const finance=handle('FINANCE');await login(finance,cfg.finance);assert(member.user.userId===state.memberId&&finance.user.userId===state.financeId,'Prepared actor identities changed.');
  if(phase==='verify'){
   for(const s of state.scenarios){
    let row=await wait(s,r=>s.name==='lost-ack'?r.refundStatus==='SUCCESS':r.refundStatus==='FAILED'&&r.outboxStatus==='DEAD','automatic-fault-outcome');
    assert(row.faultTriggered===(s.name==='transient'?cfg.maxAttempts:1),'Actual fault did not occur expected number of times.');
    if(s.name==='lost-ack'){assert(row.receiptCount===1&&row.receiptBindingValid===1&&row.refundedAmount===s.amount&&row.refundReserved===0,'ACK loss did not preserve and reconcile one channel fact.');report.checks.push('Durable channel success survives a real adapter ACK-loss exception and is booked exactly once.');continue;}
    assert(row.receiptCount===0&&row.refundReserved===s.amount&&row.refundedAmount===0,'Failed refund released or consumed its reserve.');if(s.name==='transient')assert(row.attemptCount===cfg.maxAttempts,'Backoff attempts exceeded configured sending budget.');
    if(s.name==='ui-retry'){state.pendingUi={refundId:s.refundId,orderId:s.orderId,paymentId:s.paymentId,amount:s.amount,status:'AWAITING_REAL_UI'};await persist();report.pendingUi={...state.pendingUi};report.checks.push('ui-retry: real channel rejection created FAILED/DEAD with intact reserve; deliberately left for isolated UI acceptance.');continue;}
    const current=await refund(finance,s);await api(member,'POST','/api/v1/admin/refunds/'+s.refundId+'/retry',{reason:'会员越权恢复应被拒绝',version:current.version},{expected:403});await api(finance,'POST','/api/v1/admin/refunds/'+s.refundId+'/retry',{reason:'陈旧版本不得恢复',version:current.version-1},{expected:409});
    const key=crypto.randomUUID(),body={reason:'隔离验收：渠道明确失败后独立财务恢复原退款号',version:current.version};const first=await api(finance,'POST','/api/v1/admin/refunds/'+s.refundId+'/retry',body,{key});const replay=await api(finance,'POST','/api/v1/admin/refunds/'+s.refundId+'/retry',body,{key});assert(JSON.stringify(first)===JSON.stringify(replay),'Idempotent recovery response changed.');
    row=await wait(s,r=>r.refundStatus==='SUCCESS'&&r.outboxStatus==='COMPLETED','finance-original-id-recovery');assert(row.receiptCount===1&&row.receiptBindingValid===1&&row.refundReserved===0&&row.refundedAmount===s.amount&&row.orderRefundedAmount===s.amount,'Restored original refund did not conserve money.');const final=await refund(finance,s);assert(final.refundId===s.refundId&&final.executorId===state.financeId,'Recovery replaced the original identity or omitted new authorizer.');
    const audit=JSON.parse(await sql("SELECT JSON_OBJECT('count',COUNT(*),'oldExecutorKept',COALESCE(SUM(before_summary LIKE '%executor=SYSTEM%'),0),'actorMatches',COALESCE(SUM(actor_id="+id(state.financeId)+"),0)) FROM fm_audit_event WHERE resource_id="+id(s.refundId)+" AND operation='refund.retry'"));assert(audit.count===1&&audit.oldExecutorKept===1&&audit.actorMatches===1,'Recovery audit lost original executor or repeated on replay.');report.snapshots.push({label:'recovery-audit',scenario:s.name,...audit});report.checks.push(s.name+': actual FAILED+DEAD retains reserve; member/stale version blocked; FINANCE idempotent recovery reuses original refund and retains audit.');
   }
   assert(!report.schemaErrors.length,'Schema failures remain.');state.verified=true;await persist();
  }else{
   for(const s of state.scenarios){const order=await api(member,'GET','/api/v1/orders/'+s.orderId);assert(order.status==='CANCELED'&&order.paidAmount===order.refundedAmount&&order.refunds.length===1&&order.refunds[0].refundId===s.refundId&&order.refunds[0].status==='SUCCESS','Cleanup refuses unsettled or unexpected business resources.');const row=await snapshot(s,'cleanup-read-only-final');assert(row.refundReserved===0&&row.receiptCount===1&&row.outboxStatus==='COMPLETED','Cleanup has unresolved financial work.');}
   assert(state.verified&&state.uiVerified===true&&!state.pendingUi,'Both HTTP and real UI acceptance must finish before cleanup.');state.complete=true;state.cleanup='All synthetic orders already canceled and all original refunds settled; audit and evidence retained, no deletion or state reset.';await persist();report.checks.push(state.cleanup);
  }
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=clean(error);report.pendingCleanup=state.scenarios.map(s=>({name:s.name,orderId:s.orderId,refundId:s.refundId??null,reason:'Retained; inspect current real state, do not reset or replay unknown writes.'}));process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await persist();const stamp=new Date().toISOString().replace(/[:.]/g,'-');await fs.writeFile(path.join(output,phase+'-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({phase,status:report.status,checkedResponses:report.checkedResponses,schemaErrors:report.schemaErrors.length,evidenceDirectory:output,...(report.error?{error:report.error}:{})}));}
