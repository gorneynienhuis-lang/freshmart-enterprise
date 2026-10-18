import { mall, unwrap } from '../api/client';
import type { Models } from '../domain';
import { CommandLedger } from './commands';
const { api, auth } = mall;
const ledger = new CommandLedger(typeof sessionStorage === 'undefined' ? undefined : sessionStorage);
const cmd = <T>(method: string, path: string, body: unknown, send: (key: string) => Promise<T>) => ledger.execute(auth.getSnapshot().user?.userId ?? 'anonymous', method, path, body, send);
const header = (key: string) => ({ 'Idempotency-Key': key });
export const service = {
    auth,
    home: async () => unwrap(await api.GET('/api/v1/home')),
    categories: async () => unwrap(await api.GET('/api/v1/categories')),
    products: async (query: {
        keyword?: string;
        categoryId?: string;
        nearExpiry?: boolean;
        sort?: 'RECOMMENDED' | 'PRICE_ASC' | 'PRICE_DESC';
        page?: number;
        size?: number;
    } = {}) => unwrap(await api.GET('/api/v1/products', { params: { query: { size: 100, ...query } } })),
    product: async (productId: string) => unwrap(await api.GET('/api/v1/products/{productId}', { params: { path: { productId } } })),
    cart: async () => unwrap(await api.GET('/api/v1/cart')),
    add: async (body: Models['CartAddRequest']) => cmd('POST', '/api/v1/cart/items', body, async (key) => unwrap(await api.POST('/api/v1/cart/items', { body, params: { header: header(key) } }))),
    updateCart: async (cartItemId: string, body: Models['CartUpdateRequest']) => cmd('PATCH', `/api/v1/cart/items/${cartItemId}`, body, async (key) => unwrap(await api.PATCH('/api/v1/cart/items/{cartItemId}', { body, params: { path: { cartItemId }, header: header(key) } }))),
    removeCart: async (cartItemId: string, version: number) => cmd('DELETE', `/api/v1/cart/items/${cartItemId}`, { version }, async (key) => unwrap(await api.DELETE('/api/v1/cart/items/{cartItemId}', { body: { version }, params: { path: { cartItemId }, header: header(key) } }))),
    addresses: async () => unwrap(await api.GET('/api/v1/addresses')),
    createAddress: async (body: Models['AddressInput']) => cmd('POST', '/api/v1/addresses', body, async (key) => unwrap(await api.POST('/api/v1/addresses', { body, params: { header: header(key) } }))),
    slots: async (date: string, addressId: string) => unwrap(await api.GET('/api/v1/delivery-slots', { params: { query: { date, addressId } } })),
    coupons: async () => unwrap(await api.GET('/api/v1/coupons')),
    quote: async (body: Models['QuoteRequest']) => cmd('POST', '/api/v1/orders/quote', body, async (key) => unwrap(await api.POST('/api/v1/orders/quote', { body, params: { header: header(key) } }))),
    order: async (orderId: string) => unwrap(await api.GET('/api/v1/orders/{orderId}', { params: { path: { orderId } } })),
    orders: async () => unwrap(await api.GET('/api/v1/orders', { params: { query: { size: 100 } } })),
    createOrder: async (body: Models['CreateOrderRequest']) => cmd('POST', '/api/v1/orders', body, async (key) => unwrap(await api.POST('/api/v1/orders', { body, params: { header: header(key) } }))),
    cancel: async (orderId: string, body: Models['ReasonVersionRequest']) => cmd('POST', `/api/v1/orders/${orderId}/cancel`, body, async (key) => unwrap(await api.POST('/api/v1/orders/{orderId}/cancel', { body, params: { path: { orderId }, header: header(key) } }))),
    prepay: async (body: Models['PaymentRequest']) => cmd('POST', '/api/v1/payments/prepay', body, async (key) => unwrap(await api.POST('/api/v1/payments/prepay', { body, params: { header: header(key) } }))),
    simulate: async (paymentId: string, body: Models['SandboxSimulateRequest']) => cmd('POST', `/api/v1/payments/${paymentId}/sandbox-simulate`, body, async (key) => unwrap(await api.POST('/api/v1/payments/{paymentId}/sandbox-simulate', { body, params: { path: { paymentId }, header: header(key) } }))),
    pickTasks: async () => unwrap(await api.GET('/api/v1/admin/pick-tasks', { params: { query: { size: 100 } } })),
    claimPick: async (taskId: string, version: number) => cmd('POST', `/api/v1/admin/pick-tasks/${taskId}/claim`, { version }, async (key) => unwrap(await api.POST('/api/v1/admin/pick-tasks/{taskId}/claim', { body: { version }, params: { path: { taskId }, header: header(key) } }))),
    confirmPick: async (taskId: string, body: Models['PickConfirmRequest']) => cmd('POST', `/api/v1/admin/pick-tasks/${taskId}/confirm`, body, async (key) => unwrap(await api.POST('/api/v1/admin/pick-tasks/{taskId}/confirm', { body, params: { path: { taskId }, header: header(key) } }))),
    deliveryTasks: async () => unwrap(await api.GET('/api/v1/admin/delivery-tasks', { params: { query: { size: 100 } } })),
    dispatch: async (taskId: string, body: Models['DeliveryDispatchRequest']) => cmd('POST', `/api/v1/admin/delivery-tasks/${taskId}/dispatch`, body, async (key) => unwrap(await api.POST('/api/v1/admin/delivery-tasks/{taskId}/dispatch', { body, params: { path: { taskId }, header: header(key) } }))),
    completeDelivery: async (taskId: string, body: Models['DeliveryCompleteRequest']) => cmd('POST', `/api/v1/admin/delivery-tasks/${taskId}/complete`, body, async (key) => unwrap(await api.POST('/api/v1/admin/delivery-tasks/{taskId}/complete', { body, params: { path: { taskId }, header: header(key) } }))),
    aftersales: async()=>unwrap(await api.GET('/api/v1/aftersales',{params:{query:{size:100}}})),
    applyAftersale:async(body:Models['AftersaleRequest'])=>cmd('POST','/api/v1/aftersales',body,async key=>unwrap(await api.POST('/api/v1/aftersales',{body,params:{header:header(key)}}))),
    adminAftersales:async()=>unwrap(await api.GET('/api/v1/admin/aftersales',{params:{query:{size:100}}})),
    claimAftersale:async(aftersaleId:string,version:number)=>cmd('POST',`/api/v1/admin/aftersales/${aftersaleId}/claim`,{version},async key=>unwrap(await api.POST('/api/v1/admin/aftersales/{aftersaleId}/claim',{body:{version},params:{path:{aftersaleId},header:header(key)}}))),
    approveAftersale:async(aftersaleId:string,body:Models['AftersaleReviewRequest'])=>cmd('POST',`/api/v1/admin/aftersales/${aftersaleId}/approve`,body,async key=>unwrap(await api.POST('/api/v1/admin/aftersales/{aftersaleId}/approve',{body,params:{path:{aftersaleId},header:header(key)}}))),
    rejectAftersale:async(aftersaleId:string,body:Models['AftersaleRejectRequest'])=>cmd('POST',`/api/v1/admin/aftersales/${aftersaleId}/reject`,body,async key=>unwrap(await api.POST('/api/v1/admin/aftersales/{aftersaleId}/reject',{body,params:{path:{aftersaleId},header:header(key)}}))),
    refunds:async()=>unwrap(await api.GET('/api/v1/admin/refunds',{params:{query:{size:100}}})),
    executeRefund:async(refundId:string,body:Models['RefundExecuteRequest'])=>cmd('POST',`/api/v1/admin/refunds/${refundId}/execute`,body,async key=>unwrap(await api.POST('/api/v1/admin/refunds/{refundId}/execute',{body,params:{path:{refundId},header:header(key)}}))),
    adminOrders: async () => unwrap(await api.GET('/api/v1/admin/orders', { params: { query: { size: 100 } } })),
    dashboard: async (businessDate: string) => unwrap(await api.GET('/api/v1/admin/dashboard', { params: { query: { businessDate } } })),
    employees: async (page = 1) => unwrap(await api.GET('/api/v1/admin/employees', { params: { query: { page, size: 20 } } })),
    roles: async () => unwrap(await api.GET('/api/v1/admin/roles')),
    createEmployee: async (body: Models['EmployeeCreateRequest']) => cmd('POST', '/api/v1/admin/employees', { ...body, temporaryPassword: await passwordFingerprint(body.temporaryPassword) }, async key => unwrap(await api.POST('/api/v1/admin/employees', { body, params: { header: header(key) } }))),
    employeeRoles: async (id: string, body: Models['EmployeeRolesRequest']) => cmd('PUT', `/api/v1/admin/employees/${id}/roles`, body, async key => unwrap(await api.PUT('/api/v1/admin/employees/{employeeId}/roles', { body, params: { path: { employeeId: id }, header: header(key) } }))),
    employeeStatus: async (id: string, body: Models['EmployeeStatusRequest']) => cmd('PUT', `/api/v1/admin/employees/${id}/status`, body, async key => unwrap(await api.PUT('/api/v1/admin/employees/{employeeId}/status', { body, params: { path: { employeeId: id }, header: header(key) } }))),
    changePassword: async (body: Models['PasswordChangeRequest']) => cmd('POST', '/api/v1/auth/password', { currentPassword: await passwordFingerprint(body.currentPassword), newPassword: await passwordFingerprint(body.newPassword) }, async key => unwrap(await api.POST('/api/v1/auth/password', { body, params: { header: header(key) } }))),
};

// CommandLedger persists pending request identities in sessionStorage. Never put plaintext passwords there.
async function passwordFingerprint(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
