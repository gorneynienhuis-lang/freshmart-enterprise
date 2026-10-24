/** Checkout coupon presentation only; eligibility and amounts come from the server quote. */
import { formatMoney, type Models } from '../../domain';
import '../../styles/checkout-coupons.css';

let groupNumber = 0;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function expiryLabel(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
        ? '有效期以结算结果为准'
        : `${date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })} 到期`;
}

function radio(name: string, checked: boolean, onSelect: () => void): HTMLInputElement {
    const input = node('input', 'fm-checkout-coupon-radio');
    input.type = 'radio';
    input.name = name;
    input.checked = checked;
    input.onchange = () => { if (input.checked) onSelect(); };
    return input;
}

/** Native radios support Tab, arrow keys and Space without replacing checkout business logic. */
export function renderCheckoutCoupons(
    container: Element,
    coupons: Models['Coupon'][],
    selectedCouponId: string | null,
    onSelect: (id: string | null) => void,
): void {
    container.classList.add('fm-checkout-coupons');
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', '选择优惠券');
    container.replaceChildren();
    const name = `checkout-coupon-${++groupNumber}`;
    const available = coupons.filter(coupon => coupon.status === 'AVAILABLE');
    const cards = node('div', 'fm-checkout-coupon-list');

    for (const coupon of available) {
        const card = node('label', 'fm-checkout-coupon-card');
        card.dataset.couponId = coupon.couponId;
        const input = radio(name, coupon.couponId === selectedCouponId, () => onSelect(coupon.couponId));
        input.value = coupon.couponId;
        const amount = node('span', 'fm-checkout-coupon-value');
        const figure = node('span', 'fm-checkout-coupon-figure');
        figure.append(node('small', undefined, '¥'), node('strong', undefined, formatMoney(coupon.discountAmount, { symbol: false })));
        amount.append(figure, node('span', 'fm-checkout-coupon-threshold', coupon.minGoodsAmount > 0 ? `满 ${formatMoney(coupon.minGoodsAmount)} 可用` : '无门槛'));

        const details = node('span', 'fm-checkout-coupon-details');
        const title = node('span', 'fm-checkout-coupon-name', coupon.name);
        const expiration = node('time', 'fm-checkout-coupon-expiry', expiryLabel(coupon.expiresAt));
        if (!Number.isNaN(Date.parse(coupon.expiresAt))) expiration.dateTime = coupon.expiresAt;
        const status = node('span', 'fm-checkout-coupon-status');
        status.append(node('span', 'fm-checkout-coupon-selected', '已选择'), node('span', 'fm-checkout-coupon-unselected', '点击使用'));
        details.append(title, expiration, status);
        const mark = node('span', 'fm-checkout-coupon-mark', '✓');
        mark.setAttribute('aria-hidden', 'true');
        card.append(input, amount, details, mark);
        cards.append(card);
    }

    if (available.length) {
        container.append(cards);
    } else {
        const empty = node('div', 'fm-checkout-coupon-empty');
        empty.append(node('strong', undefined, '暂无可用优惠券'), node('span', undefined, '可以继续结算，订单金额以实时报价为准。'));
        container.append(empty);
    }

    const none = node('label', 'fm-checkout-coupon-none');
    const noneInput = radio(name, selectedCouponId === null, () => onSelect(null));
    noneInput.value = '';
    const noneMark = node('span', 'fm-checkout-coupon-none-mark');
    noneMark.setAttribute('aria-hidden', 'true');
    none.append(noneInput, noneMark, node('span', undefined, '不使用优惠券'));
    container.append(none);
    if (available.length) container.append(node('p', 'fm-checkout-coupon-hint', '优惠是否适用及抵扣金额，以本次结算报价为准。'));
}
