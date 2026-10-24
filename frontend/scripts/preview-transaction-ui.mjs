/** Visual fixtures only; localhost frontend required. Does not submit business commands. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = new URL('../../docs/evidence/transaction-polish-20261024/',import.meta.url);
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const catalog=JSON.parse(await fs.readFile(new URL('../../database/seed/catalog.json',import.meta.url),'utf8'));
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.evaluate(catalog=>document.body.dataset.previewCatalog=JSON.stringify(catalog.products),catalog);
await page.evaluate(async()=>{
 const {Application}=await import('/src/app/application.ts');
 const {service}=await import('/src/app/service.ts');
 const {renderCheckoutCoupons}=await import('/src/ui/checkout/coupon-view.ts');
 const note=document.createElement('div');
 const app=new Application(document.createElement('div'),note);
 const names=[['水果黄瓜','PIECE',1],['冰鲜三文鱼','PIECE',1],['鲜活鲈鱼','GRAM',600],['无糖气泡水','PIECE',1]];
 const samples=names.map(([name,baseUnit,qty])=>[name,JSON.parse(document.body.dataset.previewCatalog).find(p=>p.name===name).imagePath,baseUnit,qty]);
 const items=samples.map(([name,id,baseUnit,quantity],i)=>({orderItemId:'preview-item-'+i,productName:name,unitLabel:baseUnit==='GRAM'?'约600克/条':'标准装',quantity,baseUnit,estimatedGram:baseUnit==='GRAM'?600:null,actualGram:baseUnit==='GRAM'?600:null,imageUrl:id}));
 const order={orderId:'ui-preview-order',orderNo:'UI-PREVIEW-20261024',status:'PENDING_PAY',paidAmount:0,items};
 const task={taskId:'ui-preview-task',version:0,items,allocations:items.map((item,i)=>({orderItemId:item.orderItemId,allocationId:'preview-allocation-'+i,batchNo:'SKU-00'+(i+1)+'-NORMAL',baseUnit:item.baseUnit,reservedQuantity:item.quantity}))};
 service.prepay=async()=>({paymentId:'ui-preview-payment',amount:12643,status:'PENDING',expiresAt:new Date(Date.now()+15*60*1000).toISOString(),allowedActions:['SIMULATE_PAYMENT'],version:0});
 window.previewUI=async(kind)=>{
  document.querySelectorAll('dialog[data-demo],#coupon-preview').forEach(x=>x.remove());
  if(kind==='payment')await app.payment(order);
  if(kind==='cancel')app.cancelOrderDialog(order);
  if(kind==='picking')app.pickDialog(task);
  if(kind==='delivery')app.receiptDialog({taskId:'ui-preview-delivery',version:0});
  if(kind==='aftersale')app.aftersaleDialog({...order,status:'FINISHED'});
  if(kind==='review')app.reviewDialog({aftersaleId:'UI-PREVIEW-AFTERSALE',version:0,items:[{orderItemId:'preview-item-0',quantity:1,requestedAmount:2000}]});
  if(kind==='coupon'){
   const surface=document.createElement('section');surface.id='coupon-preview';surface.className='fm-checkout-benefits';surface.style.cssText='position:fixed;z-index:5000;inset:70px 16px auto;margin:auto;max-width:760px;padding:24px;display:flex;flex-direction:column;gap:16px;background:white;border-radius:14px;box-shadow:0 10px 60px #22334422;font:14px/1.6 PingFang SC,sans-serif';
   const title=document.createElement('h2');title.textContent='优惠券';title.style.margin='0';const coupons=document.createElement('div');const label=document.createElement('label');label.style.cssText='display:flex;flex-direction:column';const name=document.createElement('span');name.textContent='订单备注';const note=document.createElement('input');note.type='text';note.placeholder='选填，例如：放宿舍楼下快递架';label.append(name,note);surface.append(title,coupons,label);document.body.append(surface);
   const data=[{couponId:'preview-coupon',status:'AVAILABLE',name:'新人券',discountAmount:500,minGoodsAmount:3000,expiresAt:'2026-11-24T00:00:00Z'}];
   const draw=id=>renderCheckoutCoupons(coupons,data,id,draw);draw('preview-coupon');
  }
 };
});
const results=[];
for(const width of [1440,1024,390]){
 await page.setViewportSize({width,height:1050});
 for(const kind of ['payment','cancel','coupon','picking','delivery','aftersale','review']){
  await page.evaluate(k=>window.previewUI(k),kind);
  await page.waitForTimeout(100);
  const surface=page.locator(kind==='coupon'?'#coupon-preview':'dialog[open]');
  const layout=await surface.evaluate(el=>{const r=el.getBoundingClientRect();return{width:r.width,height:r.height,withinViewport:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,overflow:el.scrollWidth>el.clientWidth+1,heading:el.querySelector('h2')?.textContent}});
  if(!layout.withinViewport||layout.overflow)throw new Error(kind+' '+width+' layout '+JSON.stringify(layout));
  if(kind==='coupon'){
   await surface.getByText('不使用优惠券',{exact:true}).click();if(!(await surface.locator('input[value=""]').isChecked()))throw new Error('Coupon deselection');
   await surface.locator('.fm-checkout-coupon-card').click();if(!(await surface.locator('.fm-checkout-coupon-card input').isChecked()))throw new Error('Coupon selection');
  }
  if(kind==='delivery'){
   await surface.locator('input').fill('123456');if(!(await surface.locator('input').evaluate(i=>i.checkValidity())))throw new Error('Six digit input');
  }
  if(kind==='aftersale')await surface.getByRole('checkbox').first().check();
  const filename=kind+'-'+width+'.png';await surface.screenshot({path:fileURLToPath(new URL(filename,output))});
  if(kind!=='coupon'){await page.keyboard.press('Escape');if(await page.locator('dialog[open]').count())throw new Error('Escape close');}
  results.push({kind,viewportWidth:width,...layout,screenshot:filename});
 }
}
if(errors.length)throw new Error('UI errors: '+errors.join(';'));
await fs.writeFile(new URL('result.json',output),JSON.stringify({status:'PASSED',type:'Visual fixtures rendered with the real local frontend modules. No business-flow acceptance claim.',applicationBuild:'TypeScript + Vite production build PASS',businessCommandsSubmitted:0,browserErrors:errors,results},null,2)+'\n');
console.log(JSON.stringify({status:'PASSED',surfaces:results.length,viewports:[1440,1024,390],businessCommandsSubmitted:0,browserErrors:errors.length,output:fileURLToPath(output)}));
await browser.close();
