export type Page<T> = { page:number; size:number; total:number; items:T[] };
export const PAGE_SIZE=20;
export function pageNumber(raw:string|null|undefined):number {
    if(!raw||!/^\d+$/.test(raw))return 1;
    const value=Number(raw);return Number.isSafeInteger(value)&&value>=1&&value<=2147483647?value:1;
}
export function paginationState(page:number,size:number,total:number) {
    if(!Number.isSafeInteger(page)||page<1||!Number.isInteger(size)||size<1||size>100||!Number.isSafeInteger(total)||total<0)throw new Error('无效分页数据');
    const pages=Math.max(1,Math.ceil(total/size));
    return {pages,previous:page>1,next:page<pages,first:total===0?0:Math.min((page-1)*size+1,total),last:Math.min(page*size,total)};
}
export function pagination<T>(result:Page<T>,label:string,onPage:(page:number)=>Promise<void>):HTMLElement {
    const state=paginationState(result.page,result.size,result.total);
    const nav=document.createElement('nav');nav.className='fm-page-controls';nav.setAttribute('aria-label',label+'分页');
    const summary=document.createElement('span');summary.textContent=`共 ${result.total} 条 · ${state.first}–${state.last} 条 · 第 ${result.page} / ${state.pages} 页`;
    const action=(text:string,target:number,enabled:boolean)=>{const button=document.createElement('button');button.type='button';button.className='fm-management-button';button.dataset.tone='quiet';button.textContent=text;button.disabled=!enabled;button.onclick=()=>void onPage(target);return button;};
    const form=document.createElement('form');form.className='fm-page-jump';
    const input=document.createElement('input');input.type='number';input.min='1';input.max=String(state.pages);input.step='1';input.value=String(Math.min(result.page,state.pages));input.required=true;input.setAttribute('aria-label',label+'跳转页码');
    const jump=document.createElement('button');jump.type='submit';jump.className='fm-management-button';jump.dataset.tone='quiet';jump.textContent='跳转';jump.disabled=state.pages<=1;
    form.append(input,jump);form.onsubmit=e=>{e.preventDefault();if(form.reportValidity())void onPage(pageNumber(input.value));};
    nav.append(summary,action('上一页',result.page-1,state.previous),action('下一页',result.page+1,state.next),form);return nav;
}
