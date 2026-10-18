import { service, type ListQuery } from './service';
import { pagination, paginationState, pageNumber, type Page } from './pagination';
import { openAddressManager, renderAddressManager } from './address-panel';
import { appendAftersaleActions, appendAdminOrderActions, appendRefundActions, appendMemberOrderActions } from './lifecycle-panel';
import '../styles/pagination.css';
import { mountTemplate, defaults, type Values, type PageName } from './template';
import { ApiError } from '../api/errors';
import { homeCategoryHref, selectHomeFeatured } from './home-featured';
import { isR04Design } from './design-version';
import { productImagePath, setProductImage } from './product-image';
import { renderManagement } from './admin-panel';
import { renderOperations } from './operations-panel';
import { renderFinanceAudit } from './finance-audit-panel';
import { appendDeliveryActions, openReallocateDialog } from './fulfillment-panel';
import { createEvidenceUploader, createReviewButton, renderProductReviews, openEvidencePreview } from './media-review';
import '../styles/account-security.css';
import '../styles/runtime-r03.css';
import { formatMoney, formatWeight, type Models, type Product, type Cart, type Quote, type Address, type DeliverySlot, type Order } from '../domain';
const money = (n: number) => formatMoney(n, { symbol: false, grouping: false });
function yuan(value:string):number {if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value))throw new Error('金额须为非负数，最多两位小数');const [whole,decimal='']=value.split('.');const cents=BigInt(whole!)*100n+BigInt(decimal.padEnd(2,'0'));if(cents>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('金额超出范围');return Number(cents);}

const storage: Record<string, string> = { AMBIENT: '常温', COLD: '冷藏', FROZEN: '冷冻', LIVE: '鲜活' };
const status: Record<string, string> = { PENDING_PAY: '待支付', PAID: '已支付，待拣货', PICKING: '拣货中', READY_TO_SHIP: '待发货', DELIVERING: '配送中', FINISHED: '已完成', CANCELED: '已取消', CLOSED: '已关闭' };
const q = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => root.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => [...root.querySelectorAll<T>(selector)];
const textButton = (root: ParentNode, label: string) => qa<HTMLButtonElement>(root, 'button').find(el => el.textContent?.trim() === label);
const byText = (root: ParentNode, text: string) => qa(root, 'a,span,p,div').find(el => el.childElementCount === 0 && el.textContent?.trim() === text);
const el = (tag: string, text?: string) => { const node = document.createElement(tag); if (text !== undefined)
    node.textContent = text; return node; };
function businessDate(offset = 0) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000)); }
function button(text: string, act: () => void) { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = act; b.className = isR04Design() ? 'r04-button' : 'fm-action-button'; if (/关闭|稍后|继续选购|刷新|切换|删除|取消订单|驳回/.test(text)) b.dataset.tone = /删除|取消订单|驳回/.test(text) ? 'danger' : 'quiet'; return b; }
function input(label: string, name: string, value = '', type = 'text') { const l = document.createElement('label'); if (isR04Design()) { l.className = 'r04-field'; l.append(el('span', label)); } else l.textContent = label + ' '; const i = document.createElement('input'); i.name = name; i.value = value; i.type = type; i.required = true; l.append(i); return l; }
const roleNames: Record<string, string> = { MEMBER: '社区会员', ADMIN: '系统管理员', PICKER: '拣货员', COURIER: '配送员', OPERATOR: '门店运营', SERVICE: '客服', FINANCE: '财务' };
function r04Note(text: string, kind = 'neutral') { const p = el('p', text); p.className = 'r04-context'; p.dataset.tone = kind; return p; }
function r04State(text: string, raw: string) { const span = el('span', text); span.className = 'r04-state'; span.dataset.state = raw; return span; }
export class Application {
    private epoch = 0;
    private listStates = new Map<string,{page:number;status:string;search:string}>();
    private busy = false;
    private cart: Cart | null = null;
    private products: Product[] = [];
    private categories: Models['Category'][] = [];
    private addressId = '';
    private slotId = '';
    private date = businessDate();
    private couponId: string | null = null;
    private quote: Quote | null = null;
    private buyerNote = '';
    private productQty = 1;
    private lastProductId = '';
    private selectedSku = '';
    private routeListener = () => { void this.render(); };
    constructor(private root: HTMLElement, private notice: HTMLElement) { }
    async start() { window.addEventListener('hashchange', this.routeListener); try {
        await service.auth.restore();
        this.categories=(await service.categories()).items;
    }
    catch (error) {
        this.report(error);
    } await this.render(); }
    destroy() { this.epoch++;window.removeEventListener('hashchange', this.routeListener); }
    private navigate(path: string) { if (location.hash === '#' + path)
        void this.render();
    else
        location.hash = path; }
    private tell(message: string) { this.notice.textContent = message; this.notice.setAttribute('role', 'status'); }
    private report(error: unknown) { const e = error instanceof Error ? error : new Error(String(error)); const suffix = error instanceof ApiError && error.traceId ? `（追踪号 ${error.traceId}）` : ''; this.notice.setAttribute('role', 'alert'); this.notice.textContent = e.message + suffix + (error instanceof ApiError && error.outcomeUnknown ? '；结果未确认，请刷新订单或以原请求重试，系统会复用幂等键。' : ''); const active=q<HTMLDialogElement>(document,'dialog[open]');if(active){let output=q(active,'[data-command-error]');if(!output){output=el('p');output.dataset.commandError='true';output.setAttribute('role','alert');active.append(output);}output.textContent=this.notice.textContent;} }
    private async run(action: () => Promise<void>) { if (this.busy)
        return; this.busy = true; const controls = qa<HTMLButtonElement>(document, 'button:not(:disabled)'); controls.forEach(b => b.disabled = true); try {
        await action();
    }
    catch (error) {
        this.report(error);
        if (error instanceof ApiError && error.status === 401)
            this.login(false);
    }
    finally {
        this.busy = false;
        controls.forEach(b => { if (b.isConnected)
            b.disabled = false; });
    } }
    private member() { const user = service.auth.getSnapshot().user; if (!user) {
        this.login(false);
        return false;
    } if (!user.roles.includes('MEMBER')) {
        this.tell('当前为员工账户，请切换会员账户进行购物。');
        return false;
    } return true; }
    private async paged<T>(main:HTMLElement,key:string,title:string,load:(query:ListQuery)=>Promise<Page<T>>,draw:(item:T)=>HTMLElement,empty:string,states:Record<string,string>) {
        const subject=service.auth.getSnapshot().user?.userId??'guest';const stateKey=subject+':'+key;
        const route=new URL(location.hash.slice(1)||'/',location.origin),pageKey='p-'+key,statusKey='s-'+key;
        const state=this.listStates.get(stateKey)??{page:1,status:'',search:''};
        if(route.searchParams.has(pageKey))state.page=pageNumber(route.searchParams.get(pageKey));
        if(route.searchParams.has(statusKey)){const filter=route.searchParams.get(statusKey)??'';state.status=Object.hasOwn(states,filter)?filter:'';}
        this.listStates.set(stateKey,state);
        const section=el('section');section.className='fm-management-section fm-paged-section';section.setAttribute('aria-label',title);section.append(el('h2',title));
        const toolbar=el('div');toolbar.className='fm-list-filter';const label=el('label','状态');const select=document.createElement('select');select.setAttribute('aria-label',title+'状态筛选');
        for(const [value,name] of [['','全部状态'],...Object.entries(states)]){const option=document.createElement('option');option.value=value!;option.textContent=name!;select.append(option);}select.value=state.status;label.append(select);toolbar.append(label);section.append(toolbar);
        let search:HTMLInputElement|undefined;if(key==='admin-orders'){const searchLabel=el('label','订单号');search=document.createElement('input');search.value=state.search;search.maxLength=64;search.placeholder='输入完整订单号';search.setAttribute('aria-label','订单查询完整订单号');searchLabel.append(search);toolbar.append(searchLabel);}
        const content=el('div');content.className='fm-list-content';const controls=el('div');section.append(content,controls);main.append(section);
        const epoch=this.epoch;let revision=0;
        const active=()=>section.isConnected&&this.epoch===epoch&&(service.auth.getSnapshot().user?.userId??'guest')===subject;
        const refresh=async()=>{const current=++revision;content.setAttribute('aria-busy','true');try {
            let result=await load({page:state.page,size:20,...state.status?{status:state.status}:{},...state.search?{orderNo:state.search}:{}});
            if(current!==revision||!active())return;
            const max=paginationState(result.page,result.size,result.total).pages;
            if(state.page>max){state.page=max;result=await load({page:state.page,size:20,...state.status?{status:state.status}:{},...state.search?{orderNo:state.search}:{}});}
            if(current!==revision||!active())return;
            state.page=result.page;
            const route=new URL(location.hash.slice(1)||'/',location.origin);if(state.page>1)route.searchParams.set(pageKey,String(state.page));else route.searchParams.delete(pageKey);if(state.status)route.searchParams.set(statusKey,state.status);else route.searchParams.delete(statusKey);
            const address=new URL(location.href);address.hash=route.pathname+(route.searchParams.size?'?'+route.searchParams:'');history.replaceState(history.state,'',address);
            content.replaceChildren(...result.items.map(draw));if(!result.items.length)content.append(el('p',empty));
            controls.replaceChildren(pagination(result,title,async page=>{await this.run(async()=>{state.page=page;await refresh();});}));
        }catch(error){if(active()&&current===revision){content.replaceChildren(el('p','读取失败，请重试。'),button('重新读取'+title,()=>void this.run(refresh)));throw error;}}finally{content.removeAttribute('aria-busy');}};
        if(search){const field=search;toolbar.append(button('查询订单',()=>void this.run(async()=>{state.search=field.value.trim();state.page=1;await refresh();})));field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void this.run(async()=>{state.search=field.value.trim();state.page=1;await refresh();});}};}
        select.onchange=()=>void this.run(async()=>{state.status=select.value;state.page=1;await refresh();});await refresh();
    }
    private async loadCart() { if (service.auth.getSnapshot().user?.roles.includes('MEMBER'))
        this.cart = await service.cart();
    else
        this.cart = null; }
    private mount(page: PageName, values: Values) { delete this.root.dataset.runtime; mountTemplate(this.root, page, { ...defaults(page), ...values }); this.common(); }
    private async render() { const epoch = ++this.epoch; const route = new URL(location.hash.slice(1) || '/', location.origin); try {
        const user = service.auth.getSnapshot().user;
        if (user?.mustChangePassword || route.pathname === '/account/password') {
            if (!user) { await this.home(); this.login(false); return; }
            this.cart = null;
            const main = this.shell('账户安全');
            main.append(el('p', user.mustChangePassword ? '首次登录请先更改临时密码，完成后才能访问商城与工作台。' : '修改密码后，所有已登录设备将退出，请用新密码重新登录。'), button('设置新密码', () => this.changePassword()), button('退出登录', () => void this.run(async () => { await service.auth.logout(); this.navigate('/'); await this.render(); })));
            this.changePassword();
            return;
        }
        await this.loadCart();
        if (epoch !== this.epoch)
            return;
        if (route.pathname === '/checkout') {
            if (!this.member()) {
                await this.home();
                return;
            }
            await this.checkout();
        }
        else if (route.pathname === '/orders') {
            if (!this.member()) {
                await this.home();
                return;
            }
            await this.orders();
        }
        else if(route.pathname==='/addresses'){if(!this.member()){await this.home();return;}const main=this.shell('我的收货地址');const content=el('div');main.append(content);await renderAddressManager(content,{run:a=>this.run(a),notify:m=>this.tell(m)});}
        else if (route.pathname === '/operations' || route.pathname === '/admin') {
            await this.operations();
        }
        else if (route.pathname.startsWith('/product/')) {
            await this.detail(decodeURIComponent(route.pathname.split('/')[2] ?? ''));
        }
        else if (route.pathname === '/products') {
            await this.list(route.searchParams);
        }
        else
            await this.home();
    }
    catch (error) {
        this.report(error);
        if (!this.root.childElementCount)
            this.root.append(el('p', '后端暂不可用，请启动 Demo 后重试。'), button('重新加载', () => void this.render()));
    } }
    private common() {
        const user = service.auth.getSnapshot().user;
        for (const a of qa<HTMLAnchorElement>(this.root, 'a')) {
            const txt = a.textContent?.trim() ?? '';
            const aria = a.getAttribute('aria-label') ?? '';
            const isAccountNavLink = Boolean(a.closest('nav[aria-label="账户"]'));
            if (aria.includes('首页') || txt === '首页')
                a.href = '#/';
            else if (/购物车/.test(txt)) {
                a.href = '#';
                a.onclick = e => { e.preventDefault(); void this.openCart(); };
                const spans = qa(a, 'span');
                for (const s of spans)
                    if (s.childElementCount === 0 && /^¥/.test(s.textContent ?? ''))
                        s.textContent = formatMoney(this.cart?.estimatedGoodsAmount ?? 0);
                const badge = spans.find(s => s.getAttribute('style')?.includes('position: absolute'));
                if (badge)
                    badge.textContent = String(this.cart?.items.length ?? 0);
            }
            else if (['你好，请登录', '登录'].includes(txt)) {
                if (user && isAccountNavLink) {
                    a.textContent = `${user.displayName} · 退出`;
                    a.onclick = e => { e.preventDefault(); void this.run(async () => { await service.auth.logout(); this.cart = null; this.quote = null; this.addressId = ''; this.tell('已安全退出'); this.navigate('/'); await this.home(); }); };
                }
                else if (!user)
                    a.onclick = e => { e.preventDefault(); this.login(false); };
            }
            else if (['免费注册', '注册'].includes(txt)) {
                if (user && isAccountNavLink) {
                    a.textContent = '账户 / 切换';
                    a.onclick = e => { e.preventDefault(); this.login(false); };
                    const security = document.createElement('a'); security.textContent = '修改密码'; security.href = '#/account/password'; a.after(security);
                }
                else if (!user)
                    a.onclick = e => { e.preventDefault(); this.login(true); };
            }
            else if (txt === '我的订单')
                a.href = '#/orders';
            else if (txt === '临期特惠')
                a.href = '#/products?nearExpiry=true';
            else if (txt.includes('新人') || txt.includes('领取'))
                a.onclick = e => { e.preventDefault(); void this.couponDialog(); };
            else if (['去选购', '查看全部 ›', '全部商品分类'].includes(txt))
                a.href = '#/products';
            else if (a.closest('.fm-hot'))
                a.href = '#/products?keyword=' + encodeURIComponent(txt);
            else if (a.closest('.fm-navlinks')) {const category=this.categories.find(c=>c.name===txt||txt.includes(c.shortName));a.href=category?'#/products?categoryId='+category.categoryId:'#/products';}
            else if (aria.includes('¥')) {
                a.href = '#/products?keyword=' + encodeURIComponent(aria.split(' ')[0] ?? '');
                a.setAttribute('aria-label', aria.split(' ')[0] ?? '');
            }
            else if (a.getAttribute('href') === '#' && !a.closest('[data-key]'))
                a.onclick = e => { e.preventDefault(); this.tell('配送、称重及售后规则详见结算页；本 Demo 先开放购物与履约闭环。'); };
        }
        const welcomeCard = q<HTMLElement>(this.root, '.fm-hero-aside > div:first-child');
        if (welcomeCard) {
            welcomeCard.classList.add('fm-welcome-card');
            const heading = q<HTMLElement>(welcomeCard, ':scope > div:first-child > span:first-child > span:first-child');
            const note = q<HTMLElement>(welcomeCard, ':scope > div:first-child > span:first-child > span:nth-child(2)');
            const links = qa<HTMLAnchorElement>(welcomeCard, ':scope > div:first-child > div > a');
            if (user) {
                welcomeCard.dataset.authenticated = 'true';
                if (heading) heading.textContent = `欢迎回来，${user.displayName}`;
                if (note) note.textContent = user.roles.includes('MEMBER') ? '会员价与订单随时可查' : `当前身份：${roleNames[user.roles[0] ?? ''] ?? '员工账户'}`;
                if (links[0]) { links[0].textContent = user.roles.includes('MEMBER') ? '我的订单' : '进入工作台'; links[0].href = user.roles.includes('MEMBER') ? '#/orders' : '#/operations'; links[0].onclick = null; }
                if (links[1]) { links[1].textContent = '账户设置'; links[1].href = '#/account/password'; links[1].onclick = null; }
            }
        }
        for (const form of qa<HTMLFormElement>(this.root, 'header form'))
            form.onsubmit = e => { e.preventDefault(); const term = q<HTMLInputElement>(form, 'input')?.value.trim() ?? ''; this.navigate('/products' + (term ? '?keyword=' + encodeURIComponent(term) : '')); };
        const account = q(this.root, 'nav[aria-label="账户"]');
        if (account) {
            const ops = document.createElement('a');
            ops.textContent = '工作台';
            ops.href = '#/operations';
            ops.style.color = 'inherit';
            account.append(ops);
        }
        if(user?.roles.includes('MEMBER')){const accountNav=q(this.root,'nav[aria-label="账户"],nav[aria-label="账户操作"]');if(accountNav){const addresses=document.createElement('a');addresses.textContent='管理收货地址';addresses.href='#/addresses';addresses.style.color='inherit';accountNav.append(addresses);}}
        const slot = q(this.root, '.fm-slot');
        if (slot) {
            slot.textContent = '选择地址后查看配送时段';
            (slot as HTMLAnchorElement).href = '#/checkout';
        }
        for (const n of qa(this.root, 'footer span'))
            if (n.childElementCount === 0)
                n.textContent = n.textContent?.replace('数据为示意', isR04Design() ? '数据库演示数据 · 备选设计待确认' : '数据库演示数据 · 沙箱支付') ?? '';
    }
    private card(product: Product) { const sample = (defaults('List').items as Values[])[0]!; return { ...sample, _key: product.productId, img: productImagePath(product.imageUrl), name: product.name, spec: product.unitLabel + ' · ' + product.origin, price: money(product.salePrice), ref: money(product.price), unit: product.priceMode === 'BY_WEIGHT' ? '按实重结算，多退少补' : '按件计价', store: storage[product.storage], near: product.nearExpiry ? `临期 · 剩 ${product.shelfLifeRemainingDays ?? '—'} 天` : '', weighed: product.priceMode === 'BY_WEIGHT', soldOut: product.stockStatus === 'SOLD_OUT', inCart: false, canAdd: product.stockStatus !== 'SOLD_OUT' }; }
    private bindCards() { for (const article of qa(this.root, 'article[data-key]')) {
        const id = article.getAttribute('data-key')!;
        const product = this.products.find(p => p.productId === id);
        for (const a of qa<HTMLAnchorElement>(article, 'a'))
            a.href = '#/product/' + encodeURIComponent(id);
        for (const b of qa<HTMLButtonElement>(article, 'button')) {
            b.disabled = product?.stockStatus === 'SOLD_OUT';
            b.onclick = () => void this.run(async () => { if (product)
                await this.add(product); });
        }
    } }
    private async home() { const epoch=this.epoch;const home = await service.home();if(epoch!==this.epoch)return; this.categories = home.categories; this.products = [...home.nearExpiryProducts, ...home.recommendedProducts];
        const recommendationFeed = isR04Design() ? home.recommendedProducts.filter(product => !home.nearExpiryProducts.some(item => item.productId === product.productId)) : home.recommendedProducts;
        const shelves = [{ title: '临期特惠', note: '库存与临期价格由服务端返回', items: home.nearExpiryProducts.slice(0, 6).map(p => this.card(p)) }, { title: '当季精选', note: '会员价 · 实时可售商品', items: recommendationFeed.slice(0, 12).map(p => this.card(p)) }].filter(shelf => !isR04Design() || shelf.items.length > 0);
        this.mount('Home', { cats: home.categories.map(c => ({ _key: c.categoryId, name: c.name, sub: c.shortName })), slots: [{ day: '选择收货地址后', time: '查看实时配送时段', state: '结算页预约', badgeStyle: '' }], shelves }); this.bindCards(); for (const a of qa<HTMLAnchorElement>(this.root, 'nav[aria-label="商品分类"] a[data-key]'))
        a.href = '#/products?categoryId=' + a.dataset.key; const note = byText(this.root, '名额为示意，以下单时为准'); if (note)
        note.textContent = '库存与名额在提交订单时再次校验';
        this.bindHomeFeatured(selectHomeFeatured(home.recommendedProducts, home.nearExpiryProducts, home.categories));
    }
    private bindHomeFeatured(products: readonly Product[]) {
        for (const slot of qa<HTMLAnchorElement>(this.root, 'a[data-home-featured-slot]')) {
            const index = Number(slot.dataset.homeFeaturedSlot);
            const product = Number.isInteger(index) && index >= 0 ? products[index] : undefined;
            slot.hidden = !product;
            slot.style.display = product ? '' : 'none';
            slot.onclick = null;
            if (!product) {
                slot.removeAttribute('href');
                continue;
            }
            slot.href = '#/product/' + encodeURIComponent(product.productId);
            slot.dataset.homeProductId = product.productId;
            slot.setAttribute('aria-label', `${product.name}，${formatMoney(product.salePrice)}，${product.unitLabel}`);
            const image = q<HTMLImageElement>(slot, '[data-home-product-image]');
            if (image) {
                setProductImage(image, product.imageUrl);
                image.alt = product.name;
            }
            for (const [selector, value] of [
                ['[data-home-product-name]', product.name],
                ['[data-home-product-price]', formatMoney(product.salePrice)],
                ['[data-home-product-unit]', product.unitLabel],
                ['[data-home-product-origin]', product.origin],
            ] as const) {
                const field = q(slot, selector);
                if (field) field.textContent = value;
            }
            const reference = q(slot, '[data-home-product-reference]');
            if (reference) {
                reference.hidden = product.price <= product.salePrice;
                reference.textContent = formatMoney(product.price);
            }
        }
        for (const link of qa<HTMLAnchorElement>(this.root, 'a[data-home-category-link]')) {
            link.href = homeCategoryHref(link.dataset.homeCategoryLink ?? '', this.categories);
            link.onclick = null;
        }
    }
    private async list(params: URLSearchParams) { const epoch=this.epoch;const keyword = params.get('keyword') || undefined; const categoryId = params.get('categoryId') || undefined; const sort = (['RECOMMENDED','PRICE_ASC','PRICE_DESC'].includes(params.get('sort')??'')?params.get('sort'):'RECOMMENDED') as 'RECOMMENDED' | 'PRICE_ASC' | 'PRICE_DESC'; const page=pageNumber(params.get('page'));  const result = await service.products({ ...keyword ? { keyword } : {}, ...categoryId ? { categoryId } : {}, ...params.get('nearExpiry') === 'true' ? { nearExpiry: true } : {}, sort, page, size:20 }); if(epoch!==this.epoch)return;const last=paginationState(result.page,result.size,result.total).pages;if(page>last){params.set('page',String(last));this.navigate('/products?'+params);return;}this.products = result.items; this.mount('List', { items: result.items.map(p => this.card(p)), facets: [] }); this.bindCards(); const h = q(this.root, 'h1'); if (h) {
        h.textContent = keyword ? `搜索：${keyword}` : categoryId ? this.categories.find(category => category.categoryId === categoryId)?.name ?? '全部商品' : '全部商品';
        const breadcrumb = q(this.root, 'main nav[aria-label="面包屑"] > span:last-child');
        if (breadcrumb) breadcrumb.textContent = h.textContent;
        if (h.nextElementSibling)
            h.nextElementSibling.textContent = `共 ${result.total} 件商品`;
    } const end = qa(this.root, 'main p').at(-1); if (end)
        end.textContent = result.items.length ? `已显示 ${result.items.length} 件商品` : '没有找到符合条件的商品'; const sidebar = q(this.root, 'main aside'); if (sidebar) {
        sidebar.replaceChildren(el('h2', '商品分类'));
        sidebar.setAttribute('aria-label', '商品分类');
        sidebar.setAttribute('data-catalog-categories', '');
        const all = document.createElement('a');
        all.textContent = '全部商品';
        all.href = '#/products';
        if (!categoryId) all.setAttribute('aria-current', 'page');
        sidebar.append(all);
        if (!this.categories.length)
            this.categories = (await service.categories()).items;
        for (const c of this.categories) {
            const a = document.createElement('a');
            a.textContent = c.name;
            a.href = '#/products?categoryId=' + c.categoryId;
            if (c.categoryId === categoryId) a.setAttribute('aria-current', 'page');
            sidebar.append(a);
        }
    } const sorter = q(this.root, '[aria-label="排序"]'); if (sorter)
        for (const [i, b] of qa<HTMLButtonElement>(sorter, 'button').entries()) {
            if (i === 3) {
                b.remove();
                continue;
            }
            b.setAttribute('aria-pressed', String(sort === ['RECOMMENDED', 'PRICE_ASC', 'PRICE_DESC'][i]));
            b.onclick = () => { params.delete('page'); params.set('sort', ['RECOMMENDED', 'PRICE_ASC', 'PRICE_DESC'][i]!); this.navigate('/products?' + params); };
        } const clear = qa<HTMLAnchorElement>(this.root, 'a').find(a => a.textContent === '清除全部');
        if(clear?.parentElement){const filters=clear.parentElement;filters.replaceChildren(el('span','已选：'));
            for(const [key,value] of [['keyword',keyword],['categoryId',categoryId?this.categories.find(c=>c.categoryId===categoryId)?.name??categoryId:undefined],['nearExpiry',params.get('nearExpiry')==='true'?'临期特惠':undefined]])if(value){const remove=button(String(value)+' ×',()=>{params.delete(key!);params.delete('page');this.navigate('/products?'+params);});remove.setAttribute('aria-label','移除筛选：'+value);filters.append(remove);}
            if(filters.childElementCount===1)filters.append(el('span','全部商品'));else filters.append(button('清除筛选',()=>this.navigate('/products')));
        }
        if(end?.parentElement)end.parentElement.append(pagination(result,'商品',async next=>{params.set('page',String(next));this.navigate('/products?'+params);window.scrollTo({top:0});}));
    }
    private async add(product: Product, quantity?: number, go = false) { if (!this.member())
        return; const sku = product.skus.find(s => s.skuId === this.selectedSku) ?? product.skus[0]; if (!sku)
        throw new Error('商品没有可购买规格'); await service.add({ skuId: sku.skuId, quantity: quantity ?? (sku.baseUnit === 'GRAM' ? sku.priceUnitGram ?? 500 : 1), selected: true }); await this.loadCart(); this.quote = null; this.tell(`${product.name} 已加入购物车`); if (go)
        this.navigate('/checkout');
    else
        await this.render(); }
    private async detail(id: string) {
        const epoch=this.epoch;
        const product = await service.product(id);
        if(epoch!==this.epoch)return;
        if (this.lastProductId !== id) {
            this.productQty = 1;
            this.selectedSku = product.skus[0]?.skuId ?? '';
            this.lastProductId = id;
        }
        const sku = product.skus.find(s => s.skuId === this.selectedSku) ?? product.skus[0]!;
        const weights = defaults('Detail').weights as Values[];
        const quantity = sku.baseUnit === 'GRAM' ? this.productQty * (sku.priceUnitGram ?? 500) : this.productQty;
        this.mount('Detail', { productName: product.name, productImage: productImagePath(product.imageUrl), productDescription: product.origin + ' · ' + sku.unitLabel + ' · ' + product.description, salePrice: money(sku.salePrice), referencePrice: money(sku.price), unitLabel: sku.unitLabel, storageLabel: storage[product.storage], priceModeLabel: sku.priceMode === 'BY_WEIGHT' ? '称重' : '按件', qty: this.productQty, weights: product.skus.map(s => ({ ...weights[0], style:(s.skuId===sku.skuId?weights[1]:weights[0])!.style, label: s.unitLabel, note: formatMoney(s.salePrice), on: s.skuId === sku.skuId, pick: () => { this.selectedSku = s.skuId; void this.detail(id); } })), slots: [], related: [], weightMessage: sku.baseUnit === 'GRAM' ? `本次加入 ${formatWeight(quantity)} 估重。按实重多退少补，实重上限为估重的 110%；补款须在 10 分钟内且不晚于配送时段开始前完成，具体金额与期限以订单为准。` : '按件购买，商品金额、优惠与运费以结算页服务端报价为准。', inc: () => { this.productQty = Math.min(99, this.productQty + 1); void this.detail(id); }, dec: () => { this.productQty = Math.max(1, this.productQty - 1); void this.detail(id); }, specs: [{ k: '商品编码', v: product.spuCode }, { k: '产地', v: product.origin }, { k: '储存方式', v: storage[product.storage] }, { k: '计价方式', v: sku.priceMode === 'BY_WEIGHT' ? `按每 ${sku.priceUnitGram}g 计价` : '按件计价' }, { k: '到货与新鲜度', v: product.arrivedAt ? new Date(product.arrivedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '尚无入库时间展示' }, { k: '说明', v: product.description }] });
        this.root.dataset.productId=id;
        for (const img of qa<HTMLImageElement>(this.root, 'main img'))
            if (!img.closest('aside')) {
                setProductImage(img, product.imageUrl);
                img.alt = product.name;
            }
        const category=this.categories.find(c=>c.categoryId===product.categoryId);const categoryLink=qa<HTMLAnchorElement>(this.root,'nav[aria-label="面包屑"] a')[1];if(categoryLink){categoryLink.textContent=category?.name??'商品分类';categoryLink.href='#/products?categoryId='+product.categoryId;categoryLink.onclick=null;}
        const slots = q(this.root, '.fm-slots');
        if (slots)
            slots.replaceChildren(el('span', '请前往结算页选择收货地址与实时配送时段。'));
        for (const label of ['加入购物车', '立即购买']) {
            const b = textButton(this.root, label);
            if (b) {
                b.disabled = sku.stockStatus === 'SOLD_OUT';
                b.onclick = () => void this.run(() => this.add(product, quantity, label === '立即购买'));
            }
        }
        q(this.root, 'main aside')?.remove();
        for (const tab of qa<HTMLButtonElement>(this.root, '[role="tab"]'))
            tab.onclick = () => this.tell(tab.textContent === '商品介绍' ? product.description : tab.textContent === '售后说明' ? '签收后 7 天内可申请品质、缺货或配送延迟售后；品质问题请上传订单图片，退款由服务端校验实付上限。' : '下方为当前商品规格参数');
        const reviews = el('section'); (q(this.root, 'main') ?? this.root).append(reviews);
        await renderProductReviews(reviews, product.productId, {run:action => this.run(action)});
    }
    private dialog(title: string) {
        qa<HTMLDialogElement>(document, 'dialog[data-demo]').forEach(d => d.remove());
        const d = document.createElement('dialog'); d.dataset.demo = 'true'; d.style.maxWidth = 'min(92vw,960px)'; d.style.fontFamily = 'inherit';
        const heading = el('h2', title); heading.id = 'dialog-' + crypto.randomUUID(); d.setAttribute('aria-labelledby', heading.id);
        const close = button('关闭', () => d.close());
        if (isR04Design()) {
            d.className = 'r04-dialog';
            d.dataset.kind = /登录|注册/.test(title) ? 'account' : title === '购物车' ? 'cart' : /地址/.test(title) ? 'address' : /支付/.test(title) ? 'payment' : /实拣/.test(title) ? 'picking' : /售后/.test(title) ? 'aftersale' : 'action';
            const head = el('header'); head.className = 'r04-dialog-head';
            const identity = el('div'); identity.append(el('span', 'DH / COMMUNITY MARKET'), heading);
            head.append(identity, close); d.append(head);
            if (d.dataset.kind === 'account') d.append(r04Note('新鲜日常，从校园出发。登录后选购食材、预约配送、查看每一笔订单。'));
            if (d.dataset.kind === 'cart') d.append(r04Note('为日常添一点新鲜', 'brand'));
        } else d.append(heading, close);
        d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal();
        if (isR04Design()) queueMicrotask(() => this.decorateDialog(d));
        return d;
    }
    private decorateDialog(d: HTMLDialogElement) {
        if (!d.isConnected) return;
        for (const row of qa<HTMLElement>(d, ':scope > p')) if (q(row, 'input,select')) row.classList.add('r04-editor-row');
        for (const form of qa<HTMLFormElement>(d, ':scope > form')) { form.classList.add('r04-form'); for (const error of qa(form, 'p[role="alert"]')) error.classList.add('r04-form-error'); }
        const actions = qa<HTMLButtonElement>(d, ':scope > button');
        if (actions.length) { const footer = el('footer'); footer.className = 'r04-dialog-actions'; footer.append(...actions); d.append(footer); }
        if (d.dataset.kind === 'payment') q(d, ':scope > p')?.classList.add('r04-payment-overview');
        if (d.dataset.kind === 'address') q(d, 'form')?.classList.add('r04-address-form');
    }
    private login(register: boolean) { const d = this.dialog(register ? '注册会员' : '登录 / 切换账户'); d.classList.add('fm-account-dialog'); d.dataset.kind = 'account'; const intro = el('p', register ? '注册东华社区账户，享受会员价与预约配送。' : '登录后继续选购食材、预约配送并查看订单。'); intro.className = 'fm-account-intro'; const f = document.createElement('form'); f.append(input('手机号', 'phone', '', 'tel'), el('br'), input('密码', 'password', '', 'password')); if (register)
        f.append(input('显示名称', 'displayName'), el('br')); const submit = button(register ? '注册并登录' : '登录', () => { }); submit.type = 'submit'; f.append(submit); const result = el('p'); result.setAttribute('role', 'alert'); f.append(result); f.onsubmit = e => { e.preventDefault(); submit.disabled = true; const data = new FormData(f); const body = { phone: String(data.get('phone')), password: String(data.get('password')) }; void (async () => { try {
        if (register)
            await service.auth.register({ ...body, displayName: String(data.get('displayName')) });
        else
            await service.auth.login(body);
        this.quote = null;
        this.addressId = '';
        this.slotId = '';
        this.couponId = null;
        this.cart = null;
        d.close();
        this.tell('登录成功');
        if (service.auth.getSnapshot().user?.mustChangePassword)
            this.navigate('/account/password');
        else if (!service.auth.getSnapshot().user?.roles.includes('MEMBER'))
            this.navigate('/operations');
        else
            await this.render();
    }
    catch (error) {
        result.textContent = error instanceof Error ? error.message : '登录失败';
    }
    finally {
        submit.disabled = false;
    } })(); }; d.append(intro, f, el('p', '东华大学社区生鲜 · 会员与员工使用各自账户登录。密码至少 12 位。')); }
    private changePassword() {
        const d = this.dialog('修改登录密码');
        d.classList.add('fm-security-dialog');
        const f = document.createElement('form');
        const current = input('当前密码', 'currentPassword', '', 'password');
        const replacement = input('新密码', 'newPassword', '', 'password');
        const confirmation = input('确认新密码', 'confirmPassword', '', 'password');
        for (const field of [current, replacement, confirmation]) {
            const control = q<HTMLInputElement>(field, 'input')!; control.minLength = 12; control.maxLength = 128;
            control.autocomplete = field === current ? 'current-password' : 'new-password';
        }
        const submit = button('保存密码并重新登录', () => {}); submit.type = 'submit';
        const output = el('p'); output.setAttribute('role', 'alert');
        f.append(current, replacement, confirmation, submit, output);
        f.onsubmit = event => { event.preventDefault(); submit.disabled = true; const values = new FormData(f);
            void (async () => { try {
                if (values.get('newPassword') !== values.get('confirmPassword')) throw new Error('两次输入的新密码不一致');
                if (values.get('newPassword') === values.get('currentPassword')) throw new Error('新密码不能与当前密码相同');
                await service.changePassword({ currentPassword: String(values.get('currentPassword')), newPassword: String(values.get('newPassword')) });
                f.reset(); this.cart = null; this.quote = null; d.close(); this.navigate('/'); await this.home();
                this.tell('密码已修改，所有旧会话已退出，请使用新密码登录。'); this.login(false);
            } catch (error) {
                output.textContent = error instanceof Error ? error.message : '密码修改失败';
                if (error instanceof ApiError && (error.outcomeUnknown || error.status === 401)) {
                    output.textContent += error.outcomeUnknown ? '；提交结果尚未确认，密码可能已生效。请尝试用新密码重新登录，若未成功再使用原密码。' : '；当前密码或会话未通过校验，可重新登录后再操作。';
                    if (!q(d, '[data-password-relogin]')) { const relogin = button('去重新登录', () => { service.auth.clearSession(); this.cart = null; this.quote = null; d.close(); this.navigate('/'); void this.home().then(() => this.login(false)); }); relogin.dataset.passwordRelogin = 'true'; d.append(relogin); }
                }
            }
            finally { submit.disabled = false; } })(); };
        d.append(el('p', '密码至少 12 位。修改后立即退出全部设备；请妥善保存新密码。'), f);
    }
    private async couponDialog() { if (!this.member())
        return; await this.run(async () => { const list = await service.coupons(); const d = this.dialog('我的优惠券'); for (const c of list.items) {
        const coupon = el('p', `${c.name}：${formatMoney(c.discountAmount)}，满 ${formatMoney(c.minGoodsAmount)} 可用 · ${c.status}`); if (isR04Design()) coupon.className = 'r04-coupon-card'; d.append(coupon); } if (!list.items.length)
        d.append(el('p', '暂无优惠券')); }); }
    private async openCart() { if (!this.member())
        return; await this.run(async () => { await this.loadCart(); this.cartDialog(); }); }
    private cartDialog() { const d = this.dialog('购物车'); if (!this.cart?.items.length) {
        d.append(el('p', '购物车为空，请先选购商品。'));
        return;
    } for (const item of this.cart.items) {
        const row = el(isR04Design() ? 'article' : 'p');
        if (isR04Design()) {
            row.className = 'r04-cart-row';
            const image = document.createElement('img'); setProductImage(image, item.imageUrl); image.alt = item.productName; image.width = 80; image.height = 80;
            const info = el('div'); info.className = 'r04-cart-description'; info.append(el('strong', item.productName), el('span', item.unitLabel + (item.baseUnit === 'GRAM' ? ' · 按实重结算' : ' · 按件计价')));
            row.append(image, info);
        } else row.append(el('strong', item.productName + ' '));
        const checked = document.createElement('input');
        checked.type = 'checkbox';
        checked.checked = item.selected;
        checked.setAttribute('aria-label', '选择 ' + item.productName);
        const quantity = document.createElement('input');
        quantity.type = 'number';
        quantity.min = '1';
        quantity.step = item.baseUnit === 'GRAM' ? '50' : '1';
        quantity.value = String(item.quantity);
        quantity.setAttribute('aria-label', item.productName + '数量');
        row.append(checked, quantity, el('span', item.baseUnit === 'GRAM' ? ' 克 ' : ' 件 '), el('span', formatMoney(item.lineAmount)), button('更新', () => void this.run(async () => { await service.updateCart(item.cartItemId, { quantity: Number(quantity.value), selected: checked.checked, version: item.version }); this.quote = null; await this.loadCart(); d.close(); this.cartDialog(); })), button('删除', () => void this.run(async () => { await service.removeCart(item.cartItemId, item.version); this.quote = null; await this.loadCart(); d.close(); this.cartDialog(); })));
        d.append(row);
    } const estimate = el('p', '商品预估金额 ' + formatMoney(this.cart.estimatedGoodsAmount)); if (isR04Design()) estimate.className = 'r04-cart-total'; d.append(estimate, button('去结算', () => { d.close(); this.navigate('/checkout'); })); }
    private manageAddresses() {openAddressManager({dialog:title=>this.dialog(title),run:action=>this.run(action),notify:message=>this.tell(message),onChanged:async()=>{this.quote=null;this.slotId='';if(location.hash.split('?')[0]==='#/checkout')await this.checkout();}});}
    private addressDialog() { const d = this.dialog('新增收货地址'); const f = document.createElement('form'); for (const [label, name, value] of [['收货人', 'recipientName', ''], ['手机号', 'phone', ''], ['省份', 'province', '上海市'], ['城市', 'city', '上海市'], ['区', 'district', '松江区'], ['详细地址', 'detail', '人民北路 2999 号 东华大学']])
        f.append(input(label!, name!, value), el('br')); const submit = button('保存地址', () => { }); submit.type = 'submit'; const error = el('p'); f.append(submit, error); f.onsubmit = e => { e.preventDefault(); submit.disabled = true; const data = new FormData(f); void (async () => { try {
        const a = await service.createAddress({ recipientName: String(data.get('recipientName')), phone: String(data.get('phone')), province: String(data.get('province')), city: String(data.get('city')), district: String(data.get('district')), detail: String(data.get('detail')), isDefault: true });
        this.addressId = a.addressId;
        this.slotId = '';
        this.quote = null;
        d.close();
        await this.render();
    }
    catch (e) {
        error.textContent = e instanceof Error ? e.message : '保存失败';
    }
    finally {
        submit.disabled = false;
    } })(); }; d.append(f); }
    private async checkout() {const epoch=this.epoch; const [addresses, coupons] = await Promise.all([service.addresses(), service.coupons()]); if (!addresses.items.some(a => a.addressId === this.addressId))
        this.addressId = (addresses.items.find(a => a.isDefault) ?? addresses.items[0])?.addressId ?? ''; const address = addresses.items.find(a => a.addressId === this.addressId); const slots = address ? (await service.slots(this.date, address.addressId)).items : []; if (!slots.some(s => s.slotId === this.slotId && s.available))
        this.slotId = slots.find(s => s.available)?.slotId ?? ''; const items = (this.cart?.items ?? []).filter(item => item.selected); const coupon = coupons.items.find(c => c.couponId === this.couponId && c.status === 'AVAILABLE'); if (!coupon)
        this.couponId = null; this.quote = null; let quoteError: unknown; if (address && this.slotId && items.length) {
        try {
            this.quote = await service.quote({ items: items.map(i => ({ skuId: i.skuId, quantity: i.quantity })), addressId: address.addressId, slotId: this.slotId, couponId: this.couponId });
        }
        catch (error) {
            quoteError = error;
        }
    } if(epoch!==this.epoch)return;this.drawCheckout(addresses.items, slots, coupons.items, items); if (quoteError)
        this.report(quoteError); }
    private drawCheckout(addresses: Address[], slots: DeliverySlot[], coupons: Models['Coupon'][], items: Models['CartItem'][]) {
        const base = defaults('Checkout');
        const select = async () => { this.quote = null; await this.render(); };
        const address = addresses.find(a => a.addressId === this.addressId);
        const slot = slots.find(s => s.slotId === this.slotId);
        const price = this.quote?.price;
        const sampleAddr = (base.addrs as Values[])[0]!;
        const sampleDay = (base.days as Values[])[0]!;
        const sampleSlot = (base.slots as Values[])[1]!;
        this.mount('Checkout', { addrs: addresses.map(a => ({ ...sampleAddr, name: a.recipientName, phone: a.phone, text: a.province + a.city + a.district + a.detail, isDefault: a.isDefault, on: a.addressId === this.addressId, style: String(sampleAddr.style).replace('border: 2px solid #A0021F', a.addressId === this.addressId ? 'border: 2px solid #A0021F' : 'border: 1px solid #D5DADF'), pick: () => void this.run(async () => { this.addressId = a.addressId; this.slotId = ''; await select(); }) })), days: [0, 1].map(i => ({ ...sampleDay, style:(base.days as Values[])[this.date===businessDate(i)?0:1]!.style, label: (i === 0 ? '今天 ' : '明天 ') + businessDate(i), on: this.date === businessDate(i), pick: () => void this.run(async () => { this.date = businessDate(i); this.slotId = ''; await select(); }) })), slots: slots.map(s => ({ ...sampleSlot, time: s.label, note: s.available ? `剩 ${s.remaining} 个名额 · ${new Date(s.cutoffAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })} 截止` : s.unavailableReason === 'FULL' ? '已约满' : '已截止或不在服务范围', disabled: !s.available, on: s.slotId === this.slotId, pick: () => void this.run(async () => { this.slotId = s.slotId; await select(); }), style:(base.slots as Values[])[!s.available?0:s.slotId===this.slotId?1:2]!.style })), lines: items.map(item => { const line = this.quote?.lines.find(l => l.skuId === item.skuId); return { img: item.imageUrl, name: item.productName, spec: item.unitLabel, unit: money(line?.unitPrice ?? item.unitPrice), ref: money(line?.referenceUnitPrice ?? item.unitPrice), qty: item.baseUnit === 'GRAM' ? formatWeight(item.quantity) : String(item.quantity), total: money(line?.linePayableAmount ?? item.lineAmount), badge: item.baseUnit === 'GRAM' ? '称重' : '按件', badgeStyle: (base.lines as Values[])[0]!.badgeStyle, weighNote: item.baseUnit === 'GRAM' ? '按估重预付，拣货后按实重结算' : '' }; }), summary: price ? [{ k: '商品参考总价', v: formatMoney(price.referenceGoodsAmount) }, { k: '会员商品金额', v: formatMoney(price.memberGoodsAmount) }, { k: '临期优惠', v: '−' + formatMoney(price.nearExpiryDiscountAmount) }, { k: '优惠券', v: '−' + formatMoney(price.couponDiscountAmount) }, { k: '运费', v: formatMoney(price.freightAmount) }].map(x => ({ ...x, style: (base.summary as Values[])[0]!.style })) : [], payable: price ? money(price.payableAmount) : '—', addrShort: address ? address.detail : '请新增收货地址', slotLabel: slot ? slot.date + ' ' + slot.label : '暂无可预约时段', freightMessage: price ? (price.freightAmount === 0 ? '本单免运费' : `再购 ${formatMoney(price.freeShippingGapAmount)} 商品可免运费`) : '选择商品、地址与时段后获得服务端报价', weightMessage: items.some(i => i.baseUnit === 'GRAM') ? '本单含称重商品，按实重多退少补。补款须在 10 分钟内且不晚于配送时段开始前完成；金额以拣货结算为准。' : '本单按商品数量结算，最终金额由服务端计算。' });
        textButton(this.root, '+ 新增收货地址')!.onclick = () => this.addressDialog();
        for (const a of qa<HTMLAnchorElement>(this.root, 'a')) {
            if (a.textContent === '管理地址')
                a.onclick = e => { e.preventDefault(); this.manageAddresses(); };
            if (a.textContent === '返回购物车修改')
                a.onclick = e => { e.preventDefault(); void this.openCart(); };
        }
        const couponHead = qa(this.root, 'h2').find(n => n.textContent === '优惠券');
        const container = couponHead?.nextElementSibling;
        if (container) {
            const template = q<HTMLButtonElement>(container, 'button')?.cloneNode(true) as HTMLButtonElement | undefined;
            container.replaceChildren();
            for (const c of coupons.filter(c => c.status === 'AVAILABLE')) {
                const b = template?.cloneNode(true) as HTMLButtonElement | undefined;
                if (!b)
                    continue;
                b.textContent = `${c.name} ${formatMoney(c.discountAmount)}（满 ${formatMoney(c.minGoodsAmount)}）${this.couponId === c.couponId ? ' · 已选' : ''}`;
                b.setAttribute('aria-pressed', String(this.couponId === c.couponId)); b.style.border=this.couponId===c.couponId?'2px solid #A0021F':'1px solid #D5DADF';
                b.onclick = () => void this.run(async () => { this.couponId = c.couponId; await select(); });
                container.append(b);
            }
            container.append(button('不使用优惠券', () => void this.run(async () => { this.couponId = null; await select(); })));
        }
        const note = q<HTMLInputElement>(this.root, 'input[type="text"]');
        if (note) {
            note.value = this.buyerNote;
            note.maxLength = 300;
            note.oninput = () => this.buyerNote = note.value;
        }
        const submit = textButton(this.root, '提交订单并支付')!;
        submit.disabled = !this.quote;
        submit.onclick = () => void this.run(async () => { const quote = this.quote; if (!quote)
            return; if (Date.parse(quote.expiresAt) <= Date.now()) {
            await this.checkout();
            this.tell('报价已过期，已重新获取，请核对后再次提交。');
            return;
        } const order = await service.createOrder({ quoteId: quote.quoteId, quoteToken: quote.quoteToken, ...this.buyerNote.trim() ? { buyerNote: this.buyerNote.trim() } : {} }); this.quote = null; this.tell('订单创建成功；付款状态以订单为准。'); await this.loadCart();this.navigate('/orders');if(order.allowedActions.includes('PAY'))await this.payment(order); });
    }
    private async payment(order: Order) { const purpose = order.weightAdjustment?.status === 'TOP_UP_PENDING' ? 'TOP_UP' : 'ORDER'; const p = await service.prepay({ orderId: order.orderId, purpose, ...purpose === 'TOP_UP' ? { adjustmentId: order.weightAdjustment!.adjustmentId } : {} }); const d = this.dialog('沙箱支付确认'); d.append(el('p', `${order.orderNo} · ${formatMoney(p.amount)} · 不产生真实扣费`), el('p', `状态 ${p.status}，有效期至 ${new Date(p.expiresAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)); for (const [label, outcome] of [['模拟支付成功', 'SUCCESS'], ['模拟支付失败', 'FAILED']] as const) {
        const b = button(label, () => { void this.run(async () => { const paid = await service.simulate(p.paymentId, { outcome, version: p.version }); d.close(); this.tell(paid.status === 'SUCCESS' ? '沙箱支付已入账' : '已模拟支付失败，可重新发起支付'); this.navigate('/orders'); }); });
        b.disabled=!p.allowedActions.includes('SIMULATE_PAYMENT');d.append(b);
    } d.append(button('稍后支付，查看订单', () => { d.close(); this.navigate('/orders'); })); }
    private shell(title: string) {
        if (isR04Design()) {
            const user = service.auth.getSnapshot().user;
            const workplace = title.startsWith('员工工作台');
            this.root.replaceChildren();
            this.root.dataset.page = 'Runtime';
            const top = el('div'); top.className = 'r04-runtime-topline'; top.append(el('span', 'DONGHUA UNIVERSITY · COMMUNITY MARKET'), el('span', '东华大学社区生鲜'));
            const header = el('header'); header.className = 'r04-runtime-header';
            const brand = document.createElement('a'); brand.href = '#/'; brand.className = 'r04-runtime-brand'; brand.setAttribute('aria-label', '东华大学社区生鲜首页');
            const logo = document.createElement('img'); logo.src = '/generated/dhu-lockup-h.png'; logo.alt = '东华大学'; logo.width = 168; logo.height = 52;
            const name = el('span'); name.append(el('strong', '社区生鲜'), el('small', '校园日常，新鲜相伴')); brand.append(logo, name);
            const links = el('nav'); links.setAttribute('aria-label', '账户操作');
            for (const [text, href] of [['首页', '#/'], ['我的订单', '#/orders'], ['工作台', '#/operations'], ['你好，请登录', '#'], ['免费注册', '#']]) { if (text === '我的订单' && !user?.roles.includes('MEMBER')) continue; if (text === '工作台' && user?.roles.every(role => role === 'MEMBER')) continue; const a = document.createElement('a'); a.textContent = text!; a.href = href!; links.append(a); }
            header.append(brand, links);
            const main = el('main'); main.className = 'r04-runtime-layout';
            const aside = el('aside'); aside.className = 'r04-runtime-sidebar';
            aside.append(el('p', workplace ? '门店运营' : '我的社区生活'), el('strong', user?.displayName ?? '欢迎来到社区生鲜'), el('span', user?.roles.map(role => roleNames[role] ?? role).join(' · ') ?? '东华大学社区'));
            const menu = el('nav'); menu.setAttribute('aria-label', workplace ? '工作台分区' : '会员中心');
            const destinations: [string, string][] = workplace ? [['工作台总览', '#/operations']] : [['我的订单', '#/orders'], ['继续选购', '#/products']];
            if (workplace) for (const [permission, label, anchor] of [['order.work.read', '订单查询', 'orders'], ['pick.read', '拣货任务', 'picking'], ['delivery.handover.read', '配送任务', 'delivery'], ['delivery.self.read', '配送任务', 'delivery'], ['aftersale.work.read', '售后工单', 'aftersales'], ['refund.read', '退款执行', 'refunds']]) { if (user?.permissions.includes(permission!) && !destinations.some(([text]) => text === label)) destinations.push([label!, '#r04-' + anchor]); }
            for (const [label, href] of destinations) { const a = document.createElement('a'); a.textContent = label; a.href = href; if (href.startsWith('#r04-')) a.onclick = event => { event.preventDefault(); document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; menu.append(a); }
            aside.append(menu, r04Note(workplace ? '依照当前岗位展示可操作任务，处理进度以服务端返回为准。' : '从挑选到签收，随时查看每一次新鲜的进度。'));
            const section = el('section'); section.className = 'r04-runtime-content';
            const intro = el('header'); intro.className = 'r04-runtime-intro';
            const heading = el('div'); heading.append(el('span', workplace ? 'OPERATIONS / DONGHUA' : 'MY ORDERS / DONGHUA'), el('h1', title), el('p', workplace ? '清晰的任务，有序的每一天。' : '每一份新鲜，都有清晰的去向。'));
            const actions = el('div'); actions.className = 'r04-runtime-actions'; actions.append(button('继续选购', () => this.navigate('/products')), button('刷新', () => void this.render())); intro.append(heading, actions); section.append(intro);
            main.append(aside, section); this.root.append(top, header, main);
            this.common(); return section;
        }
        this.mount('Checkout', { addrs: [], days: [], slots: [], lines: [], summary: [], payable: '—' }); this.root.dataset.runtime = 'true'; const main = q(this.root, 'main')!; main.replaceChildren(); main.style.display = 'block'; const section = el('section'); section.className = 'fm-runtime-panel'; section.style.cssText = 'background:#FFFFFF;border-radius:8px;padding:20px 24px;display:flex;flex-direction:column;gap:14px'; section.append(el('h1', title)); main.append(section); q(this.root, 'ol')?.replaceChildren(); const headerTitle = byText(this.root, '确认订单'); if (headerTitle)
            headerTitle.textContent = title; section.append(button('继续选购', () => this.navigate('/products')), button('刷新', () => void this.render())); return section;
    }
    private async orders() {
        const main=this.shell('我的订单');main.append(button('管理收货地址',()=>this.manageAddresses()));
        const memberOptions={dialog:(title:string)=>this.dialog(title),run:(action:()=>Promise<void>)=>this.run(action),reload:()=>this.orders()};
        await this.paged(main,'member-orders','订单列表',query=>service.orders(query),order=>{
        const article = el('article');
        if (isR04Design()) {
            article.className = 'r04-order-card'; article.dataset.state = order.status;
            const head = el('header'); head.className = 'r04-order-head';
            const title = el('h2', order.orderNo + ' · '); title.append(r04State(status[order.status] ?? order.status, order.status));
            head.append(title, el('time', '下单于 ' + new Date(order.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }))); article.append(head);
            const amounts = el('div'); amounts.className = 'r04-order-amounts';
            for (const [label, amount] of [['应付', order.price.payableAmount], ['已付', order.paidAmount], ['已退', order.refundedAmount]] as const) { const field = el('div'); field.append(el('span', label), el('strong', formatMoney(amount))); amounts.append(field); }
            article.append(amounts, r04Note(`配送预约 ${order.slot.date} ${order.slot.label} · ${order.address.recipientName} · ${order.address.detail}`));
        } else { article.style.cssText = 'border-top:1px solid #E3E6EA;padding:16px 0'; article.append(el('h2', `${order.orderNo} · ${status[order.status] ?? order.status}`), el('p', `${order.slot.date} ${order.slot.label} · 应付 ${formatMoney(order.price.payableAmount)} · 已付 ${formatMoney(order.paidAmount)} · 已退 ${formatMoney(order.refundedAmount)}`)); }
        for (const item of order.items) {
            const row = el('p', `${item.productName} × ${item.baseUnit === 'GRAM' ? formatWeight(item.actualGram ?? item.estimatedGram ?? item.quantity) + (item.actualGram !== null ? '（实重）' : '（估重）') : item.quantity} · ${formatMoney(item.finalPayableAmount ?? item.originalPayableAmount)}`);
            if (isR04Design()) { row.className = 'r04-order-line'; const image = document.createElement('img'); setProductImage(image, item.imageUrl); image.alt = item.productName; image.width = 58; image.height = 58; row.prepend(image); }
            if(order.status==='FINISHED')row.append(createReviewButton(order,item,{dialog:title=>this.dialog(title),run:action=>this.run(action),reload:()=>this.orders(),notify:message=>this.tell(message)}));
            article.append(row);
        }
        if (order.weightAdjustment && order.weightAdjustment.status!=='NONE')
            article.append(el('p', `实重结算：${({REFUND_PENDING:'退差处理中',REFUNDED:'已退差',TOP_UP_PENDING:'待补款',SETTLED:'已结算',CANCELED:'已取消',NONE:'无需调整'} as const)[order.weightAdjustment.status]} · 差额 ${formatMoney(order.weightAdjustment.deltaAmount)}`));
        if (order.deliveryReceiptCode) { const receipt = el('strong', '配送签收码：' + order.deliveryReceiptCode); if (isR04Design()) receipt.className = 'r04-receipt'; article.append(receipt); }
        if (order.allowedActions.includes('PAY') || order.allowedActions.includes('TOP_UP'))
            article.append(button(order.allowedActions.includes('TOP_UP') ? '支付称重补款' : '去支付', () => void this.run(() => this.payment(order))));
        if(order.allowedActions.includes('APPLY_AFTERSALE'))article.append(button('申请售后',()=>this.aftersaleDialog(order)));
        if (order.allowedActions.includes('CANCEL'))
            article.append(button('取消订单', () => { const d = this.dialog('取消订单'); const reason = input('取消原因', 'reason', '不再需要'); d.append(reason, button('确认取消', () => void this.run(async () => { await service.cancel(order.orderId, { version: order.version, reason: q<HTMLInputElement>(reason, 'input')!.value }); d.close(); this.tell('订单已取消；退款进度以订单为准'); await this.orders(); }))); }));
        appendMemberOrderActions(article,order,memberOptions);
        if (isR04Design()) { const actions = el('div'); actions.className = 'r04-order-actions'; for (const action of qa<HTMLButtonElement>(article, ':scope > button')) actions.append(action); if (actions.childElementCount) article.append(actions); }
        return article;
        },'暂无符合条件的订单，去选购商品吧。',status);
        await this.paged(main,'member-aftersales','售后进度',query=>service.aftersales(query),a=>{
            const row=el('article');row.dataset.aftersaleId=a.aftersaleId;row.dataset.state=a.status;
            row.append(el('p',`${a.aftersaleId} · ${a.status} · 申请 ${formatMoney(a.requestedAmount)} · 核准 ${formatMoney(a.approvedAmount)}${a.reviewComment?' · '+a.reviewComment:''}`));
            appendAftersaleActions(row,a,memberOptions);return row;
        },'暂无符合条件的售后申请。',{APPLIED:'待处理',APPROVED:'已核准',REJECTED:'已驳回',REFUNDING:'退款中',COMPLETED:'已完成',CANCELED:'已撤销'});
    }
    private async operations() {
        const user = service.auth.getSnapshot().user;
        if (!user) {
            await this.home();
            this.login(false);
            return;
        }
        const main = this.shell('员工工作台');
        main.append(el('p', '当前身份：' + user.displayName + ' · ' + user.roles.map(role => roleNames[role] ?? role).join(' / ')), button('切换账户', () => this.login(false)));
        const managementOptions = { dialog: (title:string) => this.dialog(title), run: (action:()=>Promise<void>) => this.run(action), reload: () => this.operations() };
        await renderManagement(main, managementOptions);
        await renderOperations(main, managementOptions);
        await renderFinanceAudit(main, managementOptions);
        if(user.permissions.includes('order.work.read'))await this.paged(main,'admin-orders','订单查询',query=>service.adminOrders(query),order=>{
            const row=el('article');row.dataset.orderId=order.orderId;row.append(el('h3',order.orderNo+' · '+status[order.status]),el('p',formatMoney(order.price.payableAmount)));appendAdminOrderActions(row,order,managementOptions);return row;
        },'暂无符合条件的订单。',status);
        if(user.permissions.includes('pick.read'))await this.paged(main,'pick-tasks','拣货任务',query=>service.pickTasks(query),task=>{
                const row = el('section');
                row.append(el('h3', `${task.taskId} · ${task.status}`), el('p', `${task.slot.date} ${task.slot.label}`));
                for (const item of task.items)
                    row.append(el('p', `${item.productName} · 计划 ${item.baseUnit === 'GRAM' ? formatWeight(item.quantity) : item.quantity + ' 件'}`));
                if (task.status === 'UNASSIGNED')
                    row.append(button('领取拣货任务', () => void this.run(async () => { await service.claimPick(task.taskId, task.version); this.tell('已领取拣货任务'); await this.operations(); })));
                if (task.status === 'CLAIMED' && task.pickerId === user.userId) {
                    row.append(button('录入实拣数量', () => this.pickDialog(task)),button('重新分配批次',()=>openReallocateDialog(task,managementOptions)));
                }
                appendAdminOrderActions(row,task,managementOptions);return row;
        },'暂无符合条件的拣货任务。',{UNASSIGNED:'待领取',CLAIMED:'已领取',COMPLETED:'已实拣',CANCELED:'已取消'});
        if(user.permissions.some(p=>['delivery.handover.read','delivery.self.read','delivery.exception.resolve'].includes(p)))await this.paged(main,'delivery-tasks','配送任务',query=>service.deliveryTasks(query),task=>{
                const row = el('section');
                row.append(el('h3', `${task.taskId} · ${task.status}`), el('p', `${task.contact.recipientName} ${task.contact.phoneMasked} · ${task.contact.region} · ${task.slot.date} ${task.slot.label}`));
                if (task.status === 'PENDING_DISPATCH' && user.permissions.includes('delivery.dispatch'))
                    row.append(button('交接并发货', () => { const d=this.dialog('交接配送');const courier=input('配送员账户 ID','courierId','demo-courier');d.append(courier,el('p','演示配送员 ID 为 demo-courier；服务端验证配送员角色，不能指派给拣货员。'),button('确认发货',()=>void this.run(async()=>{await service.dispatch(task.taskId,{courierId:q<HTMLInputElement>(courier,'input')!.value,version:task.version});d.close();this.tell('订单已交接发货，会员订单中可查看签收码');await this.operations();}))); }));
                if (task.status === 'DELIVERING' && task.courierId === user.userId)
                    row.append(button('确认签收', () => { const d = this.dialog('配送签收'); const proof = input('会员提供的六位签收码', 'proofCode'); const i = q<HTMLInputElement>(proof, 'input')!; i.pattern = '[0-9]{6}'; i.maxLength = 6; d.append(proof, button('提交签收', () => void this.run(async () => { await service.completeDelivery(task.taskId, { proofCode: i.value, version: task.version }); d.close(); this.tell('订单已完成'); await this.operations(); }))); }));
                appendDeliveryActions(row,task,managementOptions);
                return row;
        },'暂无符合条件的配送任务。',{PENDING_DISPATCH:'待交接',DELIVERING:'配送中',COMPLETED:'已签收',EXCEPTION:'异常待处理',CANCELED:'已取消'});
        if(user.permissions.includes('aftersale.work.read'))await this.paged(main,'admin-aftersales','售后工单',query=>service.adminAftersales(query),a=>{
            const row=el('section');row.dataset.aftersaleId=a.aftersaleId;row.append(el('h3',`${a.aftersaleId} · ${a.status}`),el('p',`${a.type} · ${a.reason} · 申请 ${formatMoney(a.requestedAmount)}`));
            if(a.status==='APPLIED'&&!a.assigneeId&&user.permissions.includes('aftersale.work.claim'))row.append(button('领取售后',()=>void this.run(async()=>{await service.claimAftersale(a.aftersaleId,a.version);await this.operations();})));
            if(a.assigneeId===user.userId&&a.evidenceMediaIds.length)row.append(button('查看品质证据',()=>openEvidencePreview(a.evidenceMediaIds,{dialog:title=>this.dialog(title),run:action=>this.run(action)})));
            if(a.status==='APPLIED'&&a.assigneeId===user.userId&&user.permissions.includes('aftersale.review'))row.append(button('审核售后',()=>this.reviewDialog(a)));return row;
        },'暂无符合条件的售后工单。',{APPLIED:'待处理',APPROVED:'已核准',REJECTED:'已驳回',REFUNDING:'退款中',COMPLETED:'已完成',CANCELED:'已撤销'});
        if(user.permissions.includes('refund.read'))await this.paged(main,'admin-refunds','退款执行',query=>service.refunds(query),refund=>{
            const row=el('section');row.dataset.refundId=refund.refundId;row.append(el('p',`${refund.refundId} · ${refund.status} · ${formatMoney(refund.amount)} · ${refund.type}`));
            if(refund.status==='PENDING'&&refund.type==='AFTERSALE'&&user.permissions.includes('refund.execute'))row.append(button('执行退款',()=>{const d=this.dialog('确认原路沙箱退款');const reason=input('复核说明','reason','复核通过，执行原路沙箱退款');d.append(el('p',formatMoney(refund.amount)),reason,button('确认退款',()=>void this.run(async()=>{await service.executeRefund(refund.refundId,{version:refund.version,reason:q<HTMLInputElement>(reason,'input')!.value});d.close();this.tell('退款指令已提交，请刷新查看结果');await this.operations();})));}));
            appendRefundActions(row,refund,managementOptions);return row;
        },'暂无符合条件的退款记录。',{PENDING:'待授权',PROCESSING:'处理中',SUCCESS:'已退款',FAILED:'失败待处理'});
        if (!user.permissions.some(p => ['order.work.read', 'pick.read', 'delivery.handover.read', 'delivery.self.read', 'aftersale.work.read', 'refund.read', 'dashboard.read', 'employee.read'].includes(p)))
            main.append(el('p', '此角色没有本工作台的业务操作权限。服务端独立校验角色与资源归属。'));
        if (isR04Design()) this.decorateWorkbench(main);
    }
    private decorateWorkbench(main: HTMLElement) {
        const anchors: Record<string, string> = { '订单查询': 'orders', '拣货任务': 'picking', '配送任务': 'delivery', '售后工单': 'aftersales', '退款执行': 'refunds' };
        let group: HTMLElement | null = null;
        const nodes = [...main.children];
        for (const node of nodes) {
            if (node.matches('.r04-runtime-intro')) continue;
            if (node.tagName === 'H2') {
                group = el('section'); group.className = 'r04-workgroup';
                const key = anchors[node.textContent ?? '']; if (key) group.id = 'r04-' + key;
                main.insertBefore(group, node); group.append(node); continue;
            }
            if (group) {
                group.append(node);
                if (node.tagName === 'SECTION') {
                    node.classList.add('r04-task-card');
                    const actions = qa<HTMLButtonElement>(node, ':scope > button'); if (actions.length) { const footer = el('div'); footer.className = 'r04-task-actions'; footer.append(...actions); node.append(footer); }
                } else if (node.tagName === 'P') node.classList.add(q(node, 'button') ? 'r04-refund-row' : 'r04-work-record');
            } else if (node.tagName === 'P') node.classList.add('r04-role-description');
        }
    }
    private aftersaleDialog(order:Order) {
        const d=this.dialog('申请售后'); d.classList.add('fm-management-dialog');
        d.append(el('p','签收后7天内可申请品质、缺货或配送延迟售后。品质问题至少提供一张本订单图片；数量、金额和已退款额度由服务端再次校验。'));
        const type=document.createElement('select');type.setAttribute('aria-label','售后类型');
        for(const [value,label] of [['QUALITY','品质问题'],['SHORTAGE','缺货'],['LATE','配送延迟']]) {const option=document.createElement('option');option.value=value!;option.textContent=label!;type.append(option);}
        const reason=input('问题说明','reason'); const reasonInput=q<HTMLInputElement>(reason,'input')!;reasonInput.maxLength=500;
        const uploader=createEvidenceUploader(order.orderId,{purpose:'AFTERSALE',ownerDialog:d,run:action=>this.run(action)});
        d.append(type,reason);const fields:{item:Models['OrderItem'];selected:HTMLInputElement;quantity:HTMLInputElement;amount:HTMLInputElement}[]=[];
        for(const item of order.items) {
            const row=el('p'),selected=document.createElement('input'),qty=document.createElement('input'),amount=document.createElement('input');
            selected.type='checkbox';selected.setAttribute('aria-label','售后选择 '+item.productName);qty.type='number';qty.min='1';qty.step='1';qty.value='1';qty.setAttribute('aria-label',item.productName+'售后数量');amount.inputMode='decimal';amount.placeholder='申请退款金额（元）';amount.setAttribute('aria-label',item.productName+'申请金额');
            row.append(selected,el('span',item.productName+' '),qty,el('span',item.baseUnit==='GRAM'?' 克 ':' 件 '),amount);fields.push({item,selected,quantity:qty,amount});d.append(row);
        }
        d.append(uploader.element,button('提交售后申请',()=>void this.run(async()=>{
            if(!reasonInput.value.trim())throw new Error('请填写问题说明');
            const items=fields.filter(f=>f.selected.checked).map(f=>{if(!/^[1-9]\d*$/.test(f.quantity.value)||!Number.isSafeInteger(Number(f.quantity.value)))throw new Error('售后数量必须为正整数');return {orderItemId:f.item.orderItemId,quantity:Number(f.quantity.value),requestedAmount:yuan(f.amount.value)};});
            if(!items.length)throw new Error('请选择需要售后的商品');await uploader.uploadPending();const evidenceMediaIds=uploader.ids();
            if(type.value==='QUALITY'&&!evidenceMediaIds.length)throw new Error('品质问题至少上传一张本订单图片');
            await service.applyAftersale({orderId:order.orderId,type:type.value as 'QUALITY'|'SHORTAGE'|'LATE',reason:reasonInput.value.trim(),items,evidenceMediaIds});
            d.close();this.tell('售后申请已提交');await this.orders();
        })));
    }
    private reviewDialog(a:Models['AdminAftersale']){const d=this.dialog('售后审核');const comment=input('审核说明','comment','已核实问题');d.append(comment);const fields:{line:Models['AftersaleLineInput'];amount:HTMLInputElement}[]=[];for(const line of a.items){const row=el('p',`${line.orderItemId} · 申请数量 ${line.quantity} · 核准金额（元） `);const amount=document.createElement('input');amount.inputMode='decimal';amount.value=money(line.requestedAmount);row.append(amount);fields.push({line,amount});d.append(row);}d.append(button('通过并生成退款单',()=>void this.run(async()=>{await service.approveAftersale(a.aftersaleId,{version:a.version,comment:q<HTMLInputElement>(comment,'input')!.value,approvedItems:fields.map(f=>({...f.line,requestedAmount:yuan(f.amount.value)}))});d.close();this.tell('审核通过，等待另一财务账户执行退款');await this.operations();})),button('驳回申请',()=>void this.run(async()=>{await service.rejectAftersale(a.aftersaleId,{version:a.version,comment:q<HTMLInputElement>(comment,'input')!.value});d.close();await this.operations();})));}
    private pickDialog(task: Models['PickTask']) {
        const d = this.dialog('实拣确认 · 基础单位');
        const fields: {
            allocation: Models['Allocation'];
            quantity: HTMLInputElement;
            reason: HTMLSelectElement;
            note: HTMLInputElement;
        }[] = [];
        for (const a of task.allocations) {
            const item = task.items.find(i => i.orderItemId === a.orderItemId);
            const row = el('p');
            row.append(el('strong', `${item?.productName ?? a.orderItemId} / ${a.batchNo} · 预占 ${a.reservedQuantity} ${a.baseUnit === 'GRAM' ? '克' : '件'} `));
            const amount = document.createElement('input');
            amount.type = 'number';
            amount.min = '0';
            amount.step = '1';
            amount.value = String(a.reservedQuantity);
            amount.setAttribute('aria-label', `${item?.productName ?? a.orderItemId}实拣数量`);
            const reason = document.createElement('select');
            for (const [value, text] of [['NORMAL', '正常'], ['WEIGHT_VARIANCE', '称重差异'], ['SHORTAGE', '缺货']]) {
                const option = document.createElement('option');
                option.value = value!;
                option.textContent = text!;
                reason.append(option);
            }
            const note = document.createElement('input');
            note.value = '实际拣货确认';
            note.setAttribute('aria-label', '拣货原因');
            row.append(amount, reason, note);
            fields.push({ allocation: a, quantity: amount, reason, note });
            d.append(row);
        }
        d.append(el('p', 'PIECE 输入件数；GRAM 输入克数。实重超出估重 110% 会被服务器拒绝，零实拣必须选择缺货。'), button('确认出库并结算', () => void this.run(async () => { const result = await service.confirmPick(task.taskId, { version: task.version, allocations: fields.map(f => ({ allocationId: f.allocation.allocationId, actualQuantity: Number(f.quantity.value), reasonCode: f.reason.value as Models['PickConfirmLine']['reasonCode'], reason: f.note.value })) }); d.close(); this.tell(`拣货完成：${status[result.orderStatus]}${result.weightAdjustment ? ' · 差额 ' + formatMoney(result.weightAdjustment.deltaAmount) : ''}`); await this.operations(); })));
    }
}
