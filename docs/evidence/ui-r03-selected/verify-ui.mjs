import {chromium} from '../../../frontend/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5173';
const out=fileURLToPath(new URL('./',import.meta.url));
const report={startedAt:new Date().toISOString(),dataSource:'real local backend, anonymous browser, no mocked responses',pages:[],categoryChecks:[],navigationChecks:[],errors:[],failedAssets:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();
page.on('pageerror',error=>report.errors.push(error.message));
page.on('request',request=>{if(/%7B%7B|\{\{/i.test(request.url()))report.errors.push('Unresolved template resource: '+new URL(request.url()).pathname);});
page.on('response',response=>{if(response.status()>=400&&/\.(png|jpg|webp|svg|woff)/.test(response.url()))report.failedAssets.push({url:response.url(),status:response.status()});});
try{
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto(base+'/#/products');
  await page.locator('[data-catalog-categories] a').nth(1).waitFor();
  await page.evaluate(async()=>{for(const image of document.images)image.loading='eager';await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))]);await Promise.all([...document.images].map(image=>Promise.race([image.decode().catch(()=>{}),new Promise(r=>setTimeout(r,5000))])));});
  const state=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,design:document.documentElement.dataset.design,title:document.querySelector('main h1')?.textContent,categories:[...document.querySelectorAll('[data-catalog-categories] a')].map(a=>({text:a.textContent,href:a.getAttribute('href'),active:a.getAttribute('aria-current'),font:getComputedStyle(a).fontSize,decoration:getComputedStyle(a).textDecorationLine,height:a.getBoundingClientRect().height})),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).slice(0,15).map(e=>({tag:e.tagName,class:e.className,right:Math.round(e.getBoundingClientRect().right)})),brokenImages:[...document.images].filter(image=>!image.naturalWidth).map(image=>image.getAttribute('src'))}));
  await page.screenshot({path:out+`/list-${width}.png`,fullPage:true});
  await page.screenshot({path:out+`/list-${width}-first-screen.png`});
  report.pages.push(state);
  await page.locator('[data-catalog-categories] a').nth(1).click();
  await page.locator('[data-catalog-categories] a[aria-current="page"]').filter({hasText:'时令蔬菜'}).waitFor();
  report.categoryChecks.push({width,selected:await page.locator('main h1').textContent(),selectedLink:await page.locator('[data-catalog-categories] a[aria-current="page"]').textContent()});
  await page.screenshot({path:out+`/category-${width}.png`,fullPage:true});
  await page.locator('[data-catalog-categories] a').first().click();
  await page.waitForFunction(()=>location.hash==='#/products'&&document.querySelector('main h1')?.textContent==='全部商品');
  await page.locator('[aria-label="排序"] button').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="排序"] button:nth-child(2)')?.getAttribute('aria-pressed')==='true');
  await page.locator('[data-catalog-categories] a').first().focus();
  await page.keyboard.press('Tab');
  const focus=await page.locator('[data-catalog-categories] a').nth(1).evaluate(a=>({active:document.activeElement===a,outline:getComputedStyle(a).outlineStyle,outlineWidth:getComputedStyle(a).outlineWidth}));
  if(!focus.active||focus.outline==='none')throw new Error('category keyboard focus is not visible');
  report.navigationChecks.push({width,returnAll:true,sortPriceAscending:true,focus});
 }
 await page.goto(base+'/?ui=r04#/products');
 await page.locator('[data-catalog-categories] a').nth(1).waitFor();
 if(await page.locator('html').getAttribute('data-design')!=='r04')throw new Error('explicit R04 unavailable');
 await page.locator('.demo-design-switch a').first().click();
 await page.waitForFunction(()=>document.documentElement.dataset.design==='r03'&&location.hash==='#/products');
 report.navigationChecks.push({explicitR04:true,switchToSelectedR03PreservesRoute:true});
 report.status=report.errors.length||report.failedAssets.length||report.pages.some(p=>p.documentWidth>p.width||p.brokenImages.length)?'FAILED':'PASSED';
}catch(error){report.status='FAILED';report.failure=error.message;throw error;}
finally{await fs.writeFile(out+'/ui-check.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report,null,2));}
