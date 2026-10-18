import { mall, unwrap } from '../api/client';
import type { Models } from '../domain';
import { executeCommand, commandHeaders } from './service';

/** Lifecycle commands share the current actor and durable idempotency ledger. Never auto-replay a write. */
export const lifecycleService = {
    order: async (orderId: string) => unwrap(await mall.api.GET('/api/v1/orders/{orderId}', { params: { path: { orderId } } })),
    requestCancellation: (orderId: string, body: Models['ReasonVersionRequest']) => executeCommand('POST', `/api/v1/orders/${orderId}/cancellation-requests`, body,
        async key => unwrap(await mall.api.POST('/api/v1/orders/{orderId}/cancellation-requests', { body, params: { path: { orderId }, header: commandHeaders(key) } }))),
    aftersale: async (aftersaleId: string) => unwrap(await mall.api.GET('/api/v1/aftersales/{aftersaleId}', { params: { path: { aftersaleId } } })),
    adminOrder: async (orderId: string) => unwrap(await mall.api.GET('/api/v1/admin/orders/{orderId}', { params: { path: { orderId } } })),
    pickTask: async (taskId: string) => unwrap(await mall.api.GET('/api/v1/admin/pick-tasks/{taskId}', { params: { path: { taskId } } })),
    batch: async (batchId: string) => unwrap(await mall.api.GET('/api/v1/admin/batches/{batchId}', { params: { path: { batchId } } })),
    cancelAftersale: (aftersaleId: string, body: Models['ReasonVersionRequest']) => executeCommand('POST', `/api/v1/aftersales/${aftersaleId}/cancel`, body,
        async key => unwrap(await mall.api.POST('/api/v1/aftersales/{aftersaleId}/cancel', { body, params: { path: { aftersaleId }, header: commandHeaders(key) } }))),
    cancelOrder: (orderId: string, body: Models['ReasonVersionRequest']) => executeCommand('POST', `/api/v1/admin/orders/${orderId}/cancel`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/orders/{orderId}/cancel', { body, params: { path: { orderId }, header: commandHeaders(key) } }))),
    receiveReturn: (orderId: string, body: Models['ReturnReceiveRequest']) => executeCommand('POST', `/api/v1/admin/orders/${orderId}/returns/receive`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/orders/{orderId}/returns/receive', { body, params: { path: { orderId }, header: commandHeaders(key) } }))),
    retryRefund: (refundId: string, body: Models['RefundExecuteRequest']) => executeCommand('POST', `/api/v1/admin/refunds/${refundId}/retry`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/refunds/{refundId}/retry', { body, params: { path: { refundId }, header: commandHeaders(key) } }))),
    // There is no unrestricted financial detail route. Read the real, scoped paginated collection.
    refund: async (refund: Pick<Models['AdminRefund'], 'refundId' | 'orderId'>): Promise<Models['AdminRefund']> => {
        for (let page = 1; ; page++) {
            const result = unwrap(await mall.api.GET('/api/v1/admin/refunds', { params: { query: { orderId: refund.orderId, page, size: 100 } } }));
            const current = result.items.find(item => item.refundId === refund.refundId);
            if (current) return current;
            if (!result.items.length || page * result.size >= result.total) throw new Error('退款记录已不在当前可访问范围，请刷新工作台。');
        }
    },
};
