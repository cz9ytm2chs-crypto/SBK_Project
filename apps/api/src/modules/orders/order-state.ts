import {
  canTransition,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type TransitionActor,
} from '@silt/shared';
import { env } from '../../config/env';
import { conflict } from '../../lib/errors';
import type { Tx } from '../../lib/prisma';
import { enqueueEmail } from '../email/email.service';
import type { OrderEmailPayload } from '../email/templates';

type OrderLike = {
  id: string;
  number: string;
  status: OrderStatus;
  email: string;
  firstName: string;
  total: number;
  currency: string;
};

export async function orderEmailPayload(tx: Tx, order: OrderLike, extra: Partial<OrderEmailPayload> = {}): Promise<OrderEmailPayload> {
  const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
  return {
    number: order.number,
    firstName: order.firstName,
    total: order.total,
    currency: order.currency,
    orderUrl: `${env.APP_URL}/account/orders/${order.id}`,
    items: items.map((i) => ({ name: i.productName, size: i.size, color: i.color, quantity: i.quantity, lineTotal: i.lineTotal })),
    ...extra,
  };
}

const EMAIL_FOR: Partial<Record<OrderStatus, 'order_paid' | 'order_shipped' | 'order_cancelled' | 'order_refunded' | 'order_status'>> = {
  PAID: 'order_paid',
  PROCESSING: 'order_status',
  SHIPPED: 'order_shipped',
  DELIVERED: 'order_status',
  CANCELLED: 'order_cancelled',
  REFUNDED: 'order_refunded',
};

/**
 * The only place an order status changes. Validates the transition against the state machine,
 * writes history and queues the customer notification inside the caller's transaction.
 */
export async function transitionOrder(
  tx: Tx,
  order: OrderLike,
  to: OrderStatus,
  actor: TransitionActor,
  opts: { actorId?: string | null; comment?: string; data?: Record<string, unknown>; email?: Partial<OrderEmailPayload> } = {},
) {
  if (!canTransition(order.status, to, actor))
    throw conflict(
      `Нельзя перевести заказ из «${ORDER_STATUS_LABELS[order.status]}» в «${ORDER_STATUS_LABELS[to]}»`,
      'INVALID_TRANSITION',
    );
  // Optimistic guard: the status must still be what we read.
  const updated = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: to, ...(opts.data ?? {}) },
  });
  if (!updated.count) throw conflict('Заказ был изменён параллельно, обновите страницу', 'CONCURRENT_UPDATE');
  await tx.orderStatusHistory.create({
    data: { orderId: order.id, fromStatus: order.status, toStatus: to, comment: opts.comment ?? '', actorId: opts.actorId ?? null },
  });
  const template = EMAIL_FOR[to];
  if (template)
    await enqueueEmail(order.email, template, await orderEmailPayload(tx, order, { status: to, comment: opts.comment, ...opts.email }), tx);
  return { ...order, status: to };
}
