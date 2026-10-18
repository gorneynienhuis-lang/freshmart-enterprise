import { mall, unwrap } from '../api/client';
import type { Models } from '../domain';
import { executeCommand as cmd, commandHeaders as header } from './service';

const { api } = mall;
export type ProductQuery = { page?: number; size?: number; status?: Models['AdminProduct']['status'] };
export type BatchQuery = { page?: number; size?: number; skuId?: string; lifecycle?: Models['Batch']['lifecycle']; freshness?: Models['Batch']['freshness'] };
export type MovementQuery = { page?: number; size?: number; batchId?: string; orderId?: string };

/** Uses the same authenticated client and durable command identity ledger as the rest of the app. */
export const operations = {
    categories: async () => unwrap(await api.GET('/api/v1/categories')),
    publicProducts: async () => unwrap(await api.GET('/api/v1/products', { params: { query: { page: 1, size: 100 } } })),
    products: async (query: ProductQuery = {}) => unwrap(await api.GET('/api/v1/admin/products', { params: { query: { page: 1, size: 20, ...query } } })),
    product: async (productId: string) => unwrap(await api.GET('/api/v1/admin/products/{productId}', { params: { path: { productId } } })),
    createProduct: async (body: Models['ProductWriteRequest']) => cmd('POST', '/api/v1/admin/products', body, async key => unwrap(await api.POST('/api/v1/admin/products', { body, params: { header: header(key) } }))),
    patchProduct: async (productId: string, body: Models['ProductPatchRequest']) => cmd('PATCH', `/api/v1/admin/products/${productId}`, body, async key => unwrap(await api.PATCH('/api/v1/admin/products/{productId}', { body, params: { path: { productId }, header: header(key) } }))),
    productStatus: async (productId: string, body: Models['ProductStatusRequest']) => cmd('PUT', `/api/v1/admin/products/${productId}/status`, body, async key => unwrap(await api.PUT('/api/v1/admin/products/{productId}/status', { body, params: { path: { productId }, header: header(key) } }))),
    createSku: async (productId: string, body: Models['SkuWriteRequest']) => cmd('POST', `/api/v1/admin/products/${productId}/skus`, body, async key => unwrap(await api.POST('/api/v1/admin/products/{productId}/skus', { body, params: { path: { productId }, header: header(key) } }))),
    patchSku: async (skuId: string, body: Models['SkuPatchRequest']) => cmd('PATCH', `/api/v1/admin/skus/${skuId}`, body, async key => unwrap(await api.PATCH('/api/v1/admin/skus/{skuId}', { body, params: { path: { skuId }, header: header(key) } }))),
    batches: async (query: BatchQuery = {}) => unwrap(await api.GET('/api/v1/admin/batches', { params: { query: { page: 1, size: 20, ...query } } })),
    batch: async (batchId: string) => unwrap(await api.GET('/api/v1/admin/batches/{batchId}', { params: { path: { batchId } } })),
    createBatch: async (body: Models['BatchCreateRequest']) => cmd('POST', '/api/v1/admin/batches', body, async key => unwrap(await api.POST('/api/v1/admin/batches', { body, params: { header: header(key) } }))),
    adjust: async (batchId: string, body: Models['InventoryAdjustmentRequest']) => cmd('POST', `/api/v1/admin/batches/${batchId}/adjustments`, body, async key => unwrap(await api.POST('/api/v1/admin/batches/{batchId}/adjustments', { body, params: { path: { batchId }, header: header(key) } }))),
    lifecycle: async (batchId: string, body: Models['BatchLifecycleRequest']) => cmd('PUT', `/api/v1/admin/batches/${batchId}/lifecycle`, body, async key => unwrap(await api.PUT('/api/v1/admin/batches/{batchId}/lifecycle', { body, params: { path: { batchId }, header: header(key) } }))),
    movements: async (query: MovementQuery = {}) => unwrap(await api.GET('/api/v1/admin/inventory-movements', { params: { query: { page: 1, size: 20, ...query } } })),
    slots: async (date: string) => unwrap(await api.GET('/api/v1/admin/delivery-slots', { params: { query: { date } } })),
    updateSlot: async (slotId: string, body: Models['SlotPolicyUpdateRequest']) => cmd('PUT', `/api/v1/admin/delivery-slots/${slotId}`, body, async key => unwrap(await api.PUT('/api/v1/admin/delivery-slots/{slotId}', { body, params: { path: { slotId }, header: header(key) } }))),
    policies: async () => unwrap(await api.GET('/api/v1/admin/policies')),
    updatePolicies: async (body: Models['BusinessPolicies']) => cmd('PUT', '/api/v1/admin/policies', body, async key => unwrap(await api.PUT('/api/v1/admin/policies', { body, params: { header: header(key) } }))),
};
