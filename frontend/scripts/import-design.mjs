import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
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
const pageNames = ['Home','List','Detail','Checkout','Admin','AdminPick'];
const scriptFrom = source => source.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)?.[1];
const legacySources = Object.fromEntries(await Promise.all(pageNames.map(async name => [name, await readFile(path.join(root, `design/v2/V2-${name}.dc.html`), 'utf8')])));
async function expandFragments(source, active = []) {
 const pattern = /<!--\s*r04:([a-z][a-z0-9-]*)\s*-->/g;
 let result = '', cursor = 0;
 for (const match of source.matchAll(pattern)) {
  const name = match[1];
  if (active.includes(name)) throw new Error(`Recursive R04 fragment: ${[...active,name].join(' -> ')}`);
  const fragment = await readFile(path.join(root, `design/r04/fragments/${name}.html`), 'utf8');
  result += source.slice(cursor, match.index) + await expandFragments(fragment, [...active,name]);
  cursor = match.index + match[0].length;
 }
 return result + source.slice(cursor);
}
async function importPages(version) {
 const pages = {};
 for(const name of pageNames) {
 const sourcePath = version === 'r04' ? `design/r04/${name}.dc.html` : `design/v2/V2-${name}.dc.html`;
 const rawSource = version === 'r04' ? await readFile(path.join(root, sourcePath), 'utf8') : legacySources[name];
 const source = version === 'r04' ? await expandFragments(rawSource) : rawSource;
 const xdc=source.match(/<x-dc>([\s\S]*)<\/x-dc>/)?.[1];
 if (!xdc) throw new Error(`Missing x-dc template in ${sourcePath}`);
 let template=xdc.replace(/<helmet>[\s\S]*?<\/helmet>/,'');
 let css=[...xdc.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const script=scriptFrom(source) ?? scriptFrom(legacySources[name]);
 if (!script) throw new Error(`Missing render values for ${sourcePath}`);
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
  pages[name]={template,css,defaults:data,source:sourcePath};
 }
 return pages;
}
async function copyR04Assets(directory) {
 for (const entry of await readdir(directory, {withFileTypes:true})) {
  const source = path.join(directory,entry.name);
  if (entry.isDirectory()) await copyR04Assets(source);
  else if (entry.isFile()) {
   if (!entry.name.startsWith('r04-')) throw new Error(`R04 asset must use r04- prefix: ${source}`);
   await copyFile(source, path.join(out,entry.name));
  }
 }
}
await mkdir(path.join(root,'frontend/src/generated'),{recursive:true});
const legacyPages = await importPages('r03');
await writeFile(path.join(root,'frontend/src/generated/design.json'),JSON.stringify(legacyPages));
const r04Pages = await importPages('r04');
await copyR04Assets(path.join(root,'design/r04/assets'));
await writeFile(path.join(root,'frontend/src/generated/design-r04.json'),JSON.stringify(r04Pages));
console.log('Imported R03 and R04 templates with local assets; design/ unchanged.');
