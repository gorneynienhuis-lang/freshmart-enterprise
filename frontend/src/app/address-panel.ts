import { mall } from '../api/client';
import { ApiError } from '../api/errors';
import type { Models } from '../domain';
import { createOwnAddress, deleteOwnAddress, listOwnAddresses, makeOwnAddressDefault, updateOwnAddress } from './address-service';
import '../styles/admin-panel.css';
import '../styles/address-panel.css';

type Address = Models['Address'];
export type AddressManagerOptions = {
    run: (action: () => Promise<void>) => Promise<void>;
    notify?: (message: string) => void;
    onChanged?: () => void | Promise<void>;
};
const create = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
    const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
};
function action(text: string, callback: () => void, tone = 'quiet') {
    const node = create('button', text, 'fm-management-button'); node.type = 'button'; node.dataset.tone = tone; node.onclick = callback; return node;
}
function field(label: string, name: string, value = '', maxLength = 30, autocomplete: HTMLInputElement['autocomplete'] = '') {
    const wrapper = create('label', undefined, 'fm-management-field'); const input = create('input');
    input.name = name; input.value = value; input.required = true; input.maxLength = maxLength; input.autocomplete = autocomplete;
    input.oninput = () => input.setCustomValidity(''); wrapper.append(create('span', label), input); return { wrapper, input };
}

/** Mount in a dedicated connected container. All reads and mutations use the authenticated SELF projection. */
export async function renderAddressManager(container: HTMLElement, options: AddressManagerOptions): Promise<void> {
    const owner = mall.auth.getSnapshot().user;
    if (!owner?.roles.includes('MEMBER')) { container.replaceChildren(create('p', '请使用会员账户登录后管理本人收货地址。', 'fm-management-note')); return; }
    const section = create('section', undefined, 'fm-management-section fm-address-manager'); section.setAttribute('aria-label', '收货地址管理');
    const head = create('div', undefined, 'fm-management-heading'); const title = create('div'); title.append(create('p', 'DELIVERY ADDRESS', 'fm-management-eyebrow'), create('h2', '我的收货地址'));
    const tools = create('div', undefined, 'fm-management-actions'); head.append(title, tools);
    const status = create('p', '正在读取本人地址…', 'fm-management-note'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const editor = create('div', undefined, 'fm-address-editor'); const list = create('div', undefined, 'fm-address-list');
    section.append(head, create('p', '可编辑收货信息、设置默认地址或删除不用的地址。配送范围由服务端校验，已下单订单保留原收货快照。', 'fm-management-note'), status, editor, list);
    container.replaceChildren(section);
    let disposed = false; let busy = false; let revision = 0; let addresses: Address[] = [];
    let observer: MutationObserver | undefined;
    const currentOwner = () => !disposed && mall.auth.getSnapshot().user?.userId === owner.userId && section.isConnected;
    const unsubscribe = mall.auth.subscribe(() => {
        if (mall.auth.getSnapshot().user?.userId !== owner.userId) {
            disposed = true; addresses = []; editor.replaceChildren(); list.replaceChildren(); status.textContent = '账户已变更，请重新打开地址管理。'; tools.replaceChildren(); observer?.disconnect(); unsubscribe();
        }
    });
    observer = new MutationObserver(() => { if (!section.isConnected) { disposed = true; addresses = []; editor.replaceChildren(); list.replaceChildren(); observer?.disconnect(); unsubscribe(); } });
    observer.observe(document.body, { childList: true, subtree: true });
    const controls = () => section.querySelectorAll<HTMLButtonElement>('button');
    const lock = (value: boolean) => { busy = value; for (const button of controls()) button.disabled = value; };
    const load = async () => {
        const generation = ++revision; const result = await listOwnAddresses();
        if (!currentOwner() || generation !== revision) return;
        addresses = result.items; renderList(); status.textContent = addresses.length ? `已保存 ${addresses.length} 个地址${addresses.some(address => address.isDefault) ? '，默认地址已标记。' : '。'}` : '已读取本人地址。';
    };
    const perform = async (operation: () => Promise<unknown>, message: string) => {
        if (busy || !currentOwner()) return;
        lock(true);
        try {
            await operation(); if (!currentOwner()) return;
            editor.replaceChildren(); await load(); if (!currentOwner()) return;
            status.textContent = message; options.notify?.(message); await options.onChanged?.();
        } catch (error) {
            if (currentOwner()) {
                if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
                    await load(); editor.replaceChildren(create('p', error.status === 409 ? '地址已在其他窗口变更。已读取最新列表，请重新编辑或确认；刚才的操作没有覆盖新内容。' : '地址已删除或不可访问。已读取最新列表，请重新选择。', 'fm-management-note'));
                } else status.textContent = '地址操作未完成，请检查提示后重试。';
            }
            throw error;
        } finally { if (currentOwner()) lock(false); }
    };
    const edit = (address?: Address) => {
        if (busy || !currentOwner()) return;
        const form = create('form', undefined, 'fm-management-form fm-address-form'); form.setAttribute('aria-label', address ? '编辑收货地址' : '新增收货地址');
        const heading = create('h3', address ? '编辑收货地址' : '新增收货地址', 'fm-management-wide');
        const name = field('收货人', 'recipientName', address?.recipientName, 60, 'shipping name');
        const phone = field('手机号码', 'phone', address?.phone, 11, 'shipping tel'); phone.input.type = 'tel'; phone.input.pattern = '1[3-9][0-9]{9}'; phone.input.inputMode = 'tel';
        const province = field('省份', 'province', address?.province ?? '上海市', 30, 'shipping address-level1');
        const city = field('城市', 'city', address?.city ?? '上海市', 30, 'shipping address-level2');
        const district = field('区县', 'district', address?.district ?? '松江区', 30, 'shipping address-level3');
        const detail = create('label', undefined, 'fm-management-field fm-management-wide'); const detailInput = create('textarea'); detailInput.name = 'detail'; detailInput.required = true; detailInput.maxLength = 200; detailInput.rows = 3; detailInput.autocomplete = 'shipping street-address'; detailInput.value = address?.detail ?? ''; detailInput.oninput = () => detailInput.setCustomValidity('');
        const detailCaption = create('span', '详细地址'); detailCaption.id = 'address-detail-' + crypto.randomUUID(); const detailHint = create('small', '填写道路、楼栋与房间等配送信息，最多 200 字。'); detailHint.id = detailCaption.id + '-hint'; detailInput.setAttribute('aria-labelledby', detailCaption.id); detailInput.setAttribute('aria-describedby', detailHint.id); detail.append(detailCaption, detailInput, detailHint);
        const defaultLabel = create('label', undefined, 'fm-address-default-choice fm-management-wide'); const isDefault = create('input'); isDefault.name = 'isDefault'; isDefault.type = 'checkbox'; isDefault.checked = address?.isDefault ?? addresses.length === 0; defaultLabel.append(isDefault, create('span', '设为默认收货地址'));
        const actions = create('div', undefined, 'fm-management-form-actions fm-management-wide'); const save = create('button', address ? '保存地址修改' : '保存新地址', 'fm-management-button'); save.type = 'submit'; actions.append(action('取消编辑', () => editor.replaceChildren()), save);
        form.append(heading, name.wrapper, phone.wrapper, province.wrapper, city.wrapper, district.wrapper, detail, defaultLabel, actions); editor.replaceChildren(form); name.input.focus();
        form.onsubmit = event => {
            event.preventDefault();
            for (const input of [name.input, phone.input, province.input, city.input, district.input, detailInput]) input.setCustomValidity(input.value.trim() ? '' : '请填写有效内容，不能只输入空格。');
            if (!form.reportValidity()) return;
            const body: Models['AddressInput'] = { recipientName: name.input.value.trim(), phone: phone.input.value.trim(), province: province.input.value.trim(), city: city.input.value.trim(), district: district.input.value.trim(), detail: detailInput.value.trim(), isDefault: isDefault.checked };
            void options.run(() => perform(() => address ? updateOwnAddress(address.addressId, { ...body, version: address.version }) : createOwnAddress(body), address ? '收货地址已更新。' : '收货地址已保存。'));
        };
    };
    const confirmDelete = (address: Address) => {
        if (busy || !currentOwner()) return;
        const confirmation = create('section', undefined, 'fm-address-confirm'); confirmation.setAttribute('aria-label', '删除地址确认');
        const title = create('h3', '确认删除这个地址？');
        const addressText = create('p', `${address.recipientName} · ${address.province}${address.city}${address.district}${address.detail}`); addressText.dataset.addressDetail = '';
        const message = create('p', address.isDefault ? '删除后，系统会从剩余地址中确定默认地址。已下单的收货快照不受影响。' : '删除后此地址将不再出现在结算页，已下单的收货快照不受影响。', 'fm-management-note');
        const actions = create('div', undefined, 'fm-management-actions'); actions.append(action('取消删除', () => editor.replaceChildren()), action('确认删除地址', () => { void options.run(() => perform(() => deleteOwnAddress(address.addressId, address.version), '收货地址已删除。')); }, 'danger'));
        confirmation.append(title, addressText, message, actions); editor.replaceChildren(confirmation); actions.querySelector('button')?.focus();
    };
    function renderList() {
        const cards = addresses.map(address => {
            const card = create('article', undefined, 'fm-address-card'); card.dataset.addressId = address.addressId;
            const header = create('div', undefined, 'fm-address-card-head'); const name = create('strong', address.recipientName); const phone = create('span', address.phone); phone.dataset.addressPhone = ''; header.append(name, phone);
            if (address.isDefault) header.append(create('span', '默认地址', 'fm-address-default'));
            if (!address.serviceable) header.append(create('span', '暂不支持配送', 'fm-address-unavailable'));
            const detail = create('p', `${address.province} ${address.city} ${address.district} ${address.detail}`); detail.dataset.addressDetail = '';
            const actions = create('div', undefined, 'fm-management-actions'); const editing = action('编辑', () => edit(address)); editing.setAttribute('aria-label', `编辑 ${address.recipientName} 的地址`);
            const deleting = action('删除', () => confirmDelete(address), 'danger'); deleting.setAttribute('aria-label', `删除 ${address.recipientName} 的地址`);
            actions.append(editing);
            if (!address.isDefault) { const makeDefault = action('设为默认', () => { void options.run(() => perform(() => makeOwnAddressDefault(address), '默认收货地址已更新。')); }); makeDefault.setAttribute('aria-label', `将 ${address.recipientName} 的地址设为默认`); actions.append(makeDefault); }
            actions.append(deleting); card.append(header, detail, actions); return card;
        });
        list.replaceChildren(...cards); if (!cards.length) list.append(create('p', '尚未保存收货地址，可先新增一个地址。', 'fm-management-note')); if (busy) lock(true);
    }
    tools.append(action('新增收货地址', () => edit(), ''), action('刷新地址', () => { if (!busy) void options.run(load); }));
    await load();
}

/** Uses the caller's existing dialog lifecycle; member and checkout entries can share this manager. */
export function openAddressManager(options: AddressManagerOptions & { dialog: (title: string) => HTMLDialogElement }): HTMLDialogElement {
    const dialog = options.dialog('收货地址管理'); dialog.classList.add('fm-management-dialog', 'fm-address-dialog');
    const container = create('div'); dialog.append(container);
    void options.run(() => renderAddressManager(container, options)); return dialog;
}
