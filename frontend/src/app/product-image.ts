/**
 * Resolve catalog image URLs returned by the showcase seed data.
 *
 * Older demo rows use an absolute `/catalog/S001.jpg` URL, while the
 * frontend build keeps the same curated assets under `/generated/`. Keeping
 * this compatibility layer in the client makes localhost and the deployed
 * showcase render the same product cards without weakening backend URL
 * validation.
 */
export function productImagePath(value: string | null | undefined): string {
    const source = (value ?? '').trim();
    const match = source.match(/(?:^|\/)catalog\/([A-Za-z0-9_-]+)\.(?:jpe?g|png|webp)(?:\?.*)?$/i);
    return match ? `/generated/${match[1]}.jpg` : source;
}

/** Set a product image and keep a missing legacy asset from showing a broken icon. */
export function setProductImage(image: HTMLImageElement, value: string | null | undefined): void {
    image.src = productImagePath(value);
    image.onerror = () => {
        if (image.dataset.productFallback === '1') return;
        image.dataset.productFallback = '1';
        image.src = '/generated/r04-produce.jpg';
    };
}
