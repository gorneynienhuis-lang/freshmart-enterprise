/** Real cross-member stock/slot contention. No automatic execution or server control.
 * CONCURRENCY_PHASE=preflight|run|cleanup
 * CONCURRENCY_CONFIG=/absolute/.runtime/engineering/v030/private/concurrency.config.json
 * CONCURRENCY_RUN_DIR=/absolute/.runtime/concurrency/<run>  (cleanup only)
 * node scripts/e2e-concurrency.mjs
 */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {validateRuntimeResponse} from './validate-contract.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),targetSchema='fresh_mall_restore_engineering_v030_20261018a';
const privateBase=path.join(root,'.runtime/engineering/v030/private'),base='http://127.0.0.1:18081';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const phase=process.env.CONCURRENCY_PHASE;
assert(['preflight','run','cleanup'].includes(phase),'Explicit CONCURRENCY_PHASE=preflight|run|cleanup is required.');
const configFile=process.env.CONCURRENCY_CONFIG;
assert(configFile===path.join(privateBase,'concurrency.config.json'),'Use the fixed private engineering-concurrency config path.');
async function noLinks(file){let current=path.resolve(file);for(;;){const s=await fs.lstat(current);assert(!s.isSymbolicLink(),'Symlink paths are refused.');if(path.dirname(current)===current)break;current=path.dirname(current);}}
async function privateRead(file){await noLinks(file);const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await handle.stat();assert(s.isFile()&&s.nlink===1&&(s.mode&0o777)===0o600&&s.uid===process.getuid(),'Private configuration must be owned, nonlinked, mode0600.');return await handle.readFile('utf8');}finally{await handle.close();}}
const privateJson=async file=>JSON.parse(await privateRead(file));
async function privateWrite(file,value){await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}
const cfg=await privateJson(configFile),env=await privateJson(path.join(privateBase,'backend.env.json'));
const purpose=await privateJson(path.join(privateBase,'purpose.json'));
assert(cfg.purpose==='engineering-concurrency'&&cfg.schema===targetSchema&&cfg.baseUrl===base&&cfg.exclusiveBusinessWindow===true,'Explicit isolated concurrency purpose and reserved business window required.');
assert(purpose.schema===targetSchema&&purpose.port===18081&&purpose.purpose==='engineering-refund-recovery','Engineering runtime purpose/schema mismatch.');
assert(env.DB_URL.split('?')[0]==='jdbc:mysql://127.0.0.1:3306/'+targetSchema&&env.SERVER_ADDRESS==='127.0.0.1'&&env.SERVER_PORT==='18081'&&env.APP_PUBLIC_ORIGIN===base&&['demo','test'].includes(env.SPRING_PROFILES_ACTIVE),'Main/wrong database, port, origin, binding or production profile refused.');
const recovery=path.join(root,'.runtime/recoveries/engineering-v030-20261018a');
assert(purpose.sourceRecovery===recovery&&env.APP_MEDIA_DIR===path.join(recovery,'media'),'Exact engineering restore/media identity required.');
const cnf=path.join(recovery,'mysql-recovery.cnf'),cnfText=await privateRead(cnf);
assert(cnfText.includes('\nuser='+env.DB_USERNAME+'\n')&&cnfText.includes('\npassword='+env.DB_PASSWORD+'\n')&&/^fmrec_[a-f0-9]{16}$/.test(env.DB_USERNAME),'Only matching scoped recovery DB credentials may be used.');
for(const role of ['operator','picker'])assert(/^1[3-9]\d{9}$/.test(cfg[role]?.phone??'')&&typeof cfg[role]?.password==='string'&&cfg[role].password.length>=12,'Private OPERATOR/PICKER login missing.');
assert(cfg.operator.phone!==cfg.picker.phone,'Separate employee actors are required.');
if(phase==='preflight'){console.log(JSON.stringify({status:'CONFIG_VALIDATED_NOT_EXECUTED',purpose:cfg.purpose,schema:targetSchema,port:18081,plannedMembers:100,plannedBursts:[100,31],httpSent:0,databaseQueries:0}));process.exit(0);}
// Check real process ownership before any registration or other business write.
const managed=JSON.parse(execFileSync('python3',[path.join(root,'scripts/engineering-runtime.py'),'status'],{encoding:'utf8'}));
const processRecord=await privateJson(path.join(privateBase,'process.json'));
assert(managed.status==='OWNED_LISTENING'&&managed.port===18081&&managed.pid===processRecord.pid&&processRecord.schema===targetSchema&&processRecord.environmentSha256===sha(await fs.readFile(path.join(privateBase,'backend.env.json'))),'Owned engineering process identity/environment mismatch.');
const runs=path.join(root,'.runtime/concurrency');await fs.mkdir(runs,{recursive:true,mode:0o700});await noLinks(runs);await fs.chmod(runs,0o700);
let runId,dir,state;
if(phase==='run'){runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(6).toString('hex');dir=path.join(runs,runId);await fs.mkdir(dir,{mode:0o700});state={purpose:cfg.purpose,schema:targetSchema,baseUrl:base,runId,members:[],products:[],slot:null,complete:false};}
else{dir=process.env.CONCURRENCY_RUN_DIR;assert(path.isAbsolute(dir??'')&&path.dirname(dir)===runs,'Cleanup needs one explicit existing private run.');await noLinks(dir);state=await privateJson(path.join(dir,'state.json'));runId=state.runId;assert(state.purpose===cfg.purpose&&state.schema===targetSchema&&state.baseUrl===base&&path.basename(dir)===runId,'Cleanup run binding mismatch.');}
await fs.mkdir(path.join(dir,'http'),{mode:0o700,recursive:true});
const marker='CONCURRENCY-'+runId,report={status:'RUNNING',phase,runId,startedAt:new Date().toISOString(),purpose:cfg.purpose,schema:targetSchema,backendPort:18081,backendPid:managed.pid,jarSha256:processRecord.jarSha256,responses:[],waves:[],snapshots:[],cleanup:{},schemaErrors:[],attempts:0,sourceSha256:{},notClaimed:['No H2/stub/cache-based stock truth.','Not a sustained formal load test, 2vCPU benchmark or 100k-row test.','DB locks may serialize critical sections; actual cross-member HTTP contention is measured.']};
for(const file of ['backend/src/main/java/com/freshmart/commerce/CommerceService.java','backend/src/main/java/com/freshmart/checkout/CheckoutService.java','contracts/openapi.yaml','scripts/e2e-concurrency.mjs'])report.sourceSha256[file]=sha(await fs.readFile(path.join(root,file)));
let persistQueue=Promise.resolve(),counter=0,inflight=0,peakInflight=0;const secrets=new Set([cfg.operator.password,cfg.picker.password,env.DB_PASSWORD,env.APP_TOKEN_SECRET,env.SANDBOX_SECRET]);
async function persist(){const data=JSON.stringify(state,null,2)+'\n';persistQueue=persistQueue.then(async()=>{const temp=path.join(dir,'state-'+crypto.randomUUID()+'.tmp');await privateWrite(temp,data);await fs.rename(temp,path.join(dir,'state.json'));});return persistQueue;}
await persist();
function handle(label){return{label,cookies:new Map(),token:null,csrf:null,user:null};}
const operator=handle('OPERATOR'),picker=handle('PICKER');let members=[];
async function http(h,method,route,body,{expected=200,binary=false,form=false,key=crypto.randomUUID(),wave=null}={}){
 const index=++counter,started=performance.now(),at=new Date().toISOString();report.attempts++;inflight++;peakInflight=Math.max(peakInflight,inflight);
 const headers={Origin:base};if(h.token)headers.Authorization='Bearer '+h.token;
 if(h.cookies.size)headers.Cookie=[...h.cookies].map(([k,v])=>k+'='+v).join(';');
 if(method!=='GET'&&!route.startsWith('/api/v1/auth/'))headers['Idempotency-Key']=key;
 if(method!=='GET'&&route.startsWith('/api/v1/auth/')&&h.csrf)headers['X-CSRF-Token']=h.csrf;
 if(body!==undefined&&!form)headers['Content-Type']='application/json';
 const item={index,client:h.label,method,route:new URL(base+route).pathname,wave,at,key:method==='GET'?null:key,httpStatus:null,elapsedMillis:null,traceId:null,schemaValid:false};
 let raw={request:{method,route,body:form?{multipart:'synthetic opaque PNG file'}:body,idempotencyKey:item.key}};
 try{const response=await fetch(base+route,{method,headers,...(body===undefined?{}:{body:form?body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  item.httpStatus=response.status;for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';',1)[0],at=pair.indexOf('=');if(at>0)h.cookies.set(pair.slice(0,at),pair.slice(at+1));}
  const bytes=Buffer.from(await response.arrayBuffer());let envelope;
  if(binary&&response.ok())envelope=new Uint8Array(bytes);else envelope=JSON.parse(bytes.toString('utf8'));
  const validation=validateRuntimeResponse(method,base+route,response.status,envelope);item.traceId=binary?response.headers.get('X-Trace-Id'):envelope.traceId;
  assert(item.traceId&&item.traceId===response.headers.get('X-Trace-Id'),'Missing/mismatched real response trace.');
  item.schemaValid=validation.covered&&!validation.errors.length;report.schemaErrors.push(...validation.errors.map(error=>({index,error})));
  raw.response={status:response.status,body:binary&&response.ok()?{binaryBytes:bytes.length,sha256:sha(bytes)}:envelope,traceId:item.traceId};
  assert(item.schemaValid,'Uncovered or invalid actual response contract.');
  if(expected!==null)assert(response.status===expected,'Unexpected '+h.label+' '+method+' '+item.route+' status '+response.status);
  item.errorKey=envelope?.data?.errorKey??null;
  if(envelope?.data?.accessToken){h.token=envelope.data.accessToken;h.user=envelope.data.user;secrets.add(h.token);assert(!h.user.mustChangePassword,'Existing employee requires first password change; it will not be modified.');}
  return{status:response.status,data:binary&&response.ok()?envelope:envelope.data,errorKey:item.errorKey,observation:item};
 }catch(error){item.failureType=error.name;item.failureMessage=String(error.message).slice(0,300);throw error;}
 finally{item.elapsedMillis=Number((performance.now()-started).toFixed(3));inflight--;report.responses.push(item);await privateWrite(path.join(dir,'http',String(index).padStart(5,'0')+'.json'),{...item,...(raw??{})});}
}
async function api(h,method,route,body,opts){return(await http(h,method,route,body,opts)).data;}
async function csrf(h){h.csrf=(await api(h,'GET','/api/v1/auth/csrf')).csrfToken;secrets.add(h.csrf);}
async function login(h,credentials){await csrf(h);await api(h,'POST','/api/v1/auth/login',credentials);}
function id(value){assert(typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value),'Unsafe API/database resource ID.');return "'"+value+"'";}
async function sql(statement){assert(/^SELECT\b/.test(statement)&&!statement.includes(';'),'Only single read-only SELECT snapshots are supported.');return await new Promise((resolve,reject)=>{const child=spawn(path.join(root,'.runtime/mysql-8.4.11-macos15-arm64/bin/mysql'),['--defaults-file='+cnf,'--database='+targetSchema,'--batch','--raw','--skip-column-names'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>{out+=x;assert(out.length<2*1024*1024,'SQL snapshot too large.');});child.stderr.on('data',x=>{err+=x;});child.on('error',()=>reject(new Error('Scoped MySQL client failed.')));child.on('close',code=>code?reject(new Error('Scoped read-only MySQL query failed; private output suppressed.')):resolve(out.trim()));child.stdin.end(statement+';\n');});}
async function jsonSql(statement){return JSON.parse(await sql(statement));}
function crc32(buffer){let n=0xffffffff;for(const b of buffer){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
function png(){const chunk=(name,data)=>{const type=Buffer.from(name),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([size,type,data,crc]);};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(16,0);ihdr.writeUInt32BE(16,4);ihdr[8]=8;ihdr[9]=2;const raster=Buffer.alloc(16*(1+16*3));for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=y*49+1+x*3;raster[p]=170;raster[p+1]=40+x*3;raster[p+2]=40+y*3;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raster)),chunk('IEND',Buffer.alloc(0))]);}
async function product(quantity,label,categoryId){const form=new FormData();form.set('file',new Blob([png()],{type:'image/png'}),'synthetic-concurrency.png');const media=await api(operator,'POST','/api/v1/admin/media/images',form,{expected:201,form:true});assert(media.status==='READY'&&new URL(media.publicUrl).origin===base,'Product image must be a real READY public raster on the isolated origin.');await http(handle('PUBLIC'),'GET',new URL(media.publicUrl).pathname,undefined,{binary:true});
 const p=await api(operator,'POST','/api/v1/admin/products',{categoryId,name:label+'-'+runId,description:'隔离数据库跨会员并发验收合成商品，不是主商城商品。',origin:'课程合成数据',storage:'AMBIENT',imageUrl:media.publicUrl},{expected:201});
 const fixture={productId:p.productId,label,quantity,mediaId:media.mediaId};state.products.push(fixture);await persist();
 const sku=await api(operator,'POST','/api/v1/admin/products/'+p.productId+'/skus',{skuCode:'CC-'+crypto.randomBytes(8).toString('hex'),name:label+'标准件',unitLabel:'1件（合成验收）',baseUnit:'PIECE',priceMode:'BY_PIECE',priceUnitGram:null,price:10000,memberPrice:10000,imageUrl:media.publicUrl},{expected:201});fixture.skuId=sku.skuId;await persist();
 const fresh=await api(operator,'GET','/api/v1/admin/products/'+p.productId);await api(operator,'PUT','/api/v1/admin/products/'+p.productId+'/status',{status:'ON_SALE',version:fresh.version});
 const batch=await api(picker,'POST','/api/v1/admin/batches',{batchNo:'CC-'+crypto.randomBytes(8).toString('hex'),skuId:sku.skuId,receivedQuantity:quantity,producedAt:new Date(Date.now()-3600000).toISOString(),expiresAt:new Date(Date.now()+10*86400000).toISOString(),reason:marker+' 合成采购入库 '+quantity+'件'},{expected:201});fixture.batchId=batch.batchId;await persist();assert(batch.onHand===quantity&&batch.reserved===0&&batch.quarantined===0&&batch.available===quantity,'Receipt stock differs from the real API.');return fixture;}
async function slotDb(slotId){return await jsonSql("SELECT JSON_OBJECT('slotId',slot_id,'capacity',capacity,'used',used,'enabled',enabled,'cutoffAt',CONCAT(DATE_FORMAT(cutoff_at,'%Y-%m-%dT%H:%i:%s.%f'),'Z'),'version',version) FROM fm_delivery_slot WHERE slot_id="+id(slotId));}
async function snapshot(fixture,label){const batch=await api(picker,'GET','/api/v1/admin/batches/'+fixture.batchId);const real=await jsonSql("SELECT JSON_OBJECT('onHand',on_hand,'reserved',reserved,'quarantined',quarantined,'available',on_hand-reserved-quarantined) FROM fm_inventory_batch WHERE batch_id="+id(fixture.batchId));assert(['onHand','reserved','quarantined','available'].every(k=>batch[k]===real[k]),'HTTP batch differs from actual MySQL.');const slot=await slotDb(state.slot.slotId);const negatives=Number(await sql('SELECT COUNT(*) FROM fm_inventory_batch WHERE on_hand<0 OR reserved<0 OR quarantined<0 OR on_hand<reserved+quarantined'));assert(negatives===0,'Actual target inventory has a negative quantity/invariant violation.');const row={label,...real,slotCapacity:slot.capacity,slotUsed:slot.used,slotVersion:slot.version,negativeBatchCount:negatives};report.snapshots.push(row);return row;}
async function ordersFor(h){const all=[];for(let page=1;;page++){const list=await api(h,'GET','/api/v1/orders?page='+page+'&size=100');all.push(...list.items);if(all.length>=list.total)break;assert(page<100,'Unexpected member order volume.');}return all;}
async function cancelOwned(){const skus=new Set(state.products.map(p=>p.skuId).filter(Boolean));for(const h of members.filter(h=>h.token&&h.user)){for(const order of await ordersFor(h)){if(!order.buyerNote?.startsWith(marker+' '))continue;assert(order.items.every(i=>skus.has(i.skuId)),'Marked order contains a nonfixture SKU; no cancellation attempted.');const current=await api(h,'GET','/api/v1/orders/'+order.orderId);if(['CANCELED','CLOSED'].includes(current.status))continue;assert(current.status==='PENDING_PAY'&&current.paidAmount===0&&current.refunds.length===0,'Cleanup refuses paid/nonpending orders rather than issuing refunds.');const canceled=await api(h,'POST','/api/v1/orders/'+current.orderId+'/cancel',{reason:marker+' 正常取消释放预占和名额',version:current.version});assert(canceled.status==='CANCELED'&&canceled.refunds.length===0,'Unpaid cancellation unexpectedly created funds/refunds.');}}}
async function wave(fixture,count,successes,errorKey,label){const before=await snapshot(fixture,label+'-before');assert(before.reserved===0&&before.slotUsed===0&&before.slotCapacity===30,'Wave requires genuine zero-used capacity30 and unreserved dedicated stock.');
 const quotes=[];for(let i=0;i<count;i++){const h=members[i],quote=await api(h,'POST','/api/v1/orders/quote',{items:[{skuId:fixture.skuId,quantity:1}],addressId:state.members[i].addressId,slotId:state.slot.slotId,couponId:null});assert(quote.price.payableAmount>0,'This test requires unpaid orders, never zero-pay PAID orders.');quotes.push(quote);}
 assert(new Set(quotes.map(q=>q.quoteId)).size===count&&quotes.every(q=>Date.parse(q.expiresAt)>Date.now()+30000),'All independent quotes must preexist and still be valid before the burst.');await privateWrite(path.join(dir,label+'-quotes.json'),quotes);
 let monitorOutput='';try{monitorOutput=execFileSync('/usr/sbin/lsof',['-nP','-iTCP:9090','-sTCP:LISTEN','-Fp'],{encoding:'utf8'});}catch(error){assert(error.status===1&&!error.stdout,'Cannot verify Prometheus stop state.');}assert(!monitorOutput,'Prometheus9090 is still listening; wait for its owner to stop it before the burst.');
 const started=performance.now();const pending=quotes.map((q,index)=>http(members[index],'POST','/api/v1/orders',{quoteId:q.quoteId,quoteToken:q.quoteToken,buyerNote:marker+' '+label+' client'+String(index+1).padStart(3,'0')},{expected:null,wave:label}));
 const settled=await Promise.allSettled(pending),duration=performance.now()-started;await persist();
 const ok=settled.filter(x=>x.status==='fulfilled'&&x.value.status===201),denied=settled.filter(x=>x.status==='fulfilled'&&x.value.status===422&&x.value.errorKey===errorKey),samples=report.responses.filter(x=>x.wave===label);const rt=samples.map(x=>x.elapsedMillis).sort((a,b)=>a-b),statuses={};for(const x of samples)statuses[String(x.httpStatus??'TRANSPORT_FAILURE')]=(statuses[String(x.httpStatus??'TRANSPORT_FAILURE')]??0)+1;
 const observed={label,clients:count,independentMembers:count,quotesPreparedBeforeAnyCreate:quotes.length,successful:ok.length,expectedRejections:denied.length,transportOrOtherFailures:count-ok.length-denied.length,allAttemptsInDenominator:samples.length,elapsedMillis:Number(duration.toFixed(3)),burstQps:Number((count/(duration/1000)).toFixed(3)),p95Millis:rt[Math.ceil(rt.length*.95)-1],statuses,errorKey,peakHttpInFlight:peakInflight};report.waves.push(observed);await privateWrite(path.join(dir,label+'-settled.json'),settled.map(x=>x.status==='fulfilled'?{status:'fulfilled',httpStatus:x.value.status,errorKey:x.value.errorKey}: {status:'rejected',errorType:x.reason?.name}));
 assert(samples.length===count&&ok.length===successes&&denied.length===count-successes,'Exact cross-member burst outcome mismatch; all failed requests retained.');
 const after=await snapshot(fixture,label+'-reserved');assert(after.onHand===fixture.quantity&&after.reserved===successes&&after.quarantined===0&&after.available===fixture.quantity-successes&&after.slotUsed-before.slotUsed===successes&&after.slotVersion===before.slotVersion+successes,'Actual stock/slot conservation/version after burst failed.');
 for(const item of ok)assert(item.value.data.status==='PENDING_PAY'&&item.value.data.paidAmount===0,'Burst created a paid order unexpectedly.');
 await cancelOwned();const restored=await snapshot(fixture,label+'-canceled');assert(restored.onHand===fixture.quantity&&restored.reserved===0&&restored.available===fixture.quantity&&restored.slotUsed===before.slotUsed&&restored.slotVersion===after.slotVersion+successes,'Owner cancellation did not restore exact baseline quantities/capacity/version.');}
async function cleanup(){await cancelOwned();report.cleanup.ownerOrders='MARKED_UNPAID_ORDERS_CANCELED_OR_ALREADY_TERMINAL';for(const p of state.products){const current=await api(operator,'GET','/api/v1/admin/products/'+p.productId);if(current.status!=='OFF_SALE')await api(operator,'PUT','/api/v1/admin/products/'+p.productId+'/status',{status:'OFF_SALE',version:current.version});if(p.batchId){const batch=await api(picker,'GET','/api/v1/admin/batches/'+p.batchId);assert(batch.reserved===0&&batch.onHand===p.quantity&&batch.quarantined===0,'Fixture stock remains held or unexpectedly altered during cleanup.');}}
 if(state.slot?.changed){const now=await slotDb(state.slot.slotId);assert(/^[A-Za-z0-9T:.Z-]+$/.test(runId),'Unexpected run marker.');const created=Number(await sql("SELECT COUNT(*) FROM fm_order WHERE JSON_UNQUOTE(JSON_EXTRACT(snapshot_json,'$.buyerNote')) LIKE '"+marker+" %'"));const expectedVersion=state.slot.original.version+1+2*created;assert(now.used===0&&now.capacity===30&&now.cutoffAt===state.slot.original.cutoffAt&&Boolean(now.enabled)===true&&now.version===expectedVersion,'Slot changed outside this run; refusing to overwrite another update.');await api(operator,'PUT','/api/v1/admin/delivery-slots/'+now.slotId,{capacity:state.slot.original.capacity,cutoffAt:state.slot.original.cutoffAt,enabled:Boolean(state.slot.original.enabled),version:now.version});state.slot.changed=false;report.cleanup.slot='ORIGINAL_CONFIG_RESTORED_WITH_CURRENT_VERSION';}
 else report.cleanup.slot='NO_CONFIG_CHANGE';report.cleanup.products='OWN_FIXTURES_OFF_SALE_WITH_AUDIT_RETAINED';await persist();}
try{
 assert(await sql('SELECT DATABASE()')===targetSchema,'SQL schema binding failed.');report.databaseVersion=await sql('SELECT VERSION()');assert(report.databaseVersion.startsWith('8.4.'),'Actual MySQL8.4 required.');await login(operator,cfg.operator);await login(picker,cfg.picker);assert(operator.user.permissions.includes('product.write')&&picker.user.permissions.includes('batch.create'),'Real OPERATOR/PICKER permissions required.');
 if(phase==='run'){
  const phones=new Set();for(let i=0;i<100;i++){let phone;do{phone='199'+String(crypto.randomInt(100000000)).padStart(8,'0');}while(phones.has(phone));phones.add(phone);state.members.push({label:'client'+String(i+1).padStart(3,'0'),phone,password:'CC-'+crypto.randomBytes(24).toString('hex')});}await persist();
  for(const saved of state.members){const h=handle(saved.label);members.push(h);secrets.add(saved.password);await csrf(h);await api(h,'POST','/api/v1/auth/register',{phone:saved.phone,password:saved.password,displayName:'并发合成'+saved.label},{expected:201});saved.userId=h.user.userId;await persist();assert(await sql('SELECT COUNT(*) FROM fm_user WHERE user_id='+id(saved.userId))==='1','HTTP registration was not persisted to this isolated schema.');const address=await api(h,'POST','/api/v1/addresses',{recipientName:'合成验收'+saved.label,phone:saved.phone,province:'上海市',city:'上海市',district:'松江区',detail:marker+' 无真实配送地址',isDefault:true},{expected:201});saved.addressId=address.addressId;await persist();}
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));const listed=(await api(operator,'GET','/api/v1/admin/delivery-slots?date='+date)).items;
  let selected,original;for(const s of listed){const actual=await slotDb(s.slotId);assert(s.remaining===actual.capacity-actual.used,'Displayed remaining differs from actual MySQL slot.');if(actual.used===0&&s.available){if(actual.capacity===30){selected=s;original=actual;break;}if(!selected){selected=s;original=actual;}}}
  assert(selected,'No real empty available tomorrow slot. There is no create-slot API; do not manufacture a slot in SQL.');state.slot={slotId:selected.slotId,date,original,changed:false};await persist();
  if(original.capacity!==30){await api(operator,'PUT','/api/v1/admin/delivery-slots/'+selected.slotId,{capacity:30,cutoffAt:original.cutoffAt,enabled:true,version:original.version});state.slot.changed=true;await persist();}
  const categories=(await api(handle('PUBLIC'),'GET','/api/v1/categories')).items;assert(categories.length,'No actual category.');const stock=await product(10,'库存并发专用',categories[0].categoryId),capacity=await product(100,'容量并发专用',categories[0].categoryId);
  await wave(stock,100,10,'INSUFFICIENT_STOCK','stock100');await wave(capacity,31,30,'SLOT_UNAVAILABLE','capacity31');
 }else{for(const saved of state.members.filter(m=>m.userId)){const h=handle(saved.label);await login(h,{phone:saved.phone,password:saved.password});assert(h.user.userId===saved.userId,'Cleanup owner identity mismatch.');members.push(h);}}
 report.status='PASSED';
}catch(error){report.status='FAILED';report.error=error.message;process.exitCode=1;}
finally{
 try{if(operator.token&&picker.token)await cleanup();}catch(error){report.cleanup.error=error.message;report.status='FAILED';process.exitCode=1;}
 state.complete=report.status==='PASSED';await persist();report.finishedAt=new Date().toISOString();report.totalHttpAttempts=report.attempts;report.recordedResponses=report.responses.length;report.peakHttpInFlight=peakInflight;report.allResponsesCounted=report.attempts===report.responses.length;const rawManifest=[];for(const name of(await fs.readdir(path.join(dir,'http'))).sort())rawManifest.push({name,sha256:sha(await fs.readFile(path.join(dir,'http',name)))});report.rawHttpDirectorySha256=sha(JSON.stringify(rawManifest));await privateWrite(path.join(dir,'http-manifest-'+crypto.randomUUID()+'.json'),rawManifest);await privateWrite(path.join(dir,phase+'-report-'+crypto.randomUUID()+'.json'),report);
 const publicDir=path.join(root,'docs/evidence/concurrency-v030',runId);await fs.mkdir(publicDir,{recursive:true});
 const publicReport={...report,responses:report.responses.map(({key,...row})=>({...row,route:row.route.replace(/\/[A-Za-z0-9_-]{12,}/g,'/[resource]')})),cleanup:{...report.cleanup},syntheticMembersCreated:state.members.filter(m=>m.userId).length,syntheticProductsCreated:state.products.length,rawPrivateDirectory:'.runtime/concurrency/'+runId};
 for(const saved of state.members){secrets.add(saved.phone);if(saved.userId)secrets.add(saved.userId);}
 let text=JSON.stringify(publicReport,null,2)+'\n';for(const secret of secrets)if(typeof secret==='string'&&secret.length>=8)text=text.split(secret).join('[redacted]');assert(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text),'JWT discovered in public export.');await fs.writeFile(path.join(publicDir,phase+'-summary-'+Date.now()+'.json'),text,{flag:'wx'});
 console.log(JSON.stringify({status:report.status,totalHttpAttempts:report.totalHttpAttempts,waves:report.waves.map(w=>({label:w.label,successful:w.successful,expectedRejections:w.expectedRejections,otherFailures:w.transportOrOtherFailures})),cleanup:report.cleanup,privateRunDirectory:dir,publicEvidence:publicDir}));
}
