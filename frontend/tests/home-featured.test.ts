import { describe, expect, it } from 'vitest';
import { homeCategoryHref, selectHomeFeatured } from '../src/app/home-featured';

const categories = [
    { categoryId: 'veg', name: '时令蔬菜', shortName: '蔬菜' },
    { categoryId: 'fruit', name: '新鲜水果', shortName: '水果' },
    { categoryId: 'fresh', name: '肉禽蛋品', shortName: '肉禽蛋' },
];
const product = (productId: string, categoryId: string, stockStatus: 'IN_STOCK' | 'LOW' | 'SOLD_OUT' = 'IN_STOCK') => ({ productId, categoryId, stockStatus });

describe('home featured products', () => {
    it('shows vegetables, fruit and fresh food using real recommended objects rather than three fixed fruit IDs', () => {
        const recommended = [product('apple', 'fruit'), product('banana', 'fruit'), product('tomato', 'veg'), product('eggs', 'fresh')];
        const selected = selectHomeFeatured(recommended, [], categories);
        expect(selected.map(item => item.productId)).toEqual(['tomato', 'apple', 'eggs']);
        expect(selected[0]).toBe(recommended[2]);
    });
    it('excludes sold-out products and duplicate feed entries, retaining low stock and a live fallback category', () => {
        const recommended = [product('tomato', 'veg', 'SOLD_OUT'), product('apple', 'fruit', 'LOW')];
        const fallback = [product('apple', 'fruit'), product('cucumber', 'veg'), product('eggs', 'fresh')];
        expect(selectHomeFeatured(recommended, fallback, categories).map(item => item.productId)).toEqual(['cucumber', 'apple', 'eggs']);
    });
    it('fills missing categories from actual sellable products and returns fewer than three when unavailable', () => {
        const fruit = [product('apple', 'fruit'), product('banana', 'fruit'), product('orange', 'fruit'), product('grape', 'fruit')];
        expect(selectHomeFeatured(fruit, [], categories).map(item => item.productId)).toEqual(['apple', 'banana', 'orange']);
        expect(selectHomeFeatured([fruit[0]!], [fruit[0]!], categories)).toEqual([fruit[0]]);
        expect(selectHomeFeatured([product('sold', 'fruit', 'SOLD_OUT')], [], categories)).toEqual([]);
    });
    it('uses real category IDs for navigation and falls back to the all-products route', () => {
        expect(homeCategoryHref('produce', categories)).toBe('#/products?categoryId=veg');
        expect(homeCategoryHref('fresh', categories)).toBe('#/products?categoryId=fresh');
        expect(homeCategoryHref('produce', [{ categoryId: 'fruit & veg', name: '蔬菜', shortName: '蔬' }])).toBe('#/products?categoryId=fruit%20%26%20veg');
        expect(homeCategoryHref('fresh', categories.slice(0, 2))).toBe('#/products');
        expect(homeCategoryHref('unsupported', categories)).toBe('#/products');
    });
});
