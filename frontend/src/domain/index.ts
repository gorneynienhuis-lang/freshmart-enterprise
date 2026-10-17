import type { components } from '../api/schema';
import type { Permission } from '../api/operations';

export type Models = components['schemas'];
export type User = Models['User'];
export type Product = Models['Product'];
export type Sku = Models['Sku'];
export type Cart = Models['Cart'];
export type Order = Models['Order'];
export type Quote = Models['Quote'];
export type Address = Models['Address'];
export type DeliverySlot = Models['DeliverySlot'];
export type PriceSummary = Models['PriceSummary'];
export type Role = User['roles'][number];
export type OrderAction = Order['allowedActions'][number];

function safeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be a safe integer`);
}

/** Display CNY integer fen exactly. This performs no pricing, discount, freight or settlement logic. */
export function formatMoney(fen: number, options: { symbol?: boolean; grouping?: boolean } = {}): string {
  safeInteger(fen, 'fen');
  const absolute = BigInt(fen < 0 ? -fen : fen);
  const whole = (absolute / 100n).toString();
  const digits = options.grouping === false ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${fen < 0 ? '-' : ''}${options.symbol === false ? '' : '¥'}${digits}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

export function formatWeight(grams: number): string {
  safeInteger(grams, 'grams');
  if (grams < 0) throw new RangeError('grams must be nonnegative');
  if (grams < 1000) return `${grams} g`;
  const raw = BigInt(grams);
  const fraction = (raw % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${raw / 1000n}${fraction ? `.${fraction}` : ''} kg`;
}

/** For affordances only. The server still enforces permission, ownership, state and SOD. */
export function hasPermission(user: User | null | undefined, permission: Permission): boolean {
  return user?.status === 'ACTIVE'
    && (!user.mustChangePassword || permission === 'auth.self')
    && user.permissions.includes(permission);
}
export function hasAnyPermission(user: User | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some(permission => hasPermission(user, permission));
}
export function hasRole(user: User | null | undefined, role: Role): boolean {
  return user?.status === 'ACTIVE' && user.roles.includes(role);
}
export function allowsOrderAction(order: Pick<Order, 'allowedActions'>, action: OrderAction): boolean {
  return order.allowedActions.includes(action);
}

/** Nonvisual common props. Visual components receive server-derived data and callback events. */
export type ResourceState<T> =
  | { status: 'idle' | 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string; traceId?: string; data?: T };
export interface ProductCardProps {
  product: Product;
  busy?: boolean;
  onOpen: (productId: string) => void;
  onAdd: (skuId: string) => void;
}
export interface OrderSummaryProps {
  order: Order;
  busy?: boolean;
  onAction: (action: OrderAction, orderId: string) => void;
}
