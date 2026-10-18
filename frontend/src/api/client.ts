import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { operations } from './operations';
import { ApiError, checkedResponse, sendRequest } from './errors';
import { AuthController } from '../auth/controller';

export const API_PREFIX = '/api/v1' as const;
const COOKIE_AUTH_PATHS = ['/api/v1/auth/csrf', '/api/v1/auth/login', '/api/v1/auth/register',
  '/api/v1/auth/refresh', '/api/v1/auth/logout'] as const;
type CookieAuthPath = typeof COOKIE_AUTH_PATHS[number];
/** Cookie/rotation endpoints are exposed through auth, preventing single-flight bypass. */
export type BrowserPaths = Omit<paths, CookieAuthPath>;

const routePatterns = operations.map(operation => ({
  operation,
  pattern: new RegExp(`^${operation.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+')}$`),
}));

export function createMallClient(options: { origin?: string; fetch?: typeof fetch } = {}) {
  const origin = new URL(options.origin ?? (typeof location !== 'undefined' ? location.origin : 'http://localhost:8080')).origin;
  if (!/^https?:/.test(origin)) throw new Error('API origin must be HTTP(S)');
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const auth = new AuthController(origin, fetcher);

  const transport: typeof fetch = async (input, init) => {
    const original = new Request(input, init);
    const url = new URL(original.url);
    const match = routePatterns.find(({ operation, pattern }) => operation.method === original.method && pattern.test(url.pathname));
    if (url.origin !== origin || !match || url.username || url.password) {
      throw new ApiError('请求不属于已配置的 API 契约', { kind: 'protocol' });
    }
    const operation = match.operation;
    if ((COOKIE_AUTH_PATHS as readonly string[]).includes(url.pathname)) {
      throw new ApiError('会话端点请通过 auth 控制器调用', { kind: 'session' });
    }
    const build = (token: string | null) => {
      const headers = new Headers(original.headers);
      headers.delete('Authorization');
      if (operation.bearer && token) headers.set('Authorization', `Bearer ${token}`);
      return new Request(original.clone(), { headers, credentials: 'include', cache: 'no-store', redirect: 'error' });
    };
    const sentToken = auth.getAccessToken();
    let response = await sendRequest(fetcher, build(sentToken));
    // ONLY reads are replayed. A write may already have committed; its caller must inspect/retry explicitly.
    if (response.status === 401 && operation.bearer && ['GET', 'HEAD'].includes(original.method)) {
      if (!auth.getAccessToken() || auth.getAccessToken() === sentToken) await auth.refresh(false);
      if (original.signal.aborted) throw new ApiError('请求已取消', { kind: 'aborted' });
      response = await sendRequest(fetcher, build(auth.getAccessToken()));
      if (response.status === 401) auth.clearSession();
    }
    const checked = await checkedResponse(response, original.method, operation.responseBody === 'BINARY_IMAGE');
    if (operation.operationId === 'changePassword') auth.clearSession();
    return checked;
  };

  const api = createClient<BrowserPaths>({ baseUrl: origin, fetch: transport });
  return { api, auth, origin };
}

/** Default app instance; UI imports types/props and gets data from Codex adapters. */
export const mall = createMallClient();
export const api = mall.api;
export const auth = mall.auth;

/** Extract the typed envelope data, throwing on impossible empty success. Errors already throw ApiError. */
export function unwrap<T>(result: { data?: { data: T } }): T {
  if (!result.data) throw new ApiError('服务端未返回数据', { kind: 'protocol' });
  return result.data.data;
}
