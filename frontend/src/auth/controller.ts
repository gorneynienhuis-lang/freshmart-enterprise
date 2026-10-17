import type { components } from '../api/schema';
import { ApiError, checkedResponse, sendRequest } from '../api/errors';

type Schema = components['schemas'];
export type AuthUser = Schema['User'];
export type AuthState = Readonly<{
  status: 'anonymous' | 'authenticated';
  user: AuthUser | null;
}>;
type AuthSession = Schema['AuthSession'];
type Csrf = { csrfToken: string; expiresAt: string };

/** One controller per browser app. Tokens stay in this closure, never web storage. */
export class AuthController {
  private token: string | null = null;
  private state: AuthState = { status: 'anonymous', user: null };
  private csrf: Csrf | null = null;
  private csrfFlight: Promise<string> | null = null;
  private refreshFlight: Promise<void> | null = null;
  private transition = false;
  private refreshBlocked = false;
  private epoch = 0;
  private listeners = new Set<() => void>();

  constructor(private readonly origin: string, private readonly fetcher: typeof fetch = fetch) {}

  readonly getSnapshot = (): AuthState => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getAccessToken(): string | null { return this.token; }
  private publish(user: AuthUser | null): void {
    this.state = user ? { status: 'authenticated', user } : { status: 'anonymous', user: null };
    this.listeners.forEach(listener => listener());
  }
  private accept(session: AuthSession, epoch: number): void {
    if (epoch !== this.epoch) throw new ApiError('会话已变更，请重新操作', { kind: 'session' });
    if (!session || typeof session.accessToken !== 'string' || !session.accessToken
      || typeof session.csrfToken !== 'string' || !Number.isFinite(Date.parse(session.csrfExpiresAt))
      || !session.user || !Array.isArray(session.user.permissions) || !Array.isArray(session.user.roles)) {
      throw new ApiError('会话响应不符合接口契约', { kind: 'protocol' });
    }
    this.token = session.accessToken;
    this.refreshBlocked = false;
    this.csrf = { csrfToken: session.csrfToken, expiresAt: session.csrfExpiresAt };
    this.publish(session.user);
  }
  clearSession(): void {
    this.epoch++;
    this.token = null;
    this.csrf = null;
    this.publish(null);
  }

  async ensureCsrf(force = false): Promise<string> {
    if (!force && this.csrf && Date.parse(this.csrf.expiresAt) > Date.now() + 30_000) return this.csrf.csrfToken;
    if (this.csrfFlight) return this.csrfFlight;
    const flight = (async () => {
      const response = await checkedResponse(await sendRequest(this.fetcher, new Request(`${this.origin}/api/v1/auth/csrf`, {
        credentials: 'include', cache: 'no-store', redirect: 'error',
      })));
      const envelope = await response.json() as Schema['CsrfTokenEnvelope'];
      if (!envelope.data || typeof envelope.data.csrfToken !== 'string'
        || !Number.isFinite(Date.parse(envelope.data.expiresAt))) {
        throw new ApiError('CSRF响应不符合接口契约', { kind: 'protocol' });
      }
      this.csrf = envelope.data;
      return envelope.data.csrfToken;
    })();
    this.csrfFlight = flight;
    try { return await flight; } finally { if (this.csrfFlight === flight) this.csrfFlight = null; }
  }

  private async cookieCommand<T>(path: string, body?: unknown): Promise<T> {
    const csrf = await this.ensureCsrf();
    const response = await checkedResponse(await sendRequest(this.fetcher, new Request(`${this.origin}/api/v1/auth/${path}`, {
      method: 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
      headers: { 'X-CSRF-Token': csrf, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      // Origin is supplied by the browser; never forge a forbidden browser header.
    })), 'POST');
    return (await response.json() as { data: T }).data;
  }

  private async establish(path: 'login' | 'register', body: Schema['LoginRequest'] | Schema['RegisterRequest']): Promise<AuthUser> {
    if (this.transition) throw new ApiError('会话操作正在进行', { kind: 'session' });
    this.transition = true;
    this.clearSession();
    const epoch = this.epoch;
    try {
      await this.refreshFlight?.catch(() => {});
      await this.ensureCsrf(true);
      const session = await this.cookieCommand<AuthSession>(path, body);
      this.accept(session, epoch);
      return session.user;
    } finally { this.transition = false; }
  }
  login(body: Schema['LoginRequest']): Promise<AuthUser> { return this.establish('login', body); }
  register(body: Schema['RegisterRequest']): Promise<AuthUser> { return this.establish('register', body); }

  /** Explicit startup restore or GET 401 recovery. Never recursively refresh refresh itself. */
  async refresh(explicit = true): Promise<void> {
    if (this.transition) throw new ApiError('会话操作正在进行', { kind: 'session' });
    if (this.refreshFlight) return this.refreshFlight;
    if (this.refreshBlocked && !explicit) throw new ApiError('会话恢复失败，请显式恢复会话或重新登录', { kind: 'session' });
    const epoch = this.epoch;
    const run = async () => {
      // Refresh CSRF after obtaining the cross-tab lock: another tab may have rotated its cookie.
      await this.ensureCsrf(true);
      this.accept(await this.cookieCommand<AuthSession>('refresh'), epoch);
    };
    const flight = (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks) {
          await navigator.locks.request(`fresh-mall:refresh:${this.origin}`, run);
        } else await run();
      } catch (error) {
        if (epoch === this.epoch) { this.clearSession(); this.refreshBlocked = true; }
        throw error;
      }
    })();
    this.refreshFlight = flight;
    try { await flight; } finally { if (this.refreshFlight === flight) this.refreshFlight = null; }
  }

  async restore(): Promise<AuthState> {
    try { await this.refresh(); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    return this.state;
  }

  async logout(): Promise<void> {
    if (this.transition) throw new ApiError('会话操作正在进行', { kind: 'session' });
    this.transition = true;
    this.clearSession();
    try {
      // Let an in-flight rotation finish before revoking the resulting cookie.
      await this.refreshFlight?.catch(() => {});
      await this.ensureCsrf(true);
      await this.cookieCommand<Schema['CommandResult']>('logout');
    } finally { this.clearSession(); this.transition = false; }
  }
}
