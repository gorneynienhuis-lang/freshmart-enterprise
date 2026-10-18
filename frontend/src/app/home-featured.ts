import type { Models, Product } from '../domain';

type CategorySummary = Pick<Models['Category'], 'categoryId' | 'name' | 'shortName'>;
type FeaturedCandidate = Pick<Product, 'productId' | 'categoryId' | 'stockStatus'>;

const categoryGroups = [/蔬菜/, /水果/, /肉|禽|蛋|水产|海鲜|乳品|烘焙|鲜食/];

/** Keep server order within each category, preferring recommended products over the fallback feed. */
export function selectHomeFeatured<T extends FeaturedCandidate>(recommended: readonly T[], fallback: readonly T[], categories: readonly CategorySummary[]): T[] {
    const seen = new Set<string>();
    const available = [...recommended, ...fallback].filter(product => {
        if (product.stockStatus === 'SOLD_OUT' || seen.has(product.productId)) return false;
        seen.add(product.productId);
        return true;
    });
    const selected: T[] = [];
    const choose = (product: T | undefined) => {
        if (product && !selected.some(item => item.productId === product.productId)) selected.push(product);
    };
    for (const group of categoryGroups) {
        const categoryIds = new Set(categories.filter(category => group.test(category.name + category.shortName)).map(category => category.categoryId));
        choose(available.find(product => categoryIds.has(product.categoryId)));
    }
    for (const product of available) {
        if (selected.length >= 3) break;
        choose(product);
    }
    return selected;
}

export function homeCategoryHref(kind: string, categories: readonly CategorySummary[]): string {
    const pattern = kind === 'produce' ? /蔬菜|水果/ : kind === 'fresh' ? /肉|禽|蛋|水产|海鲜|乳品|鲜食/ : null;
    const category = pattern ? categories.find(item => pattern.test(item.name + item.shortName)) : undefined;
    return category ? '#/products?categoryId=' + encodeURIComponent(category.categoryId) : '#/products';
}
