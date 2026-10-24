import type { Models } from '../../domain';
import '../../styles/pick-confirmation.css';

let nextFormId = 0;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/** Visual-only picking form. The caller owns API submission, settlement, errors and dialog lifecycle. */
export function renderPickConfirmation(
    body: HTMLElement,
    footer: HTMLElement,
    task: Models['PickTask'],
    onConfirm: (allocations: Models['PickConfirmLine'][]) => void,
): void {
    const form = node('form', 'fm-pick-confirmation');
    form.id = `fm-pick-confirmation-${++nextFormId}`;

    const intro = node('p', 'fm-pick-confirmation-intro', '逐项核对商品和批次，填写本次实际拣货数量。');
    form.append(intro);

    const list = node('div', 'fm-pick-confirmation-list');
    const fields: {
        allocation: Models['Allocation'];
        quantity: HTMLInputElement;
        reason: HTMLSelectElement;
        note: HTMLInputElement;
    }[] = [];

    task.allocations.forEach((allocation, index) => {
        const product = task.items.find(item => item.orderItemId === allocation.orderItemId);
        const name = product?.productName ?? allocation.orderItemId;
        const unit = allocation.baseUnit === 'GRAM' ? '克' : '件';
        const row = node('section', 'fm-pick-confirmation-row');
        const head = node('div', 'fm-pick-confirmation-product');
        const identity = node('div', 'fm-pick-confirmation-identity');
        const nameId = `${form.id}-product-${index}`;
        const title = node('h3', 'fm-pick-confirmation-name', name);
        title.id = nameId;
        row.setAttribute('aria-labelledby', nameId);
        identity.append(title, node('p', 'fm-pick-confirmation-batch', `批次 ${allocation.batchNo}`));
        const reserved = node('span', 'fm-pick-confirmation-reserved', `预占 ${allocation.reservedQuantity} ${unit}`);
        head.append(identity, reserved);

        const controls = node('div', 'fm-pick-confirmation-controls');
        const amountField = node('div', 'fm-pick-confirmation-field');
        const amountLabel = node('label', 'fm-pick-confirmation-label', '实际数量');
        const amount = node('input', 'fm-pick-confirmation-input');
        amount.id = `${form.id}-quantity-${index}`;
        amountLabel.htmlFor = amount.id;
        amount.setAttribute('aria-label', `${name}实拣数量（${unit}）`);
        amount.type = 'number';
        amount.min = '0';
        amount.step = '1';
        amount.value = String(allocation.reservedQuantity);
        const quantity = node('div', 'fm-pick-confirmation-quantity');
        quantity.append(amount, node('span', 'fm-pick-confirmation-unit', unit));
        amountField.append(amountLabel, quantity);

        const reasonField = node('div', 'fm-pick-confirmation-field');
        const reasonLabel = node('label', 'fm-pick-confirmation-label', '拣货结果');
        const reason = node('select', 'fm-pick-confirmation-select');
        reason.id = `${form.id}-reason-${index}`;
        reasonLabel.htmlFor = reason.id;
        reason.setAttribute('aria-label', `${name}拣货结果`);
        for (const [value, text] of [['NORMAL', '正常'], ['WEIGHT_VARIANCE', '称重差异'], ['SHORTAGE', '缺货']] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = text;
            reason.append(option);
        }
        reasonField.append(reasonLabel, reason);

        const noteField = node('div', 'fm-pick-confirmation-field fm-pick-confirmation-note');
        const noteLabel = node('label', 'fm-pick-confirmation-label', '操作说明');
        const note = node('input', 'fm-pick-confirmation-input');
        note.type = 'text';
        note.id = `${form.id}-note-${index}`;
        noteLabel.htmlFor = note.id;
        note.setAttribute('aria-label', `${name}拣货原因`);
        note.value = '实际拣货确认';
        noteField.append(noteLabel, note);
        controls.append(amountField, reasonField, noteField);
        row.append(head, controls);
        fields.push({ allocation, quantity: amount, reason, note });
        list.append(row);
    });

    const help = node('aside', 'fm-pick-confirmation-help');
    help.append(
        node('strong', 'fm-pick-confirmation-help-title', '填写提示'),
        node('p', 'fm-pick-confirmation-help-text', '按件商品填件数，称重商品填克数。称重实拣数量不得超过估重的 110%；实拣数量为 0 时请选择“缺货”。提交时由服务器统一校验并结算。'),
    );
    form.append(list, help);
    form.addEventListener('submit', event => {
        event.preventDefault();
        onConfirm(fields.map(field => ({
            allocationId: field.allocation.allocationId,
            actualQuantity: Number(field.quantity.value),
            reasonCode: field.reason.value as Models['PickConfirmLine']['reasonCode'],
            reason: field.note.value,
        })));
    });

    const submit = node('button', 'fm-pick-confirmation-submit', '确认出库并结算');
    submit.type = 'submit';
    submit.setAttribute('form', form.id);
    footer.classList.add('fm-pick-confirmation-footer');
    body.append(form);
    footer.append(submit);
}
