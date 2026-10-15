export const ORDER_STATUSES = [
  'CREATED',
  'AWAITING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'REQUIRES_ACTION',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Создан',
  AWAITING_PAYMENT: 'Ожидает оплаты',
  PAID: 'Оплачен',
  PROCESSING: 'Собирается',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
  REFUNDED: 'Возврат оформлен',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Ожидает оплаты',
  REQUIRES_ACTION: 'Требует подтверждения',
  SUCCEEDED: 'Оплачен',
  FAILED: 'Ошибка оплаты',
  CANCELLED: 'Отменён',
  PARTIALLY_REFUNDED: 'Частичный возврат',
  REFUNDED: 'Возвращён',
};

/** Who may perform a transition. "system" = payment events and scheduled jobs. */
export type TransitionActor = 'system' | 'staff';

const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, TransitionActor[]>>> = {
  CREATED: { AWAITING_PAYMENT: ['system'], CANCELLED: ['system', 'staff'] },
  AWAITING_PAYMENT: { PAID: ['system'], CANCELLED: ['system', 'staff'] },
  // A paid order can only be closed through a refund, never silently cancelled.
  PAID: { PROCESSING: ['staff'], REFUNDED: ['system', 'staff'] },
  PROCESSING: { SHIPPED: ['staff'], REFUNDED: ['system', 'staff'] },
  SHIPPED: { DELIVERED: ['staff', 'system'], REFUNDED: ['system', 'staff'] },
  DELIVERED: { REFUNDED: ['system', 'staff'] },
  CANCELLED: {},
  REFUNDED: {},
};

export function canTransition(from: OrderStatus, to: OrderStatus, actor: TransitionActor): boolean {
  return TRANSITIONS[from]?.[to]?.includes(actor) ?? false;
}

/** Statuses staff can set directly (refunds go through the dedicated refund action). */
export function nextStaffStatuses(from: OrderStatus): OrderStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [OrderStatus, TransitionActor[]][])
    .filter(([to, actors]) => actors.includes('staff') && to !== 'REFUNDED')
    .map(([to]) => to);
}

/** Order statuses that require a successful payment. */
export const PAID_ORDER_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Guards against contradictory order/payment combinations. */
export function isConsistent(order: OrderStatus, payment: PaymentStatus): boolean {
  if (PAID_ORDER_STATUSES.includes(order))
    return payment === 'SUCCEEDED' || payment === 'PARTIALLY_REFUNDED';
  if (order === 'REFUNDED') return payment === 'REFUNDED' || payment === 'PARTIALLY_REFUNDED';
  if (order === 'CANCELLED') return payment !== 'SUCCEEDED';
  return payment !== 'SUCCEEDED' && payment !== 'REFUNDED';
}

export const SHIPMENT_STATUS_LABELS = {
  PENDING: 'Ожидает сборки',
  READY: 'Готов к отправке',
  SHIPPED: 'Передан в доставку',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлен',
  RETURNED: 'Возвращён',
} as const;
export type ShipmentStatus = keyof typeof SHIPMENT_STATUS_LABELS;
