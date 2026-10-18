#!/usr/bin/env node
/**
 * Zero-dependency contract checks for this repository's OpenAPI 3.1 JSON/YAML subset.
 * Usage: node scripts/validate-contract.mjs [contracts/openapi.yaml]
 * Checks local refs, explicit operations/roles/errors, closed object schemas,
 * examples against the JSON Schema keywords actually used here, fixtures and
 * security/state invariants. This is not a full OpenAPI meta-schema validator
 * and does not test any running server, authorization, concurrency or payments.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.resolve(root,process.argv[2]||'contracts/openapi.yaml');
const doc=JSON.parse(fs.readFileSync(target,'utf8'));
const failures=[];let refs=0,examples=0,operations=0;
const check=(ok,message)=>{if(!ok)failures.push(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function resolve(reference){
 if(!reference.startsWith('#/'))throw Error('External ref is not supported: '+reference);
 let value=doc;for(const token of reference.slice(2).split('/').map(p=>p.replaceAll('~1','/').replaceAll('~0','~')))value=value?.[token];
 if(value===undefined)throw Error('Missing ref '+reference);return value;
}
const deref=v=>v?.$ref?resolve(v.$ref):v;
function walk(value,visit,where='$'){
 if(!value||typeof value!=='object')return;visit(value,where);
 for(const [k,v]of Object.entries(value))walk(v,visit,where+'/'+k);
}
const formats={
 'date-time':v=>/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v)),
 date:v=>/^\d{4}-\d\d-\d\d$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,
 uuid:v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),
 uri:v=>{try{return !!new URL(v).protocol}catch{return false}},
 // Multipart binary examples document field shape, not the actual bytes.
 binary:v=>typeof v==='string'
};
function validate(schema,value,where='$',depth=0){
 if(depth>60)return [where+': recursion limit'];
 if(schema.$ref)return validate(resolve(schema.$ref),value,where,depth+1);
 let errs=[];
 if(schema.if&&validate(schema.if,value,where,depth+1).length===0&&schema.then)errs.push(...validate(schema.then,value,where,depth+1));
 if(schema.anyOf){const sets=schema.anyOf.map(s=>validate(s,value,where,depth+1));if(sets.every(e=>e.length))return [where+': matches no anyOf alternative'];return [];}
 if(schema.oneOf){const count=schema.oneOf.filter(s=>validate(s,value,where,depth+1).length===0).length;if(count!==1)errs.push(where+': expected one matching alternative');}
 if(schema.allOf)for(const s of schema.allOf)errs.push(...validate(s,value,where,depth+1));
 if(schema.const!==undefined&&!same(value,schema.const))errs.push(where+': const mismatch');
 if(schema.enum&&!schema.enum.some(v=>same(v,value)))errs.push(where+': not in enum');
 const t=schema.type;
 const typeOK=t===undefined||t==='null'&&value===null||t==='object'&&value!==null&&typeof value==='object'&&!Array.isArray(value)||t==='array'&&Array.isArray(value)||t==='integer'&&Number.isSafeInteger(value)||t==='number'&&typeof value==='number'&&Number.isFinite(value)||t==='string'&&typeof value==='string'||t==='boolean'&&typeof value==='boolean';
 if(!typeOK)return [...errs,where+': expected '+t];
 if(t==='object'||(!t&&schema.properties&&value!==null&&typeof value==='object'&&!Array.isArray(value))){
  for(const k of schema.required||[])if(!Object.hasOwn(value,k))errs.push(where+': missing required '+k);
  if(schema.minProperties!==undefined&&Object.keys(value).length<schema.minProperties)errs.push(where+': too few properties');
  if(schema.maxProperties!==undefined&&Object.keys(value).length>schema.maxProperties)errs.push(where+': too many properties');
  for(const [k,v]of Object.entries(value)){
   if(schema.properties?.[k])errs.push(...validate(schema.properties[k],v,where+'.'+k,depth+1));
   else if(schema.additionalProperties===false)errs.push(where+': unexpected property '+k);
  }
 }
 if(t==='array'){
  if(value.length<(schema.minItems||0))errs.push(where+': too few items');
  if(schema.maxItems!==undefined&&value.length>schema.maxItems)errs.push(where+': too many items');
  if(schema.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)errs.push(where+': duplicated items');
  value.forEach((v,i)=>errs.push(...validate(schema.items,v,where+'['+i+']',depth+1)));
 }
 if(t==='string'){
  if(schema.minLength!==undefined&&[...value].length<schema.minLength)errs.push(where+': shorter than minLength');
  if(schema.maxLength!==undefined&&[...value].length>schema.maxLength)errs.push(where+': longer than maxLength');
  if(schema.pattern&&!new RegExp(schema.pattern,'u').test(value))errs.push(where+': pattern mismatch');
  if(schema.format){if(!formats[schema.format])errs.push(where+': unchecked format '+schema.format);else if(!formats[schema.format](value))errs.push(where+': invalid '+schema.format);}
 }
 if(t==='integer'||t==='number'){
  if(schema.minimum!==undefined&&value<schema.minimum)errs.push(where+': below minimum');
  if(schema.maximum!==undefined&&value>schema.maximum)errs.push(where+': above maximum');
 }
 return errs;
}
function testExample(schema,value,where){examples++;try{failures.push(...validate(schema,value,where));}catch(e){failures.push(where+': '+e.message);}}
check(doc.openapi==='3.1.0','OpenAPI version must be 3.1.0');
check(doc.info?.version==='0.2.0','Expected contract version 0.2.0');
check(doc['x-contract-status']==='IMPLEMENTATION_IN_PROGRESS','Implementation boundary missing');
walk(doc,(value,where)=>{if(value.$ref){refs++;try{resolve(value.$ref)}catch(e){failures.push(where+': '+e.message)}}});
walk(doc.components.schemas,(s,where)=>{
 if(s.type==='object'){
  check(s.additionalProperties===false,where+': object must explicitly reject unknown fields');
  check(s.properties&&Object.keys(s.properties).length>0,where+': empty object schema');
  check(Array.isArray(s.required),where+': explicit required list missing');
  for(const key of s.required||[])check(Object.hasOwn(s.properties||{},key),where+': required property not declared '+key);
 }
 if(s.type==='array')check(!!s.items,where+': array items missing');
 if(s.example!==undefined&&(s.type||s.$ref||s.anyOf))testExample(s,s.example,where+'.example');
 if(s.properties)for(const [name,field]of Object.entries(s.properties)){
  if(/Id$/.test(name)&&name!=='eventId'){
   const f=deref(field);const choices=f.anyOf||[f];check(choices.every(c=>['string','null'].includes(deref(c).type)),where+'.'+name+': ID must be string or null');
  }
 }
});
const operationMap=new Map();const roleSet=new Set(['GUEST','MEMBER','PICKER','COURIER','OPERATOR','SERVICE','FINANCE','ADMIN','SANDBOX_CHANNEL']);
const permissionText=fs.readFileSync(path.join(root,'contracts/permissions.md'),'utf8');
const permissionKeys=new Set([...permissionText.matchAll(/\| `([a-z][a-z0-9.]+)` \|/g)].map(m=>m[1]));
function responseFields(schema,visited=new Set()){
 if(schema.$ref){if(visited.has(schema.$ref))return [];visited.add(schema.$ref);return responseFields(resolve(schema.$ref),visited);}
 return [...Object.keys(schema.properties||{}),...Object.values(schema.properties||{}).flatMap(s=>responseFields(s,visited)),...(schema.items?responseFields(schema.items,visited):[]),...(schema.anyOf||[]).flatMap(s=>responseFields(s,visited))];
}
for(const [url,item] of Object.entries(doc.paths))for(const [method,op]of Object.entries(item)){
 operations++;const label=method.toUpperCase()+' '+url;
 check(url.startsWith('/api/v1/'),label+': wrong prefix');
 check(!!op.operationId&&!operationMap.has(op.operationId),label+': missing/duplicate operationId');operationMap.set(op.operationId,{op,url,method});
 check(['CONTRACT_ONLY','IMPLEMENTED_DEMO'].includes(op['x-implementation-status']),label+': missing implementation boundary');
 check(Array.isArray(op['x-roles'])&&op['x-roles'].length>0&&op['x-roles'].every(r=>roleSet.has(r)),label+': roles missing/unknown');
 check(Array.isArray(op['x-permissions'])&&op['x-permissions'].length>0&&op['x-permissions'].every(k=>permissionKeys.has(k)),label+': permission not defined in permissions.md');
 check(Object.hasOwn(op,'security'),label+': explicit security missing');
 check(['NONE','JSON_SCHEMA'].includes(op['x-request-body']),label+': explicit request-body policy missing');
 const parameters=(op.parameters||[]).map(deref);const pathParams=[...url.matchAll(/\{([^}]+)\}/g)].map(m=>m[1]);
 for(const name of pathParams)check(parameters.some(p=>p.in==='path'&&p.name===name&&p.required===true),label+': missing required path parameter '+name);
 for(const p of parameters){check(!!p.schema,label+': parameter schema missing '+p.name);const ex=p.example??deref(p.schema).example;check(ex!==undefined,label+': parameter example missing '+p.name);if(ex!==undefined)testExample(p.schema,ex,label+'.parameter.'+p.name);}
 if(op.requestBody){const rb=deref(op.requestBody);check(rb.required===true,label+': body must explicitly be required');for(const [type,m]of Object.entries(rb.content||{})){check(!!m.schema&&m.example!==undefined,label+': missing request schema/example');if(m.schema&&m.example!==undefined)testExample(m.schema,m.example,label+'.request.'+type);}}
 let successes=0,errors=0;for(const [status,response]of Object.entries(op.responses||{})){
  if(/^2\d\d$/.test(status))successes++;if(/^[45]\d\d$/.test(status))errors++;
  const res=deref(response);check(!!res.description,label+': response description missing');
  for(const [type,m]of Object.entries(res.content||{})){check(!!m.schema&&m.example!==undefined,label+': response schema/example missing '+status);if(m.schema&&m.example!==undefined)testExample(m.schema,m.example,label+'.response.'+status+'.'+type);
   if(status.startsWith('2')&&!url.includes('/admin/')&&!url.endsWith('/callback'))check(!responseFields(m.schema).some(n=>['batchId','batchNo','allocations'].includes(n)),label+': warehouse batch detail leaked to customer schema');
  }
 }
 check(successes===1&&errors>0,label+': expected one success and real error responses');
 check(Object.keys(op['x-error-codes']||{}).length>0,label+': no error mapping');
 for(const error of Object.values(op['x-error-codes']||{}))check(Number.isInteger(error.code)&&error.code>0&&error.httpStatus>=400&&error.httpStatus<600&&op.responses[error.httpStatus],label+': invalid error code/status mapping');
}
const sim=operationMap.get('simulateSandboxPayment')?.op;check(same(sim?.['x-environments'],['dev','test','demo','showcase'])&&same(sim?.['x-roles'],['MEMBER']),'sandbox simulation must be explicit dev/test/demo/showcase MEMBER only');
const callback=operationMap.get('receiveSandboxPaymentCallback')?.op;check(same(callback?.security,[])&&callback?.['x-channel-auth']==='HMAC-SHA256','callback must use HMAC and no Bearer');
for(const key of ['registerMember','login','refreshSession','logout']){const op=operationMap.get(key)?.op;check((op?.parameters||[]).map(deref).some(p=>p.name==='X-CSRF-Token'&&p.required),key+': missing CSRF header');check((op?.parameters||[]).map(deref).some(p=>p.name==='Origin'&&p.required),key+': missing Origin check');}
const states={Order:['PENDING_PAY','PAID','PICKING','READY_TO_SHIP','DELIVERING','FINISHED','CANCELED','CLOSED'],Payment:['INIT','PENDING','SUCCESS','FAILED','CLOSED'],Refund:['PENDING','PROCESSING','SUCCESS','FAILED'],Aftersale:['APPLIED','APPROVED','REJECTED','REFUNDING','COMPLETED','CANCELED'],WeightAdjustment:['NONE','REFUND_PENDING','REFUNDED','TOP_UP_PENDING','SETTLED','CANCELED']};
for(const [name,allowed]of Object.entries(states))check(same(doc.components.schemas[name].properties.status.enum,allowed),name+': state enum differs from baseline');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'contracts/examples/contract-samples.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'contracts/examples/operation-manifest.json'),'utf8'));
check(manifest.operations.length===operations,'manifest operation count differs');check(Object.keys(fixture.operations).length===operations,'fixture operation count differs');
for(const m of manifest.operations){const current=operationMap.get(m.operationId);check(current&&current.url===m.path&&current.method.toUpperCase()===m.method&&same(current.op['x-roles'],m.roles)&&same(current.op['x-permissions'],m.permissions),'manifest drift: '+m.operationId);}
for(const [operationId,fx]of Object.entries(fixture.operations)){
 const current=operationMap.get(operationId);if(!current){failures.push('Unknown fixture '+operationId);continue;}
 const op=current.op;check(fx.path===current.url&&fx.method===current.method.toUpperCase(),'fixture route drift '+operationId);
 if(op.requestBody){const body=Object.values(deref(op.requestBody).content)[0];testExample(body.schema,fx.request,'fixture.'+operationId+'.request');check(same(body.example,fx.request),'request fixture drift '+operationId);}
 const res=deref(Object.entries(op.responses).find(([k])=>k.startsWith('2'))[1]);const media=Object.values(res.content)[0];testExample(media.schema,fx.response,'fixture.'+operationId+'.response');check(same(media.example,fx.response),'response fixture drift '+operationId);
}
// Closed-loop prerequisites: claim before evidence review; recover exceptions before delivery completion.
const claim=operationMap.get('claimAftersale');
check(claim?.url==='/api/v1/admin/aftersales/{aftersaleId}/claim'&&same(claim.op['x-roles'],['SERVICE'])&&claim.op['x-permissions'].includes('aftersale.work.claim'),'aftersale claim contract missing');
check(doc.components.schemas.AdminAftersale.required.includes('assigneeId'),'aftersale assigneeId missing');
const recovery=operationMap.get('resolveDeliveryException');
check(recovery?.url==='/api/v1/admin/delivery-tasks/{taskId}/resolve-exception'&&same(recovery.op['x-roles'],['SERVICE'])&&recovery.op['x-permissions'].includes('delivery.exception.resolve'),'delivery exception recovery contract missing');
check(same(doc.components.schemas.ResolveDeliveryExceptionRequest.required,['reason','expectedVersion']),'recovery must require reason and expectedVersion');
check(recovery?.op['x-transition']?.from==='EXCEPTION'&&recovery.op['x-transition'].to==='DELIVERING'&&recovery.op['x-transition'].preserveCourier===true,'recovery must preserve courier and restore DELIVERING');
for(const id of ['listDeliveryTasks','getDeliveryTask'])check(operationMap.get(id)?.op['x-roles'].includes('SERVICE')&&operationMap.get(id).op['x-permissions'].includes('delivery.exception.resolve'),id+': SERVICE recovery prerequisite read missing');
// Small validator self-checks guard the essential rejection behavior, not business code.
check(validate(doc.components.schemas.User,{userId:42},'negative').length>0,'self-check failed to reject numeric/missing user fields');
check(validate(doc.components.schemas.VersionRequest,{version:1,amount:100},'negative').length>0,'self-check failed to reject undeclared amount');
check(validate(doc.components.schemas.CsrfToken.properties.csrfToken,'short','negative').length>0,'self-check failed to reject short CSRF');
if(failures.length){console.error(`FAIL: ${failures.length} contract issue(s)`);for(const f of failures)console.error('- '+f);process.exitCode=1;}
else console.log(`PASS: ${operations} operations; ${Object.keys(doc.components.schemas).length} schemas; ${refs} local refs; ${examples} schema/example checks; manifest + fixtures + roles + permission keys + state/security invariants. Static contract only; backend runtime/business tests NOT EXECUTED.`);

// Runtime harnesses may reuse the same schema checks against actual HTTP responses.
// This checks serialized shape only; callers still assert business behavior separately.
export function validateRuntimeResponse(method, url, status, body) {
 const pathname=new URL(url,'http://localhost').pathname;
 const entry=[...operationMap.values()].find(({url:path,method:m})=>m===method.toLowerCase()&&new RegExp('^'+path.replace(/\{[^}]+\}/g,'[^/]+')+'$').test(pathname));
 if(!entry)return {covered:false,errors:[]};
 const response=entry.op.responses[String(status)];
 if(!response)return {covered:true,errors:[`${method} ${pathname}: undeclared status ${status}`]};
 const media=Object.entries(deref(response).content||{});
 if(entry.op['x-response-body']==='BINARY_IMAGE'&&String(status).startsWith('2')) {
  const allowed=['image/png','image/jpeg'];
  const bytes=body instanceof Uint8Array?body:body instanceof ArrayBuffer?new Uint8Array(body):null;
  const isPng=bytes?.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
  const isJpeg=bytes?.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const valid=media.every(([type,m])=>allowed.includes(type)&&m.schema?.format==='binary')&&(isPng||isJpeg);
  return {covered:true,binary:true,errors:valid?[]:['Expected actual PNG/JPEG bytes for binary image response']};
 }
 const schema=media[0]?.[1]?.schema;
 return {covered:true,errors:schema?validate(schema,body,`${entry.op.operationId}.${status}`):[]};
}
