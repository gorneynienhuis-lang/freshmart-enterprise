import { describe, expect, it } from 'vitest';
import { formatMoney, formatWeight, hasPermission, hasRole, allowsOrderAction } from '../src/domain';
import type { User } from '../src/domain';

const admin: User = { userId: 'admin-1', displayName: '管理员', phoneMasked: '138****0000', roles: ['ADMIN'],
  status: 'ACTIVE', version: 1, permissions: ['auth.self'], mustChangePassword: false };

describe('pure display helpers', () => {
  it('formats integer fen without floating rounding loss or backend price calculations', () => {
    expect(formatMoney(0)).toBe('¥0.00');
    expect(formatMoney(590)).toBe('¥5.90');
    expect(formatMoney(-1)).toBe('-¥0.01');
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe('¥90,071,992,547,409.91');
    expect(formatMoney(123456, { symbol: false, grouping: false })).toBe('1234.56');
    expect(() => formatMoney(1.2)).toThrow(TypeError);
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError);
  });
  it('formats grams exactly and rejects invalid units', () => {
    expect(formatWeight(500)).toBe('500 g');
    expect(formatWeight(1234)).toBe('1.234 kg');
    expect(formatWeight(2000)).toBe('2 kg');
    expect(() => formatWeight(-1)).toThrow(RangeError);
  });
});

describe('permission affordances', () => {
  it('does not infer business permissions or MEMBER from ADMIN', () => {
    expect(hasPermission(admin, 'auth.self')).toBe(true);
    expect(hasPermission(admin, 'order.self.read')).toBe(false);
    expect(hasRole(admin, 'MEMBER')).toBe(false);
    expect(hasRole({ ...admin, roles: ['ADMIN', 'MEMBER'] }, 'MEMBER')).toBe(true);
  });
  it('blocks disabled accounts and forced initial-password users from business actions', () => {
    expect(hasPermission({ ...admin, status: 'DISABLED' }, 'auth.self')).toBe(false);
    expect(hasPermission({ ...admin, mustChangePassword: true, permissions: ['order.self.read'] }, 'order.self.read')).toBe(false);
  });
  it('honors server allowedActions rather than rebuilding the state machine', () => {
    expect(allowsOrderAction({ allowedActions: ['CANCEL'] }, 'CANCEL')).toBe(true);
    expect(allowsOrderAction({ allowedActions: [] }, 'CANCEL')).toBe(false);
  });
});
