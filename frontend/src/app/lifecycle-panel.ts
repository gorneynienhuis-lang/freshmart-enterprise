import { mall } from '../api/client';
import { ApiError } from '../api/errors';
import { formatMoney, hasPermission, type Models } from '../domain';
import { lifecycleService } from './lifecycle-service';
import '../styles/admin-panel.css';

export type LifecyclePanelOptions = {
    dialog: (title: string) => HTMLDialogElement;
    run: (action: () => Promise<void>) => Promise<void>;
    reload: () => Promise<void>;
};
type StaffOrder = Models['AdminOrder'] | Models['PickTask'];
const cancellable = new Set(['PENDING_PAY', 'PAID', 'PICKING', 'READY_TO_SHIP']);
const orderStates: Record<string, string> = { PENDING_PAY: '待付款', PAID: '已付款', PICKING: '拣货中', READY_TO_SHIP: '待发货', DELIVERING: '配送中', FINISHED: '已完成', CANCELED: '已取消', CLOSED: '已关闭' };
const refundStates: Record<Models['Refund']['status'], string> = { PENDING: '待授权', PROCESSING: '处理中', SUCCESS: '退款成功', FAILED: '退款失败' };
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
};
function button(label: string, action: () => void, tone = 'quiet') {
    const control = node('button', label, 'fm-management-button'); control.type = 'button'; control.onclick = action;
    if (tone) control.dataset.tone = tone;
    return control;
}
function message(dialog: HTMLDialogElement, text: string) { dialog.append(node('p', text, 'fm-management-note')); }
function noteField(label: string, name = 'reason') {
    const wrapper = node('label', undefined, 'fm-management-field fm-management-wide');
    const input = node('textarea'); input.name = name; input.required = true; input.maxLength = 500; input.rows = 3;
    input.oninput = () => input.setCustomValidity('');
    wrapper.append(node('span', label), input, node('small', '必填，最多 500 字；请描述处理依据，不填写密码等无关信息。'));
    return { wrapper, input };
}
function quantityField(label: string, name: string, maximum: number) {
    const wrapper = node('label', undefined, 'fm-management-field');
    const input = node('input'); input.type = 'number'; input.inputMode = 'numeric'; input.name = name;
    input.required = true; input.min = '0'; input.max = String(maximum); input.step = '1'; input.value = '0';
    input.oninput = () => input.setCustomValidity(''); wrapper.append(node('span', label), input);
    return { wrapper, input };
}
function reason(input: HTMLTextAreaElement) {
    input.setCustomValidity(input.value.trim() ? '' : '请填写有效处理说明。'); return input.reportValidity();
}
function integer(input: HTMLInputElement): number | null {
    const value = Number(input.value);
    input.setCustomValidity(/^\d+$/.test(input.value) && Number.isSafeInteger(value) && value >= 0 ? '' : '请输入非负安全整数。');
    return input.reportValidity() ? value : null;
}
function live(dialog: HTMLDialogElement, actor: string) { return dialog.isConnected && dialog.open && mall.auth.getSnapshot().user?.userId === actor; }
function formFor(dialog: HTMLDialogElement, label: string, options: LifecyclePanelOptions) {
    dialog.classList.add('fm-management-dialog');
    const form = node('form', undefined, 'fm-management-form');
    const footer = node('div', undefined, 'fm-management-form-actions fm-management-wide');
    const submit = node('button', label, 'fm-management-button'); submit.type = 'submit';
    const status = node('p', undefined, 'fm-management-note fm-management-wide'); status.setAttribute('role', 'status');
    footer.append(button('关闭', () => dialog.close()), button('刷新后重新处理', () => void options.run(async () => { dialog.close(); await options.reload(); })), submit);
    form.append(status, footer); dialog.append(form);
    return { form, footer, submit, status };
}
/** An ambiguous result never schedules another command; users must inspect current server state first. */
function submitCommand(form: HTMLFormElement, submit: HTMLButtonElement, status: HTMLElement, options: LifecyclePanelOptions, action: () => Promise<void>) {
    let uncertain = false;
    return () => {
        if (uncertain) return;
        void options.run(async () => {
            try { await action(); }
            catch (error) {
                if (error instanceof ApiError && (error.outcomeUnknown || error.status === 401)) {
                    uncertain = true; status.setAttribute('role', 'alert');
                    status.textContent = '本次请求结果未确认，已暂停再次提交。请关闭并刷新状态；系统不会自动重发或另建退款。';
                }
                throw error;
            }
        }).finally(() => {
            if (uncertain && form.isConnected) {
                submit.disabled = true;
                for (const input of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) input.disabled = true;
            }
        });
    };
}

/** A request assigns an independent SERVICE; it does not silently cancel, pause fulfillment, or move funds. */
export function appendMemberOrderActions(row: HTMLElement, order: Models['Order'], options: LifecyclePanelOptions): void {
    const user = mall.auth.getSnapshot().user;
    if (!user || !user.roles.includes('MEMBER') || !hasPermission(user, 'order.self.cancel')) return;
    const support = order.cancellationSupport;
    if (support) row.append(node('p', support.status === 'OPEN' ? '取消协助：已分派客服，等待处理。订单仍按当前进度履约；也可直接取消符合条件的订单。' : '取消协助：已结束，订单结果以当前状态为准。', 'fm-management-note'));
    if (order.allowedActions.includes('CANCEL') && cancellable.has(order.status) && support?.status !== 'OPEN')
        row.append(button('请求客服协助取消', () => openCancellationRequest(order, options)));
}
function openCancellationRequest(order: Models['Order'], options: LifecyclePanelOptions) {
    const actor = mall.auth.getSnapshot().user?.userId; if (!actor) return;
    const dialog = options.dialog('请求客服协助取消'); dialog.classList.add('fm-management-dialog'); message(dialog, '正在读取本人订单与取消协助状态…');
    void options.run(async () => {
        const current = await lifecycleService.order(order.orderId); if (!live(dialog, actor)) return;
        dialog.querySelector('.fm-management-note')?.remove();
        if (!cancellable.has(current.status) || !current.allowedActions.includes('CANCEL') || current.cancellationSupport?.status === 'OPEN') { message(dialog, '当前订单已不允许新建取消协助，或已有客服正在处理。请刷新订单。'); return; }
        message(dialog, `${current.orderNo} · ${orderStates[current.status]}。系统自动分派独立客服处理，仅创建协助请求，不立即取消或退款，也不冻结履约。发货前仍可自行取消；已发货后此请求自动结束。`);
        const { form, footer, submit, status } = formFor(dialog, '提交取消协助请求', options); const explanation = noteField('请求取消的原因'); form.insertBefore(explanation.wrapper, footer);
        const send = submitCommand(form, submit, status, options, async () => { await lifecycleService.requestCancellation(current.orderId, { reason: explanation.input.value.trim(), version: current.version }); dialog.close(); await options.reload(); });
        form.onsubmit = event => { event.preventDefault(); if (reason(explanation.input) && form.reportValidity()) send(); };
    });
}

/** Only member-owned collections should call this; staff projections carry an additional owner guard. */
export function appendAftersaleActions(row: HTMLElement, aftersale: Models['Aftersale'] | Models['AdminAftersale'], options: LifecyclePanelOptions): void {
    const user = mall.auth.getSnapshot().user;
    if (!user || !hasPermission(user, 'aftersale.self') || !user.roles.includes('MEMBER') || aftersale.status !== 'APPLIED') return;
    if ('memberId' in aftersale && aftersale.memberId !== user.userId) return;
    row.append(button('撤销售后申请', () => openAftersaleCancellation(aftersale, options), 'danger'));
}
function openAftersaleCancellation(aftersale: Models['Aftersale'], options: LifecyclePanelOptions) {
    const actor = mall.auth.getSnapshot().user?.userId; if (!actor) return;
    const dialog = options.dialog('撤销售后申请'); dialog.classList.add('fm-management-dialog');
    message(dialog, '正在读取本人售后当前状态…');
    void options.run(async () => {
        const current = await lifecycleService.aftersale(aftersale.aftersaleId); if (!live(dialog, actor)) return;
        dialog.querySelector('.fm-management-note')?.remove();
        if (current.status !== 'APPLIED') { message(dialog, '该售后已审核、处理或撤销，不能再次撤回。请刷新订单。'); return; }
        message(dialog, `申请金额 ${formatMoney(current.requestedAmount)}。撤回只关闭本次未审核申请，不取消订单、不执行退款。已领取但未审核的申请仍可由本人撤回。`);
        const { form, footer, submit, status } = formFor(dialog, '确认撤销售后', options); const explanation = noteField('撤回原因');
        form.insertBefore(explanation.wrapper, footer);
        const send = submitCommand(form, submit, status, options, async () => {
            await lifecycleService.cancelAftersale(current.aftersaleId, { reason: explanation.input.value.trim(), version: current.version });
            dialog.close(); await options.reload();
        });
        form.onsubmit = event => { event.preventDefault(); if (reason(explanation.input) && form.reportValidity()) send(); };
    });
}

/** A picker receives its own PickTask, never an unrestricted admin order or a manually typed task ID. */
export function appendAdminOrderActions(row: HTMLElement, order: StaffOrder, options: LifecyclePanelOptions): void {
    const user = mall.auth.getSnapshot().user; if (!user) return;
    if ('taskId' in order) {
        if (hasPermission(user, 'return.receive') && order.pickerId === user.userId && order.status === 'CANCELED'
            && order.allocations.some(allocation => allocation.pickedQuantity > allocation.returnedQuantity))
            row.append(button('登记取消订单实物回库', () => openReturnInspection(order, options)));
        return;
    }
    if (hasPermission(user, 'order.service.cancel') && user.roles.includes('SERVICE') && order.memberId !== user.userId
        && order.allowedActions.includes('CANCEL') && cancellable.has(order.status))
        row.append(button('代客取消订单', () => openServiceCancellation(order, options), 'danger'));
}
function openServiceCancellation(order: Models['AdminOrder'], options: LifecyclePanelOptions) {
    const actor = mall.auth.getSnapshot().user?.userId; if (!actor) return;
    const dialog = options.dialog('客服代客取消订单'); dialog.classList.add('fm-management-dialog'); message(dialog, '正在核验受派订单与当前状态…');
    void options.run(async () => {
        const current = await lifecycleService.adminOrder(order.orderId); if (!live(dialog, actor)) return;
        dialog.querySelector('.fm-management-note')?.remove();
        if (current.memberId === actor || !current.allowedActions.includes('CANCEL') || !cancellable.has(current.status)) { message(dialog, '当前状态或工单范围不允许代客取消，请刷新工作台。'); return; }
        message(dialog, `${current.orderNo} · ${orderStates[current.status]} · 已收 ${formatMoney(current.paidAmount)} / 已退 ${formatMoney(current.refundedAmount)}`);
        if (current.cancellationSupport?.status === 'OPEN') message(dialog, '会员取消请求：' + current.cancellationSupport.reason);
        message(dialog, '取消后停止履约，已收款按原支付单异步退款。已拣出的商品须由原拣货员实际收回并质检，取消不会直接增加可售库存。');
        const { form, footer, submit, status } = formFor(dialog, '确认代客取消', options); const explanation = noteField('取消依据与处理说明'); form.insertBefore(explanation.wrapper, footer);
        const send = submitCommand(form, submit, status, options, async () => {
            await lifecycleService.cancelOrder(current.orderId, { reason: explanation.input.value.trim(), version: current.version }); dialog.close(); await options.reload();
        });
        form.onsubmit = event => { event.preventDefault(); if (reason(explanation.input) && form.reportValidity()) send(); };
    });
}

function openReturnInspection(task: Models['PickTask'], options: LifecyclePanelOptions) {
    const actor = mall.auth.getSnapshot().user?.userId; if (!actor) return;
    const dialog = options.dialog('取消订单实物回库质检'); dialog.classList.add('fm-management-dialog'); message(dialog, '正在读取本人任务、批次与待回实物…');
    void options.run(async () => {
        const current = await lifecycleService.pickTask(task.taskId);
        if (!live(dialog, actor)) return;
        if (current.pickerId !== actor || current.status !== 'CANCELED') { message(dialog, '仅原拣货员可验收已取消订单的待回实物。请刷新任务。'); return; }
        const pending = current.allocations.filter(allocation => allocation.pickedQuantity > allocation.returnedQuantity);
        if (!pending.length) { message(dialog, '该任务已无待回实物，不需要再次登记。'); return; }
        const batches = new Map((await Promise.all([...new Set(pending.map(item => item.batchId))].map(async id => [id, await lifecycleService.batch(id)] as const))));
        if (!live(dialog, actor)) return;
        dialog.querySelector('.fm-management-note')?.remove();
        message(dialog, '逐商品、逐批次记录实际收到的数量。合格部分恢复可售，待检/破损部分进入隔离库存；尚未收回部分可以留待下次，不能凭退款直接回库。数量使用整数克或件。');
        const { form, footer, submit, status } = formFor(dialog, '确认质检回库', options);
        const editors: { allocation: Models['Allocation']; passed: HTMLInputElement; quarantined: HTMLInputElement; eligible: boolean }[] = [];
        for (const allocation of pending) {
            const item = current.items.find(line => line.orderItemId === allocation.orderItemId); const batch = batches.get(allocation.batchId)!;
            if (!item) throw new Error('任务缺少对应商品行，未提交任何回库，请刷新任务。');
            const unit = allocation.baseUnit === 'GRAM' ? '克' : '件'; const remaining = allocation.pickedQuantity - allocation.returnedQuantity;
            const group = node('fieldset', undefined, 'fm-management-roles fm-management-wide'); group.style.cssText = 'border:1px solid #E3E6EA;border-radius:6px;padding:16px;min-width:0';
            group.append(node('legend', `${item.productName} · ${allocation.batchNo}`), node('p', `已出库 ${allocation.pickedQuantity} ${unit} · 已验收 ${allocation.returnedQuantity} ${unit} · 待回 ${remaining} ${unit}`, 'fm-management-note'));
            const fields = node('div', undefined, 'fm-management-form');
            const passed = quantityField(`合格回库（${unit}）`, 'passed-' + allocation.allocationId, remaining);
            const quarantined = quantityField(`隔离回库（${unit}）`, 'quarantined-' + allocation.allocationId, remaining);
            fields.append(passed.wrapper, quarantined.wrapper); group.append(fields);
            const eligible = batch.lifecycle === 'NORMAL'; const expired = Date.parse(batch.expiresAt) <= Date.now();
            if (!eligible) { passed.input.disabled = true; quarantined.input.disabled = true; group.append(node('p', '该批次已隔离或报废，当前不能直接回库。请按仓储质检流程处理。', 'fm-management-note')); }
            else if (expired) { passed.input.disabled = true; group.append(node('p', '该批次已过期，只能登记隔离回库，不能恢复可售。', 'fm-management-note')); }
            editors.push({ allocation, passed: passed.input, quarantined: quarantined.input, eligible }); form.insertBefore(group, footer);
        }
        const explanation = noteField('实物验收与质检说明', 'inspectionNote'); form.insertBefore(explanation.wrapper, footer);
        let body: Models['ReturnReceiveRequest'];
        const send = submitCommand(form, submit, status, options, async () => { await lifecycleService.receiveReturn(current.orderId, body); dialog.close(); await options.reload(); });
        form.onsubmit = event => {
            event.preventDefault(); if (!reason(explanation.input) || !form.reportValidity()) return;
            const allocations: Models['ReturnAllocationInput'][] = [];
            for (const editor of editors) {
                if (!editor.eligible) continue;
                const passed = integer(editor.passed); const quarantined = integer(editor.quarantined); if (passed === null || quarantined === null) return;
                const total = passed + quarantined; const remaining = editor.allocation.pickedQuantity - editor.allocation.returnedQuantity;
                if (!Number.isSafeInteger(total) || total > remaining) { editor.quarantined.setCustomValidity(`本次合格与隔离合计不得超过待回的 ${remaining}。`); editor.quarantined.reportValidity(); return; }
                if (total > 0) allocations.push({ allocationId: editor.allocation.allocationId, passedQuantity: passed, quarantinedQuantity: quarantined });
            }
            if (!allocations.length) { explanation.input.setCustomValidity('请至少填写一条实际收到的合格或隔离数量。'); explanation.input.reportValidity(); return; }
            body = { allocations, inspectionNote: explanation.input.value.trim(), version: current.version }; send();
        };
    });
}

export function appendRefundActions(row: HTMLElement, refund: Models['AdminRefund'], options: LifecyclePanelOptions): void {
    const user = mall.auth.getSnapshot().user;
    if (!user || !user.roles.includes('FINANCE') || !hasPermission(user, 'refund.retry') || refund.status !== 'FAILED' || !refund.executorId || refund.reviewerId === user.userId) return;
    row.append(button('核验并重试原退款', () => openRefundRetry(refund, options), 'danger'));
}
function openRefundRetry(refund: Models['AdminRefund'], options: LifecyclePanelOptions) {
    const actor = mall.auth.getSnapshot().user?.userId; if (!actor) return;
    const dialog = options.dialog('核验失败退款'); dialog.classList.add('fm-management-dialog'); message(dialog, '正在读取退款当前状态与必要的订单财务信息…');
    void options.run(async () => {
        const [current, order] = await Promise.all([lifecycleService.refund(refund), lifecycleService.adminOrder(refund.orderId)]); if (!live(dialog, actor)) return;
        dialog.querySelector('.fm-management-note')?.remove();
        message(dialog, `原订单 ${order.orderNo} · 退款 ${formatMoney(current.amount)} · 当前${refundStates[current.status]}`);
        if (current.status !== 'FAILED' || !current.executorId) { message(dialog, '当前退款不是已授权的失败状态，不能重试。处理中或结果未知时请先查对账与渠道结果。'); return; }
        if (current.reviewerId === actor || order.memberId === actor) { message(dialog, '购买人或原审核人不能执行同一笔退款，请由独立财务处理。'); return; }
        if (current.lastError) message(dialog, '最近失败说明：' + current.lastError);
        message(dialog, '系统先核验原退款号的渠道回执，已有成功回执则补记结果；确认可重试时沿用同一原路退款号。这里不能改金额、收款账户或另建退款。');
        const { form, footer, submit, status } = formFor(dialog, '核验渠道并重试', options); const explanation = noteField('对账核验与重试依据'); form.insertBefore(explanation.wrapper, footer);
        const send = submitCommand(form, submit, status, options, async () => { await lifecycleService.retryRefund(current.refundId, { reason: explanation.input.value.trim(), version: current.version }); dialog.close(); await options.reload(); });
        form.onsubmit = event => { event.preventDefault(); if (reason(explanation.input) && form.reportValidity()) send(); };
    });
}
