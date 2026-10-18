import { mall } from '../api/client';
import { hasPermission, type Models } from '../domain';
import { fulfillmentService } from './fulfillment-service';
import '../styles/admin-panel.css';

export type FulfillmentPanelOptions = {
    dialog: (title: string) => HTMLDialogElement;
    run: (action: () => Promise<void>) => Promise<void>;
    reload: () => Promise<void>;
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
function button(text: string, act: () => void, tone = '') {
    const control = node('button', text, 'fm-management-button'); control.type = 'button'; control.onclick = act;
    if (tone) control.dataset.tone = tone;
    return control;
}
function reasonField(label = '处理原因') {
    const wrapper = node('label', undefined, 'fm-management-field fm-management-wide');
    const input = node('textarea'); input.name = 'reason'; input.rows = 3; input.required = true; input.maxLength = 500;
    input.oninput = () => input.setCustomValidity('');
    wrapper.append(node('span', label), input, node('small', '必填，最多 500 字；请勿填写密码或与处理无关的个人信息。'));
    return { wrapper, input };
}
function validReason(input: HTMLTextAreaElement) {
    input.setCustomValidity(input.value.trim() ? '' : '请填写有效处理原因。');
    return input.reportValidity();
}
function formFor(dialog: HTMLDialogElement, label: string) {
    dialog.classList.add('fm-management-dialog');
    const form = node('form', undefined, 'fm-management-form');
    const footer = node('div', undefined, 'fm-management-form-actions fm-management-wide');
    const submit = node('button', label, 'fm-management-button'); submit.type = 'submit';
    footer.append(button('取消', () => dialog.close(), 'quiet'), submit); form.append(footer); dialog.append(form);
    return { form, footer };
}
function localTime(value: string) {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
}
function styleSelect(select: HTMLSelectElement) {
    select.style.cssText = 'width:100%;min-width:0;min-height:39px;border:1px solid #D9DEE5;border-radius:5px;padding:8px 10px;background:#FFF;color:#434B55;font:inherit;font-size:13px';
}

/** Public task rows remain masked. Contact data exists only in one short-lived dialog. */
export function appendDeliveryActions(row: HTMLElement, task: Models['DeliveryTask'], options: FulfillmentPanelOptions): void {
    const user = mall.auth.getSnapshot().user;
    if (!user) return;
    const actions = node('div', undefined, 'fm-management-actions');
    const own = task.courierId === user.userId;
    if (own && task.status === 'DELIVERING' && hasPermission(user, 'delivery.contact.access'))
        actions.append(button('按需查看收货信息', () => openContactDialog(task, options), 'quiet'));
    if (own && task.status === 'DELIVERING' && hasPermission(user, 'delivery.exception'))
        actions.append(button('上报配送异常', () => openExceptionDialog(task, options), 'quiet'));
    if (task.status === 'EXCEPTION' && hasPermission(user, 'delivery.exception.resolve'))
        actions.append(button('处理配送异常', () => openResolutionDialog(task, options)));
    if (actions.childElementCount) row.append(actions);
}

function openContactDialog(task: Models['DeliveryTask'], options: FulfillmentPanelOptions) {
    const dialog = options.dialog('按需查看收货信息');
    dialog.append(node('p', '仅用于本次配送联系。系统实时验证本人任务与配送状态，并记录访问。关闭、切换页面或账户后立即清除。', 'fm-management-note'));
    const { form, footer } = formFor(dialog, '验证并查看联系信息');
    const purpose = node('p', '访问用途：配送联系', 'fm-management-note fm-management-wide');
    const reason = reasonField('访问理由');
    const privateArea = node('section', undefined, 'fm-management-wide'); privateArea.setAttribute('aria-label', '本次配送联系信息');
    privateArea.style.overflowWrap = 'anywhere';
    form.insertBefore(purpose, footer); form.insertBefore(reason.wrapper, footer); dialog.append(privateArea);
    const abort = new AbortController(), listeners = new AbortController();
    let wiped = false, observer: MutationObserver | undefined, unsubscribe: (() => void) | undefined;
    const clear = () => {
        if (wiped) return; wiped = true; abort.abort(); listeners.abort(); observer?.disconnect(); unsubscribe?.();
        privateArea.replaceChildren(); form.reset();
    };
    dialog.addEventListener('close', clear, { once: true }); dialog.addEventListener('cancel', clear, { once: true });
    window.addEventListener('hashchange', () => { clear(); if (dialog.open) dialog.close(); }, { signal: listeners.signal });
    window.addEventListener('pagehide', clear, { signal: listeners.signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { clear(); if (dialog.open) dialog.close(); } }, { signal: listeners.signal });
    unsubscribe = mall.auth.subscribe(() => { clear(); if (dialog.open) dialog.close(); });
    observer = new MutationObserver(() => { if (!dialog.isConnected) clear(); }); observer.observe(document.body, { childList: true });
    form.onsubmit = event => {
        event.preventDefault(); if (wiped || !validReason(reason.input) || !form.reportValidity()) return;
        void options.run(async () => {
            let contact: Models['DeliveryContact'] | null = await fulfillmentService.contact(task.taskId, { purpose: 'DELIVERY_CONTACT', reason: reason.input.value.trim(), version: task.version }, abort.signal);
            if (wiped || !dialog.isConnected || !dialog.open) { contact = null; return; }
            const details = node('dl');
            for (const [label, value] of [['收货人', contact.recipientName], ['联系电话', contact.phone], ['配送地址', contact.addressDetail]]) {
                details.append(node('dt', label), node('dd', value));
            }
            privateArea.replaceChildren(details, button('关闭并清除', () => { clear(); dialog.close(); }, 'quiet'));
            contact = null;
            form.reset(); form.remove();
        });
    };
}

function openExceptionDialog(task: Models['DeliveryTask'], options: FulfillmentPanelOptions) {
    const dialog = options.dialog('上报配送异常');
    dialog.append(node('p', '上报后暂停签收及完整联系信息访问，并分派给独立客服。原配送员保留，订单不会自动退款或回库存。', 'fm-management-note'));
    const { form, footer } = formFor(dialog, '提交异常并通知客服');
    const type = node('label', undefined, 'fm-management-field fm-management-wide'); type.append(node('span', '异常类型'));
    const select = node('select'); select.name = 'exceptionType'; select.required = true; select.setAttribute('aria-label', '异常类型');
    styleSelect(select);
    const labels: Record<Models['DeliveryExceptionRequest']['type'], string> = { RECIPIENT_UNREACHABLE: '联系不上收货人', DAMAGED: '商品或包装破损', DELAYED: '配送延误', OTHER: '其他异常' };
    for (const [value, text] of Object.entries(labels)) { const option = node('option', text); option.value = value; select.append(option); }
    type.append(select); const reason = reasonField('异常事实与原因'); form.insertBefore(type, footer); form.insertBefore(reason.wrapper, footer);
    form.onsubmit = event => { event.preventDefault(); if (!validReason(reason.input) || !form.reportValidity()) return;
        void options.run(async () => { await fulfillmentService.reportException(task.taskId, { type: select.value as Models['DeliveryExceptionRequest']['type'], reason: reason.input.value.trim(), version: task.version }); dialog.close(); await options.reload(); });
    };
}
function openResolutionDialog(task: Models['DeliveryTask'], options: FulfillmentPanelOptions) {
    const dialog = options.dialog('处理配送异常');
    dialog.append(node('p', '仅处理分派给本人的异常工单。恢复后由原配送员继续配送，真正签收仍需有效签收码；此处不更换配送员，也不改变收退款与库存。', 'fm-management-note'));
    const { form, footer } = formFor(dialog, '恢复原配送任务'); const reason = reasonField('处理经过与恢复依据'); form.insertBefore(reason.wrapper, footer);
    form.onsubmit = event => { event.preventDefault(); if (!validReason(reason.input) || !form.reportValidity()) return;
        void options.run(async () => { await fulfillmentService.resolveException(task.taskId, { reason: reason.input.value.trim(), expectedVersion: task.version }); dialog.close(); await options.reload(); });
    };
}

type AllocationEditor = { line: HTMLElement; batch: HTMLSelectElement; quantity: HTMLInputElement };
type ItemEditor = { item: Models['OrderItem']; block: HTMLFieldSetElement; rows: HTMLElement; fields: AllocationEditor[]; batches: Models['Batch'][] };
const MAX_SAFE = Number.MAX_SAFE_INTEGER;
function exactPositive(input: HTMLInputElement): number | null {
    input.setCustomValidity('');
    if (!/^[1-9][0-9]*$/.test(input.value) || BigInt(input.value) > BigInt(MAX_SAFE)) {
        input.setCustomValidity('请输入安全范围内的正整数基础数量。'); input.reportValidity(); return null;
    }
    return Number(input.value);
}
/** Structured line/batch controls; the backend remains authoritative for FEFO and stock. */
export function openReallocateDialog(task: Models['PickTask'], options: FulfillmentPanelOptions): void {
    const user = mall.auth.getSnapshot().user;
    const dialog = options.dialog('显式重分配库存批次');
    if (!user || !hasPermission(user, 'pick.reallocate') || task.pickerId !== user.userId || task.status !== 'CLAIMED') {
        dialog.append(node('p', '仅本人已领取且未出库的拣货任务可以重分配。', 'fm-management-note')); return;
    }
    dialog.append(node('p', '保持每个订单行原有数量，按基础单位分配。系统按 FEFO、配送结束前有效与原成交规则复核；未通过时整笔回滚。此操作不改变商品价格、不扣减实物库存。', 'fm-management-note'));
    const loading = node('p', '正在读取该任务商品的真实库存批次…', 'fm-management-note'); dialog.append(loading);
    void options.run(async () => {
        const bySku = new Map<string, Models['Batch'][]>();
        await Promise.all([...new Set(task.items.map(item => item.skuId))].map(async sku => bySku.set(sku, await fulfillmentService.batches(sku))));
        if (!dialog.isConnected || !dialog.open) return; loading.remove();
        const { form, footer } = formFor(dialog, '确认原子重分配');
        const ownReserved = new Map<string, number>();
        for (const allocation of task.allocations) ownReserved.set(allocation.batchId, (ownReserved.get(allocation.batchId) ?? 0) + allocation.reservedQuantity);
        const eligible = (batch: Models['Batch']) => batch.lifecycle === 'NORMAL' && Date.parse(batch.receivedAt) <= Date.now() && Date.parse(batch.expiresAt) > Math.max(Date.now(), Date.parse(task.slot.endAt));
        const capacity = (batch: Models['Batch']) => batch.available + (ownReserved.get(batch.batchId) ?? 0);
        const editors: ItemEditor[] = [];
        const addRow = (editor: ItemEditor, batchId = '', quantity = '') => {
            const line = node('div', undefined, 'fm-management-actions'); line.style.alignItems = 'flex-end'; line.style.marginBottom = '10px';
            const batchField = node('label', undefined, 'fm-management-field'); batchField.style.flex = '1 1 200px'; batchField.style.minWidth = '0'; batchField.append(node('span', '目标库存批次'));
            const select = node('select'); select.required = true; select.setAttribute('aria-label', `${editor.item.productName}目标批次`); select.style.maxWidth = '100%';
            styleSelect(select);
            const blank = node('option', '请选择批次'); blank.value = ''; select.append(blank);
            for (const batch of editor.batches) {
                const label = `${batch.batchNo} · 可用 ${batch.available}${batch.baseUnit === 'GRAM' ? '克' : '件'} · 本单预占 ${ownReserved.get(batch.batchId) ?? 0} · 到期 ${localTime(batch.expiresAt)}${eligible(batch) ? '' : ' · 不符合本次配送'}`;
                const option = node('option', label); option.value = batch.batchId; option.disabled = !eligible(batch); select.append(option);
            }
            if (batchId && !editor.batches.some(batch => batch.batchId === batchId)) { const option = node('option', '原批次已不可读取，请选择合格批次'); option.value = batchId; option.disabled = true; select.append(option); }
            select.value = batchId; select.onchange = () => select.setCustomValidity(''); batchField.append(select);
            const quantityField = node('label', undefined, 'fm-management-field'); quantityField.style.flex = '0 1 110px'; quantityField.append(node('span', editor.item.baseUnit === 'GRAM' ? '分配重量（克）' : '分配数量（件）'));
            const amount = node('input'); amount.type = 'number'; amount.min = '1'; amount.max = String(MAX_SAFE); amount.step = '1'; amount.required = true; amount.value = quantity; amount.setAttribute('aria-label', `${editor.item.productName}分配数量`); amount.oninput = () => amount.setCustomValidity(''); quantityField.append(amount);
            const entry: AllocationEditor = { line, batch: select, quantity: amount }; editor.fields.push(entry);
            line.append(batchField, quantityField, button('移除此分配', () => { editor.fields = editor.fields.filter(field => field !== entry); line.remove(); }, 'quiet')); editor.rows.append(line);
        };
        for (const item of task.items) {
            const block = node('fieldset', undefined, 'fm-management-wide'); block.style.minWidth = '0'; block.style.border = '1px solid #E3E6EA'; block.style.borderRadius = '6px'; block.style.padding = '14px';
            const unit = item.baseUnit === 'GRAM' ? '克' : '件'; block.append(node('legend', item.productName), node('p', `SKU ${item.skuId} · 本行必须分配 ${item.quantity} ${unit}`, 'fm-management-note'));
            const current = task.allocations.filter(allocation => allocation.orderItemId === item.orderItemId);
            block.append(node('p', '当前分配：' + current.map(allocation => `${allocation.batchNo} / ${allocation.reservedQuantity}${unit}`).join('；'), 'fm-management-note'));
            const rows = node('div'); block.append(rows);
            const editor: ItemEditor = { item, block, rows, fields: [], batches: (bySku.get(item.skuId) ?? []).sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.batchId.localeCompare(b.batchId)) }; editors.push(editor);
            for (const allocation of current) addRow(editor, allocation.batchId, String(allocation.reservedQuantity));
            block.append(button('新增批次分配', () => addRow(editor), 'quiet')); form.insertBefore(block, footer);
        }
        const suggest = button('按当前库存填入 FEFO 建议', () => void options.run(async () => {
            const suggestions = editors.map(editor => {
                let remaining = editor.item.quantity; const proposal: { batchId: string; quantity: number }[] = [];
                for (const batch of editor.batches.filter(eligible)) { const take = Math.min(remaining, capacity(batch)); if (take > 0) { proposal.push({ batchId: batch.batchId, quantity: take }); remaining -= take; } if (!remaining) break; }
                if (remaining) throw new Error(`${editor.item.productName}当前合格库存不足，不能生成完整建议。`);
                return { editor, proposal };
            });
            for (const { editor, proposal } of suggestions) {
                editor.rows.replaceChildren(); editor.fields = []; for (const line of proposal) addRow(editor, line.batchId, String(line.quantity));
            }
        }), 'quiet');
        const guidance = node('div', undefined, 'fm-management-wide'); guidance.append(suggest, node('p', '建议只使用当前读取的批次数量，可能因库存变化或临期成交规则被后端拒绝。请核对后提交；不能用手工跳过合格早到期批次来绕开 FEFO。', 'fm-management-note')); form.insertBefore(guidance, form.firstChild);
        const reason = reasonField('重分配原因'); form.insertBefore(reason.wrapper, footer);
        form.onsubmit = event => {
            event.preventDefault(); if (!validReason(reason.input) || !form.reportValidity()) return;
            const allocations: Models['ReallocateLine'][] = [];
            for (const editor of editors) {
                let total = 0; const selected = new Set<string>();
                if (!editor.fields.length) { reason.input.setCustomValidity('每个订单行至少保留一条完整分配。'); reason.input.reportValidity(); return; }
                for (const field of editor.fields) {
                    const batch = editor.batches.find(batch => batch.batchId === field.batch.value); field.batch.setCustomValidity('');
                    if (!batch || !eligible(batch) || selected.has(batch.batchId)) { field.batch.setCustomValidity('请选择合格且不重复的库存批次。'); field.batch.reportValidity(); return; }
                    const quantity = exactPositive(field.quantity); if (quantity === null) return; total += quantity;
                    if (!Number.isSafeInteger(total)) { field.quantity.setCustomValidity('数量合计超出安全范围。'); field.quantity.reportValidity(); return; }
                    selected.add(batch.batchId); allocations.push({ orderItemId: editor.item.orderItemId, batchId: batch.batchId, quantity });
                }
                if (total !== editor.item.quantity) { const field = editor.fields[0]!; field.quantity.setCustomValidity(`本行分配合计须为 ${editor.item.quantity}${editor.item.baseUnit === 'GRAM' ? '克' : '件'}，当前为 ${total}。`); field.quantity.reportValidity(); return; }
            }
            if (allocations.length > 200) { reason.input.setCustomValidity('最多提交 200 条批次分配。'); reason.input.reportValidity(); return; }
            void options.run(async () => { await fulfillmentService.reallocate(task.taskId, { allocations, reason: reason.input.value.trim(), version: task.version }); dialog.close(); await options.reload(); });
        };
    });
}
