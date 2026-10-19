/**
 * 会员“我的订单 / 售后进度”的视觉呈现（当前版 r03）。
 * 只负责把已有数据画成卡片、状态标签和筛选胶囊；
 * 支付、取消、售后、评价等动作按钮仍由 application.ts 创建，经 finish() 归入底部操作栏。
 */
import { formatMoney, formatWeight, type Models } from '../../domain';
import { setProductImage } from '../../app/product-image';
import '../../styles/orders.css';

type Order = Models['Order'];
type OrderItem = Models['MemberOrderItem'];
type Aftersale = Models['Aftersale'];

export interface OrderCardOptions {
    /** 状态的中文名 */
    statusLabel: string;
    /** 商品行右侧的附加控件（例如“评价”按钮） */
    itemExtra?(item: OrderItem): HTMLElement | null;
}

export interface OrderCard {
    article: HTMLElement;
    /** 调用方把按钮、提示 append 到 article 之后调用：按钮进入操作栏，提示进入备注区。 */
    finish(): void;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}

function svg(paths: string, size = 16): string {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

type Tone = 'todo' | 'active' | 'done' | 'muted';

function toneOf(status: string): Tone {
    if (status === 'PENDING_PAY') return 'todo';
    if (/^(PAID|PICKING|READY_TO_SHIP|DELIVERING)$/.test(status)) return 'active';
    if (status === 'FINISHED') return 'done';
    return 'muted';
}

/** 履约进度：待支付 → 拣货 → 配送 → 完成；已取消/已关闭不显示。 */
const STEPS = ['待支付', '拣货', '配送', '完成'] as const;
const STEP_INDEX: Readonly<Record<string, number>> = { PENDING_PAY: 0, PAID: 1, PICKING: 1, READY_TO_SHIP: 2, DELIVERING: 2, FINISHED: 3 };

function track(status: string): HTMLElement | null {
    const current = STEP_INDEX[status];
    if (current === undefined) return null;
    const list = node('ol', 'fm-order-track');
    list.setAttribute('aria-label', '订单进度');
    STEPS.forEach((label, index) => {
        const li = node('li', undefined, label);
        if (index < current || (status === 'FINISHED' && index === current)) li.dataset.state = 'done';
        else if (index === current) { li.dataset.state = 'current'; li.setAttribute('aria-current', 'step'); }
        list.append(li);
    });
    return list;
}

function when(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(/\//g, '-');
}

function itemQuantity(item: OrderItem): string {
    if (item.baseUnit !== 'GRAM') return `× ${item.quantity}`;
    const actual = item.actualGram !== null && item.actualGram !== undefined;
    return `× ${formatWeight(item.actualGram ?? item.estimatedGram ?? item.quantity)}${actual ? '（实重）' : '（估重）'}`;
}

function itemRow(item: OrderItem, options: OrderCardOptions): HTMLElement {
    const li = node('li', 'fm-order-item');
    const img = node('img');
    setProductImage(img, item.imageUrl);
    img.alt = item.productName;
    img.width = 64;
    img.height = 64;
    const info = node('div', 'fm-order-item-info');
    info.append(node('strong', undefined, item.productName), node('span', undefined, itemQuantity(item)));
    const side = node('div', 'fm-order-item-side');
    side.append(node('b', undefined, formatMoney(item.finalPayableAmount ?? item.originalPayableAmount)));
    const extra = options.itemExtra?.(item);
    if (extra) side.append(extra);
    li.append(img, info, side);
    return li;
}

const ADJUST: Readonly<Record<string, string>> = { REFUND_PENDING: '退差处理中', REFUNDED: '已退差', TOP_UP_PENDING: '待补款', SETTLED: '已结算', CANCELED: '已取消', NONE: '无需调整' };

export function renderOrderCard(order: Order, options: OrderCardOptions): OrderCard {
    const article = node('article', 'fm-order');
    article.dataset.state = order.status;
    article.dataset.tone = toneOf(order.status);

    const head = node('header', 'fm-order-head');
    const left = node('span', 'fm-order-head-main');
    const chip = node('span', 'fm-order-status', options.statusLabel);
    chip.dataset.tone = toneOf(order.status);
    left.append(chip, node('time', undefined, `下单于 ${when(order.createdAt)}`));
    const no = node('p', 'fm-order-no');
    no.append(node('span', undefined, '订单号'), node('code', undefined, order.orderNo));
    head.append(left, no);
    article.append(head);

    const progress = track(order.status);
    if (progress) article.append(progress);

    const items = node('ul', 'fm-order-items');
    items.setAttribute('aria-label', '订单商品');
    for (const item of order.items) items.append(itemRow(item, options));
    article.append(items);

    const ship = node('p', 'fm-order-ship');
    ship.innerHTML = svg('<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>');
    ship.append(node('span', undefined, `配送预约 ${order.slot.date} ${order.slot.label} · ${order.address.recipientName} · ${order.address.detail}`));
    article.append(ship);

    const notes = node('div', 'fm-order-notes');
    if (order.weightAdjustment && order.weightAdjustment.status !== 'NONE')
        notes.append(node('p', undefined, `实重结算：${ADJUST[order.weightAdjustment.status] ?? order.weightAdjustment.status} · 差额 ${formatMoney(order.weightAdjustment.deltaAmount)}`));
    if (order.deliveryReceiptCode) {
        const receipt = node('p', 'fm-order-receipt');
        receipt.append(node('span', undefined, '配送签收码'), node('strong', undefined, order.deliveryReceiptCode));
        notes.append(receipt);
    }
    article.append(notes);

    const foot = node('footer', 'fm-order-foot');
    const sums = node('dl', 'fm-order-sums');
    const sum = (label: string, amount: number, className?: string) => {
        const box = node('div', className);
        box.append(node('dt', undefined, label), node('dd', undefined, formatMoney(amount)));
        sums.append(box);
    };
    sum('应付', order.price.payableAmount, 'is-payable');
    sum('已付', order.paidAmount);
    sum('已退', order.refundedAmount);
    const actions = node('div', 'fm-order-actions');
    foot.append(sums, actions);
    article.append(foot);

    return {
        article,
        finish() {
            for (const child of [...article.children]) {
                if (child instanceof HTMLButtonElement) actions.append(child);
                else if (child.tagName === 'P' && child.classList.contains('fm-management-note')) notes.append(child);
            }
            if (!notes.childElementCount) notes.remove();
            if (!actions.childElementCount) actions.remove();
        },
    };
}

/** 售后进度卡片；撤销按钮由调用方 append 后自动成为底部操作。 */
export function renderAftersaleCard(a: Aftersale, statusLabel: string): HTMLElement {
    const article = node('article', 'fm-order fm-aftersale');
    article.dataset.state = a.status;
    const tone: Tone = a.status === 'COMPLETED' || a.status === 'APPROVED' ? 'done' : a.status === 'APPLIED' || a.status === 'REFUNDING' ? 'active' : 'muted';
    const head = node('header', 'fm-order-head');
    const left = node('span', 'fm-order-head-main');
    const chip = node('span', 'fm-order-status', statusLabel);
    chip.dataset.tone = tone;
    left.append(chip);
    const no = node('p', 'fm-order-no');
    no.append(node('span', undefined, '售后单'), node('code', undefined, a.aftersaleId));
    head.append(left, no);
    const sums = node('dl', 'fm-order-sums');
    for (const [label, amount, cls] of [['申请退款', a.requestedAmount, 'is-payable'], ['核准金额', a.approvedAmount, undefined]] as const) {
        const box = node('div', cls);
        box.append(node('dt', undefined, label), node('dd', undefined, formatMoney(amount)));
        sums.append(box);
    }
    article.append(head, sums);
    if (a.reviewComment) article.append(node('p', 'fm-order-comment', `审核意见：${a.reviewComment}`));
    return article;
}

/** 把页头里零散的按钮收进一行工具栏（标题之后）。 */
export function tidyPageBar(main: HTMLElement): void {
    main.classList.add('fm-orders-page');
    const bar = node('div', 'fm-orders-bar');
    for (const child of [...main.children]) if (child instanceof HTMLButtonElement) bar.append(child);
    const title = main.querySelector(':scope > h1');
    if (title) title.after(bar);
    else main.prepend(bar);
}

const SHORT_LABEL: Readonly<Record<string, string>> = { PAID: '待拣货', READY_TO_SHIP: '待发货' };

/** 状态筛选胶囊：只是 <select> 的外观替身，点击后沿用原有的 change 流程。 */
export function mountStatusPills(toolbar: HTMLElement, select: HTMLSelectElement): void {
    const group = node('div', 'fm-pills');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', '按状态筛选');
    const sync = () => {
        for (const pill of group.querySelectorAll('button')) pill.setAttribute('aria-pressed', String(pill.dataset.value === select.value));
    };
    for (const option of [...select.options]) {
        const pill = node('button', undefined, SHORT_LABEL[option.value] ?? option.textContent ?? option.value);
        pill.type = 'button';
        pill.dataset.value = option.value;
        pill.onclick = () => {
            if (select.value === option.value) return;
            select.value = option.value;
            select.dispatchEvent(new Event('change'));
            sync();
        };
        group.append(pill);
    }
    sync();
    toolbar.classList.add('has-pills');
    toolbar.prepend(group);
}
