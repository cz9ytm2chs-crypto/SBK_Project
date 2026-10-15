import { Router, type Request } from 'express';
import { z } from 'zod';
import { checkoutQuoteSchema, placeOrderSchema } from '@silt/shared';
import { forbidden, notFound } from '../../lib/errors';
import { env } from '../../config/env';
import { orderAccessToken, safeEqual } from '../../lib/crypto';
import { paged, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';
import { checkoutLimiter } from '../../middleware/security';
import { MAX_LINE_QTY, resolveCart } from '../cart/cart.service';
import { startPayment, syncOrderPayments } from '../payments/payments.service';
import * as inventory from '../inventory/inventory.service';
import { invalidateCatalog } from '../../lib/cache';
import { checkoutOptions, placeOrder, quote } from './checkout.service';
import { orderInclude, toOrderDTO, toOrderSummary } from './order.mapper';
import { transitionOrder } from './order-state';

// ── Checkout ──
export const checkoutRouter = Router();
checkoutRouter.use('/orders', checkoutLimiter);
const c = createRoutes(checkoutRouter, '/checkout', 'Оформление заказа');

c.get('/options', { summary: 'Способы доставки и оплаты' }, () => checkoutOptions());

c.get('/quote', { summary: 'Расчёт итоговой суммы на сервере', query: checkoutQuoteSchema }, ({ req, res, query }) =>
  quote(req, res, query.deliveryMethodCode),
);

c.post('/orders', { summary: 'Создать заказ (идемпотентно) и платёжную сессию', body: placeOrderSchema, status: 201 }, ({ req, res, body }) =>
  placeOrder(req, res, body),
);

// ── Orders ──
export const ordersRouter = Router();
const o = createRoutes(ordersRouter, '/orders', 'Заказы');
const tokenQuery = z.object({ token: z.string().max(100).optional() });

/** Owner, staff with orders.read, or a guest holding the access token from the checkout redirect. */
async function loadViewableOrder(req: Request, id: string, token?: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw notFound('Заказ не найден');
  const isOwner = !!req.user && order.userId === req.user.id;
  const isStaff = !!req.user?.permissions.includes('orders.read');
  const hasToken = !!token && safeEqual(token, orderAccessToken(env.APP_SECRET, order.id));
  if (!isOwner && !isStaff && !hasToken) throw notFound('Заказ не найден');
  return order;
}

o.get(
  '/',
  { summary: 'История заказов пользователя', auth: 'user', query: z.object({ page: z.coerce.number().int().min(1).default(1) }) },
  async ({ req, query }) => {
    const where = { userId: req.user!.id };
    const [items, total] = await Promise.all([
      prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: 'desc' }, ...paginate(query.page, 10) }),
      prisma.order.count({ where }),
    ]);
    return paged(items.map(toOrderSummary), total, query.page, 10);
  },
);

o.get('/:id', { summary: 'Заказ', params: idParams, query: tokenQuery }, async ({ req, params, query }) =>
  toOrderDTO(await loadViewableOrder(req, params.id, query.token)),
);

o.post(
  '/:id/sync-payment',
  { summary: 'Повторно запросить статус оплаты у провайдера', params: idParams, query: tokenQuery },
  async ({ req, params, query }) => {
    const order = await loadViewableOrder(req, params.id, query.token);
    if (['CREATED', 'AWAITING_PAYMENT', 'CANCELLED'].includes(order.status)) await syncOrderPayments(order.id);
    return toOrderDTO(await loadViewableOrder(req, params.id, query.token));
  },
);

o.post('/:id/pay', { summary: 'Повторная оплата неоплаченного заказа', params: idParams, query: tokenQuery }, async ({ req, params, query }) => {
  const order = await loadViewableOrder(req, params.id, query.token);
  return startPayment(order.id, query.token ?? null);
});

o.post('/:id/cancel', { summary: 'Отмена неоплаченного заказа покупателем', params: idParams, query: tokenQuery }, async ({ req, params, query }) => {
  const order = await loadViewableOrder(req, params.id, query.token);
  if (!['CREATED', 'AWAITING_PAYMENT'].includes(order.status)) throw forbidden('Оплаченный заказ можно отменить только через поддержку');
  await syncOrderPayments(order.id); // do not cancel something that was just paid
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
    await inventory.release(tx, fresh.id, 'RELEASED', 'Отмена покупателем');
    await transitionOrder(tx, fresh, 'CANCELLED', 'system', {
      comment: 'Отменён покупателем',
      data: { cancelledAt: new Date(), reservationExpiresAt: null, paymentStatus: 'CANCELLED' },
    });
  });
  invalidateCatalog();
  return toOrderDTO(await loadViewableOrder(req, params.id, query.token));
});

o.post('/:id/reorder', { summary: 'Повторить заказ: добавить доступные позиции в корзину', params: idParams, auth: 'user' }, async ({ req, res, params }) => {
  const order = await loadViewableOrder(req, params.id);
  const cart = (await resolveCart(req, res, true))!;
  let added = 0;
  const skipped: string[] = [];
  for (const item of order.items) {
    const v = item.variantId
      ? await prisma.productVariant.findUnique({ where: { id: item.variantId }, include: { product: { select: { status: true } } } })
      : null;
    const available = v && v.isActive && v.product.status === 'PUBLISHED' ? v.stock - v.reserved : 0;
    if (!v || available <= 0) {
      skipped.push(item.productName);
      continue;
    }
    const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: v.id } } });
    const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, available, MAX_LINE_QTY);
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: v.id } },
      create: { cartId: cart.id, variantId: v.id, quantity },
      update: { quantity },
    });
    added++;
  }
  return { added, skipped };
});
