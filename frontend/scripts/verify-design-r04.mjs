/** Real, anonymous, read-only UI acceptance. Run after R04 sources have been built.
 * No route interception, mocked responses, credentials, login, cart writes or orders.
 * The app's automatic anonymous auth-refresh request is observed, never forged.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'docs/evidence/ui-demo-r04');
const base = process.env.R04_SMOKE_BASE ?? 'http://127.0.0.1:5173';
const report = {startedAt: new Date().toISOString(), dataSource: 'real local API; anonymous new browser contexts; no mock or interception', status: 'RUNNING', screenshotLoadStrategy: 'For screenshots only, mark existing lazy images eager and await bounded decode; real URLs and APIs unchanged.', sourceSha256: {}, pages: [], featuredChecks: [], navigationChecks: [], categorySortChecks: [], detailChecks: [], pageErrors: [], failedAssets: [], unexpectedApiWrites: [], anonymousRefreshes: 0};
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const money = cents => '¥' + (cents / 100).toFixed(2);
const compact = value => value.replace(/\s+/g, '');
async function sourceHashes(directory) {
 for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
  if (entry.name === 'screens' || entry.name === 'render-preview.py') continue;
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) await sourceHashes(target);
  else if (entry.isFile()) report.sourceSha256[path.relative(root,target)] = crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex');
 }
}
async function getData(request, apiPath) {
 const response = await request.get(base + apiPath);
 assert(response.ok(), `GET ${apiPath}: HTTP ${response.status()}`);
 return (await response.json()).data;
}
const progress = (stage, extra = {}) => console.log(JSON.stringify({progress:stage,...extra}));
async function ready(page, name) {
 await page.locator(`[data-page="${name}"]`).waitFor();
 const loading = await page.evaluate(async () => {
  // Screenshot-only eager loading prevents offscreen loading=lazy images from blocking decode.
  // This changes browser loading priority only; URLs, responses and business data are untouched.
  const images = [...document.images];
  for (const image of images) image.loading = 'eager';
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]);
  return await Promise.all(images.map(async image => {
   let timedOut = false;
   await Promise.race([image.decode().catch(() => {}),new Promise(resolve => setTimeout(() => {timedOut=true;resolve();},10000))]);
   return {src:image.getAttribute('src'),complete:image.complete,naturalWidth:image.naturalWidth,timedOut};
  }));
 });
 const failed = loading.filter(image=>!image.complete||!image.naturalWidth);
 assert(!failed.length, `${name}: image load failed/timed out: ${JSON.stringify(failed)}`);
}

async function snapshot(page, name, width, version='r04') {
 await ready(page, name === 'home' ? 'Home' : name === 'list' ? 'List' : 'Detail');
 const state = await page.evaluate(() => ({url: location.href, design: document.documentElement.dataset.design, viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, title: document.querySelector('[data-page] main h1')?.textContent?.trim() ?? null, brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.getAttribute('src')), overflowElements: [...document.querySelectorAll('body *')].filter(element => { const style=getComputedStyle(element);if(style.display==='none'||style.visibility==='hidden')return false;const rect=element.getBoundingClientRect();return rect.width>0 && (rect.right>innerWidth+1 || rect.left < -1); }).slice(0,20).map(element => ({tag:element.tagName,className:String(element.className),right:Math.round(element.getBoundingClientRect().right)}))}));
 report.pages.push({name, width, version, ...state});
 assert(state.design===version, `${name} ${width}: wrong version ${state.design}`);
 assert(state.documentWidth <= width + 1, `${name} ${width}: horizontal document overflow ${state.documentWidth}`);
 assert(!state.brokenImages.length, `${name} ${width}: broken images`);
 const filename = version==='r03' ? `home-r03-${width}.png` : `${name}-${width}.png`;
 await page.screenshot({path:path.join(out, filename),fullPage:true});
 progress('screenshot-saved',{name,width,version,filename});
}
async function home(page) {
 const waiting=page.waitForResponse(response => new URL(response.url()).pathname==='/api/v1/home' && response.ok());
 await page.goto(base + '/');
 const data=(await (await waiting).json()).data;
 await page.locator('[data-home-featured-slot]:not([hidden])').first().waitFor();
 await ready(page,'Home');
 return data;
}
async function liveFeatured(page, data, width) {
 const cards=await page.locator('[data-home-featured-slot]:not([hidden])').evaluateAll(nodes => nodes.map(anchor => ({slot:anchor.dataset.homeFeaturedSlot,id:anchor.dataset.homeProductId,name:anchor.querySelector('[data-home-product-name]')?.textContent?.trim(),price:anchor.querySelector('[data-home-product-price]')?.textContent?.trim(),unit:anchor.querySelector('[data-home-product-unit]')?.textContent?.trim(),image:anchor.querySelector('img')?.getAttribute('src'),href:anchor.getAttribute('href'),label:anchor.getAttribute('aria-label'),prototypeHandler:anchor.onclick!==null})));
 const products=[...data.recommendedProducts,...data.nearExpiryProducts];
 const visibleIds=await page.locator('main article[data-key]').evaluateAll(nodes=>nodes.map(node=>node.dataset.key));
 assert(visibleIds.length===new Set(visibleIds).size,`home ${width}: duplicate products across shelves`);
 assert(cards.length===3, `home ${width}: expected three live featured cards`);
 for(const card of cards){const product=products.find(item=>item.productId===card.id);assert(product,`home ${width}: featured product not from API`);assert(card.name===product.name&&card.price===money(product.salePrice)&&card.unit===product.unitLabel&&card.image===product.imageUrl,`home ${width}: featured fields mismatch ${card.id}`);assert(card.href==='#/product/'+encodeURIComponent(card.id)&&!card.prototypeHandler,`home ${width}: featured link mismatch`);assert(card.label?.includes(product.name)&&card.label?.includes(money(product.salePrice)),`home ${width}: featured aria mismatch`);}
 report.featuredChecks.push({width,cards});
 return cards;
}
let browser;
await fs.mkdir(out,{recursive:true});
try {
 for(const directory of ['design/r04','design/v2']) await sourceHashes(path.join(root,directory));
 for(const relative of ['frontend/src/app/application.ts','frontend/src/app/template.ts','frontend/src/app/design-version.ts','frontend/src/main.tsx','frontend/src/styles/r04-foundation.css','frontend/src/styles/runtime-r04.css','frontend/src/generated/design.json','frontend/src/generated/design-r04.json']) report.sourceSha256[relative]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,relative))).digest('hex');
 progress('source-hashes-ready',{files:Object.keys(report.sourceSha256).length});
 progress('launching-chrome');
 browser=await chromium.launch({headless:true,channel:'chrome'});
 progress('chrome-ready');
 for(const width of [1440,1024]) {
  progress('viewport-start',{width});
  const context=await browser.newContext({viewport:{width,height:1000}});
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',error => report.pageErrors.push({width,message:error.message}));
  page.on('response',response => {if(response.status()>=400&&/\.(png|jpe?g|webp|svg)(\?|$)/i.test(response.url()))report.failedAssets.push({width,url:response.url(),status:response.status()});});
  page.on('requestfailed',request => {if(request.resourceType()==='image'&&!request.failure()?.errorText?.includes('ABORTED'))report.failedAssets.push({width,url:request.url(),error:request.failure()?.errorText});});
  page.on('request',request => {if(new URL(request.url()).pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method())){if(new URL(request.url()).pathname==='/api/v1/auth/refresh')report.anonymousRefreshes++;else report.unexpectedApiWrites.push({width,method:request.method(),url:request.url()});}});
  progress('home-start',{width});
  let homeData=await home(page);
  progress('home-ready',{width});
  const featured=await liveFeatured(page,homeData,width);
  await snapshot(page,'home',width);
  if(width===1440){
   for(const card of featured){await page.locator(`[data-home-featured-slot="${card.slot}"]`).click();await page.waitForURL(url=>url.hash==='#/product/'+encodeURIComponent(card.id));await ready(page,'Detail');assert(await page.locator('[data-page="Detail"]').getAttribute('data-product-id')===card.id,'featured clicked wrong product');report.navigationChecks.push({kind:'featured',productId:card.id,url:page.url()});homeData=await home(page);}
  }
  progress('catalog-start',{width});
  const category=homeData.categories.find(item=>/蔬菜/.test(item.name))??homeData.categories[0];
  assert(category,'No real category');
  await page.locator(`nav[aria-label="商品分类"] a[data-key="${category.categoryId}"]`).click();
  await page.waitForURL(url=>url.hash.includes('categoryId='+category.categoryId));
  await ready(page,'List');
  const categoryHeading=(await page.locator('[data-page="List"] main h1').textContent()).trim();
  assert(categoryHeading===category.name,'Category title not from real category');
  const activeCategory=page.locator('main aside a[aria-current="page"]');
  assert(await activeCategory.count()===1&&(await activeCategory.textContent()).trim()===category.name,'Active category aria-current mismatch');
  const sorts=['RECOMMENDED','PRICE_ASC','PRICE_DESC'];
  for(let index=0;index<sorts.length;index++){
   const target=page.locator('[aria-label="排序"] button').nth(index);
   if(index>0){const waiting=page.waitForResponse(response=>{const url=new URL(response.url());return url.pathname==='/api/v1/products'&&url.searchParams.get('sort')===sorts[index]&&response.ok();});await target.click();await waiting;await ready(page,'List');await page.waitForFunction(selected=>[...document.querySelectorAll('[aria-label="排序"] button')].every((button,i)=>button.getAttribute('aria-pressed')===String(i===selected)),index);}
   const buttons=await page.locator('[aria-label="排序"] button').evaluateAll(nodes=>nodes.map(node=>({text:node.textContent.trim(),pressed:node.getAttribute('aria-pressed')})));
   assert(buttons.length===3&&buttons.every((button,i)=>button.pressed===String(i===index)),`Sort pressed state mismatch ${sorts[index]}`);
   const expected=await getData(context.request, '/api/v1/products?size=100&categoryId='+encodeURIComponent(category.categoryId)+'&sort='+sorts[index]);
   const actual=await page.locator('main article[data-key]').evaluateAll(nodes=>nodes.map(node=>node.dataset.key));
   assert(JSON.stringify(actual)===JSON.stringify(expected.items.map(item=>item.productId)),`Catalog order differs from API ${sorts[index]}`);
   report.categorySortChecks.push({width,categoryId:category.categoryId,categoryName:category.name,sort:sorts[index],heading:categoryHeading,buttons,productIds:actual,url:page.url()});
  }
  await snapshot(page,'list',width);
  progress('detail-start',{width});
  const catalog=await getData(context.request,'/api/v1/products?size=100');
  const candidate=[...catalog.items].sort((a,b)=>(b.skus?.length??0)-(a.skus?.length??0))[0];
  assert(candidate,'No real product');
  const product=await getData(context.request,'/api/v1/products/'+encodeURIComponent(candidate.productId));
  await page.goto(base+'/#/product/'+encodeURIComponent(product.productId));
  await ready(page,'Detail');
  assert((await page.locator('[data-page="Detail"] main h1').textContent()).trim()===product.name,'Product heading mismatch');
  assert(await page.locator('.r4-detail-skus button').count()===product.skus.length,'SKU button count differs from API');
  for(const [index,sku] of product.skus.entries()){
   const button=page.locator('.r4-detail-skus button').nth(index);
   assert(compact(await button.textContent()).includes(compact(sku.unitLabel))&&compact(await button.textContent()).includes(money(sku.salePrice)), 'SKU visible text differs from API');
   await button.click();
   await page.waitForFunction(({index,price})=>{const buttons=[...document.querySelectorAll('.r4-detail-skus button')];return buttons[index]?.getAttribute('aria-pressed')==='true'&&document.querySelector('.r4-detail-price')?.textContent?.replace(/\s+/g,'')===price;},{index,price:money(sku.salePrice)});
   const state=await page.locator('.r4-detail-skus button').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-pressed')));
   assert(state.every((value,i)=>value===String(i===index)), 'SKU selected state mismatch');
   report.detailChecks.push({width,productId:product.productId,name:product.name,skuId:sku.skuId,unitLabel:sku.unitLabel,salePrice:money(sku.salePrice),selectedState:state});
  }
  await page.getByRole('button',{name:'增加一份',exact:true}).click();
  await page.locator('.r4-detail-quantity [aria-live="polite"]').filter({hasText:/^2$/}).waitFor();
  await page.getByRole('button',{name:'减少一份',exact:true}).click();
  await page.locator('.r4-detail-quantity [aria-live="polite"]').filter({hasText:/^1$/}).waitFor();
  report.detailChecks.push({width,kind:'quantity',afterIncrease:2,afterDecrease:1});
  await snapshot(page,'detail',width);
  if(width===1440){
   progress('version-switch-start',{width});
   const oldSwitch=page.getByRole('navigation',{name:'界面版本'}).getByRole('link',{name:'上一版',exact:true});
   const hash=new URL(page.url()).hash;await oldSwitch.click();await ready(page,'Detail');
   assert(new URL(page.url()).searchParams.get('ui')==='r03'&&new URL(page.url()).hash===hash,'R03 switch did not preserve hash');
   report.navigationChecks.push({kind:'switch-r03-preserve-detail',url:page.url()});
   await page.goto(base+'/?ui=r03#/');await ready(page,'Home');await snapshot(page,'home',1440,'r03');
   const newest=page.getByRole('navigation',{name:'界面版本'}).getByRole('link',{name:'新版',exact:true});await newest.click();await ready(page,'Home');
   assert(new URL(page.url()).searchParams.get('ui')==='r04'&&new URL(page.url()).hash==='#/','R04 switch did not preserve hash');
   report.navigationChecks.push({kind:'switch-r04-preserve-home',url:page.url()});
  }
  await context.close();
  progress('viewport-complete',{width});
 }
 assert(!report.pageErrors.length&&!report.failedAssets.length&&!report.unexpectedApiWrites.length,'Page errors, failed image assets or unexpected business writes');
 report.status='PASSED';
} catch(error) {report.status='FAILED';report.error=String(error.message).slice(0,1000);process.exitCode=1;}
finally {
 progress('finalizing',{status:report.status});
 report.finishedAt=new Date().toISOString();
 await fs.writeFile(path.join(out,'readonly-smoke.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,error:report.error??null,pages:report.pages.length,featuredCards:report.featuredChecks.map(check=>({width:check.width,count:check.cards.length})),navigationChecks:report.navigationChecks.length,categorySortChecks:report.categorySortChecks.length,detailChecks:report.detailChecks.length,pageErrors:report.pageErrors,failedAssets:report.failedAssets,unexpectedApiWrites:report.unexpectedApiWrites,anonymousRefreshes:report.anonymousRefreshes,evidence:path.relative(root,out)}));
 await browser?.close();
}
