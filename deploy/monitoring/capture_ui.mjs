/** Read-only capture of the actual local Prometheus APIs and native UI; no interception or fixtures. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../frontend/node_modules/playwright/index.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const label=process.argv[2]??'baseline';
if(!/^[a-z][a-z0-9-]{0,40}$/.test(label))throw new Error('Use a short non-sensitive evidence label.');
const base='http://127.0.0.1:9090';
const output=path.join(root,'docs/evidence/monitoring-v030');await fs.mkdir(output,{recursive:true});
try{const previous=JSON.parse(await fs.readFile(path.join(output,label+'-live.json'),'utf8'));const archive=path.join(output,'attempts',(previous.capturedAt??'unknown').replace(/[:.]/g,'-')+'-'+label);await fs.mkdir(archive,{recursive:true});for(const file of [label+'-live.json',...(previous.screens??[])]){if(!/^[a-z0-9-]+\.(json|png)$/.test(file))throw new Error('Unsafe previous evidence filename');await fs.rename(path.join(output,file),path.join(archive,file)).catch(error=>{if(error.code!=='ENOENT')throw error;});}}catch(error){if(error.code!=='ENOENT')throw error;}
const report={capturedAt:new Date().toISOString(),label,dataSource:'Actual Prometheus 3.15.0 HTTP APIs and native browser UI. No mocked responses, interception, fixture scrape, or main application/database access.',queries:[],screens:[],pageErrors:[],failedRequests:[]};
async function api(route,parameters){const url=new URL(route,base);if(parameters)url.search=new URLSearchParams(parameters);const response=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new Error('Local Prometheus API HTTP '+response.status);const value=await response.json();if(value.status!=='success')throw new Error('Local Prometheus API reported failure');return value.data;}
const info=await api('/api/v1/status/buildinfo');if(info.version!=='3.15.0')throw new Error('Unexpected local Prometheus version');report.prometheusVersion=info.version;
const targetData=await api('/api/v1/targets');report.targets=targetData.activeTargets.map(target=>({job:target.labels.job,instance:target.labels.instance,health:target.health,lastError:target.lastError,lastScrape:target.lastScrape,lastScrapeDuration:target.lastScrapeDuration,scrapeUrl:target.scrapeUrl}));
if(report.targets.length!==1||report.targets[0].scrapeUrl!=='http://127.0.0.1:18081/actuator/prometheus')throw new Error('Evidence capture must target only the isolated application on 18081');
report.alerts=(await api('/api/v1/alerts')).alerts;
for(const expression of ['up{job="freshmall"}','{__name__=~"freshmall_outbox_.*|freshmall_refund_failed|freshmall_inventory_.*|freshmall_business_.*"}','ALERTS{alertname=~"FreshMall.*"}'])report.queries.push({expression,data:await api('/api/v1/query',{query:expression})});
const end=Date.now()/1000;report.upHistory=await api('/api/v1/query_range',{query:'up{job="freshmall"}',start:String(end-600),end:String(end),step:'5'});
let browser;
try{
 browser=await chromium.launch({headless:true,channel:process.env.E2E_BROWSER_CHANNEL??'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',error=>report.pageErrors.push(error.message));
 page.on('requestfailed',request=>{if(!request.failure()?.errorText.includes('ERR_ABORTED'))report.failedRequests.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText});});
 const expression='up{job="freshmall"}';
 const views=[['targets','/targets'],['alerts','/alerts'],['up-graph','/query?'+new URLSearchParams({'g0.expr':expression,'g0.tab':'0','g0.range_input':'10m'})]];
 if(label.startsWith('business-'))views.push(['dead-graph','/query?'+new URLSearchParams({'g0.expr':'freshmall_outbox_events{state="DEAD"}','g0.tab':'0','g0.range_input':'10m'})]);
 for(const [view,url] of views){
  await page.goto(base+url,{waitUntil:'domcontentloaded'});
  if(view==='targets')await page.waitForFunction(()=>document.body.innerText.includes('127.0.0.1:18081/actuator/prometheus'));
  else if(view==='alerts')await page.getByRole('button',{name:/^FreshMallApplicationDown\b/}).waitFor();
  else if(view==='up-graph')await page.waitForFunction(()=>document.body.innerText.includes('up{instance="127.0.0.1:18081", job="freshmall"}'));
  else await page.waitForFunction(()=>document.body.innerText.includes('freshmall_outbox_events{instance="127.0.0.1:18081", job="freshmall", state="DEAD"}'));
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const file=label+'-'+view+'.png';await page.screenshot({path:path.join(output,file),fullPage:true});report.screens.push(file);
  if(view==='up-graph')report.graphPageText=(await page.locator('body').innerText()).slice(0,2000);
 }
 report.status=report.pageErrors.length||report.failedRequests.length?'BROWSER_ERRORS':'CAPTURED';
}catch(error){report.status='FAILED_CAPTURE';report.error=error.message;throw error;}
finally{await browser?.close();await fs.writeFile(path.join(output,label+'-live.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,label,targetHealth:report.targets[0].health,alerts:report.alerts.map(alert=>({name:alert.labels.alertname,state:alert.state})),screens:report.screens,pageErrors:report.pageErrors.length,failedRequests:report.failedRequests.length}));
