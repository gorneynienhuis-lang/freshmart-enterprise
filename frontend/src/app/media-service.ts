import { mall, unwrap } from '../api/client';
import { ApiError } from '../api/errors';
import type { Models } from '../domain';
import { commandHeaders, executeCommand } from './service';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export type OrderImagePurpose = 'AFTERSALE' | 'REVIEW';
export const validateImageFile = (file: File) => {
    if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('每张图片须大于 0 字节且不超过 6MiB。');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPEG、PNG 或 WebP 图片。实际图片格式还会由服务端检查。');
};
async function sourceHash(file: File): Promise<string> {
    validateImageFile(file);
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** File bytes and filenames stay in this request, never in the command ledger/sessionStorage. */
export async function uploadOrderImage(file: File, purpose: OrderImagePurpose, orderId: string): Promise<Models['MediaReference']> {
    const hash = await sourceHash(file);
    return executeCommand('POST', '/api/v1/media/images', { purpose, orderId, sourceSha256: hash, mimeType: file.type }, async key => {
        const form = new FormData(); form.append('purpose', purpose); form.append('orderId', orderId); form.append('file', file);
        // OpenAPI's binary descriptor is a string type; the serializer sends the real File as multipart bytes.
        const body = { purpose, orderId, file: file as unknown as string };
        return unwrap(await mall.api.POST('/api/v1/media/images', { body, bodySerializer: () => form, params: { header: commandHeaders(key) } }));
    });
}

export async function uploadProductImage(file: File, productId: string | null = null): Promise<Models['ProductMedia']> {
    const hash = await sourceHash(file);
    return executeCommand('POST', '/api/v1/admin/media/images', { productId, sourceSha256: hash, mimeType: file.type }, async key => {
        const form = new FormData(); form.append('productId', productId ?? ''); form.append('file', file);
        return unwrap(await mall.api.POST('/api/v1/admin/media/images', { body: { productId, file: file as unknown as string }, bodySerializer: () => form, params: { header: commandHeaders(key) } }));
    });
}

export async function submitReview(input: Models['ReviewInput']): Promise<Models['Review']> {
    return executeCommand('POST', '/api/v1/reviews', input, async key => unwrap(await mall.api.POST('/api/v1/reviews', { body: input, params: { header: commandHeaders(key) } })));
}

export async function productReviews(productId: string, page = 1): Promise<Models['ReviewPage']> {
    return unwrap(await mall.api.GET('/api/v1/products/{productId}/reviews', { params: { path: { productId }, query: { page, size: 10 } } }));
}

/** Use the trusted API client origin; never send the bearer token to a URL origin returned in data. */
export async function privateImageBlob(mediaId: string, signal?: AbortSignal): Promise<Blob> {
    const reference = unwrap(await mall.api.GET('/api/v1/media/{mediaId}/access', { params: { path: { mediaId } }, ...(signal ? { signal } : {}) }));
    const url = new URL(reference.url, mall.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.pathname !== `/api/v1/media/${encodeURIComponent(mediaId)}/content`) throw new ApiError('图片访问地址不符合受控接口。', { kind: 'protocol' });
    const expiresAt = Number(url.searchParams.get('expiresAt'));
    const sessionId = url.searchParams.get('sessionId');
    const signature = url.searchParams.get('signature');
    if (!Number.isSafeInteger(expiresAt) || !sessionId || !/^[A-Za-z0-9_-]{1,64}$/.test(sessionId) || !signature || !/^[A-Za-z0-9_-]{20,100}$/.test(signature) || [...url.searchParams.keys()].some(key => !['expiresAt', 'sessionId', 'signature'].includes(key))) throw new ApiError('图片授权参数不符合接口约定。', { kind: 'protocol' });
    const response = await mall.api.GET('/api/v1/media/{mediaId}/content', { params: { path: { mediaId }, query: { expiresAt, sessionId, signature } }, parseAs: 'blob', ...(signal ? { signal } : {}) });
    const blob: unknown = response.data;
    if (!(blob instanceof Blob) || !['image/png', 'image/jpeg'].includes(blob.type) || !blob.size || blob.size > MAX_IMAGE_BYTES) throw new ApiError('服务端未返回有效图片。', { kind: 'protocol' });
    return blob;
}

/** Public review images are constrained to the API publication scope, with no signature or private IDs in links. */
export function publicReviewImagePath(value: string): string {
    const url = new URL(value, mall.origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/api\/v1\/media\/reviews\/[A-Za-z0-9_-]{1,64}\/content$/.test(url.pathname)) throw new ApiError('评价图片地址不合法。', { kind: 'protocol' });
    return url.pathname;
}
