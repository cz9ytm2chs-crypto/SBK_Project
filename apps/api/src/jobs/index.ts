import type { PaymentProviderKey } from '@silt/shared';
import { invalidateCatalog } from '../lib/cache';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { processEmailQueue } from '../modules/email/email.service';
import * as inventory from '../modules/inventory/inventory.service';
import { transitionOrder } from '../modules/orders/order-state';
import { getProvider } from '../modules/payments/providers';
import { syncOrderPayments } from '../modules/payments/payments.service';

/**
 * Unpaid orders past their reservation deadline: re-check the provider first
 * (the payment may have succeeded without a webhook), then cancel and free the stock.
 */
export async function expireUnpaidOrders() {
  const due = await prisma.order.findMany({
    where: { status: { in: ['CREATED', 'AWAITING_PAYMENT'] }, reservationExpiresAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const { id } of due) {
    await syncOrderPayments(id);
    const cancelled = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id } });
      if (!['CREATED', 'AWAITING_PAYMENT'].includes(order.status)) return false;
      await inventory.release(tx, id, 'EXPIRED', 'Истёк срок оплаты');
      await transitionOrder(tx, order, 'CANCELLED', 'system', {
        comment: 'Истёк срок оплаты',
        data: { cancelledAt: new Date(), reservationExpiresAt: null, paymentStatus: 'CANCELLED' },
      });
      return true;
    });
    if (cancelled) {
      const open = await prisma.payment.findMany({ where: { orderId: id, status: { in: ['PENDING', 'REQUIRES_ACTION'] } } });
      for (const p of open) {
        await getProvider(p.provider as PaymentProviderKey).cancelPayment?.(p.providerPaymentId!).catch(() => undefined);
        await prisma.payment.update({ where: { id: p.id }, data: { status: 'CANCELLED' } });
      }
    }
  }
  if (due.length) invalidateCatalog();
  return due.length;
}

/** Safety net for lost webhooks: re-check payments that have been pending for a while. */
export async function reconcilePendingPayments() {
  const stale = await prisma.payment.findMany({
    where: { status: { in: ['PENDING', 'REQUIRES_ACTION'] }, providerPaymentId: { not: null }, createdAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    select: { orderId: true },
    distinct: ['orderId'],
    take: 50,
  });
  for (const p of stale) await syncOrderPayments(p.orderId);
}

/** Old guest carts and expired sessions. */
async function cleanup() {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.cart.deleteMany({ where: { userId: null, updatedAt: { lt: new Date(now.getTime() - 60 * 24 * 3600_000) } } });
}

function every(ms: number, name: string, fn: () => Promise<unknown>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error({ err, job: name }, 'Job failed');
    } finally {
      running = false;
    }
  };
  return setInterval(tick, ms);
}

export function startJobs() {
  const timers = [
    every(5_000, 'email', processEmailQueue),
    every(60_000, 'expire-orders', expireUnpaidOrders),
    every(5 * 60_000, 'reconcile-payments', reconcilePendingPayments),
    every(6 * 3600_000, 'cleanup', cleanup),
  ];
  logger.info('Background jobs started');
  return () => timers.forEach(clearInterval);
}
