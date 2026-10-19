/**
 * Resolve catalog image URLs returned by the showcase seed data.
 *
 * Catalog rows are served by the backend from the complete `/catalog/`
 * resource set. The design importer also emits a smaller curated
 * `/generated/` set for static templates, so catalog URLs must not be
 * rewritten to that set: doing so silently replaces missing products with
 * the generic produce fallback.
 */
export function productImagePath(value: string | null | undefined): string {
    const source = (value ?? '').trim();
    const match = source.match(/^(?:https?:\/\/[^/]+)?\/catalog\/([A-Za-z0-9_-]+)\.(?:jpe?g|png|webp)(?:\?.*)?$/i);
    return match ? `/catalog/${match[1]}.jpg` : source;
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
