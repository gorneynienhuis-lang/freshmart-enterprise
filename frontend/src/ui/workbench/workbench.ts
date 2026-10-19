/**
 * 员工工作台（当前版 r03）的外壳与列表行呈现。
 * 只负责布局、导航与展示；所有业务数据、权限判断和操作仍由 application.ts 及各面板完成。
 */
import '../../styles/workbench.css';

export interface WorkbenchUser {
    displayName: string;
    roles: readonly string[];
}

export interface WorkbenchShellOptions {
    user: WorkbenchUser;
    roleNames: Readonly<Record<string, string>>;
    onHome(): void;
    onRefresh(): void;
    onSwitch(): void;
    onLogout(): void;
}

/** 各岗位的一句话职责，摘自 contracts/permissions.md 的“默认职责”。 */
const ROLE_DUTY: Readonly<Record<string, string>> = {
    PICKER: '入库、批次与库存调整，领取拣货任务、称重，并完成出库交接。',
    COURIER: '查看本人配送任务，送达时核对签收码，必要时上报配送异常。',
    OPERATOR: '维护商品与规格、上下架、配送时段和交易规则，关注经营看板。',
    SERVICE: '领取并审核售后工单，在允许的状态下取消订单、处理配送异常。',
    FINANCE: '执行已审核的退款、重试失败退款，并完成资金日对账。',
    ADMIN: '管理员工账户、岗位分配与账户状态，查询操作审计。',
};

/** 导航图标（线性 24px），按分区标题匹配。 */
const ICONS: readonly [RegExp, string][] = [
    [/概览|看板/, '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>'],
    [/门店业务|商品|仓储/, '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 13h6"/>'],
    [/订单/, '<path d="M7 3h10l2 3v15H5V6zM9 10h6M9 14h6M9 18h3"/>'],
    [/拣货/, '<path d="M4 7h16l-1.5 12h-13zM9 7V5a3 3 0 016 0v2"/>'],
    [/配送/, '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7M7.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>'],
    [/售后/, '<path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5M12 16h.01"/>'],
    [/退款/, '<path d="M4 7h13a3 3 0 010 6H8M8 13l3-3M8 13l3 3M4 17h16"/>'],
    [/对账|资金/, '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    [/员工|权限/, '<path d="M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 11a3 3 0 100-6M22 21a6 6 0 00-5-5.9"/>'],
    [/审计/, '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4"/>'],
];
const DEFAULT_ICON = '<path d="M5 5h14v14H5z"/>';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
}

function svg(paths: string, size = 18): string {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function textButton(label: string, onClick: () => void, tone: 'quiet' | 'ghost' = 'quiet', icon?: string): HTMLButtonElement {
    const b = node('button', `fm-wb-btn fm-wb-btn-${tone}`);
    b.type = 'button';
    b.innerHTML = (icon ? svg(icon, 16) : '') + `<span>${label}</span>`;
    b.onclick = onClick;
    return b;
}

function greeting(): string {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }).format(new Date()));
    if (hour < 11) return '早上好';
    if (hour < 13) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
}

function today(): string {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
}

/** 搭好工作台外壳，返回放置各业务分区的内容容器。 */
export function buildWorkbenchShell(root: HTMLElement, options: WorkbenchShellOptions): HTMLElement {
    const { user, roleNames } = options;
    const staffRoles = user.roles.filter(r => r !== 'MEMBER');
    root.replaceChildren();
    root.dataset.page = 'Workbench';
    delete root.dataset.runtime;

    const app = node('div', 'fm-wb');

    // 顶栏
    const top = node('header', 'fm-wb-top');
    const brand = node('a', 'fm-wb-brand');
    brand.href = '#/operations';
    brand.setAttribute('aria-label', '员工工作台首页');
    const logo = node('img');
    logo.src = '/generated/dhu-lockup-h.png';
    logo.alt = '东华大学';
    logo.width = 150;
    logo.height = 46;
    const brandText = node('span');
    brandText.append(node('strong', undefined, '社区生鲜'), node('small', undefined, '员工工作台'));
    brand.append(logo, brandText);

    const tools = node('div', 'fm-wb-tools');
    tools.append(textButton('返回商城', options.onHome, 'ghost', '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>'));
    const who = node('div', 'fm-wb-user');
    const avatar = node('span', 'fm-wb-avatar', (user.displayName.replace(/^.*[-－·]/, '') || user.displayName).slice(0, 1));
    avatar.setAttribute('aria-hidden', 'true');
    const whoText = node('span');
    whoText.append(node('strong', undefined, user.displayName), node('small', undefined, staffRoles.map(r => roleNames[r] ?? r).join(' · ') || '员工'));
    who.append(avatar, whoText);
    tools.append(who, textButton('切换账户', options.onSwitch), textButton('退出', options.onLogout));
    top.append(brand, tools);

    // 主体：侧栏 + 内容
    const body = node('div', 'fm-wb-body');
    const aside = node('aside', 'fm-wb-side');
    const nav = node('nav', 'fm-wb-nav');
    nav.setAttribute('aria-label', '工作台分区');
    aside.append(node('p', 'fm-wb-side-label', '工作分区'), nav);
    const hint = node('p', 'fm-wb-side-note', '页面只显示当前岗位可用的操作，所有处理结果以服务端返回为准。');
    aside.append(hint);

    const main = node('main', 'fm-wb-main');
    const intro = node('section', 'fm-wb-intro');
    const introText = node('div');
    const name = user.displayName.replace(/^.*[-－]/, '');
    introText.append(
        node('p', 'fm-wb-date', today()),
        node('h1', undefined, `${greeting()}，${name}`),
        node('p', 'fm-wb-duty', staffRoles.map(r => ROLE_DUTY[r]).filter(Boolean).join(' ') || '当前账户没有员工岗位。'),
    );
    const roleTags = node('div', 'fm-wb-roles');
    for (const r of staffRoles) roleTags.append(node('span', undefined, roleNames[r] ?? r));
    introText.append(roleTags);
    intro.append(introText, textButton('刷新数据', options.onRefresh, 'quiet', '<path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6"/>'));

    const content = node('div', 'fm-wb-content');
    main.append(intro, content);
    body.append(aside, main);
    app.append(top, body);
    root.append(app);
    return content;
}

/** 内容渲染完成后调用：根据实际出现的分区生成侧栏导航，并高亮当前分区。 */
export function finishWorkbench(content: HTMLElement): void {
    const app = content.closest('.fm-wb');
    const nav = app?.querySelector<HTMLElement>('.fm-wb-nav');
    if (!app || !nav) return;
    nav.replaceChildren();
    const sections = [...content.querySelectorAll<HTMLElement>(':scope > section')];
    const links = new Map<Element, HTMLAnchorElement>();
    sections.forEach((section, index) => {
        const title = section.querySelector('h2')?.textContent?.trim();
        if (!title) return;
        section.id ||= `wb-${index}`;
        section.classList.add('fm-wb-section');
        const a = node('a');
        a.href = `#${section.id}`;
        const icon = ICONS.find(([re]) => re.test(title))?.[1] ?? DEFAULT_ICON;
        a.innerHTML = svg(icon) + `<span>${title}</span>`;
        a.onclick = e => {
            e.preventDefault();
            section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
            setActive(a);
        };
        nav.append(a);
        links.set(section, a);
    });
    if (!links.size) {
        nav.append(node('span', 'fm-wb-nav-empty', '当前岗位暂无工作分区'));
        return;
    }
    function setActive(active: HTMLAnchorElement) {
        for (const a of links.values()) {
            if (a === active) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        }
    }
    const first = links.values().next().value;
    if (first) setActive(first);
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
        if (!nav.isConnected) { observer.disconnect(); return; }
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const link = visible && links.get(visible.target);
        if (link) setActive(link);
    }, { rootMargin: '-90px 0px -60% 0px' });
    for (const section of links.keys()) observer.observe(section);
}

export type WorkTone = 'todo' | 'active' | 'done' | 'muted' | 'alert';

export interface WorkItemOptions {
    /** 主标题，例如订单号或“拣货 · 沙瓤番茄 等 2 件” */
    title: string;
    /** 标题下方的小字，例如任务编号 */
    code?: string;
    status: string;
    tone: WorkTone;
    /** 一行一条的辅助信息 */
    meta?: readonly string[];
    /** 右上角的金额 */
    amount?: string;
}

/** 列表中的一条工作项：标题 + 状态标签 + 辅助信息；调用方之后 append 的按钮会排成底部操作栏。 */
export function workItem(options: WorkItemOptions): HTMLElement {
    const row = node('section', 'fm-work-item');
    row.dataset.tone = options.tone;
    const head = node('header', 'fm-work-head');
    const titles = node('div', 'fm-work-titles');
    const h = node('h3', undefined, options.title);
    titles.append(h);
    if (options.code) titles.append(node('small', undefined, options.code));
    const status = node('span', 'fm-work-status', options.status);
    status.dataset.tone = options.tone;
    head.append(titles);
    if (options.amount) head.append(node('strong', 'fm-work-amount', options.amount));
    head.append(status);
    row.append(head);
    if (options.meta?.length) {
        const meta = node('ul', 'fm-work-meta');
        for (const line of options.meta) meta.append(node('li', undefined, line));
        row.append(meta);
    }
    return row;
}

/** 根据业务状态挑选标签色调。 */
export function toneOf(status: string): WorkTone {
    if (/^(UNASSIGNED|PENDING_DISPATCH|APPLIED|PENDING|PENDING_PAY|PAID|READY_TO_SHIP)$/.test(status)) return 'todo';
    if (/^(CLAIMED|DELIVERING|PICKING|PROCESSING|REFUNDING|APPROVED)$/.test(status)) return 'active';
    if (/^(COMPLETED|FINISHED|SUCCESS)$/.test(status)) return 'done';
    if (/^(EXCEPTION|FAILED)$/.test(status)) return 'alert';
    return 'muted';
}
