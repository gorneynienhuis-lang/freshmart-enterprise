import { service } from './service';
import { formatMoney, hasPermission, type Models } from '../domain';
import '../styles/admin-panel.css';

type ManagementOptions = {
    dialog: (title: string) => HTMLDialogElement;
    run: (action: () => Promise<void>) => Promise<void>;
    reload: () => Promise<void>;
};
type Employee = Models['Employee'];
type Role = Models['Role'];
type RoleCode = Role['code'];
const roleNames: Record<RoleCode, string> = { MEMBER: '社区会员', PICKER: '拣货员', COURIER: '配送员', OPERATOR: '门店运营', SERVICE: '客服', FINANCE: '财务', ADMIN: '系统管理员' };
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
};
function action(label: string, callback: () => void, tone = '') {
    const node = create('button', label, 'fm-management-button');
    node.type = 'button';
    if (tone) node.dataset.tone = tone;
    node.onclick = callback;
    return node;
}
function field(label: string, name: string, type = 'text', hint = '') {
    const wrapper = create('label', undefined, 'fm-management-field');
    const caption = create('span', label);
    const input = create('input');
    input.type = type;
    input.name = name;
    input.required = true;
    wrapper.append(caption, input);
    if (hint) wrapper.append(create('small', hint));
    return { wrapper, input };
}
function reasonField() {
    const wrapper = create('label', undefined, 'fm-management-field fm-management-wide');
    const input = create('textarea');
    input.name = 'reason';
    input.required = true;
    input.maxLength = 500;
    input.rows = 3;
    wrapper.append(create('span', '操作原因'), input, create('small', '必填，最多 500 字；将随操作记录保存。'));
    input.oninput = () => input.setCustomValidity('');
    return { wrapper, input };
}
function nonblank(input: HTMLInputElement | HTMLTextAreaElement) {
    input.setCustomValidity(input.value.trim() ? '' : '请填写有效内容，不能只输入空格。');
    return input.reportValidity();
}
function roleFields(roles: Role[], selected: readonly RoleCode[] = []) {
    const container = create('fieldset', undefined, 'fm-management-roles fm-management-wide');
    container.append(create('legend', '分配角色'), create('p', '至少选择一个员工岗位。购物权限需额外勾选「社区会员」。', 'fm-management-note'));
    const choices = create('div', undefined, 'fm-management-role-choices');
    const checks: { input: HTMLInputElement; code: RoleCode }[] = [];
    for (const role of roles) {
        const label = create('label', undefined, 'fm-management-role-option');
        const input = create('input');
        input.type = 'checkbox'; input.name = 'roles'; input.value = role.code; input.checked = selected.includes(role.code);
        const text = create('span');
        text.append(create('strong', roleNames[role.code]), create('small', role.description));
        label.append(input, text); choices.append(label); checks.push({ input, code: role.code });
        input.onchange = () => { for (const check of checks) check.input.setCustomValidity(''); };
    }
    container.append(choices);
    return {
        container,
        values: (): RoleCode[] | null => {
            const values = checks.filter(check => check.input.checked).map(check => check.code);
            if (!values.some(code => code !== 'MEMBER')) {
                const first = checks[0]?.input;
                if (first) { first.setCustomValidity('请选择至少一个员工岗位，不能只分配会员角色。'); first.reportValidity(); }
                return null;
            }
            return values;
        },
    };
}
function dialogForm(dialog: HTMLDialogElement, submitLabel: string) {
    dialog.classList.add('fm-management-dialog');
    const form = create('form', undefined, 'fm-management-form');
    const footer = create('div', undefined, 'fm-management-form-actions fm-management-wide');
    const submit = create('button', submitLabel, 'fm-management-button');
    submit.type = 'submit';
    footer.append(action('取消', () => dialog.close(), 'quiet'), submit);
    form.append(footer);
    dialog.append(form);
    return { form, footer };
}
function businessDate() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function displayTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(date);
}

/** Server-authorized management projections. This never grants client-side permissions. */
export async function renderManagement(main: HTMLElement, options: ManagementOptions): Promise<void> {
    const user = service.auth.getSnapshot().user;
    if (!user) return;
    const { dialog, run, reload } = options;
    const tasks: Promise<void>[] = [];

    if (hasPermission(user, 'dashboard.read')) {
        const section = create('section', undefined, 'fm-management-section');
        section.setAttribute('aria-label', '经营概览');
        const heading = create('div', undefined, 'fm-management-heading');
        const title = create('div'); title.append(create('p', 'STORE OVERVIEW', 'fm-management-eyebrow'), create('h2', '经营概览'));
        const form = create('form', undefined, 'fm-management-date-filter');
        const date = field('业务日期', 'businessDate', 'date'); date.input.value = businessDate();
        const submit = create('button', '查询', 'fm-management-button'); submit.type = 'submit';
        form.append(date.wrapper, submit); heading.append(title, form);
        const content = create('div');
        section.append(heading, content); main.append(section);
        let revision = 0;
        const load = async (requestedDate: string) => {
            const current = ++revision;
            const overview = await service.dashboard(requestedDate);
            if (current !== revision || !section.isConnected) return;
            const cards = create('div', undefined, 'fm-management-metrics');
            const metrics: { title: string; value: number | null; currency?: boolean; hint: string }[] = [
                { title: '已支付订单', value: overview.paidOrderCount, hint: '所选业务日成功付款的订单' },
                { title: '支付入账', value: overview.capturedPaymentAmount, currency: true, hint: '成功支付的沙箱资金' },
                { title: '成功退款', value: overview.successfulRefundAmount, currency: true, hint: '已成功执行的退款' },
                { title: '净收款', value: overview.netCollectedAmount, currency: true, hint: '支付入账减去成功退款' },
                { title: '待拣货任务', value: overview.pendingPickCount, hint: '当前待处理任务' },
                { title: '临期批次', value: overview.nearExpiryBatchCount, hint: '当前库存批次' },
                { title: '低库存规格', value: overview.lowStockSkuCount, hint: '当前库存预警' },
            ];
            for (const metric of metrics) {
                const card = create('article', undefined, 'fm-management-metric');
                const value = metric.value === null ? '未授权' : metric.currency ? formatMoney(metric.value) : String(metric.value);
                if (metric.value === null) card.dataset.unavailable = 'true';
                card.append(create('span', metric.title), create('strong', value), create('small', metric.value === null ? '当前岗位不提供此数据' : metric.hint));
                cards.append(card);
            }
            content.replaceChildren(cards, create('p', `业务日期 ${overview.businessDate} · 更新于 ${displayTime(overview.generatedAt)} · 沙箱支付，不产生真实扣款`, 'fm-management-note'));
        };
        form.onsubmit = event => { event.preventDefault(); if (form.reportValidity()) void run(() => load(date.input.value)); };
        tasks.push(load(date.input.value));
    }

    if (hasPermission(user, 'employee.read')) {
        const section = create('section', undefined, 'fm-management-section');
        section.setAttribute('aria-label', '员工与权限');
        const heading = create('div', undefined, 'fm-management-heading');
        const title = create('div'); title.append(create('p', 'TEAM & ACCESS', 'fm-management-eyebrow'), create('h2', '员工与权限'));
        const tools = create('div', undefined, 'fm-management-actions');
        heading.append(title, tools);
        const content = create('div');
        section.append(heading, create('p', '员工身份与购物权限独立。角色及停用操作由服务端校验并记录；当前账户不能在此修改自身权限或状态。', 'fm-management-note'), content);
        main.append(section);
        let roles: Role[] = [];
        let revision = 0;
        const rolesDialog = (employee: Employee) => {
            const popup = dialog('调整员工角色');
            popup.append(create('p', `${employee.displayName} · ${employee.phoneMasked} · 当前版本 ${employee.version}`, 'fm-management-note'));
            const { form, footer } = dialogForm(popup, '保存角色');
            const choices = roleFields(roles, employee.roles);
            const reason = reasonField();
            form.insertBefore(choices.container, footer); form.insertBefore(reason.wrapper, footer);
            form.onsubmit = event => { event.preventDefault(); const values = choices.values(); if (!values || !nonblank(reason.input) || !form.reportValidity()) return;
                void run(async () => { await service.employeeRoles(employee.employeeId, { roles: values, reason: reason.input.value.trim(), version: employee.version }); popup.close(); await reload(); });
            };
        };
        const statusDialog = (employee: Employee) => {
            const next = employee.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
            const label = next === 'DISABLED' ? '停用' : '启用';
            const popup = dialog(label + '员工账户');
            popup.append(create('p', `即将${label} ${employee.displayName}（${employee.phoneMasked}）。当前版本 ${employee.version}。${next === 'DISABLED' ? '停用后该账户无法继续访问系统。' : '启用后员工仍须使用有效密码登录。'}`, 'fm-management-note'));
            const { form, footer } = dialogForm(popup, '确认' + label);
            const reason = reasonField(); form.insertBefore(reason.wrapper, footer);
            form.onsubmit = event => { event.preventDefault(); if (!nonblank(reason.input) || !form.reportValidity()) return;
                void run(async () => { await service.employeeStatus(employee.employeeId, { status: next, reason: reason.input.value.trim(), version: employee.version }); popup.close(); await reload(); });
            };
        };
        const load = async (page: number) => {
            const current = ++revision;
            const employees = await service.employees(page);
            if (current !== revision || !section.isConnected) return;
            const scroll = create('div', undefined, 'fm-management-table-scroll');
            scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', '员工列表，可横向滚动');
            const table = create('table', undefined, 'fm-management-table');
            const caption = create('caption', `员工列表，第 ${employees.page} 页，每页 ${employees.size} 人，共 ${employees.total} 人`); caption.className = 'fm-management-sr-only';
            const head = create('thead'); const row = create('tr');
            for (const label of ['员工', '岗位角色', '账户状态', '首次改密', '版本', '操作']) { const th = create('th', label); th.scope = 'col'; row.append(th); }
            head.append(row); table.append(caption, head);
            const body = create('tbody');
            for (const employee of employees.items) {
                const tr = create('tr');
                const name = create('td');
                name.append(create('strong', employee.displayName), create('small', employee.phoneMasked));
                const own = employee.userId === user.userId;
                if (own) name.append(create('span', '当前账户', 'fm-management-own'));
                const roleCell = create('td'); const chips = create('div', undefined, 'fm-management-role-tags');
                for (const code of employee.roles) chips.append(create('span', roleNames[code], 'fm-management-role-tag'));
                roleCell.append(chips);
                const status = create('td'); const badge = create('span', employee.status === 'ACTIVE' ? '已启用' : '已停用', 'fm-management-status'); badge.dataset.status = employee.status; status.append(badge);
                const password = create('td', employee.mustChangePassword ? '待首次改密' : '已设置');
                const version = create('td', String(employee.version));
                const controls = create('td'); const actions = create('div', undefined, 'fm-management-actions');
                if (hasPermission(user, 'employee.roles')) {
                    const edit = action('调整角色', () => rolesDialog(employee), 'quiet'); edit.disabled = own; edit.setAttribute('aria-label', `调整 ${employee.displayName} 的角色`); if (own) edit.title = '不能修改当前账户的角色'; actions.append(edit);
                }
                if (hasPermission(user, 'employee.status')) {
                    const edit = action(employee.status === 'ACTIVE' ? '停用' : '启用', () => statusDialog(employee), employee.status === 'ACTIVE' ? 'danger' : 'quiet'); edit.disabled = own; edit.setAttribute('aria-label', `${employee.status === 'ACTIVE' ? '停用' : '启用'} ${employee.displayName} 的账户`); if (own) edit.title = '不能修改当前账户的状态'; actions.append(edit);
                }
                controls.append(actions); tr.append(name, roleCell, status, password, version, controls); body.append(tr);
            }
            if (!employees.items.length) { const empty = create('tr'); const cell = create('td', '暂无员工记录'); cell.colSpan = 6; cell.className = 'fm-management-empty'; empty.append(cell); body.append(empty); }
            table.append(body); scroll.append(table);
            const pages = Math.max(1, Math.ceil(employees.total / employees.size));
            const pagination = create('nav', undefined, 'fm-management-pagination'); pagination.setAttribute('aria-label', '员工分页');
            const previous = action('上一页', () => { void run(() => load(Math.max(1, employees.page - 1))); }, 'quiet'); previous.disabled = employees.page <= 1;
            const next = action('下一页', () => { void run(() => load(employees.page + 1)); }, 'quiet'); next.disabled = employees.page >= pages;
            const count = create('span', `共 ${employees.total} 人 · 第 ${employees.page} / ${pages} 页 · 每页 ${employees.size} 人`); count.setAttribute('aria-live', 'polite');
            pagination.append(count, previous, next); content.replaceChildren(scroll, pagination);
        };
        tools.append(action('刷新列表', () => { void run(() => load(1)); }, 'quiet'));
        const initial = async () => {
            roles = (await service.roles()).items;
            if (hasPermission(user, 'employee.create')) tools.prepend(action('新增员工', () => {
                const popup = dialog('新增员工');
                popup.append(create('p', '请通过安全方式交付临时密码。员工首次登录后必须修改密码，页面不会回显密码。', 'fm-management-note'));
                const { form, footer } = dialogForm(popup, '创建员工');
                const name = field('员工姓名', 'displayName'); name.input.maxLength = 60; name.input.autocomplete = 'off'; name.input.oninput = () => name.input.setCustomValidity('');
                const phone = field('手机号', 'phone', 'tel'); phone.input.pattern = '1[3-9][0-9]{9}'; phone.input.maxLength = 11; phone.input.autocomplete = 'off'; phone.input.inputMode = 'tel';
                const password = field('临时密码', 'temporaryPassword', 'password', '12–128 位，仅用于首次登录；请勿重复使用其他账户密码。'); password.input.minLength = 12; password.input.maxLength = 128; password.input.autocomplete = 'new-password'; password.input.spellcheck = false; password.wrapper.classList.add('fm-management-wide');
                popup.addEventListener('close', () => { password.input.value = ''; });
                const choices = roleFields(roles);
                for (const node of [name.wrapper, phone.wrapper, password.wrapper, choices.container]) form.insertBefore(node, footer);
                form.onsubmit = event => { event.preventDefault(); const values = choices.values(); if (!values || !nonblank(name.input) || !form.reportValidity()) return;
                    void run(async () => { await service.createEmployee({ displayName: name.input.value.trim(), phone: phone.input.value.trim(), temporaryPassword: password.input.value, roles: values }); password.input.value = ''; popup.close(); await reload(); });
                };
            }));
            await load(1);
        };
        tasks.push(initial());
    }
    await Promise.all(tasks);
}
