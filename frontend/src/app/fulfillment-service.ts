import { mall, unwrap } from '../api/client';
import type { Models } from '../domain';
import { executeCommand, commandHeaders } from './service';

export const fulfillmentService = {
    reallocate: (taskId: string, body: Models['ReallocateRequest']) => executeCommand('POST', `/api/v1/admin/pick-tasks/${taskId}/reallocate`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/pick-tasks/{taskId}/reallocate', { body, params: { path: { taskId }, header: commandHeaders(key) } }))),
    reportException: (taskId: string, body: Models['DeliveryExceptionRequest']) => executeCommand('POST', `/api/v1/admin/delivery-tasks/${taskId}/exceptions`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/delivery-tasks/{taskId}/exceptions', { body, params: { path: { taskId }, header: commandHeaders(key) } }))),
    resolveException: (taskId: string, body: Models['ResolveDeliveryExceptionRequest']) => executeCommand('POST', `/api/v1/admin/delivery-tasks/${taskId}/resolve-exception`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/delivery-tasks/{taskId}/resolve-exception', { body, params: { path: { taskId }, header: commandHeaders(key) } }))),
    // No contact object is retained in module state, storage, or an application cache.
    contact: (taskId: string, body: Models['ContactAccessRequest'], signal?: AbortSignal) => executeCommand('POST', `/api/v1/admin/delivery-tasks/${taskId}/contact-access`, body,
        async key => unwrap(await mall.api.POST('/api/v1/admin/delivery-tasks/{taskId}/contact-access', { body, ...(signal ? { signal } : {}), params: { path: { taskId }, header: commandHeaders(key) } }))),
    batches: async (skuId: string): Promise<Models['Batch'][]> => {
        const batches: Models['Batch'][] = [];
        for (let page = 1; page <= 20; page++) {
            const result = unwrap(await mall.api.GET('/api/v1/admin/batches', { params: { query: { skuId, page, size: 100 } } }));
            batches.push(...result.items);
            if (page * result.size >= result.total) return batches;
        }
        throw new Error('该规格批次较多，请先整理库存后重新打开重分配。未提交任何库存变更。');
    },
};
