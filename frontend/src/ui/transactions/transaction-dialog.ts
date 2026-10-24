/** Shared presentation for checkout and fulfillment dialogs. Business commands stay in Application. */
import '../../styles/transaction-dialog.css';

export function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

export function transactionSurface(dialog: HTMLDialogElement, options: {
    kind: 'payment' | 'cancel' | 'picking' | 'delivery' | 'aftersale' | 'review';
    title: string;
    description: string;
}) {
    dialog.className = 'fm-transaction-dialog';
    dialog.dataset.kind = options.kind;
    dialog.style.removeProperty('max-width');
    const head = node('header', 'fm-transaction-head');
    const identity = node('div', 'fm-transaction-identity');
    const icon = node('span', 'fm-transaction-icon');
    icon.setAttribute('aria-hidden', 'true');
    const paths = options.kind === 'payment'
        ? '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>'
        : '<path d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10"/>';
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    const titles = node('div', 'fm-transaction-titles');
    const heading = node('h2', '', options.title);
    heading.id = `transaction-${crypto.randomUUID()}`;
    const description = node('p', '', options.description);
    description.id = `${heading.id}-description`;
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.setAttribute('aria-describedby', description.id);
    titles.append(heading, description);
    identity.append(icon, titles);
    const close = node('button', 'fm-transaction-close');
    close.type = 'button';
    close.setAttribute('aria-label', `关闭${options.title}`);
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    close.onclick = () => dialog.close();
    head.append(identity, close);
    const body = node('div', 'fm-transaction-body');
    const footer = node('footer', 'fm-transaction-actions');
    dialog.replaceChildren(head, body, footer);
    queueMicrotask(() => { if (dialog.isConnected && dialog.open) close.focus({ preventScroll: true }); });
    return { body, footer };
}

export function transactionButton(label: string, action: () => void, tone: 'primary' | 'secondary' | 'text' = 'primary') {
    const button = node('button', 'fm-transaction-button', label);
    button.type = 'button';
    button.dataset.tone = tone;
    button.onclick = action;
    return button;
}
