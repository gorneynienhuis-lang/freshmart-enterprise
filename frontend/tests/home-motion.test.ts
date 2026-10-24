import { describe, expect, it } from 'vitest';
import { nextHomeMotion, resetHomeVisit, viewTransitionName, type MotionVisit } from '../src/app/home-motion';

describe('home motion visit', () => {
    it('plays the entrance once per visit and stays settled across remounts', () => {
        const visit: MotionVisit = { consumed: false };
        expect(nextHomeMotion(visit, false)).toBe('enter');
        expect(nextHomeMotion(visit, false)).toBe('settled');
        expect(nextHomeMotion(visit, false)).toBe('settled');
        resetHomeVisit(visit);
        expect(nextHomeMotion(visit, false)).toBe('enter');
    });

    it('does not consume the visit when motion is reduced', () => {
        const visit: MotionVisit = { consumed: false };
        expect(nextHomeMotion(visit, true)).toBe('reduced');
        expect(visit.consumed).toBe(false);
        expect(nextHomeMotion(visit, false)).toBe('enter');
    });

    it('builds a css-safe view transition name', () => {
        expect(viewTransitionName('S001')).toBe('p-S001');
        expect(viewTransitionName('bad id!/x')).toBe('p-badidx');
        expect(viewTransitionName('!!!')).toBe('p-item');
    });
});
