import { describe, expect, it } from 'vitest';
import { productImagePath } from '../src/app/product-image';

describe('catalog image paths', () => {
    it('keeps every backend catalog asset addressable instead of mapping to the curated subset', () => {
        expect(productImagePath('/catalog/S006.jpg')).toBe('/catalog/S006.jpg');
        expect(productImagePath('/catalog/S040.jpg')).toBe('/catalog/S040.jpg');
    });

    it('normalizes absolute catalog URLs to the current origin', () => {
        expect(productImagePath('http://localhost:8080/catalog/S021.jpg')).toBe('/catalog/S021.jpg');
        expect(productImagePath('https://freshmart-enterprise-production.up.railway.app/catalog/S039.jpg')).toBe('/catalog/S039.jpg');
    });

    it('leaves generated design assets unchanged', () => {
        expect(productImagePath('/generated/S001.jpg')).toBe('/generated/S001.jpg');
        expect(productImagePath('/generated/r04-produce.jpg')).toBe('/generated/r04-produce.jpg');
    });
});
