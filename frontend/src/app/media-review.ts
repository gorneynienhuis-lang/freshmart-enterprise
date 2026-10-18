import { mall } from '../api/client';
import { ApiError } from '../api/errors';
import type { Models } from '../domain';
import { privateImageBlob, productReviews, publicReviewImagePath, submitReview, uploadOrderImage, validateImageFile, type OrderImagePurpose } from './media-service';
import '../styles/admin-panel.css';

export type MediaUiOptions = {
    dialog: (title: string) => HTMLDialogElement;
    run: (action: () => Promise<void>) => Promise<void>;
    reload: () => Promise<void>;
    notify?: (message: string) => void;
};
type UploadOptions = Pick<MediaUiOptions, 'run'> & Partial<Pick<MediaUiOptions, 'dialog'>> & { purpose?: OrderImagePurpose; ownerDialog?: HTMLDialogElement };
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
    const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result;
};
function button(text: string, callback: () => void, quiet = false) {
    const result = node('button', text, 'fm-management-button'); result.type = 'button'; if (quiet) result.dataset.tone = 'quiet'; result.onclick = callback; return result;
}
function disposeWithOwner(owner: HTMLElement, dispose: () => void): () => void {
    let connected = owner.isConnected;
    const observer = new MutationObserver(() => { if (owner.isConnected) connected = true; else if (connected) dispose(); });
    observer.observe(document.body, { childList: true, subtree: true });
    owner.addEventListener('close', dispose);
    return () => { observer.disconnect(); owner.removeEventListener('close', dispose); };
}

/** Controlled private pixels only. The signed access URL is never assigned to img/href or persistent storage. */
export function openEvidencePreview(mediaIds: readonly string[], options: Pick<MediaUiOptions, 'dialog' | 'run'>): void {
    const dialog = options.dialog('查看图片证据'); dialog.classList.add('fm-management-dialog');
    const message = node('p', '正在核验授权并读取图片…', 'fm-management-note'); message.setAttribute('role', 'status');
    const gallery = node('div'); gallery.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;max-width:760px';
    dialog.append(message, gallery);
    const objectUrls = new Set<string>(); const controller = new AbortController(); let disposed = false; let stop = () => {};
    const owner = mall.auth.getSnapshot().user?.userId;
    const unsubscribe = mall.auth.subscribe(() => { if (mall.auth.getSnapshot().user?.userId !== owner) { dialog.close(); dispose(); } });
    const dispose = () => { if (disposed) return; disposed = true; controller.abort(); gallery.replaceChildren(); for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); stop(); unsubscribe(); };
    stop = disposeWithOwner(dialog, dispose);
    void options.run(async () => {
        try {
            const ids = [...new Set(mediaIds)];
            if (!ids.length) { message.textContent = '该工单没有已关联图片。'; return; }
            if (ids.length > 6) throw new Error('证据图片数量超过约定。');
            for (const [index, mediaId] of ids.entries()) {
                const blob = await privateImageBlob(mediaId, controller.signal); if (disposed) return;
                const url = URL.createObjectURL(blob); objectUrls.add(url);
                const figure = node('figure'); figure.style.cssText = 'margin:0;min-width:0';
                const image = node('img'); image.src = url; image.alt = `订单图片证据 ${index + 1}`; image.style.cssText = 'display:block;width:100%;height:240px;object-fit:contain;border:1px solid #E3E6EA;border-radius:6px;background:#F7F8FA';
                figure.append(image, node('figcaption', `图片 ${index + 1}`, 'fm-management-note')); gallery.append(figure);
            }
            message.textContent = `已读取 ${ids.length} 张授权图片，关闭窗口后释放本地预览。`;
        } catch (error) { if (!disposed) { message.textContent = '图片读取失败，请关闭后重试或刷新工单授权。'; throw error; } }
    });
}

/** Files stay in memory. ids() returns only verified READY references; call uploadPending() before business submission. */
export function createEvidenceUploader(orderId: string, options: UploadOptions): { element: HTMLElement; ids: () => string[]; uploadPending: () => Promise<void>; dispose: () => void } {
    const purpose = options.purpose ?? 'AFTERSALE';
    const element = node('fieldset', undefined, 'fm-management-roles fm-management-wide'); element.dataset.mediaUploader = purpose;
    element.append(node('legend', purpose === 'REVIEW' ? '评价图片（可选）' : '订单图片证据'));
    const label = node('label', undefined, 'fm-management-field'); label.append(node('span', '选择图片，最多 6 张'));
    const input = node('input'); input.type = 'file'; input.name = `${purpose.toLowerCase()}Images`; input.multiple = true; input.accept = 'image/jpeg,image/png,image/webp';
    label.append(input, node('small', '每张不超过 6MiB，支持 JPEG、PNG、WebP。图片先上传核验，提交时关联到本次订单。'));
    const list = node('ul'); list.style.cssText = 'list-style:none;margin:12px 0;padding:0;display:grid;gap:8px';
    const status = node('p', '尚未选择图片。', 'fm-management-note'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const upload = button('上传所选图片', () => { void options.run(uploadPending).finally(() => render()); });
    element.append(label, list, status, upload);
    type Entry = { key: string; file?: File; mediaId?: string; previewUrl?: string; state: 'pending' | 'uploading' | 'ready' | 'error'; error?: string };
    const objectUrls = new Set<string>();
    let entries: Entry[] = []; let uploading = false; let disposed = false; let active: Promise<void> | undefined; let stop = () => {};
    const owner = mall.auth.getSnapshot().user?.userId;
    const unsubscribe = mall.auth.subscribe(() => { if (mall.auth.getSnapshot().user?.userId !== owner) dispose(); });
    const dispose = () => { if (disposed) return; disposed = true; for (const entry of entries) delete entry.file; entries = []; for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); input.value = ''; input.disabled = true; list.replaceChildren(); status.textContent = '图片面板已关闭。'; stop(); unsubscribe(); };
    stop = disposeWithOwner(options.ownerDialog ?? element, dispose);
    const render = () => {
        if (disposed) return;
        list.replaceChildren();
        for (const [index, entry] of entries.entries()) {
            const row = node('li'); row.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:9px;padding:10px 12px;border:1px solid #E3E6EA;border-radius:5px;background:#FAFBFC;font-size:12px';
            row.append(node('span', `图片 ${index + 1} · ${{ pending: '待上传', uploading: '正在上传', ready: '已核验', error: '上传失败' }[entry.state]}`));
            if (entry.error) { const error = node('small', entry.error); error.style.color = '#A0021F'; row.append(error); }
            if (entry.mediaId && !entry.previewUrl) { const preview = button('查看图片', () => { void options.run(async () => { const blob = await privateImageBlob(entry.mediaId!); if (disposed || !entries.includes(entry)) return; const url = URL.createObjectURL(blob); objectUrls.add(url); entry.previewUrl = url; render(); }); }, true); preview.disabled = uploading; row.append(preview); }
            if (entry.previewUrl) { const image = node('img'); image.src = entry.previewUrl; image.alt = `已核验的订单图片 ${index + 1}`; image.style.cssText = 'display:block;flex-basis:100%;width:100%;max-height:280px;object-fit:contain;background:#FFF;border-radius:4px'; row.append(image); }
            const remove = button('移除', () => { entries = entries.filter(candidate => candidate.key !== entry.key); delete entry.file; if (entry.previewUrl) { URL.revokeObjectURL(entry.previewUrl); objectUrls.delete(entry.previewUrl); } render(); }, true); remove.setAttribute('aria-label', `移除图片 ${index + 1}`); remove.disabled = uploading; row.append(remove); list.append(row);
        }
        const ready = entries.filter(entry => entry.state === 'ready').length;
        status.textContent = entries.length ? `已选择 ${entries.length} / 6 张，${ready} 张已核验。` : '尚未选择图片。';
        input.disabled = uploading || entries.length >= 6; upload.disabled = uploading || !entries.some(entry => entry.file && entry.state !== 'ready');
    };
    input.onchange = () => {
        const files = [...(input.files ?? [])]; input.value = '';
        void options.run(async () => {
            if (files.length + entries.length > 6) throw new Error('一次最多关联 6 张图片，请先移除多余图片。');
            files.forEach(validateImageFile);
            for (const file of files) entries.push({ key: crypto.randomUUID(), file, state: 'pending' });
            render();
        });
    };
    function uploadPending(): Promise<void> {
        if (active) return active;
        if (disposed) return Promise.reject(new Error('图片面板已关闭，请重新打开。'));
        uploading = true; render();
        active = Promise.resolve().then(async () => {
            try {
                for (const entry of entries) {
                    if (entry.state === 'ready') continue;
                    if (!entry.file) throw new Error('图片文件已释放，请重新选择。');
                    entry.state = 'uploading'; delete entry.error; render();
                    try {
                        const media = await uploadOrderImage(entry.file, purpose, orderId);
                        if (disposed) throw new Error('图片面板已关闭。');
                        if (media.status !== 'READY' || media.purpose !== purpose) throw new Error('图片尚未通过服务端核验，不能用于提交。');
                        entry.mediaId = media.mediaId; entry.state = 'ready'; delete entry.file;
                    } catch (error) { entry.state = 'error'; entry.error = error instanceof Error ? error.message : '上传失败，请重试'; throw error; }
                }
            } finally { uploading = false; active = undefined; render(); }
        });
        return active;
    }
    render();
    return { element, ids: () => entries.filter(entry => entry.state === 'ready' && entry.mediaId).map(entry => entry.mediaId!), uploadPending, dispose };
}

let reviewSubject: string | undefined;
const reviewedThisSession = new Set<string>();
function reviewedItems() { const subject = mall.auth.getSnapshot().user?.userId; if (subject !== reviewSubject) { reviewedThisSession.clear(); reviewSubject = subject; } return reviewedThisSession; }

export function openReviewDialog(order: Models['Order'], item: Models['OrderItem'], options: MediaUiOptions): void {
    if (order.status !== 'FINISHED' || !mall.auth.getSnapshot().user?.roles.includes('MEMBER')) { const dialog = options.dialog('暂不能评价'); dialog.append(node('p', '请使用会员账户，对本人已完成并实际收到的商品进行评价。', 'fm-management-note')); return; }
    const dialog = options.dialog('评价已购商品'); dialog.classList.add('fm-management-dialog');
    dialog.append(node('p', `${item.productName} · ${item.unitLabel} · ${order.orderNo}`, 'fm-management-note'));
    const form = node('form', undefined, 'fm-management-form');
    const ratingLabel = node('label', undefined, 'fm-management-field fm-management-wide'); ratingLabel.append(node('span', '商品评分'));
    const rating = node('select'); rating.name = 'rating'; rating.required = true; rating.style.cssText = 'min-height:40px;padding:9px 11px;border:1px solid #D9DEE5;border-radius:5px;background:#FFF;font:inherit';
    const empty = node('option', '请选择 1–5 星'); empty.value = ''; rating.append(empty);
    for (let value = 5; value >= 1; value--) { const option = node('option', `${value} 星${value === 5 ? ' · 非常满意' : value === 1 ? ' · 不满意' : ''}`); option.value = String(value); rating.append(option); } ratingLabel.append(rating);
    const contentLabel = node('label', undefined, 'fm-management-field fm-management-wide'); contentLabel.append(node('span', '评价内容'));
    const content = node('textarea'); content.name = 'content'; content.required = true; content.maxLength = 1000; content.rows = 5; content.placeholder = '说说食材品质、包装或配送体验'; content.oninput = () => content.setCustomValidity(''); contentLabel.append(content, node('small', '最多 1000 字，每个已完成订单行可评价一次。'));
    const uploader = createEvidenceUploader(order.orderId, { ...options, purpose: 'REVIEW', ownerDialog: dialog });
    const anonymousLabel = node('label', undefined, 'fm-management-wide'); anonymousLabel.style.cssText = 'display:flex;align-items:center;gap:9px;font-size:12px';
    const anonymous = node('input'); anonymous.type = 'checkbox'; anonymous.name = 'anonymous'; anonymous.checked = true; anonymousLabel.append(anonymous, node('span', '匿名发布评价'));
    const consentLabel = node('label', undefined, 'fm-management-wide'); consentLabel.style.cssText = 'display:flex;align-items:flex-start;gap:9px;font-size:12px;line-height:1.7';
    const consent = node('input'); consent.type = 'checkbox'; consent.name = 'publishReviewImages'; consentLabel.append(consent, node('span', '同意将本次选中的评价图片公开展示在商品评价中（不上传图片时无需勾选）。'));
    const actions = node('div', undefined, 'fm-management-form-actions fm-management-wide'); const submit = node('button', '提交评价', 'fm-management-button'); submit.type = 'submit'; actions.append(button('取消', () => dialog.close(), true), submit);
    form.append(ratingLabel, contentLabel, uploader.element, anonymousLabel, consentLabel, actions); dialog.append(form);
    form.onsubmit = event => { event.preventDefault(); content.setCustomValidity(content.value.trim() ? '' : '请填写有效评价内容。'); if (!form.reportValidity()) return;
        void options.run(async () => {
            await uploader.uploadPending(); const images = uploader.ids();
            if (images.length && !consent.checked) throw new Error('请确认公开所选评价图片，或移除图片后提交。');
            try { await submitReview({ orderItemId: item.orderItemId, rating: Number(rating.value), content: content.value.trim(), imageMediaIds: images, anonymous: anonymous.checked }); }
            catch (error) { if (error instanceof ApiError && error.status === 409 && error.message.includes('订单行已经评价')) { reviewedItems().add(item.orderItemId); dialog.close(); options.notify?.('这个订单行已有评价，每行只能评价一次。'); await options.reload(); return; } throw error; }
            reviewedItems().add(item.orderItemId); dialog.close(); options.notify?.('评价已提交，商品评价中可以查看。'); await options.reload();
        });
    };
}

export function createReviewButton(order: Models['Order'], item: Models['OrderItem'], options: MediaUiOptions): HTMLButtonElement {
    const reviewed = reviewedItems().has(item.orderItemId);
    const result = button(reviewed ? '已评价' : `评价 ${item.productName}`, () => openReviewDialog(order, item, options), true);
    result.disabled = reviewed || order.status !== 'FINISHED'; return result;
}

export async function renderProductReviews(container: HTMLElement, productId: string, options: Pick<MediaUiOptions, 'run'>): Promise<void> {
    const section = node('section', undefined, 'fm-management-section'); section.dataset.productReviews = productId; section.setAttribute('aria-label', '真实购买评价');
    const heading = node('h2', '购买评价'); heading.style.cssText = 'font-size:19px;margin:0 0 14px';
    const content = node('div'); content.append(node('p', '正在读取评价…', 'fm-management-note')); section.append(heading, content); container.append(section);
    let generation = 0;
    const load = async (page: number) => {
        const current = ++generation;
        try {
            const result = await productReviews(productId, page); if (current !== generation || !section.isConnected) return;
            const list = node('div'); list.style.cssText = 'display:grid;gap:15px';
            if (!result.items.length) list.append(node('p', result.total === 0 ? '暂无购买评价。完成订单后可以分享真实体验。' : '这一页没有评价，请返回上一页。', 'fm-management-note'));
            for (const review of result.items) {
                const card = node('article'); card.style.cssText = 'padding:17px 0;border-bottom:1px solid #EEF0F3;min-width:0';
                const header = node('div'); header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap';
                header.append(node('strong', review.displayName)); const stars = node('span', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating)); stars.setAttribute('aria-label', `${review.rating} 星，满分 5 星`); stars.style.color = '#A0021F'; header.append(stars);
                const text = node('p', review.content); text.style.cssText = 'font-size:13px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere';
                const time = node('time', new Date(review.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }), 'fm-management-note'); time.dateTime = review.createdAt;
                card.append(header, text);
                if (review.imageUrls.length) { const pictures = node('div'); pictures.style.cssText = 'display:flex;flex-wrap:wrap;gap:9px;margin:12px 0'; for (const [index, value] of review.imageUrls.entries()) { const image = node('img'); image.src = publicReviewImagePath(value); image.alt = `购买评价图片 ${index + 1}`; image.loading = 'lazy'; image.width = 104; image.height = 104; image.style.cssText = 'width:104px;height:104px;object-fit:cover;border:1px solid #E3E6EA;border-radius:6px'; pictures.append(image); } card.append(pictures); }
                card.append(time); list.append(card);
            }
            const pagination = node('nav', undefined, 'fm-management-pagination'); pagination.setAttribute('aria-label', '购买评价分页');
            const pages = Math.max(1, Math.ceil(result.total / result.size)); const previous = button('上一页', () => { void options.run(() => load(result.page - 1)); }, true); previous.disabled = result.page <= 1;
            const next = button('下一页', () => { void options.run(() => load(result.page + 1)); }, true); next.disabled = result.page >= pages;
            pagination.append(node('span', `共 ${result.total} 条 · 第 ${result.page} / ${pages} 页`), previous, next); content.replaceChildren(list, pagination);
        } catch (error) { content.replaceChildren(node('p', '评价读取失败，请重试。', 'fm-management-note'), button('重新读取评价', () => { void options.run(() => load(page)); }, true)); throw error; }
    };
    await load(1);
}
