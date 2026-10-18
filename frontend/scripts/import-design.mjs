import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.join(root, 'frontend/public/generated');
await mkdir(out, {recursive:true});
// Provenance: docs/evidence/design-review-2026-10-18/previews/mapping.json; this committed map removes the build dependency on audit outputs.
const refs = JSON.parse(await readFile(new URL('./design-assets.json',import.meta.url),'utf8'));
const extra = {
 '212daffd30974fd23a4d144bc908fa73':'S010-cut.png','6e20d5b3b87508c7691eabd9c6436eae':'S007-cut.png',
 'e17f33201d9edaf481e37c5e91f31831':'S008-cut.png','1c325d6097fb7b3818807080959500f0':'dhu-weave-soft.png',
 '576df79a48b1fbc08c0224bb5f7a6f02':'dhu-weave-soft.png','48bde7c765abd9a63178ec245903b69f':'dhu-weave-white.png',
 'fda7af62195fbe9bd07b39f07f802586':'dhu-weave-red-fade.png',
 'cdde82d80a28194a7fec944db7aad91a':'home-r03-market-photo.jpg'
};
for(const [hash,file] of Object.entries(extra)) refs['/_blob/'+hash]='design/v2/assets/'+file;
for(const [blob,source] of Object.entries(refs)) {
 const file=path.basename(source); await copyFile(path.join(root,source),path.join(out,file)); refs[blob]='/generated/'+file;
}
const pages={};
for(const name of ['Home','List','Detail','Checkout','Admin','AdminPick']) {
 const source=await readFile(path.join(root,`design/v2/V2-${name}.dc.html`),'utf8');
 const xdc=source.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
 let template=xdc.replace(/<helmet>[\s\S]*?<\/helmet>/,'');
 let css=[...xdc.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const script=source.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
 // Evaluate only the local design export at build time. No prototype executable code is shipped.
 const values=vm.runInNewContext(`class DCLogic{constructor(p){this.props=p;this.state={}}setState(){}};${script};JSON.stringify(new Component({}).renderVals())`,{}, {timeout:1000});
 let data=JSON.parse(values);
 const replace=s=>s.replace(/\/_blob\/[a-f0-9]{32}/g, blob=>{if(!refs[blob]) throw new Error(`Missing ${name} asset ${blob}`);return refs[blob]});
 template=replace(template).replaceAll('7 天品质售后','7 天售后申请').replaceAll('7 天品质保障','7 天售后申请');css=replace(css);data=JSON.parse(replace(JSON.stringify(data)).replaceAll('7 天品质售后','7 天售后申请').replaceAll('7 天品质保障','7 天售后申请'));
 if(name==='Detail') {
   template=template.replaceAll('鲜活基围虾','{{productName}}').replaceAll('/generated/S016.jpg','{{productImage}}')
    .replace('产地广东 · 按 500g 计价 · 按份下单，拣货称重后多退少补','{{productDescription}}')
    .replace('>54.90<','>{{salePrice}}<').replace('¥59.90 / 500g','¥{{referencePrice}} / {{unitLabel}}')
    .replace('>/ 500g<','>/ {{unitLabel}}<').replace('¥10.98 / 100g · 注册即享会员价','注册即享会员价')
    .replace('>鲜活<','>{{storageLabel}}<').replace('>称重<','>{{priceModeLabel}}<')
    .replace('>每份预估重量<','>商品规格<').replace('预付 ¥{{w.amount}}','{{w.note}}')
    .replace(/按预估重量先付 <strong>[\s\S]*?否则订单取消并全额退款。/,'{{weightMessage}}');
  }
  if(name==='Checkout') {
   template=template.replace('每个时段开始前 30 分钟截止下单（示意），名额以提交时为准','截止时间与名额由服务端返回，提交时再次校验')
    .replace('已满 ¥99，免运费','{{freightMessage}}')
    .replace('本单含 1 件称重商品，按预估重量预付。拣货称重后实重偏少会自动退差；偏多需补款（最多 ¥5.49），补款须在 10 分钟内完成。','{{weightMessage}}');
  }
  pages[name]={template,css,defaults:data,source:`design/v2/V2-${name}.dc.html`};
}
await mkdir(path.join(root,'frontend/src/generated'),{recursive:true});
await writeFile(path.join(root,'frontend/src/generated/design.json'),JSON.stringify(pages));
console.log('Imported six design templates with local assets; design/ unchanged.');
