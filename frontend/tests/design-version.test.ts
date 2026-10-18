import { describe, expect, it } from 'vitest';
import { designVersion, designVersionHref } from '../src/app/design-version';

describe('parallel design versions', () => {
    it('opens the selected R03 design by default and keeps R04 as an explicit alternative', () => {
        expect(designVersion('')).toBe('r03');
        expect(designVersion('?ui=r04')).toBe('r04');
        expect(designVersion('?ui=r03')).toBe('r03');
        expect(designVersion('?ui=other')).toBe('r03');
    });
    it('preserves product routing and other query values when changing presentation', () => {
        expect(designVersionHref('r03', 'http://localhost:5173/?campaign=autumn&ui=r04#/products/product-7?sku=2')).toBe('/?campaign=autumn&ui=r03#/products/product-7?sku=2');
        expect(designVersionHref('r04', 'http://localhost:5173/demo?ui=r03#/checkout')).toBe('/demo?ui=r04#/checkout');
    });
});
