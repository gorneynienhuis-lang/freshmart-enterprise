/** Aftersale presentation only. The caller owns validation, upload and application requests. */
import { formatWeight, type Models, type Order } from '../../domain';
import { setProductImage } from '../../app/product-image';
import '../../styles/aftersale-form.css';

interface AftersaleField {
    item: Models['OrderItem'];
    selected: HTMLInputElement;
    quantity: HTMLInputElement;
    amount: HTMLInputElement;
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function field(labelText: string, control: HTMLElement, hint?: string): HTMLLabelElement {
    const label = node('label', 'fm-aftersale-field');
    label.append(node('span', 'fm-aftersale-label', labelText), control);
    if (hint) label.append(node('small', 'fm-aftersale-hint', hint));
    return label;
}

function amountField(labelText: string, input: HTMLInputElement, unit: string): HTMLLabelElement {
    const control = node('span', 'fm-aftersale-input-unit');
    control.append(input, node('span', undefined, unit));
    return field(labelText, control);
}

export function renderAftersaleFields(
    body: HTMLElement,
    footer: HTMLElement,
    order: Order,
    uploader: HTMLElement,
    onSubmit: () => void,
): { type: HTMLSelectElement; reasonInput: HTMLTextAreaElement; fields: AftersaleField[] } {
    body.classList.add('fm-aftersale-body');
    footer.classList.add('fm-aftersale-footer');

    const summary = node('div', 'fm-aftersale-summary');
    summary.append(node('span', undefined, '售后订单'), node('code', undefined, order.orderNo));
    const intro = node('p', 'fm-aftersale-intro', '签收后7天内可申请品质、缺货或配送延迟售后。数量、金额和已退款额度由服务端再次校验。');

    const type = node('select');
    type.setAttribute('aria-label', '售后类型');
    for (const [value, text] of [['QUALITY', '品质问题'], ['SHORTAGE', '缺货'], ['LATE', '配送延迟']] as const) {
        const option = node('option', undefined, text);
        option.value = value;
        type.append(option);
    }
    const typeRow = node('div', 'fm-aftersale-type-row');
    typeRow.append(field('售后类型', type));

    const section = node('section', 'fm-aftersale-products');
    const head = node('div', 'fm-aftersale-section-head');
    head.append(node('h3', undefined, '选择售后商品'), node('span', undefined, '勾选商品后填写数量及申请金额'));
    section.append(head);
    const fields: AftersaleField[] = [];
    for (const item of order.items) {
        const card = node('article', 'fm-aftersale-product');
        const selected = node('input', 'fm-aftersale-product-check');
        selected.type = 'checkbox';
        selected.setAttribute('aria-label', '售后选择 ' + item.productName);
        const image = node('img', 'fm-aftersale-product-image');
        image.alt = item.productName;
        image.width = 48;
        image.height = 48;
        setProductImage(image, item.imageUrl);
        const identity = node('div', 'fm-aftersale-product-identity');
        identity.append(node('strong', undefined, item.productName), node('span', undefined,
            item.baseUnit === 'GRAM'
                ? item.actualGram !== null ? `实交重量 ${formatWeight(item.actualGram)}` : '实交重量以订单记录为准'
                : `订单数量 ${item.quantity} 件`));
        const productHead = node('label', 'fm-aftersale-product-head');
        productHead.append(selected, image, identity);

        const quantity = node('input');
        quantity.type = 'number';
        quantity.min = '1';
        quantity.step = '1';
        quantity.value = '1';
        quantity.setAttribute('aria-label', item.productName + '售后数量');
        const amount = node('input');
        amount.inputMode = 'decimal';
        amount.placeholder = '请输入金额';
        amount.setAttribute('aria-label', item.productName + '申请金额');
        const inputs = node('div', 'fm-aftersale-product-inputs');
        inputs.append(amountField('售后数量', quantity, item.baseUnit === 'GRAM' ? '克' : '件'), amountField('申请金额', amount, '元'));
        card.append(productHead, inputs);
        section.append(card);
        fields.push({ item, selected, quantity, amount });
    }

    const reasonInput = node('textarea');
    reasonInput.name = 'reason';
    reasonInput.maxLength = 500;
    reasonInput.rows = 3;
    reasonInput.placeholder = '请描述遇到的问题，便于我们核实处理';
    reasonInput.setAttribute('aria-label', '问题说明');
    const reason = field('问题说明', reasonInput, '500字以内，请说明商品问题或配送情况。');
    reason.classList.add('fm-aftersale-reason');

    const evidence = node('section', 'fm-aftersale-evidence');
    uploader.classList.add('fm-aftersale-uploader');
    evidence.append(uploader, node('p', 'fm-aftersale-hint', '品质问题至少提供一张本订单图片。'));

    body.append(summary, intro, typeRow, section, reason, evidence);
    const submit = node('button', 'fm-transaction-button', '提交售后申请');
    submit.type = 'button';
    submit.onclick = onSubmit;
    footer.append(submit);
    return { type, reasonInput, fields };
}
