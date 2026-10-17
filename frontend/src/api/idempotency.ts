type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
function canonical(value: Json): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Action payload must be JSON');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(item => canonical(item)).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, Json>)[key]!)}`).join(',')}}`;
}

/** Keep one action object through pending/unknown/retry; create a new one only for a new user intent. */
export function createAction<P extends Json>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, payload: P) {
  if (!path.startsWith('/api/v1/')) throw new TypeError('Action requires a canonical API path');
  const signature = canonical(payload);
  const key = crypto.randomUUID();
  return Object.freeze({
    key, method, path,
    /** Caller must pass the same method/path as this action. Changed payloads cannot reuse the key. */
    headersFor(currentPayload: P) {
      if (canonical(currentPayload) !== signature) throw new Error('Payload changed; create a new action and idempotency key');
      return { 'Idempotency-Key': key } as const;
    },
  });
}
