import { ApiError } from '../api/errors';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** Persist only hashes and random keys (no token, address or request body). An unknown result retains its key. */
export class CommandLedger {
    private pending = new Map<string, Promise<unknown>>();
    private keys = new Map<string, string>();
    constructor(private storage?: StorageLike) { }
    async execute<T>(subject: string, method: string, path: string, body: unknown, send: (key: string) => Promise<T>): Promise<T> {
        const signature = JSON.stringify({ subject, method, path, body });
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signature))), b => b.toString(16).padStart(2, '0')).join('');
        const name = `fresh-mall:command:${hash}`;
        const running = this.pending.get(name);
        if (running)
            return running as Promise<T>;
        let key: string | null = this.keys.get(name) ?? null;
        try {
            key = this.storage?.getItem(name) ?? key;
        }
        catch { /* private mode */ }
        key ??= crypto.randomUUID();
        this.keys.set(name, key);
        try {
            this.storage?.setItem(name, key);
        }
        catch { /* in-memory request remains valid */ }
        const request = send(key).then(value => { this.keys.delete(name); try {
            this.storage?.removeItem(name);
        }
        catch { } return value; }).catch(error => {
            if (!(error instanceof ApiError && (error.outcomeUnknown || error.status === 401))) {
                this.keys.delete(name);
                try {
                    this.storage?.removeItem(name);
                }
                catch { }
            }
            throw error;
        }).finally(() => this.pending.delete(name));
        this.pending.set(name, request);
        return request;
    }
}
