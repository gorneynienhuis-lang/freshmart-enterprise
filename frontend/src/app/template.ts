import legacyDesigns from '../generated/design.json';
import r04Designs from '../generated/design-r04.json';
import { isR04Design } from './design-version';
const selectedDesigns = () => isR04Design() ? r04Designs : legacyDesigns;
export type PageName = keyof typeof legacyDesigns;
export type Values = Record<string, unknown>;
function lookup(path: string, scopes: Values[]): unknown {
    path = path.trim();
    if (path === 'true')
        return true;
    if (path === 'false')
        return false;
    const [key, ...parts] = path.split('.');
    for (let i = scopes.length - 1; i >= 0; i--)
        if (Object.prototype.hasOwnProperty.call(scopes[i], key!)) {
            let value: unknown = scopes[i]![key!];
            for (const p of parts)
                value = value && typeof value === 'object' ? (value as Values)[p] : undefined;
            return value;
        }
}
function interpolate(value: string, scopes: Values[]): string { return value.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => String(lookup(path, scopes) ?? '')); }
function walk(parent: Element, scopes: Values[]): void {
    for (const node of [...parent.childNodes]) {
        if (node.nodeType === Node.TEXT_NODE) {
            node.textContent = interpolate(node.textContent ?? '', scopes);
            continue;
        }
        if (!(node instanceof Element))
            continue;
        if (node.localName === 'sc-for') {
            const items = lookup((node.getAttribute('list') ?? '').replace(/[{}]/g, ''), scopes);
            const fragment = document.createDocumentFragment();
            if (Array.isArray(items))
                for (const [index, item] of items.entries()) {
                    const holder = document.createElement('div');
                    holder.innerHTML = node.innerHTML;
                    walk(holder, [...scopes, { [node.getAttribute('as') ?? 'item']: item, $index: index }]);
                    if (item && typeof item === 'object' && '_key' in item)
                        for (const el of holder.children)
                            el.setAttribute('data-key', String(item._key));
                    fragment.append(...holder.childNodes);
                }
            node.replaceWith(fragment);
            continue;
        }
        if (node.localName === 'sc-if') {
            if (!lookup((node.getAttribute('value') ?? '').replace(/[{}]/g, ''), scopes)) {
                node.remove();
                continue;
            }
            walk(node, scopes);
            node.replaceWith(...node.childNodes);
            continue;
        }
        for (const attr of [...node.attributes]) {
            if (/^on[a-z]+$/i.test(attr.name)) {
                const fn = lookup(attr.value.replace(/[{}]/g, ''), scopes);
                node.removeAttribute(attr.name);
                if (typeof fn === 'function')
                    node.addEventListener(attr.name.slice(2).toLowerCase(), fn as EventListener);
            }
            else if (['disabled', 'checked'].includes(attr.name) && attr.value.startsWith('{{')) {
                if (lookup(attr.value.replace(/[{}]/g, ''), scopes))
                    node.setAttribute(attr.name, '');
                else
                    node.removeAttribute(attr.name);
            }
            else
                node.setAttribute(attr.name, interpolate(attr.value, scopes));
        }
        walk(node, scopes);
    }
}
export function defaults(name: PageName): Values { return structuredClone(selectedDesigns()[name].defaults); }
export function mountTemplate(root: HTMLElement, name: PageName, values: Values): void {
    const designs = selectedDesigns();
    root.dataset.page = name;
    root.innerHTML = `<style>${designs[name].css}</style>${designs[name].template}`;
    walk(root, [values]);
    // Build-time template is trusted; runtime values are assigned as DOM text/attributes, never HTML.
}
