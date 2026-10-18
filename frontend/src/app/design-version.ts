export type DesignVersion = 'r03' | 'r04';

/** The query selects presentation only; the hash continues to own application routing. */
export function designVersion(search = globalThis.location?.search ?? ''): DesignVersion {
    return new URLSearchParams(search).get('ui') === 'r04' ? 'r04' : 'r03';
}

export function isR04Design(): boolean {
    return designVersion() === 'r04';
}

export function designVersionHref(version: DesignVersion, href = globalThis.location?.href ?? 'http://localhost/'): string {
    const url = new URL(href);
    url.searchParams.set('ui', version);
    return `${url.pathname}${url.search}${url.hash}`;
}
