import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'frontend/public/generated/design-gallery');
await fs.mkdir(out,{recursive:true});
const versions=[
 {title:'R01 · 暖米首屏',note:'最初可运行Demo的首页',source:'docs/evidence/demo-runtime/browser/home-1440.png',tag:'ui/home-r01-warm'},
 {title:'R02 · 白底货架',note:'三种水果与货架价签候选稿',source:'docs/evidence/ui-home-r02-shelf/home-1440-local.png',tag:'ui/home-r02-shelf'},
 {title:'R03 · 自然摄影',note:'上一版已保留，点击可实际体验',source:'docs/evidence/ui-home-r03-market/home-1440-first-screen.png',tag:'ui/home-r03-market',live:'/?ui=r03#/'},
 {title:'R04 · 红白自然全站',note:'新一版全站候选，待你确认',source:'docs/evidence/ui-demo-r04/home-1440.png',tag:'ui/demo-r04-dhu-natural',live:'/?ui=r04#/'}
];
const pages=[
 {title:'旧版首页',note:'R03实际页面',source:'docs/evidence/ui-home-r03-market/home-1440-local.png',live:'/?ui=r03#/'},
 {title:'旧版商品列表',note:'本机真实接口截图',source:'docs/evidence/ui-demo-r04/list-r03-1440.png',live:'/?ui=r03#/products'},
 {title:'旧版商品详情',note:'本机真实接口截图',source:'docs/evidence/ui-demo-r04/detail-r03-1440.png',live:'/?ui=r03#/product/S001'},
 {title:'旧版确认订单',note:'此前真实业务验收截图；实际操作需会员登录',source:'docs/evidence/demo-runtime/browser/checkout-live.png',live:'/?ui=r03#/checkout'}
];
async function cards(items,prefix){let html='';for(const [index,item]of items.entries()){
 const filename=prefix+'-'+index+'.png';await fs.copyFile(path.join(root,item.source),path.join(out,filename));
 html+=`<article><a class="preview" href="${filename}" target="_blank"><img src="${filename}" alt="${item.title}"></a><div class="info"><h2>${item.title}</h2><p>${item.note}</p><div class="links"><a href="${filename}" target="_blank">查看完整截图 ↗</a>${item.live?`<a href="${item.live}" target="_blank">打开实际页面 ↗</a>`:''}${item.tag?`<a href="https://github.com/gorneynienhuis-lang/freshmart-enterprise/tree/${item.tag}" target="_blank">GitHub版本 ↗</a>`:''}</div></div></article>`;
 }return html;}
const versionHtml=await cards(versions,'version');const pageHtml=await cards(pages,'page');
await fs.writeFile(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>东华生鲜 · 历史页面与版本对比</title><style>*{box-sizing:border-box}body{margin:0;background:#F6F6F3;color:#293128;font:14px 'PingFang SC','Microsoft YaHei',sans-serif;border-top:4px solid #A0021F}main{max-width:1480px;margin:auto;padding:36px 28px 60px}header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:30px}header small{color:#A0021F;font-size:11px;letter-spacing:.14em}h1{font-size:28px;margin:10px 0 8px}header p{font-size:12px;color:#818678;line-height:1.8}header>a{color:#A0021F;text-decoration:none;white-space:nowrap}section{margin-top:35px}section>h2{font-size:20px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}article{background:white;border:1px solid #DFE3D8;border-radius:10px;overflow:hidden}.preview{display:block;height:290px;overflow:hidden;background:#EDEFE7;border-bottom:1px solid #E7E9E0}.preview img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}.info{padding:19px}.info h2{font-size:17px;margin:0 0 10px}.info p{font-size:11px;color:#8B9083;line-height:1.8;min-height:36px}.links{display:flex;gap:12px;flex-wrap:wrap}.links a{color:#A0021F;font-size:11px;line-height:1.8;text-decoration:none}@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){main{padding:25px 16px}header{display:block}.grid{grid-template-columns:1fr}.preview{height:330px}h1{font-size:24px}}</style><main><header><div><small>DONGHUA COMMUNITY · DESIGN ARCHIVE</small><h1>历史页面，一起比较</h1><p>每张卡片可打开完整截图。R03可实际操作，R01/R02已在GitHub保留；R04仍为新候选稿。</p></div><a href="/?ui=r04#/" target="_blank">打开新版商城 ↗</a></header><section><h2>首页的四个版本</h2><div class="grid">${versionHtml}</div></section><section><h2>上一版的主要页面</h2><div class="grid">${pageHtml}</div></section></main></html>`);
console.log('Design gallery: http://localhost:5173/generated/design-gallery/index.html');
