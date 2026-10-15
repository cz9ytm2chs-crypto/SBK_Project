import type { PaymentProviderKey, PaymentStatus } from '@silt/shared';
import { env } from '../../config/env';
import { AppError, badRequest, conflict } from '../../lib/errors';
import { invalidateCatalog } from '../../lib/cache';
import { logger } from '../../lib/logger';
import { Prisma, prisma } from '../../lib/prisma';
import * as inventory from '../inventory/inventory.service';
import { transitionOrder } from '../orders/order-state';
import { getProvider } from './providers';
import { WebhookVerificationError, type ProviderPaymentState, type WebhookRequest } from './providers/types';

const ACTIVE: PaymentStatus[] = ['PENDING', 'REQUIRES_ACTION'];

/** Creates a payment session at the provider. Amount always comes from the stored order. */
export async function startPayment(orderId: string, accessToken: string | null) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { orderBy: { createdAt: 'desc' } } } });
  if (!['CREATED', 'AWAITING_PAYMENT'].includes(order.status))
    throw conflict('Заказ нельзя оплатить в текущем статусе', 'ORDER_NOT_PAYABLE');
  if (order.reservationExpiresAt && order.reservationExpiresAt < new Date())
    throw conflict('Время на оплату истекло, оформите заказ заново', 'RESERVATION_EXPIRED');

  // Re-use an open session instead of creating a second charge.
  const open = order.payments.find((p) => ACTIVE.includes(p.status as PaymentStatus) && p.confirmationUrl && p.provider === order.paymentProvider);
  if (open) return { paymentUrl: open.confirmationUrl };

  const provider = getProvider(order.paymentProvider as PaymentProviderKey);
  if (!provider.isConfigured()) throw badRequest('Способ оплаты недоступен', 'PAYMENT_METHOD_UNAVAILABLE');

  const attempt = order.payments.length + 1;
  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: order.paymentProvider,
      amount: order.total,
      currency: order.currency,
      idempotencyKey: `${order.id}:${attempt}`,
    },
  });
  const tokenParam = accessToken ? `&token=${encodeURIComponent(accessToken)}` : '';
  try {
    const created = await provider.createPayment({
      paymentId: payment.id,
      orderNumber: order.number,
      amount: order.total,
      currency: order.currency,
      description: `Заказ ${order.number} в SILT`,
      customerEmail: order.email,
      returnUrl: `${env.APP_URL}/checkout/result?order=${order.id}${tokenParam}`,
      cancelUrl: `${env.APP_URL}/checkout/result?order=${order.id}${tokenParam}&cancelled=1`,
      idempotencyKey: payment.idempotencyKey,
    });
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: created.providerPaymentId, confirmationUrl: created.confirmationUrl, status: created.status },
      });
      if (order.status === 'CREATED')
        await transitionOrder(tx, order, 'AWAITING_PAYMENT', 'system', { comment: `Платёж создан (${provider.displayName})` });
    });
    return { paymentUrl: created.confirmationUrl };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, orderId }, 'Payment creation failed');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', failureReason: 'Провайдер недоступен' } });
    throw new AppError(502, 'PAYMENT_PROVIDER_ERROR', 'Не удалось связаться с платёжной системой. Попробуйте ещё раз');
  }
}

/**
 * Reconciles our payment with the provider's state. Idempotent and safe to call from webhooks,
 * the return page and the background job concurrently (row lock on the payment).
 */
export async function applyProviderState(paymentId: string, state: ProviderPaymentState) {
  let paidOrder = false;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`);
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
    const order = payment.order;
    if (payment.status === state.status || ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) return;

    if (state.status === 'SUCCEEDED') {
      // Never trust amounts blindly: what was paid must match what we asked for.
      if (state.amount !== payment.amount || state.currency.toUpperCase() !== payment.currency.toUpperCase()) {
        logger.error({ paymentId, expected: payment.amount, got: state.amount }, 'Payment amount mismatch');
        await tx.payment.update({ where: { id: paymentId }, data: { status: 'FAILED', failureReason: 'AMOUNT_MISMATCH' } });
        return;
      }
      await tx.payment.update({ where: { id: paymentId }, data: { status: 'SUCCEEDED', failureReason: null } });

      if (order.status === 'AWAITING_PAYMENT' || order.status === 'CREATED') {
        await inventory.consume(tx, order.id);
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        for (const i of items)
          if (i.productId) await tx.product.update({ where: { id: i.productId }, data: { salesCount: { increment: i.quantity } } });
        let current = { ...order, status: order.status as never };
        if (order.status === 'CREATED') current = await transitionOrder(tx, current, 'AWAITING_PAYMENT', 'system') as never;
        await transitionOrder(tx, current, 'PAID', 'system', {
          comment: 'Оплата подтверждена платёжной системой',
          data: { paymentStatus: 'SUCCEEDED', paidAt: new Date(), reservationExpiresAt: null },
        });
        paidOrder = true;
      } else if (order.status === 'CANCELLED') {
        // Paid after the reservation expired: sell if stock is still there, otherwise refund.
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        const lines = items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
        const ok = await inventory.takeDirect(tx, order.id, lines);
        await tx.order.update({ where: { id: order.id }, data: { paymentStatus: 'SUCCEEDED' } });
        await tx.orderNote.create({
          data: {
            orderId: order.id,
            body: ok
              ? 'Оплата поступила после отмены заказа. Товар в наличии — требуется ручное восстановление заказа или возврат.'
              : 'Оплата поступила после отмены заказа, товара нет в наличии. Требуется возврат средств.',
          },
        });
      }
      return;
    }

    await tx.payment.update({ where: { id: paymentId }, data: { status: state.status, failureReason: state.failureReason ?? null } });
    if (['AWAITING_PAYMENT', 'CREATED'].includes(order.status))
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus: state.status } });
  });
  if (paidOrder) invalidateCatalog();
}

/** Re-checks the provider for every open payment of an order ("повторная проверка статуса"). */
export async function syncOrderPayments(orderId: string) {
  const payments = await prisma.payment.findMany({ where: { orderId, status: { in: ACTIVE }, providerPaymentId: { not: null } } });
  for (const p of payments) {
    try {
      const state = await getProvider(p.provider as PaymentProviderKey).getPayment(p.providerPaymentId!);
      await applyProviderState(p.id, state);
    } catch (err) {
      logger.warn({ err, paymentId: p.id }, 'Payment status check failed');
    }
  }
}

export async function handleWebhook(providerKey: PaymentProviderKey, req: WebhookRequest) {
  const provider = getProvider(providerKey);
  if (!provider.isConfigured()) throw new AppError(404, 'NOT_FOUND', 'Provider disabled');
  let event;
  try {
    event = await provider.parseWebhook(req);
  } catch (err) {
    if (err instanceof WebhookVerificationError || err instanceof SyntaxError) {
      logger.warn({ provider: providerKey, reason: (err as Error).message }, 'Rejected webhook');
      throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid webhook');
    }
    throw err;
  }

  const payment = event.providerPaymentId
    ? await prisma.payment.findUnique({ where: { provider_providerPaymentId: { provider: providerKey, providerPaymentId: event.providerPaymentId } } })
    : null;

  // Replay protection: each provider event is processed once.
  let stored;
  try {
    stored = await prisma.paymentEvent.create({
      data: { provider: providerKey, providerEventId: event.eventId, type: event.type, payload: event.payload as Prisma.InputJsonValue, paymentId: payment?.id },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { duplicate: true };
    throw err;
  }

  if (!payment) {
    await prisma.paymentEvent.update({ where: { id: stored.id }, data: { processedAt: new Date(), error: 'Payment not found' } });
    return { ignored: true };
  }
  try {
    // The webhook is only a trigger; the state comes from the provider's API.
    const state = await provider.getPayment(payment.providerPaymentId!);
    await applyProviderState(payment.id, state);
    await prisma.paymentEvent.update({ where: { id: stored.id }, data: { processedAt: new Date() } });
  } catch (err) {
    await prisma.paymentEvent.update({ where: { id: stored.id }, data: { error: String((err as Error).message).slice(0, 500) } });
    // Let the event be redelivered by the provider.
    await prisma.paymentEvent.delete({ where: { id: stored.id } }).catch(() => undefined);
    throw err;
  }
  return { ok: true };
}

/** Refund through the provider, then record it and close the order. */
export async function refundOrder(
  orderId: string,
  input: { amount?: number; reason: string; restock: boolean },
  actorId: string | null,
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true, items: true } });
  const payment = order.payments.find((p) => ['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(p.status));
  if (!payment) throw conflict('По заказу нет успешной оплаты', 'NO_PAYMENT');
  const remaining = payment.amount - payment.refundedAmount;
  const amount = input.amount ?? remaining;
  if (amount <= 0 || amount > remaining) throw badRequest(`Сумма возврата должна быть от 0,01 до ${(remaining / 100).toFixed(2)}`, 'INVALID_REFUND_AMOUNT');

  const provider = getProvider(payment.provider as PaymentProviderKey);
  if (!provider.refund) throw badRequest('Провайдер не поддерживает возвраты', 'REFUND_UNSUPPORTED');
  const refund = await prisma.refund.create({ data: { paymentId: payment.id, amount, reason: input.reason, createdById: actorId } });
  let result;
  try {
    result = await provider.refund(payment.providerPaymentId!, amount, `refund-${refund.id}`);
  } catch (err) {
    logger.error({ err, orderId }, 'Refund failed');
    await prisma.refund.update({ where: { id: refund.id }, data: { status: 'FAILED' } });
    throw new AppError(502, 'REFUND_FAILED', 'Платёжная система отклонила возврат');
  }

  await prisma.$transaction(async (tx) => {
    const refundedAmount = payment.refundedAmount + amount;
    const full = refundedAmount >= payment.amount;
    const paymentStatus = full ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await tx.refund.update({ where: { id: refund.id }, data: { status: result.succeeded ? 'SUCCEEDED' : 'PENDING', providerRefundId: result.providerRefundId } });
    await tx.payment.update({ where: { id: payment.id }, data: { refundedAmount, status: paymentStatus } });
    if (order.status !== 'REFUNDED' && order.status !== 'CANCELLED') {
      await transitionOrder(tx, order, 'REFUNDED', 'staff', {
        actorId,
        comment: `Возврат ${(amount / 100).toFixed(2)} ₽: ${input.reason}`,
        data: { paymentStatus },
        email: { total: amount },
      });
      if (input.restock)
        await inventory.restock(tx, order.id, order.items.filter((i) => i.variantId).map((i) => ({ variantId: i.variantId!, quantity: i.quantity })), actorId);
    } else {
      await tx.order.update({ where: { id: order.id }, data: { paymentStatus } });
    }
  });
  invalidateCatalog();
  return { ok: true, amount };
}
