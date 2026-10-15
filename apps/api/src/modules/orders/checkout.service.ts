import type { Request, Response } from 'express';
import {
  calculatePricing,
  type CheckoutOptionsDTO,
  type PaymentProviderKey,
  type PlaceOrderInput,
  type PlaceOrderResultDTO,
} from '@silt/shared';
import { placeOrderSchema } from '@silt/shared';
import type { z } from 'zod';
import { AppError, badRequest, conflict } from '../../lib/errors';
import { invalidateCatalog } from '../../lib/cache';
import { env } from '../../config/env';
import { orderAccessToken, randomToken } from '../../lib/crypto';
import { logger } from '../../lib/logger';
import { Prisma, prisma } from '../../lib/prisma';
import { lineFromItem, loadCartItems, purchasableLines, resolveCart } from '../cart/cart.service';
import { getSettings } from '../content/settings.service';
import { enqueueEmail } from '../email/email.service';
import * as inventory from '../inventory/inventory.service';
import { availableProviders, getUsableProvider } from '../payments/providers';
import { startPayment } from '../payments/payments.service';
import { orderEmailPayload } from './order-state';

type PlaceOrder = z.output<typeof placeOrderSchema>;

export async function checkoutOptions(): Promise<CheckoutOptionsDTO> {
  const [settings, methods] = await Promise.all([
    getSettings(),
    prisma.deliveryMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, include: { pickupPoints: { where: { isActive: true } } } }),
  ]);
  return {
    deliveryMethods: methods.map((m) => ({
      code: m.code,
      name: m.name,
      type: m.type,
      description: m.description,
      price: m.price,
      freeFromAmount: m.freeFromAmount,
      estimatedDaysMin: m.estimatedDaysMin,
      estimatedDaysMax: m.estimatedDaysMax,
      requiresAddress: m.requiresAddress,
      pickupPoints: m.pickupPoints.map((p) => ({ id: p.id, name: p.name, address: p.address, workingHours: p.workingHours })),
    })),
    paymentMethods: availableProviders(settings.enabledPaymentProviders as PaymentProviderKey[]).map((p) => ({
      provider: p.key,
      name: p.displayName,
      description: p.description,
      testMode: p.testMode,
    })),
  };
}

/** Totals for the checkout summary — same calculation that will be used for the order. */
export async function quote(req: Request, res: Response, deliveryMethodCode?: string) {
  const [settings, cart] = await Promise.all([getSettings(), resolveCart(req, res, false)]);
  const items = cart ? await loadCartItems(cart.id) : [];
  const method = deliveryMethodCode
    ? await prisma.deliveryMethod.findFirst({ where: { code: deliveryMethodCode, isActive: true } })
    : null;
  const pricing = calculatePricing({
    lines: purchasableLines(items),
    shipping: method ? { price: method.price, freeFromAmount: method.freeFromAmount } : null,
    taxRatePercent: settings.taxRatePercent,
  });
  return {
    items: items.map(lineFromItem),
    totals: {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shippingTotal: pricing.shippingTotal,
      taxTotal: pricing.taxTotal,
      total: pricing.total,
      freeShippingRemaining: pricing.freeShippingRemaining,
    },
    currency: settings.currency,
    minOrderAmount: settings.minOrderAmount,
  };
}

async function generateOrderNumber() {
  const d = new Date();
  const date = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  for (let i = 0; i < 5; i++) {
    const number = `SL-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await prisma.order.findUnique({ where: { number }, select: { id: true } }))) return number;
  }
  return `SL-${date}-${randomToken(4).toUpperCase()}`;
}

async function existingResult(req: Request, input: PlaceOrder): Promise<PlaceOrderResultDTO | null> {
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (!existing) return null;
  if (existing.email !== input.contact.email || (existing.userId && existing.userId !== req.user?.id))
    throw conflict('Повторный запрос с чужими данными', 'IDEMPOTENCY_MISMATCH');
  const payment = await prisma.payment.findFirst({ where: { orderId: existing.id }, orderBy: { createdAt: 'desc' } });
  return { orderId: existing.id, number: existing.number, paymentUrl: payment?.confirmationUrl ?? null, accessToken: orderAccessToken(env.APP_SECRET, existing.id) };
}

/** Thrown inside the transaction when a parallel request with the same key already created the order. */
class DuplicateAttempt extends Error {}

export async function placeOrder(req: Request, res: Response, input: PlaceOrder): Promise<PlaceOrderResultDTO> {
  // Double-click / retry protection: the same attempt key returns the same order.
  const existing = await existingResult(req, input);
  if (existing) return existing;
  try {
    return await createOrder(req, res, input);
  } catch (err) {
    // A parallel request with the same key won the race (it may have emptied the cart already).
    const raced = await existingResult(req, input);
    if (raced) return raced;
    throw err;
  }
}

async function createOrder(req: Request, res: Response, input: PlaceOrder): Promise<PlaceOrderResultDTO> {
  const settings = await getSettings();
  const cart = await resolveCart(req, res, false);
  const items = cart ? await loadCartItems(cart.id) : [];
  if (!items.length) throw badRequest('Корзина пуста', 'CART_EMPTY');
  const problems = items.map(lineFromItem).filter((l) => l.issue);
  if (problems.length)
    throw new AppError(409, 'CART_CHANGED', 'Наличие товаров изменилось. Проверьте корзину', {
      items: problems.map((p) => ({ id: p.id, name: p.name, issue: p.issue, available: p.available })),
    });

  const method = await prisma.deliveryMethod.findFirst({ where: { code: input.deliveryMethodCode, isActive: true } });
  if (!method) throw badRequest('Выберите способ доставки', 'DELIVERY_METHOD_INVALID');
  if (method.requiresAddress && !input.address) throw badRequest('Укажите адрес доставки', 'ADDRESS_REQUIRED');
  let pickupPointName: string | null = null;
  if (method.type === 'PICKUP_POINT') {
    const point = input.pickupPointId
      ? await prisma.pickupPoint.findFirst({ where: { id: input.pickupPointId, deliveryMethodId: method.id, isActive: true } })
      : null;
    if (!point) throw badRequest('Выберите пункт выдачи', 'PICKUP_POINT_REQUIRED');
    pickupPointName = `${point.name}, ${point.address}`;
  }
  getUsableProvider(input.paymentProvider, settings.enabledPaymentProviders as PaymentProviderKey[]);

  const lines = purchasableLines(items);
  const pricing = calculatePricing({
    lines,
    shipping: { price: method.price, freeFromAmount: method.freeFromAmount },
    taxRatePercent: settings.taxRatePercent,
  });
  if (pricing.subtotal < settings.minOrderAmount)
    throw badRequest(`Минимальная сумма заказа — ${(settings.minOrderAmount / 100).toFixed(0)} ₽`, 'MIN_ORDER_AMOUNT');

  const number = await generateOrderNumber();
  const expiresAt = new Date(Date.now() + settings.reservationTtlMinutes * 60_000);
  const byVariant = new Map(items.map((i) => [i.variantId, i]));

  let order;
  try {
    order = await prisma.$transaction(
      async (tx) => {
        // Serialise attempts with the same key; the loser sees the winner's order and backs off.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`;
        if (await tx.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true } })) throw new DuplicateAttempt();
        const created = await tx.order.create({
          data: {
            number,
            userId: req.user?.id ?? null,
            email: input.contact.email,
            phone: input.contact.phone,
            firstName: input.contact.firstName,
            lastName: input.contact.lastName,
            deliveryMethodCode: method.code,
            deliveryMethodName: method.name,
            shippingAddress: method.requiresAddress ? (input.address as Prisma.InputJsonValue) : Prisma.JsonNull,
            pickupPointName,
            currency: settings.currency,
            subtotal: pricing.subtotal,
            discountTotal: pricing.discountTotal,
            shippingTotal: pricing.shippingTotal,
            taxTotal: pricing.taxTotal,
            total: pricing.total,
            paymentProvider: input.paymentProvider,
            customerComment: input.comment,
            idempotencyKey: input.idempotencyKey,
            reservationExpiresAt: expiresAt,
            // Snapshot: later product edits never change what this order contains.
            items: {
              create: lines.map((l) => {
                const it = byVariant.get(l.key)!;
                const v = it.variant;
                const discount = pricing.lineDiscounts[l.key] ?? 0;
                return {
                  productId: v.productId,
                  variantId: v.id,
                  productName: v.product.name,
                  productSlug: v.product.slug,
                  sku: v.sku,
                  size: v.size.label,
                  color: v.color.name,
                  imageUrl: (v.product.images.find((i) => i.colorId === v.colorId) ?? v.product.images[0])?.url ?? null,
                  unitPrice: l.unitPrice,
                  quantity: l.quantity,
                  discount,
                  lineTotal: l.unitPrice * l.quantity - discount,
                };
              }),
            },
            shipment: { create: {} },
            statusHistory: { create: { toStatus: 'CREATED', comment: 'Заказ оформлен' } },
          },
        });
        await inventory.reserve(tx, created.id, lines.map((l) => ({ variantId: l.key, quantity: l.quantity })), expiresAt);
        if (input.saveAddress && req.user && input.address) {
          const count = await tx.address.count({ where: { userId: req.user.id } });
          if (count < 10)
            await tx.address.create({
              data: { ...input.address, userId: req.user.id, firstName: input.contact.firstName, lastName: input.contact.lastName, phone: input.contact.phone, isDefault: count === 0 },
            });
        }
        await enqueueEmail(created.email, 'order_created', await orderEmailPayload(tx, created), tx);
        await tx.cartItem.deleteMany({ where: { cartId: cart!.id } });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
    );
  } catch (err) {
    if (err instanceof DuplicateAttempt) return (await existingResult(req, input))!;
    throw err;
  }
  invalidateCatalog();

  const accessToken = orderAccessToken(env.APP_SECRET, order.id);
  let paymentUrl: string | null = null;
  try {
    paymentUrl = (await startPayment(order.id, accessToken)).paymentUrl;
  } catch (err) {
    // The order exists and stock is held; the customer can retry payment from the order page.
    logger.warn({ err, orderId: order.id }, 'Initial payment start failed');
  }
  return { orderId: order.id, number: order.number, paymentUrl, accessToken };
}

export type { PlaceOrderInput };
