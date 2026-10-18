import { mall } from '../api/client';
import { ApiError } from '../api/errors';
import { formatMoney, hasPermission, type Models } from '../domain';
import { operations, type BatchQuery, type MovementQuery, type ProductQuery } from './operations-service';
import { uploadProductImage } from './media-service';
import '../styles/admin-panel.css';

type Options = {
    dialog: (title: string) => HTMLDialogElement;
    run: (action: () => Promise<void>) => Promise<void>;
    reload: () => Promise<void>;
};
type AdminProduct = Models['AdminProduct'];
type Sku = Models['Sku'];
type Batch = Models['Batch'];
type Slot = Models['DeliverySlot'];
type Category = Models['Category'];
type Policies = Models['BusinessPolicies'];
type Tab = 'products' | 'batches' | 'movements' | 'slots' | 'policies';
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const lastTab = new Map<string, Tab>();
type View = { productStatus: ProductQuery['status'] | ''; productPage: number; batchPage: number; movementPage: number; batchFilter: BatchQuery; movementFilter: MovementQuery; selectedDate: string };
const views = new Map<string, View>();
const productStates = { DRAFT: '草稿', ON_SALE: '在售', OFF_SALE: '已下架' };
const storageStates = { AMBIENT: '常温', COLD: '冷藏', FROZEN: '冷冻', LIVE: '鲜活' };
const lifecycleStates = { NORMAL: '正常', QUARANTINED: '已隔离', DISPOSED: '已报废' };
const freshnessStates = { NORMAL: '正常保质期', NEAR_EXPIRY: '临期', EXPIRED: '已过期' };
const movementStates: Record<Models['InventoryMovement']['type'], string> = { RECEIVE: '采购入库', RESERVE: '订单预占', RELEASE: '释放预占', PICK_OUT: '拣货出库', RETURN_PASS: '验收回库', RETURN_QUARANTINE: '隔离回库', QUARANTINE: '质检隔离', DISPOSE: '实物报废', ADJUST: '盘点调整' };

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}
function action(label: string, callback: () => void, tone = 'quiet') {
    const result = node('button', label, 'fm-management-button'); result.type = 'button';
    if (tone) result.dataset.tone = tone;
    result.onclick = callback; return result;
}
function note(text: string) { return node('p', text, 'fm-management-note'); }
function field(label: string, name: string, value = '', type = 'text', hint = '') {
    const wrapper = node('label', undefined, 'fm-management-field');
    const input = node('input'); input.name = name; input.value = value; input.type = type; input.required = true;
    input.autocomplete = 'off'; input.oninput = () => input.setCustomValidity('');
    wrapper.append(node('span', label), input); if (hint) wrapper.append(node('small', hint));
    return { wrapper, input };
}
function select(label: string, name: string, values: readonly (readonly [string, string])[], current = '') {
    const wrapper = node('label', undefined, 'fm-management-field'); const input = node('select'); input.name = name;
    input.style.cssText = 'min-height:39px;border:1px solid #D9DEE5;border-radius:5px;padding:8px 10px;background:#fff;color:#1B1F24;font:inherit;max-width:100%';
    for (const [value, text] of values) { const item = node('option', text); item.value = value; input.append(item); }
    input.value = current; wrapper.append(node('span', label), input); return { wrapper, input };
}
function reason(label = '操作原因') {
    const wrapper = node('label', undefined, 'fm-management-field fm-management-wide'); const input = node('textarea');
    input.name = 'reason'; input.rows = 3; input.maxLength = 500; input.required = true;
    wrapper.append(node('span', label), input, node('small', '填写具体业务原因，最多500字；请勿填写密码或无关个人信息。'));
    return { wrapper, input };
}
function text(input: HTMLInputElement | HTMLTextAreaElement, max: number, label: string) {
    const value = input.value.trim(); if (!value || value.length > max) throw new Error(`${label}须为1–${max}字`); return value;
}
function integer(value: string, label: string, min = 0n, max = MAX) {
    if (!/^-?\d+$/.test(value.trim())) throw new Error(`${label}须为整数，不能使用小数或科学计数法`);
    const amount = BigInt(value.trim()); if (amount < min || amount > max) throw new Error(`${label}超出允许范围`); return Number(amount);
}
function cents(value: string, label: string) {
    if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value.trim())) throw new Error(`${label}须为非负金额，最多两位小数`);
    const [whole = '', fraction = ''] = value.trim().split('.'); const amount = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (amount > MAX) throw new Error(`${label}超出允许范围`); return Number(amount);
}
function money(value: number) { return formatMoney(value, { symbol: false, grouping: false }); }
function identifier(value: string, label: string, optional = false) {
    const normalized = value.trim(); if (!normalized && optional) return '';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(normalized)) throw new Error(`${label}须为1–64位字母、数字、横线或下划线`); return normalized;
}
function businessDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function localDateTime(value: string | Date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === name)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}
function instant(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error(`${label}须为有效的北京时间`);
    const date = new Date(value + '+08:00'); if (Number.isNaN(date.valueOf())) throw new Error(`${label}无效`); return date.toISOString();
}
function time(value: string | null) { if(value===null)return '未记录'; const date = new Date(value); return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short', hour12: false }).format(date); }
function numeric(input: HTMLInputElement, signed = false) { input.inputMode = 'numeric'; input.pattern = signed ? '-?[0-9]+' : '[0-9]+'; input.maxLength = 18; }
function amountField(label: string, name: string, value: number) { const result = field(label, name, money(value)); result.input.inputMode = 'decimal'; result.input.maxLength = 24; return result; }
function modal(options: Options, title: string, submitText: string) {
    const popup = options.dialog(title); popup.classList.add('fm-management-dialog');
    const form = node('form', undefined, 'fm-management-form'); const footer = node('div', undefined, 'fm-management-form-actions fm-management-wide');
    const submit = node('button', submitText, 'fm-management-button'); submit.type = 'submit'; footer.append(action('取消', () => popup.close()), submit);
    form.append(footer); popup.append(form);
    return { popup, form, add: (...items: HTMLElement[]) => items.forEach(item => form.insertBefore(item, footer)) };
}
function table(title: string, labels: string[]) {
    const scroll = node('div', undefined, 'fm-management-table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', title + '，可横向滚动');
    const element = node('table', undefined, 'fm-management-table'); const caption = node('caption', title, 'fm-management-sr-only'); const head = node('thead'), row = node('tr');
    for (const label of labels) { const cell = node('th', label); cell.scope = 'col'; row.append(cell); }
    head.append(row); const body = node('tbody'); element.append(caption, head, body); scroll.append(element);
    return { scroll, body, empty: () => { const row = node('tr'), cell = node('td', '暂无符合条件的记录', 'fm-management-empty'); cell.colSpan = labels.length; row.append(cell); body.append(row); } };
}
function cell(...children: (HTMLElement | string)[]) { const result = node('td'); result.append(...children); return result; }
function info(title: string, detail: string) {
    const result = node('div'); result.style.minWidth = '0';
    const main = node('strong', title), secondary = node('small', detail);
    main.style.cssText = 'display:block;overflow-wrap:anywhere';
    secondary.style.cssText = 'display:block;margin-top:4px;overflow-wrap:anywhere;color:#7D8794';
    result.append(main, secondary); return result;
}
function tools(...items: HTMLElement[]) { const result = node('div', undefined, 'fm-management-actions'); result.append(...items); return result; }
function pagination(page: { page: number; size: number; total: number }, load: (page: number) => Promise<void>, options: Options, label: string) {
    const nav = node('nav', undefined, 'fm-management-pagination'); nav.setAttribute('aria-label', label + '分页'); const pages = Math.max(1, Math.ceil(page.total / page.size));
    const previous = action('上一页', () => void options.run(() => load(page.page - 1))); previous.disabled = page.page <= 1;
    const next = action('下一页', () => void options.run(() => load(page.page + 1))); next.disabled = page.page >= pages;
    nav.append(node('span', `共${page.total}条 · 第${page.page}/${pages}页 · 每页${page.size}条`), previous, next); return nav;
}
function errorBox(container: HTMLElement, error: unknown) {
    const message = node('p', error instanceof Error ? error.message : '暂时无法读取数据，请稍后重试。'); message.setAttribute('role', 'alert');
    if (error instanceof ApiError && error.traceId) message.append(node('small', ` · 追踪号 ${error.traceId}`)); container.replaceChildren(message);
}
function imageField(current: string, urls: readonly string[], options: Options, productId: string | null = null) {
    const result = field('商品公图地址', 'imageUrl', current, 'url', '从现有公图中选择或填写已登记的商品图片地址。私有售后图和任意外链不能用于商品。');
    const container = node('div', undefined, 'fm-management-field fm-management-wide'); container.append(result.wrapper);
    result.input.maxLength = 2048; const list = node('datalist'); list.id = 'ops-images-' + crypto.randomUUID();
    const controlled = new Set([current, ...urls].filter(Boolean)); for (const url of controlled) { const item = node('option'); item.value = url; list.append(item); }
    result.input.setAttribute('list', list.id); const preview = node('img'); preview.alt = '所选商品公图预览'; preview.width = 88; preview.height = 88; preview.style.cssText = 'object-fit:contain;border:1px solid #E3E6EA;border-radius:5px;background:#fff';
    const refresh = () => { const value = result.input.value.trim(); preview.hidden = !controlled.has(value); if (controlled.has(value)) preview.src = value; else preview.removeAttribute('src'); };
    preview.onerror = () => { preview.hidden = true; }; result.input.addEventListener('change', refresh); refresh(); container.append(list, preview);
    if (hasPermission(mall.auth.getSnapshot().user, 'media.product.upload')) {
        const file = node('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.setAttribute('aria-label', '选择待上传商品图片');
        const message = node('small', '可上传JPEG、PNG或WebP公图，每张不超过6MiB。'); message.setAttribute('role', 'status');
        const upload = action('上传所选商品图片', () => void options.run(async () => {
            const selected = file.files?.[0]; if (!selected) throw new Error('请先选择商品图片');
            const uploaded = await uploadProductImage(selected, productId); if (uploaded.status !== 'READY') throw new Error('图片尚未通过处理，请稍后重新选择已就绪图片');
            if (!result.wrapper.isConnected) return; controlled.add(uploaded.publicUrl); result.input.value = uploaded.publicUrl; file.value = ''; refresh(); message.textContent = '商品公图已上传并选中，保存商品或规格后生效。';
        })); container.append(file, upload, message);
    }
    return { wrapper: container, input: result.input };
}

/** Independent operational screens. No storefront templates or application routing are changed here. */
export async function renderOperations(main: HTMLElement, options: Options): Promise<void> {
    const user = mall.auth.getSnapshot().user; if (!user) return;
    const allowed: { key: Tab; label: string }[] = [];
    if (hasPermission(user, 'product.read')) allowed.push({ key: 'products', label: '商品与规格' });
    if (hasPermission(user, 'batch.read')) allowed.push({ key: 'batches', label: '补货与批次' });
    if (hasPermission(user, 'inventory.movement.read')) allowed.push({ key: 'movements', label: user.roles.includes('FINANCE') ? '订单库存对账' : '库存流水' });
    if (hasPermission(user, 'slot.manage')) allowed.push({ key: 'slots', label: '配送预约' });
    if (hasPermission(user, 'policy.manage')) allowed.push({ key: 'policies', label: '交易规则' });
    if (!allowed.length) return;
    const section = node('section', undefined, 'fm-management-section'); section.id = 'operational-management'; section.setAttribute('aria-label', '商品仓储与经营规则');
    const heading = node('div', undefined, 'fm-management-heading'); const title = node('div'); title.append(node('p', 'STORE OPERATIONS', 'fm-management-eyebrow'), node('h2', '门店业务管理'));
    heading.append(title, action('刷新工作台', () => void options.run(options.reload))); const tabs = node('nav', undefined, 'fm-management-actions'); tabs.setAttribute('aria-label', '门店业务分区');
    const body = node('div'); section.append(heading, tabs, body); main.append(section);
    let revision = 0;
    let categories: Category[] | null = null;
    let knownImages: string[] = [];
    const loadCategories = async () => { categories ??= (await operations.categories()).items; return categories; };
    const previousView = views.get(user.userId);
    let productStatus: ProductQuery['status'] | '' = previousView?.productStatus ?? '';
    let productPage = previousView?.productPage ?? 1, batchPage = previousView?.batchPage ?? 1, movementPage = previousView?.movementPage ?? 1;
    let batchFilter: BatchQuery = previousView?.batchFilter ?? {}, movementFilter: MovementQuery = previousView?.movementFilter ?? {};
    let selectedDate = previousView?.selectedDate ?? businessDate();
    const refreshAll = async () => {
        views.set(user.userId, { productStatus, productPage, batchPage, movementPage, batchFilter: { ...batchFilter }, movementFilter: { ...movementFilter }, selectedDate });
        await options.reload();
    };

    const editProduct = async (product?: AdminProduct) => {
        const cats = await loadCategories(); if (!cats.length) throw new Error('当前没有启用的商品分类，请先检查初始化数据。');
        const dialog = modal(options, product ? '编辑商品资料' : '新建商品草稿', product ? '保存资料' : '创建草稿');
        const category = select('商品分类', 'categoryId', cats.map(c => [c.categoryId, c.name] as const), product?.categoryId ?? cats[0]!.categoryId);
        category.input.required = true;
        const name = field('商品名称', 'name', product?.name ?? ''); name.input.maxLength = 120;
        const origin = field('产地', 'origin', product?.origin ?? ''); origin.input.maxLength = 100;
        const storage = select('储存方式', 'storage', Object.entries(storageStates), product?.storage ?? 'COLD');
        const description = node('label', undefined, 'fm-management-field fm-management-wide'), descriptionInput = node('textarea'); descriptionInput.name = 'description'; descriptionInput.required = true; descriptionInput.rows = 3; descriptionInput.maxLength = 4000; descriptionInput.value = product?.description ?? ''; description.append(node('span', '商品介绍'), descriptionInput);
        const image = imageField(product?.imageUrl ?? cats[0]!.imageUrl, [...knownImages, ...cats.map(c => c.imageUrl)], options, product?.productId ?? null);
        dialog.add(category.wrapper, name.wrapper, origin.wrapper, storage.wrapper, description, image.wrapper);
        dialog.add(note(product ? `资料版本 ${product.version}。商品资料修改不覆盖历史订单快照。` : '创建后为草稿，添加有效规格并确认公图后才能上架。'));
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => {
            const body: Models['ProductWriteRequest'] = { categoryId: identifier(category.input.value, '分类'), name: text(name.input, 120, '商品名称'), description: text(descriptionInput, 4000, '商品介绍'), origin: text(origin.input, 100, '产地'), storage: storage.input.value as Models['ProductWriteRequest']['storage'], imageUrl: text(image.input, 2048, '商品公图') };
            if (product) await operations.patchProduct(product.productId, { ...body, version: product.version }); else await operations.createProduct(body);
            dialog.popup.close(); await refreshAll();
        }); };
    };
    const editSku = (product: AdminProduct, sku?: Sku, parent?: HTMLDialogElement) => {
        parent?.close();
        const dialog = modal(options, sku ? '编辑商品规格与价格' : '新增商品规格', sku ? '保存规格' : '创建规格');
        const code = field('规格编码', 'skuCode', sku?.skuCode ?? 'SKU-' + crypto.randomUUID().slice(0, 8).toUpperCase()); code.input.maxLength = 64; code.input.pattern = '[A-Za-z0-9_-]{1,64}';
        const name = field('规格名称', 'name', sku?.name ?? product.name); name.input.maxLength = 120;
        const unit = field('规格展示', 'unitLabel', sku?.unitLabel ?? '', 'text', '例如：500g/份、1盒、每500克。'); unit.input.maxLength = 60;
        const mode = select('计价方式', 'priceMode', [['BY_PIECE', '按件计价'], ['BY_WEIGHT', '按实重计价']], sku?.priceMode ?? 'BY_PIECE');
        const grams = field('单价对应克数', 'priceUnitGram', String(sku?.priceUnitGram ?? 500), 'text', '例如：单价按每500克，则填500；入库和拣货数量始终按克记录。'); numeric(grams.input);
        const price = amountField('参考价（元）', 'price', sku?.price ?? 0), member = amountField('会员价（元）', 'memberPrice', sku?.memberPrice ?? 0);
        const image = imageField(sku?.imageUrl ?? product.imageUrl, [product.imageUrl, ...product.skus.map(s => s.imageUrl), ...knownImages], options, product.productId);
        dialog.add(code.wrapper, name.wrapper, unit.wrapper, mode.wrapper, grams.wrapper, price.wrapper, member.wrapper, image.wrapper);
        const description = note(sku ? `当前规格版本 ${sku.version}。已有库存台账后不能改计量基础单位；需要新计量方式请新增规格。旧订单价格快照保留。` : '按件商品以“件”记库存；称重商品以“克”记库存，实际结算由服务端计算。'); description.classList.add('fm-management-wide'); dialog.add(description);
        const modeChanged = () => { const weighted = mode.input.value === 'BY_WEIGHT'; grams.wrapper.hidden = !weighted; grams.input.required = weighted; }; mode.input.onchange = modeChanged; modeChanged();
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => {
            const priceValue = cents(price.input.value, '参考价'), memberValue = cents(member.input.value, '会员价'); if (memberValue > priceValue) throw new Error('会员价不能高于参考价');
            const weighted = mode.input.value === 'BY_WEIGHT';
            const body: Models['SkuWriteRequest'] = { skuCode: identifier(code.input.value, '规格编码'), name: text(name.input, 120, '规格名称'), unitLabel: text(unit.input, 60, '规格展示'), baseUnit: weighted ? 'GRAM' : 'PIECE', priceMode: weighted ? 'BY_WEIGHT' : 'BY_PIECE', priceUnitGram: weighted ? integer(grams.input.value, '单价克数', 1n) : null, price: priceValue, memberPrice: memberValue, imageUrl: text(image.input, 2048, '商品公图') };
            if (sku) await operations.patchSku(sku.skuId, { ...body, version: sku.version }); else await operations.createSku(product.productId, body);
            dialog.popup.close(); parent?.close(); await refreshAll();
        }); };
    };
    const setProductStatus = (product: AdminProduct, parent?: HTMLDialogElement) => {
        parent?.close();
        const next = product.status === 'ON_SALE' ? 'OFF_SALE' : 'ON_SALE'; const verb = next === 'ON_SALE' ? '上架' : '下架';
        const dialog = modal(options, verb + '商品', '确认' + verb); dialog.add(note(`${product.name} · 当前版本 ${product.version}。${next === 'ON_SALE' ? '服务端将检查启用分类、有效规格及受控商品图片。' : '下架后不再接受新的购物报价，已有订单继续按原快照处理。'}`));
        dialog.form.onsubmit = event => { event.preventDefault(); void options.run(async () => { await operations.productStatus(product.productId, { status: next, version: product.version }); dialog.popup.close(); parent?.close(); await refreshAll(); }); };
    };
    const showProduct = async (id: string) => {
        const product = await operations.product(id); const popup = options.dialog('商品与规格详情'); popup.classList.add('fm-management-dialog');
        popup.append(info(product.name, `${productStates[product.status]} · ${product.origin} · ${storageStates[product.storage]} · 资料版本 ${product.version}`), note(product.description));
        const actions = tools(); if (hasPermission(user, 'product.write')) actions.append(action('编辑商品资料', () => { popup.close(); void options.run(() => editProduct(product)); }));
        if (hasPermission(user, 'product.status')) actions.append(action(product.status === 'ON_SALE' ? '下架商品' : '上架商品', () => setProductStatus(product, popup), product.status === 'ON_SALE' ? 'danger' : ''));
        if (hasPermission(user, 'sku.write')) actions.append(action('新增规格', () => editSku(product, undefined, popup), '')); popup.append(actions);
        const rows = table('商品规格', ['规格', '计量方式', '参考价 / 会员价', '可售提示', '版本', '操作']);
        for (const sku of product.skus) { const row = node('tr'); row.append(cell(info(sku.name, sku.skuCode + ' · ID：' + sku.skuId)), cell(`${sku.priceMode === 'BY_WEIGHT' ? '按实重 · 每' + sku.priceUnitGram + '克' : '按件'} · ${sku.unitLabel}`), cell(`${formatMoney(sku.price)} / ${formatMoney(sku.memberPrice)}`), cell(sku.stockStatus === 'SOLD_OUT' ? '暂无可售库存' : sku.stockStatus === 'LOW' ? '低库存' : '有货'), cell(String(sku.version)), cell(hasPermission(user, 'sku.write') ? action('编辑规格', () => editSku(product, sku, popup)) : node('span', '只读'))); rows.body.append(row); }
        if (!product.skus.length) rows.empty(); popup.append(rows.scroll, note('库存和临期成交价由批次与报价计算。上架商品至少需要一个有效规格。'));
    };
    const loadProducts = async (page: number) => {
        productPage = page; const query: ProductQuery = { page, size: 20, ...(productStatus ? { status: productStatus } : {}) }; const current = revision; const result = await operations.products(query);
        if (current !== revision || !section.isConnected) return; knownImages = [...new Set(result.items.flatMap(p => [p.imageUrl, ...p.skus.map(s => s.imageUrl)]))];
        const filter = select('商品状态', 'productStatus', [['', '全部状态'], ['DRAFT', '草稿'], ['ON_SALE', '在售'], ['OFF_SALE', '已下架']], productStatus); filter.input.onchange = () => { void options.run(async () => { productStatus = filter.input.value as typeof productStatus; await loadProducts(1); }); };
        const toolbar = tools(filter.wrapper, action('刷新商品', () => void options.run(() => loadProducts(productPage)))); if (hasPermission(user, 'product.write')) toolbar.append(action('新建商品草稿', () => void options.run(() => editProduct()), ''));
        const rows = table('运营商品', ['商品', '分类 / 储存', '状态', '会员价起', '规格数 / 版本', '操作']);
        const cats = await loadCategories(); if (current !== revision || !section.isConnected) return;
        for (const product of result.items) { const row = node('tr'); row.append(cell(info(product.name, product.spuCode)), cell(`${cats.find(c => c.categoryId === product.categoryId)?.name ?? product.categoryId} · ${storageStates[product.storage]}`), cell(productStates[product.status]), cell(product.skus.length ? formatMoney(product.memberPrice) : '待配置规格'), cell(`${product.skus.length}个 · v${product.version}`), cell(action('查看与管理', () => void options.run(() => showProduct(product.productId))))); rows.body.append(row); }
        if (!result.items.length) rows.empty(); body.replaceChildren(toolbar, note('先建草稿、配置规格和价格，再上架。需要长期供货时请由仓储新建采购批次，不重置历史库存。'), rows.scroll, pagination(result, loadProducts, options, '商品'));
    };

    const createBatch = () => {
        const dialog = modal(options, '采购验收入库', '确认入库'); const sku = field('规格ID', 'skuId', batchFilter.skuId ?? '', 'text', '从商品规格详情复制准确的规格ID。按件填件数，称重规格填克数。'); sku.input.maxLength = 64;
        const availableSkus = select('从在售商品选择规格', 'availableSku', [['', '正在读取在售规格…']]); availableSkus.wrapper.classList.add('fm-management-wide');
        const unitHint = note('基础单位以服务端规格为准。草稿或下架商品的规格可填写准确ID验收入库。'); unitHint.classList.add('fm-management-wide');
        const no = field('采购批次号', 'batchNo', 'B-' + crypto.randomUUID().slice(0, 8).toUpperCase()); no.input.pattern = '[A-Za-z0-9_-]{1,64}'; no.input.maxLength = 64;
        const quantity = field('实收入库数量（规格基础单位）', 'receivedQuantity', ''); numeric(quantity.input);
        const produced = field('生产时间（北京时间）', 'producedAt', '', 'datetime-local'); produced.input.step = '1';
        const expires = field('到期时间（北京时间）', 'expiresAt', '', 'datetime-local'); expires.input.step = '1';
        const explanation = reason('验收来源与入库说明'); dialog.add(availableSkus.wrapper, sku.wrapper, no.wrapper, quantity.wrapper, produced.wrapper, expires.wrapper, unitHint, explanation.wrapper);
        void operations.publicProducts().then(result => {
            if (!dialog.popup.isConnected) return; availableSkus.input.replaceChildren(); const empty = node('option', '选择在售商品规格（也可直接填写ID）'); empty.value = ''; availableSkus.input.append(empty);
            const skus = result.items.flatMap(product => product.skus.map(item => ({ product: product.name, item })));
            for (const { product, item } of skus) { const option = node('option', `${product} · ${item.unitLabel} · 按${item.baseUnit === 'GRAM' ? '克' : '件'}记库存`); option.value = item.skuId; availableSkus.input.append(option); }
            availableSkus.input.onchange = () => { const selected = skus.find(entry => entry.item.skuId === availableSkus.input.value); if (!selected) return; sku.input.value = selected.item.skuId; unitHint.textContent = `${selected.product} · ${selected.item.unitLabel}。本次入库数量请填写${selected.item.baseUnit === 'GRAM' ? '克数（例如5公斤填5000）' : '件数'}。`; };
            if (sku.input.value && skus.some(entry => entry.item.skuId === sku.input.value)) { availableSkus.input.value = sku.input.value; availableSkus.input.onchange(new Event('change')); }
        }).catch(() => { if (dialog.popup.isConnected) { availableSkus.input.replaceChildren(node('option', '暂时无法读取在售规格，请填写准确ID')); unitHint.textContent = '在售规格读取失败。请刷新重试，或填写从商品详情取得的规格ID；数量单位仍由服务端核验。'; } });
        const hint = note('验收入库时间由系统记录。生产时间不能晚于现在，到期须晚于入库；同一规格的相同批次号不能重复入库。'); hint.classList.add('fm-management-wide'); dialog.add(hint);
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => {
            const producedAt = instant(produced.input.value, '生产时间'), expiresAt = instant(expires.input.value, '到期时间'); if (Date.parse(producedAt) > Date.now() || Date.parse(expiresAt) <= Date.now() || Date.parse(expiresAt) <= Date.parse(producedAt)) throw new Error('请检查生产与到期时间：不能提前记录尚未生产或已经过期的货品');
            await operations.createBatch({ skuId: identifier(sku.input.value, '规格ID'), batchNo: identifier(no.input.value, '批次号'), receivedQuantity: integer(quantity.input.value, '入库数量', 1n), producedAt, expiresAt, reason: text(explanation.input, 500, '验收说明') }); dialog.popup.close(); await refreshAll();
        }); };
    };
    const adjustBatch = (batch: Batch) => {
        const dialog = modal(options, '盘点与损耗调整', '保存库存调整'); const quantity = field('数量变化（正数增加、负数减少）', 'quantityDelta', '', 'text', `基础单位：${batch.baseUnit === 'GRAM' ? '克' : '件'}。当前在库${batch.onHand}，预占${batch.reserved}，隔离${batch.quarantined}，版本${batch.version}。`); numeric(quantity.input, true); quantity.wrapper.classList.add('fm-management-wide');
        const code = select('调整类型', 'reasonCode', [['COUNT_CORRECTION', '实物盘点差异'], ['DAMAGE', '破损损耗'], ['EXPIRED_DISPOSAL', '过期销毁']], 'COUNT_CORRECTION'); const explanation = reason(); dialog.add(quantity.wrapper, code.wrapper, explanation.wrapper);
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => {
            const delta = integer(quantity.input.value, '数量变化', -MAX); if (!delta) throw new Error('数量变化不能为0'); if (code.input.value !== 'COUNT_CORRECTION' && delta > 0) throw new Error('损耗和过期销毁只能减少数量');
            await operations.adjust(batch.batchId, { quantityDelta: delta, reasonCode: code.input.value as Models['InventoryAdjustmentRequest']['reasonCode'], reason: text(explanation.input, 500, '操作原因'), version: batch.version }); dialog.popup.close(); await refreshAll();
        }); };
    };
    const lifecycle = (batch: Batch, next: Batch['lifecycle']) => {
        const title = next === 'NORMAL' ? '质检恢复' : next === 'QUARANTINED' ? '隔离批次' : '报废批次'; const dialog = modal(options, title, '确认' + title); const explanation = reason();
        dialog.add(note(`${batch.batchNo} · 在库${batch.onHand}${batch.baseUnit === 'GRAM' ? '克' : '件'} · 当前版本${batch.version}。${next === 'DISPOSED' ? '报废将记录实物销毁，完成后不能恢复。' : next === 'NORMAL' ? '只可恢复质检通过且未过期的实物库存。' : '隔离库存不参与新的销售分配。'} 预占尚未处理完的批次将被服务端拦截。`), explanation.wrapper);
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => { await operations.lifecycle(batch.batchId, { lifecycle: next, reason: text(explanation.input, 500, '操作原因'), version: batch.version }); dialog.popup.close(); await refreshAll(); }); };
    };
    const batchDetails = async (id: string) => {
        const batch = await operations.batch(id); const popup = options.dialog('采购批次详情'); popup.classList.add('fm-management-dialog');
        popup.append(info(batch.batchNo, `${batch.skuId} · ${batch.baseUnit === 'GRAM' ? '克' : '件'} · 版本${batch.version}`), note(`生产 ${time(batch.producedAt)} · 入库 ${time(batch.receivedAt)} · 到期 ${time(batch.expiresAt)}`), note(`${lifecycleStates[batch.lifecycle]} · ${freshnessStates[batch.freshness]} · 在库 ${batch.onHand} · 预占 ${batch.reserved} · 隔离 ${batch.quarantined} · 可用 ${batch.available}`));
        const controls = tools(); if (batch.lifecycle !== 'DISPOSED' && hasPermission(user, 'inventory.adjust')) controls.append(action('盘点 / 损耗', () => { popup.close(); adjustBatch(batch); }));
        if (batch.lifecycle !== 'DISPOSED' && hasPermission(user, 'batch.lifecycle')) {
            if (batch.lifecycle === 'NORMAL') controls.append(action('质检隔离', () => { popup.close(); lifecycle(batch, 'QUARANTINED'); }));
            if (batch.lifecycle === 'QUARANTINED') { const restore = action('质检通过恢复', () => { popup.close(); lifecycle(batch, 'NORMAL'); }); restore.disabled = batch.freshness === 'EXPIRED'; controls.append(restore); }
            controls.append(action('实物报废', () => { popup.close(); lifecycle(batch, 'DISPOSED'); }, 'danger'));
        }
        if (hasPermission(user, 'inventory.movement.read')) controls.append(action('查看该批次流水', () => { popup.close(); movementFilter = { batchId: batch.batchId }; void options.run(() => activate('movements')); })); popup.append(controls);
    };
    const loadBatches = async (page: number) => {
        batchPage = page; const current = revision; const result = await operations.batches({ ...batchFilter, page, size: 20 }); if (current !== revision || !section.isConnected) return;
        const form = node('form', undefined, 'fm-management-actions'); const sku = field('规格ID筛选', 'skuId', batchFilter.skuId ?? ''); sku.input.required = false;
        const state = select('生命周期', 'lifecycle', [['', '全部生命周期'], ['NORMAL', '正常'], ['QUARANTINED', '已隔离'], ['DISPOSED', '已报废']], batchFilter.lifecycle ?? '');
        const freshness = select('保质状态', 'freshness', [['', '全部保质状态'], ['NORMAL', '正常保质期'], ['NEAR_EXPIRY', '临期'], ['EXPIRED', '已过期']], batchFilter.freshness ?? '');
        const submit = node('button', '筛选批次', 'fm-management-button'); submit.type = 'submit'; form.append(sku.wrapper, state.wrapper, freshness.wrapper, submit);
        if (hasPermission(user, 'batch.create')) form.append(action('采购验收入库', createBatch, ''));
        form.onsubmit = event => { event.preventDefault(); void options.run(async () => { const id = identifier(sku.input.value, '规格ID', true); batchFilter = { ...(id ? { skuId: id } : {}), ...(state.input.value ? { lifecycle: state.input.value as Batch['lifecycle'] } : {}), ...(freshness.input.value ? { freshness: freshness.input.value as Batch['freshness'] } : {}) }; await loadBatches(1); }); };
        const rows = table('采购批次', ['批次 / 规格', '状态 / 到期', '在库', '预占', '隔离', '可用', '版本 / 操作']);
        for (const batch of result.items) { const row = node('tr'), unit = batch.baseUnit === 'GRAM' ? '克' : '件'; row.append(cell(info(batch.batchNo, batch.skuId)), cell(info(`${lifecycleStates[batch.lifecycle]} · ${freshnessStates[batch.freshness]}`, time(batch.expiresAt))), cell(`${batch.onHand}${unit}`), cell(`${batch.reserved}${unit}`), cell(`${batch.quarantined}${unit}`), cell(`${batch.available}${unit}`), cell(info('v' + batch.version, ''), action('查看与处理', () => void options.run(() => batchDetails(batch.batchId))))); rows.body.append(row); }
        if (!result.items.length) rows.empty(); body.replaceChildren(form, note('可用=在库−预占−隔离；过期品不参与销售。盘损、隔离与报废均保留原因和流水，不能侵占已有订单预占。'), rows.scroll, pagination(result, loadBatches, options, '批次'));
    };
    const loadMovements = async (page: number) => {
        movementPage = page; const current = revision; const result = await operations.movements({ ...movementFilter, page, size: 20 }); if (current !== revision || !section.isConnected) return;
        const form = node('form', undefined, 'fm-management-actions'); const batch = field('批次引用筛选', 'batchId', movementFilter.batchId ?? ''), order = field('订单ID筛选', 'orderId', movementFilter.orderId ?? ''); batch.input.required = false; order.input.required = false;
        const submit = node('button', '查询流水', 'fm-management-button'); submit.type = 'submit'; form.append(batch.wrapper, order.wrapper, submit);
        form.onsubmit = event => { event.preventDefault(); void options.run(async () => { const batchId = identifier(batch.input.value, '批次引用', true), orderId = identifier(order.input.value, '订单ID', true); movementFilter = { ...(batchId ? { batchId } : {}), ...(orderId ? { orderId } : {}) }; await loadMovements(1); }); };
        const rows = table('不可变库存流水', ['时间 / 类型', '批次 / 规格引用', '订单引用', '在库变化', '预占变化', '隔离变化', '原因 / 执行标识']);
        const signed = (value: number) => value > 0 ? '+' + value : String(value);
        for (const movement of result.items) { const row = node('tr'); row.append(cell(info(time(movement.createdAt), movementStates[movement.type])), cell(info(movement.batchId, movement.skuId)), cell(movement.orderId ?? '非订单库存业务'), cell(signed(movement.onHandDelta)), cell(signed(movement.reservedDelta)), cell(signed(movement.quarantinedDelta)), cell(info(movement.reason, movement.actorId))); rows.body.append(row); }
        if (!result.items.length) rows.empty(); body.replaceChildren(form, note(user.roles.includes('FINANCE') ? '这里只显示与订单关联的实际数量变化。人工仓储备注和执行人信息已由服务端按财务权限处理。' : '流水只读且不可修改或删除；数量按对应规格的基础单位记录。'), rows.scroll, pagination(result, loadMovements, options, '库存流水'));
    };
    const editSlot = (slot: Slot) => {
        const dialog = modal(options, '调整配送预约', '保存预约规则'); const capacity = field('新总容量（1–500单）', 'capacity', '', 'text', `当前剩余可约${slot.remaining}单；新总容量不能低于已经预约的订单数。`); numeric(capacity.input);
        const cutoff = field('下单截止（北京时间）', 'cutoffAt', localDateTime(slot.cutoffAt), 'datetime-local'); cutoff.input.step = '1';
        const enabled = select('预约状态', 'enabled', [['true', '开放预约'], ['false', '暂停新预约']], slot.unavailableReason === 'OUT_OF_SERVICE' ? 'false' : 'true');
        dialog.add(note(`${slot.date} ${slot.label} · 当前版本${slot.version}。本次只修改新预约限制，不取消已经成立的订单。`), capacity.wrapper, cutoff.wrapper, enabled.wrapper);
        dialog.form.onsubmit = event => { event.preventDefault(); if (!dialog.form.reportValidity()) return; void options.run(async () => { const cutoffAt = instant(cutoff.input.value, '下单截止'); if (Date.parse(cutoffAt) > Date.parse(slot.startAt)) throw new Error('下单截止不能晚于配送开始'); await operations.updateSlot(slot.slotId, { capacity: integer(capacity.input.value, '总容量', 1n, 500n), cutoffAt, enabled: enabled.input.value === 'true', version: slot.version }); dialog.popup.close(); await refreshAll(); }); };
    };
    const loadSlots = async () => {
        const current = revision; const result = await operations.slots(selectedDate); if (current !== revision || !section.isConnected) return;
        const form = node('form', undefined, 'fm-management-date-filter'); const date = field('配送日期', 'date', selectedDate, 'date'); const submit = node('button', '查询时段', 'fm-management-button'); submit.type = 'submit'; form.append(date.wrapper, submit);
        form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return; void options.run(async () => { selectedDate = date.input.value; await loadSlots(); }); };
        const rows = table('配送预约时段', ['配送日期 / 时段', '开始 / 结束', '下单截止', '剩余可约', '当前状态', '版本 / 操作']);
        for (const slot of result.items) { const reason = slot.available ? '可预约' : slot.unavailableReason === 'FULL' ? '已约满' : slot.unavailableReason === 'CUTOFF' ? '已截止' : '暂停预约'; const row = node('tr'); row.append(cell(info(slot.date, slot.label)), cell(`${time(slot.startAt)} — ${time(slot.endAt)}`), cell(time(slot.cutoffAt)), cell(String(slot.remaining)), cell(reason), cell(info('v' + slot.version, ''), action('调整预约', () => editSlot(slot)))); rows.body.append(row); }
        if (!result.items.length) rows.empty(); body.replaceChildren(form, note('按北京时间管理配送预约。总容量调整不能低于已预约量；截止时间不能晚于配送开始。当天和次日时段由系统维护。'), rows.scroll);
    };
    const loadPolicies = async () => {
        const current = revision; const policy = await operations.policies(); if (current !== revision || !section.isConnected) return;
        const form = node('form', undefined, 'fm-management-form'); const freight = amountField('基础运费（元）', 'freightAmount', policy.freightAmount), threshold = amountField('免运门槛（优惠后商品实付，元）', 'freeShippingThresholdAmount', policy.freeShippingThresholdAmount);
        const days = field('临期范围（1–30天）', 'nearExpiryDays', String(policy.nearExpiryDays)); numeric(days.input);
        const discount = field('临期售价（原价百分比）', 'nearExpiryDiscount', money(policy.nearExpiryDiscountBasisPoints), 'text', '填90表示原价的90%，即9折；0.01–100。实际成交取临期价与会员价中的较低值。'); discount.input.inputMode = 'decimal';
        const coupon = amountField('新人券面额（元，0为停发）', 'newcomerCouponAmount', policy.newcomerCouponAmount), minimum = amountField('新人券使用门槛（元）', 'newcomerCouponMinGoodsAmount', policy.newcomerCouponMinGoodsAmount);
        const footer = node('div', undefined, 'fm-management-form-actions fm-management-wide'), save = node('button', '保存交易规则', 'fm-management-button'); save.type = 'submit'; footer.append(save);
        form.append(freight.wrapper, threshold.wrapper, days.wrapper, discount.wrapper, coupon.wrapper, minimum.wrapper, footer);
        form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return; void options.run(async () => {
            const discountValue = cents(discount.input.value, '临期百分比'); if (discountValue < 1 || discountValue > 10000) throw new Error('临期百分比须为0.01–100');
            const next: Policies = { freightAmount: cents(freight.input.value, '基础运费'), freeShippingThresholdAmount: cents(threshold.input.value, '免运门槛'), nearExpiryDays: integer(days.input.value, '临期天数', 1n, 30n), nearExpiryDiscountBasisPoints: discountValue, newcomerCouponAmount: cents(coupon.input.value, '新人券面额'), newcomerCouponMinGoodsAmount: cents(minimum.input.value, '新人券门槛'), version: policy.version };
            const dialog = modal(options, '确认更新交易规则', '确认保存'); dialog.add(note(`当前版本${policy.version}。新运费${formatMoney(next.freightAmount)}，满${formatMoney(next.freeShippingThresholdAmount)}免运费；临期${next.nearExpiryDays}天内，原价${money(next.nearExpiryDiscountBasisPoints)}%；新人券${formatMoney(next.newcomerCouponAmount)}。新报价与新发券使用新规则，历史订单和已发优惠券保持原快照。`));
            dialog.form.onsubmit = event => { event.preventDefault(); void options.run(async () => { await operations.updatePolicies(next); dialog.popup.close(); await refreshAll(); }); };
        }); };
        body.replaceChildren(note(`规则版本 ${policy.version}。金额由服务端按整数分结算；规则变更后未提交的旧报价需要重新确认。新人券面额填0可暂停新发券，不回收已发优惠券。`), form);
    };

    const loaders: Record<Tab, () => Promise<void>> = { products: () => loadProducts(productPage), batches: () => loadBatches(batchPage), movements: () => loadMovements(movementPage), slots: loadSlots, policies: loadPolicies };
    async function activate(key: Tab) {
        if (!allowed.some(tab => tab.key === key)) return; revision++; lastTab.set(user!.userId, key);
        for (const button of tabs.querySelectorAll<HTMLButtonElement>('button')) { const selected = button.dataset.tab === key; button.dataset.tone = selected ? '' : 'quiet'; button.setAttribute('aria-current', selected ? 'page' : 'false'); }
        body.replaceChildren(note('正在读取最新业务数据…'));
        try { await loaders[key](); } catch (error) { errorBox(body, error); body.append(action('重新读取', () => void options.run(() => activate(key)))); }
    }
    for (const tab of allowed) { const button = action(tab.label, () => void options.run(() => activate(tab.key))); button.dataset.tab = tab.key; tabs.append(button); }
    const previous = lastTab.get(user.userId); await activate(previous && allowed.some(tab => tab.key === previous) ? previous : allowed[0]!.key);
}
