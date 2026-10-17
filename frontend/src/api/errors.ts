export type ApiErrorKind = 'http' | 'network' | 'aborted' | 'protocol' | 'session';

/** No request body, credentials, raw response or tokens are retained here. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: number | undefined;
  readonly errorKey: string | undefined;
  readonly traceId: string | undefined;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;
  readonly details: readonly unknown[];

  constructor(message: string, options: {
    kind: ApiErrorKind; status?: number; code?: number; errorKey?: string;
    traceId?: string; retryable?: boolean; outcomeUnknown?: boolean; details?: readonly unknown[];
  }) {
    super(message);
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.errorKey = options.errorKey;
    this.traceId = options.traceId;
    this.retryable = options.retryable ?? false;
    this.outcomeUnknown = options.outcomeUnknown ?? false;
    this.details = options.details ?? [];
  }
}

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

export async function checkedResponse(response: Response, method = 'GET'): Promise<Response> {
  let value: unknown;
  try { value = await response.clone().json(); } catch { /* handled as protocol/http error below */ }
  const envelope = object(value);
  const data = object(envelope?.data);
  const traceId = typeof envelope?.traceId === 'string'
    ? envelope.traceId : response.headers.get('X-Trace-Id') ?? undefined;
  const shared = {
    ...(traceId ? { traceId } : {}),
    status: response.status,
    ...(typeof envelope?.code === 'number' ? { code: envelope.code } : {}),
    ...(typeof data?.errorKey === 'string' ? { errorKey: data.errorKey } : {}),
    retryable: data?.retryable === true,
    outcomeUnknown: !['GET', 'HEAD', 'OPTIONS'].includes(method) && response.status >= 500,
    details: Array.isArray(data?.details) ? data.details : [],
  };
  if (!response.ok) {
    throw new ApiError(typeof envelope?.message === 'string' ? envelope.message : `HTTP ${response.status}`, { kind: 'http', ...shared });
  }
  if (envelope?.code !== 0 || !('data' in envelope) || typeof envelope.traceId !== 'string') {
    throw new ApiError('服务端响应不符合接口契约', {
      kind: 'protocol', ...shared, outcomeUnknown: !['GET', 'HEAD', 'OPTIONS'].includes(method),
    });
  }
  return response;
}

export async function sendRequest(fetcher: typeof fetch, request: Request): Promise<Response> {
  try { return await fetcher(request); }
  catch (cause) {
    const aborted = cause instanceof Error && cause.name === 'AbortError';
    throw new ApiError(aborted ? '请求已取消' : '网络请求失败，请先确认操作结果', {
      kind: aborted ? 'aborted' : 'network',
      outcomeUnknown: !['GET', 'HEAD', 'OPTIONS'].includes(request.method),
    });
  }
}
