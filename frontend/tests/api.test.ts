import { describe, expect, it, vi } from 'vitest';
import { createMallClient, unwrap } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import { createAction } from '../src/api/idempotency';
import { operations } from '../src/api/operations';
import type { components, paths } from '../src/api/schema';

const user: components['schemas']['User'] = {
  userId: 'member-1', displayName: '会员', phoneMasked: '138****0000', roles: ['MEMBER'],
  status: 'ACTIVE', version: 1, permissions: ['order.self.read'], mustChangePassword: false,
};
const csrf = { csrfToken: 'csrf-context-long-enough', expiresAt: '2099-01-01T00:00:00Z' };
const session = {
  accessToken: 'new-access-token-long-enough', tokenType: 'Bearer', expiresIn: 900, user,
  csrfToken: 'new-csrf-context-long-enough', csrfExpiresAt: '2099-01-01T00:00:00Z',
};
const envelope = (data: unknown, status = 200) => Response.json({ code: 0, message: 'ok', data, traceId: 'trace-ok', timestamp: '2026-10-18T00:00:00Z' }, { status });
const failure = (status: number) => Response.json({ code: 1001, message: '真实错误', data: { errorKey: 'UNAUTHENTICATED', retryable: false, details: [] }, traceId: 'trace-error', timestamp: '2026-10-18T00:00:00Z' }, { status });
const mock = (handler: (request: Request) => Response | Promise<Response>): typeof fetch => vi.fn(async input => handler(input as Request)) as typeof fetch;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}

describe('canonical contract', () => {
  it('covers all 91 unique operations without claiming implementation', () => {
    expect(operations).toHaveLength(91);
    expect(new Set(operations.map(operation => operation.operationId)).size).toBe(91);
    expect(operations.every(operation => ['CONTRACT_ONLY', 'IMPLEMENTED_DEMO'].includes(operation.implementationStatus))).toBe(true);
  });
  it('uses typed paths including dynamic path parameters and real envelope data', async () => {
    const fetcher = mock(request => {
      expect(request.url).toBe('http://localhost:8080/api/v1/products/S001');
      expect(request.credentials).toBe('include');
      return envelope({ productId: 'S001' });
    });
    const { api } = createMallClient({ fetch: fetcher });
    const result = await api.GET('/api/v1/products/{productId}', { params: { path: { productId: 'S001' } } });
    expect(unwrap(result).productId).toBe('S001');
  });
});

describe('read recovery and rotating refresh', () => {
  it('single-flights simultaneous 401 reads and recovers both with the new bearer', async () => {
    const gate = deferred<void>();
    let refreshCount = 0;
    const requests: Request[] = [];
    const fetcher = mock(async request => {
      requests.push(request);
      if (request.url.endsWith('/csrf')) return envelope(csrf);
      if (request.url.endsWith('/refresh')) {
        refreshCount++;
        await gate.promise;
        expect(request.headers.get('X-CSRF-Token')).toBe(csrf.csrfToken);
        expect(request.headers.get('Authorization')).toBeNull();
        return envelope(session);
      }
      return request.headers.get('Authorization') ? envelope(user) : failure(401);
    });
    const { api, auth } = createMallClient({ fetch: fetcher });
    const first = api.GET('/api/v1/auth/me');
    const second = api.GET('/api/v1/auth/me');
    await vi.waitFor(() => expect(refreshCount).toBe(1));
    gate.resolve();
    await Promise.all([first, second]);
    expect(refreshCount).toBe(1);
    expect(auth.getSnapshot().user).toEqual(user);
    expect(requests.every(request => request.credentials === 'include')).toBe(true);
    expect(requests.filter(request => request.url.endsWith('/me'))).toHaveLength(4);
  });
  it('late 401 from an older request reuses the fresh token instead of rotating twice', async () => {
    const late = deferred<Response>();
    let initialReads = 0;
    let refreshCount = 0;
    const fetcher = mock(request => {
      if (request.url.endsWith('/csrf')) return envelope(csrf);
      if (request.url.endsWith('/refresh')) { refreshCount++; return envelope(session); }
      if (request.headers.has('Authorization')) return envelope(user);
      initialReads++;
      return initialReads === 1 ? late.promise : failure(401);
    });
    const { api } = createMallClient({ fetch: fetcher });
    const first = api.GET('/api/v1/auth/me');
    await api.GET('/api/v1/auth/me');
    late.resolve(failure(401));
    await first;
    expect(refreshCount).toBe(1);
  });
  it('does not loop on a second 401', async () => {
    let refreshCount = 0;
    const { api } = createMallClient({ fetch: mock(request => {
      if (request.url.endsWith('/csrf')) return envelope(csrf);
      if (request.url.endsWith('/refresh')) { refreshCount++; return envelope(session); }
      return failure(401);
    }) });
    await expect(api.GET('/api/v1/auth/me')).rejects.toMatchObject({ status: 401, traceId: 'trace-error' });
    expect(refreshCount).toBe(1);
  });
  it('blocks automatic rotation retries after an uncertain refresh failure', async () => {
    let refreshCount = 0;
    const { api } = createMallClient({ fetch: mock(request => {
      if (request.url.endsWith('/csrf')) return envelope(csrf);
      if (request.url.endsWith('/refresh')) { refreshCount++; throw new TypeError('connection lost'); }
      return failure(401);
    }) });
    await expect(api.GET('/api/v1/auth/me')).rejects.toMatchObject({ kind: 'network' });
    await expect(api.GET('/api/v1/auth/me')).rejects.toMatchObject({ kind: 'session' });
    expect(refreshCount).toBe(1);
  });
});

describe('write safety and errors', () => {
  it.each([401, 409, 500, 503])('never refreshes or replays a POST on HTTP %s', async status => {
    const fetcher = mock(() => failure(status));
    const { api } = createMallClient({ fetch: fetcher });
    await expect(api.POST('/api/v1/payments/prepay', {
      body: { orderId: 'order-1', purpose: 'ORDER' },
      params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
    })).rejects.toMatchObject({ kind: 'http', status, code: 1001, traceId: 'trace-error' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('marks a lost POST response as unknown outcome without replaying it', async () => {
    const fetcher = mock(() => { throw new TypeError('offline'); });
    const { api } = createMallClient({ fetch: fetcher });
    await expect(api.POST('/api/v1/orders', {
      body: { quoteId: 'quote-1', quoteToken: 'quote-token-long-enough' },
      params: { header: { 'Idempotency-Key': crypto.randomUUID() } },
    })).rejects.toMatchObject({ kind: 'network', outcomeUnknown: true, status: undefined });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('uses trace header for non-JSON HTTP errors', async () => {
    const { api } = createMallClient({ fetch: mock(() => new Response('proxy unavailable', { status: 502, headers: { 'X-Trace-Id': 'proxy-trace' } })) });
    await expect(api.GET('/api/v1/home')).rejects.toMatchObject({ status: 502, traceId: 'proxy-trace' });
  });
  it('rejects an HTTP 200 business error as a protocol failure', async () => {
    const { api } = createMallClient({ fetch: mock(() => failure(200)) });
    await expect(api.GET('/api/v1/home')).rejects.toMatchObject({ kind: 'protocol', status: 200, code: 1001 });
  });
  it('rejects route overrides before transmitting credentials', async () => {
    const fetcher = mock(() => envelope({}));
    const { api } = createMallClient({ fetch: fetcher });
    await expect(api.GET('/api/v1/home', { baseUrl: 'https://unexpected.example' })).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps a manual retry key stable and refuses changed payloads', () => {
    const payload = { quoteId: 'quote-1', quoteToken: 'quote-token' };
    const action = createAction('POST', '/api/v1/orders', payload);
    expect(action.headersFor(payload)).toEqual(action.headersFor({ quoteToken: 'quote-token', quoteId: 'quote-1' }));
    expect(() => action.headersFor({ ...payload, quoteId: 'quote-2' })).toThrow('Payload changed');
    expect(createAction('POST', '/api/v1/orders', payload).key).not.toBe(action.key);
  });
});

describe('session boundaries', () => {
  it('login obtains CSRF and never refreshes invalid credentials', async () => {
    const urls: string[] = [];
    const { auth } = createMallClient({ fetch: mock(request => {
      urls.push(request.url);
      if (request.url.endsWith('/csrf')) return envelope(csrf);
      expect(request.headers.get('X-CSRF-Token')).toBe(csrf.csrfToken);
      return failure(401);
    }) });
    await expect(auth.login({ phone: '13800138000', password: 'invalid-password' })).rejects.toMatchObject({ status: 401 });
    expect(urls.map(url => url.split('/').at(-1))).toEqual(['csrf', 'login']);
    expect(auth.getSnapshot().status).toBe('anonymous');
  });
  it('logout waits for rotation and never restores a late access token', async () => {
    const gate = deferred<void>();
    const calls: string[] = [];
    const { auth } = createMallClient({ fetch: mock(async request => {
      const route = request.url.split('/').at(-1)!;
      calls.push(route);
      if (route === 'csrf') return envelope(csrf);
      if (route === 'refresh') { await gate.promise; return envelope(session); }
      return envelope({});
    }) });
    const refresh = auth.refresh().catch(error => error);
    await vi.waitFor(() => expect(calls).toContain('refresh'));
    const logout = auth.logout();
    gate.resolve();
    await Promise.all([refresh, logout]);
    expect(calls.indexOf('logout')).toBeGreaterThan(calls.indexOf('refresh'));
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.getSnapshot().status).toBe('anonymous');
  });
  it('renews an expired CSRF context and coalesces concurrent acquisition', async () => {
    let count = 0;
    const { auth } = createMallClient({ fetch: mock(() => {
      count++;
      return envelope({ ...csrf, expiresAt: count === 1 ? '2000-01-01T00:00:00Z' : csrf.expiresAt });
    }) });
    await auth.ensureCsrf();
    await Promise.all([auth.ensureCsrf(), auth.ensureCsrf()]);
    expect(count).toBe(2);
  });
});

// Compile-time contract checks. These lines are deliberately not executed.
function typeContract(api: ReturnType<typeof createMallClient>['api']) {
  // @ts-expect-error unknown endpoint
  api.GET('/api/v1/made-up');
  // @ts-expect-error a payment action requires the idempotency header
  api.POST('/api/v1/payments/prepay', { body: { orderId: 'o1', purpose: 'ORDER' } });
  // @ts-expect-error generated ID fields must remain strings
  const invalid: components['schemas']['PaymentRequest'] = { orderId: 123, purpose: 'ORDER' };
  const allContractPaths: keyof paths = '/api/v1/auth/refresh';
  return [invalid, allContractPaths];
}
void typeContract;
