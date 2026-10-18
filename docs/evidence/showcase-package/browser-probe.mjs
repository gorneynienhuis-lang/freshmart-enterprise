import {chromium} from '../../../frontend/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('./',import.meta.url));
const report={dataSource:'isolated real showcase JAR through local self-signed HTTPS loopback proxy; anonymous new context; no mocked response, forged Origin, login or reused session',base:'https://localhost:8182',tlsScope:'self-signed local probe with ignoreHTTPSErrors:true in this new test context only; not a public CA or cloud TLS verification',pages:[],pageErrors:[],failedAssets:[],optionalAssets:[],apiResponses:[],originRequests:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});
 const page=await context.newPage();
 page.on('request',request=>{const origin=request.headers().origin;if(origin)report.originRequests.push({path:new URL(request.url()).pathname,method:request.method(),origin});});
 page.on('pageerror',error=>report.pageErrors.push(error.message));
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/'))report.apiResponses.push({path:url.pathname,status:response.status()});else if(response.status()>=400)(url.pathname==='/favicon.ico'?report.optionalAssets:report.failedAssets).push({path:url.pathname,status:response.status()});});
 for(const [name,route,selector] of [['home','/','[data-page="Home"] main'],['list','/#/products','[data-catalog-categories]']]){
  const response=await page.goto('https://localhost:8182'+route);
  const tls=response?await response.securityDetails():null;
  await page.locator(selector).waitFor();
  await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await Promise.all([...document.images].map(image=>Promise.race([image.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,5000))])));});
  const result=await page.evaluate(()=>({design:document.documentElement.dataset.design,title:document.querySelector('[data-page] main h1')?.textContent,productCards:document.querySelectorAll('main article[data-key]').length,documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,brokenImages:[...document.images].filter(image=>!image.naturalWidth).map(image=>image.getAttribute('src'))}));
  if(result.design!=='r03'||!result.productCards||result.brokenImages.length||result.documentWidth>result.viewport)throw new Error(name+' packaged page invalid');
  await page.screenshot({path:out+name+'-1440.png',fullPage:true});
  await page.screenshot({path:out+name+'-1440-first-screen.png'});
  report.pages.push({name,route,tls,...result});
 }
 report.status=report.pageErrors.length||report.failedAssets.length?'FAILED':'PASSED';
}catch(error){report.status='FAILED';report.failure=error.message;throw error;}
finally{await fs.writeFile(out+'browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({status:report.status,pages:report.pages.length}));}
