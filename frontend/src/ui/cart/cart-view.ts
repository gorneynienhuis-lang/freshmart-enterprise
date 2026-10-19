/**
 * 购物车弹层与“我的优惠券”弹层的视觉呈现（当前版 r03）。
 * 只负责把已有数据画出来、把用户操作通过回调交出去；
 * 加购、改数量、删除、报价等业务调用仍由 application.ts 完成。
 */
import { formatMoney, type Cart, type Models } from '../../domain';
import { setProductImage } from '../../app/product-image';
import '../../styles/cart-sheet.css';

type CartItem = Cart['items'][number];
type Coupon = Models['Coupon'];

export interface CartViewHandlers {
    onQuantity(item: CartItem, quantity: number): void;
    onToggle(item: CartItem, selected: boolean): void;
    onRemove(item: CartItem): void;
    onCheckout(): void;
    onBrowse(): void;
    onClose(): void;
}

/** 本站规则：优惠后商品实付满 ¥99 免运费（以结算页报价为准）。 */
const FREE_SHIPPING_FEN = 9900;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}

function closeButton(label: string, onClose: () => void): HTMLButtonElement {
    const b = node('button', 'fm-sheet-close');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    b.onclick = onClose;
    return b;
}

function header(d: HTMLDialogElement, title: string, meta: string, onClose: () => void): HTMLElement {
    const head = node('header', 'fm-sheet-head');
    const titles = node('div');
    const h = node('h2', undefined, title);
    h.id = d.getAttribute('aria-labelledby') ?? `sheet-${Date.now()}`;
    d.setAttribute('aria-labelledby', h.id);
    titles.append(h, node('p', undefined, meta));
    head.append(titles, closeButton('关闭' + title, onClose));
    return head;
}

function stepper(item: CartItem, onChange: (q: number) => void): HTMLElement {
    const step = item.baseUnit === 'GRAM' ? 50 : 1;
    const wrap = node('div', 'fm-stepper');
    const minus = node('button', undefined, '−');
    const plus = node('button', undefined, '+');
    const field = node('input');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', `减少 ${item.productName}`);
    plus.setAttribute('aria-label', `增加 ${item.productName}`);
    field.type = 'number';
    field.inputMode = 'numeric';
    field.min = String(step);
    field.step = String(step);
    field.value = String(item.quantity);
    field.setAttribute('aria-label', `${item.productName}数量（${item.baseUnit === 'GRAM' ? '克' : '件'}）`);
    minus.disabled = item.quantity <= step;
    const commit = (q: number) => {
        const next = Math.max(step, Math.round(q / step) * step);
        if (Number.isFinite(next) && next !== item.quantity) onChange(next);
        else field.value = String(item.quantity);
    };
    minus.onclick = () => commit(item.quantity - step);
    plus.onclick = () => commit(item.quantity + step);
    field.onchange = () => commit(Number(field.value));
    field.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); field.blur(); } };
    wrap.append(minus, field, plus);
    if (item.baseUnit === 'GRAM') wrap.append(node('span', 'fm-stepper-unit', '克'));
    return wrap;
}

function row(item: CartItem, h: CartViewHandlers): HTMLElement {
    const li = node('li', 'fm-cart-item');
    if (!item.selected) li.dataset.unselected = 'true';

    const pick = node('label', 'fm-check');
    const box = node('input');
    box.type = 'checkbox';
    box.checked = item.selected;
    box.setAttribute('aria-label', `选择 ${item.productName}`);
    box.onchange = () => h.onToggle(item, box.checked);
    pick.append(box, node('span', undefined));

    const img = node('img', 'fm-cart-thumb');
    setProductImage(img, item.imageUrl);
    img.alt = item.productName;
    img.width = 72;
    img.height = 72;

    const info = node('div', 'fm-cart-info');
    info.append(node('strong', undefined, item.productName));
    const meta = node('p');
    meta.append(node('span', undefined, item.unitLabel));
    meta.append(node('span', undefined, item.baseUnit === 'GRAM' ? '按实重结算' : '按件计价'));
    info.append(meta);
    if (item.stockStatus !== 'IN_STOCK') info.append(node('em', 'fm-cart-stock', item.stockStatus === 'SOLD_OUT' ? '已售罄' : '库存紧张'));
    if (item.baseUnit === 'PIECE') info.append(node('span', 'fm-cart-unit', `${formatMoney(item.unitPrice)} / 件`));
    else info.append(node('span', 'fm-cart-unit', '先按估重付款，拣货后多退少补'));

    const side = node('div', 'fm-cart-side');
    side.append(node('span', 'fm-cart-line', formatMoney(item.lineAmount)));
    side.append(stepper(item, q => h.onQuantity(item, q)));
    const remove = node('button', 'fm-cart-remove', '删除');
    remove.type = 'button';
    remove.setAttribute('aria-label', `删除 ${item.productName}`);
    remove.onclick = () => h.onRemove(item);
    side.append(remove);

    li.append(pick, img, info, side);
    return li;
}

export function renderCartSheet(d: HTMLDialogElement, cart: Cart | null, h: CartViewHandlers): void {
    d.classList.add('fm-sheet', 'fm-cart-sheet');
    const items = cart?.items ?? [];
    const selected = items.filter(i => i.selected);
    d.replaceChildren(header(d, '购物车', items.length ? `共 ${items.length} 种商品 · 已选 ${selected.length} 种` : '还没有挑选商品', h.onClose));

    if (!cart || items.length === 0) {
        const empty = node('div', 'fm-sheet-empty');
        const img = node('img');
        img.src = '/brand/mascot/dongxiaojin-basket.png';
        img.alt = '';
        img.width = 120;
        empty.append(img, node('strong', undefined, '购物车还是空的'), node('p', undefined, '当季蔬果、肉禽蛋奶都在这里，挑几样带回家吧。'));
        const go = node('button', 'fm-sheet-primary', '去逛逛');
        go.type = 'button';
        go.onclick = h.onBrowse;
        empty.append(go);
        d.append(empty);
        return;
    }

    const list = node('ul', 'fm-cart-list');
    list.setAttribute('aria-label', '购物车商品');
    for (const item of items) list.append(row(item, h));
    d.append(list);

    const foot = node('footer', 'fm-cart-foot');
    const gap = FREE_SHIPPING_FEN - cart.estimatedGoodsAmount;
    const ship = node('p', 'fm-cart-ship');
    const bar = node('span', 'fm-cart-ship-bar');
    const fill = node('i');
    fill.style.width = `${Math.min(100, Math.round((cart.estimatedGoodsAmount / FREE_SHIPPING_FEN) * 100))}%`;
    bar.append(fill);
    ship.append(node('span', undefined, gap > 0 ? `预估再买 ${formatMoney(gap)} 可免运费` : '已满 ¥99，可享免运费'), bar);

    const sum = node('div', 'fm-cart-sum');
    const label = node('p');
    label.append(node('span', undefined, '商品预估'), node('strong', undefined, formatMoney(cart.estimatedGoodsAmount)));
    sum.append(label, node('small', undefined, '运费与优惠券在结算页计算，以最终报价为准'));

    const checkout = node('button', 'fm-sheet-primary', selected.length ? `去结算（${selected.length}）` : '去结算');
    checkout.type = 'button';
    checkout.disabled = selected.length === 0;
    checkout.onclick = h.onCheckout;

    foot.append(ship, sum, checkout);
    d.append(foot);
}

const COUPON_STATUS: Record<string, string> = { AVAILABLE: '可使用', LOCKED: '已锁定', USED: '已使用', EXPIRED: '已过期' };

function expiry(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return '有效期至 ' + new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replace(/\//g, '-');
}

export function renderCouponSheet(d: HTMLDialogElement, coupons: readonly Coupon[], onClose: () => void, onShop: () => void): void {
    d.classList.add('fm-sheet', 'fm-coupon-sheet');
    const usable = coupons.filter(c => c.status === 'AVAILABLE').length;
    d.replaceChildren(header(d, '我的优惠券', usable ? `${usable} 张可使用` : '暂无可使用的优惠券', onClose));

    const intro = node('p', 'fm-coupon-intro', '新人券可以与会员价叠加使用，在结算页选择即可抵扣。');
    d.append(intro);

    if (!coupons.length) {
        const empty = node('div', 'fm-sheet-empty');
        empty.append(node('strong', undefined, '还没有优惠券'), node('p', undefined, '注册成为会员后会自动发放新人券。'));
        d.append(empty);
        return;
    }

    const list = node('ul', 'fm-coupon-list');
    const order = ['AVAILABLE', 'LOCKED', 'USED', 'EXPIRED'];
    for (const c of [...coupons].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))) {
        const li = node('li', 'fm-coupon');
        li.dataset.status = c.status;
        const stub = node('div', 'fm-coupon-stub');
        const amount = node('strong');
        amount.append(node('small', undefined, '¥'), document.createTextNode(formatMoney(c.discountAmount, { symbol: false })));
        stub.append(amount, node('span', undefined, c.minGoodsAmount > 0 ? `满 ${formatMoney(c.minGoodsAmount)} 可用` : '无门槛'));
        const body = node('div', 'fm-coupon-body');
        body.append(node('strong', undefined, c.name), node('span', undefined, expiry(c.expiresAt)));
        const status = node('em', 'fm-coupon-status', COUPON_STATUS[c.status] ?? c.status);
        li.append(stub, body, status);
        list.append(li);
    }
    d.append(list);

    if (usable) {
        const foot = node('footer', 'fm-coupon-foot');
        const go = node('button', 'fm-sheet-primary', '去选购');
        go.type = 'button';
        go.onclick = onShop;
        foot.append(go);
        d.append(foot);
    }
}
