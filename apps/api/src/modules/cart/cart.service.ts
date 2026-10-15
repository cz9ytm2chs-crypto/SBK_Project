import type { Request, Response } from 'express';
import { calculatePricing, type CartDTO, type CartLineDTO, type PricingLine } from '@silt/shared';
import { AppError, badRequest, notFound } from '../../lib/errors';
import { CART_COOKIE, clearCookie, setCookie } from '../../lib/cookies';
import { randomToken, sha256 } from '../../lib/crypto';
import { Prisma, prisma } from '../../lib/prisma';
import { getSettings } from '../content/settings.service';

const GUEST_CART_TTL = 1000 * 60 * 60 * 24 * 60;
export const MAX_LINE_QTY = 20;

const itemInclude = {
  variant: {
    include: {
      size: true,
      color: true,
      product: {
        include: {
          brand: { select: { name: true } },
          images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }] },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemFull = Prisma.CartItemGetPayload<{ include: typeof itemInclude }>;

/** Finds the cart of the current user or guest. Creates one when `create` is set. */
export async function resolveCart(req: Request, res: Response, create: boolean) {
  if (req.user) {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (cart || !create) return cart;
    return prisma.cart.create({ data: { userId: req.user.id } });
  }
  const token = req.cookies?.[CART_COOKIE];
  if (typeof token === 'string' && token) {
    const cart = await prisma.cart.findUnique({ where: { guestTokenHash: sha256(token) } });
    if (cart) return cart;
  }
  if (!create) return null;
  const newToken = randomToken();
  setCookie(res, CART_COOKIE, newToken, GUEST_CART_TTL);
  return prisma.cart.create({ data: { guestTokenHash: sha256(newToken) } });
}

export function lineFromItem(item: CartItemFull): CartLineDTO {
  const v = item.variant;
  const p = v.product;
  const available = Math.max(0, v.stock - v.reserved);
  const purchasable = v.isActive && p.status === 'PUBLISHED';
  const image = p.images.find((i) => i.colorId === v.colorId) ?? p.images[0];
  let issue: CartLineDTO['issue'] = null;
  if (!purchasable) issue = 'UNAVAILABLE';
  else if (available === 0) issue = 'OUT_OF_STOCK';
  else if (item.quantity > available) issue = 'QUANTITY_REDUCED';
  return {
    id: item.id,
    variantId: v.id,
    productId: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand?.name ?? null,
    image: image?.url ?? null,
    size: v.size.label,
    color: v.color.name,
    colorHex: v.color.hex,
    sku: v.sku,
    unitPrice: p.price,
    compareAtPrice: p.compareAtPrice,
    quantity: item.quantity,
    available,
    lineTotal: p.price * item.quantity,
    issue,
  };
}

/** Lines that can actually be bought right now (used for totals and checkout). */
export function purchasableLines(items: CartItemFull[]): PricingLine[] {
  return items
    .filter((i) => i.variant.isActive && i.variant.product.status === 'PUBLISHED')
    .map((i) => ({
      key: i.variantId,
      productId: i.variant.productId,
      categoryId: i.variant.product.categoryId,
      unitPrice: i.variant.product.price,
      quantity: Math.min(i.quantity, Math.max(0, i.variant.stock - i.variant.reserved)),
    }))
    .filter((l) => l.quantity > 0);
}

export async function loadCartItems(cartId: string) {
  return prisma.cartItem.findMany({ where: { cartId }, include: itemInclude, orderBy: { createdAt: 'asc' } });
}

export async function buildCart(cartId: string | null): Promise<CartDTO> {
  const settings = await getSettings();
  const items = cartId ? await loadCartItems(cartId) : [];
  const freeShipping = await prisma.deliveryMethod.findFirst({
    where: { isActive: true, type: 'COURIER' },
    orderBy: { sortOrder: 'asc' },
  });
  const pricing = calculatePricing({
    lines: purchasableLines(items),
    // Shipping is chosen at checkout; here it only drives the "free shipping in N" hint.
    shipping: freeShipping ? { price: 0, freeFromAmount: freeShipping.freeFromAmount } : null,
    taxRatePercent: settings.taxRatePercent,
  });
  const lines = items.map(lineFromItem);
  return {
    id: cartId ?? '',
    items: lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    totals: {
      subtotal: pricing.subtotal,
      discountTotal: pricing.discountTotal,
      shippingTotal: 0,
      taxTotal: pricing.taxTotal,
      total: pricing.subtotal - pricing.discountTotal,
      freeShippingRemaining: pricing.freeShippingRemaining,
    },
    currency: settings.currency,
    minOrderAmount: settings.minOrderAmount,
  };
}

async function assertAvailable(variantId: string, quantity: number) {
  const v = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { select: { status: true } } },
  });
  // A non-existent size/colour combination simply has no variant row.
  if (!v || !v.isActive || v.product.status !== 'PUBLISHED')
    throw notFound('Такой вариант товара недоступен');
  const available = v.stock - v.reserved;
  if (available <= 0) throw new AppError(409, 'OUT_OF_STOCK', 'Товар закончился');
  if (quantity > available)
    throw new AppError(409, 'NOT_ENOUGH_STOCK', `Доступно только ${available} шт.`, { available });
}

export async function addItem(cartId: string, variantId: string, quantity: number) {
  const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const next = (existing?.quantity ?? 0) + quantity;
  if (next > MAX_LINE_QTY) throw badRequest(`Не больше ${MAX_LINE_QTY} шт. одной позиции`, 'QUANTITY_LIMIT');
  await assertAvailable(variantId, next);
  await prisma.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity },
    update: { quantity: next },
  });
}

export async function updateItem(cartId: string, itemId: string, quantity: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
  if (!item) throw notFound('Позиция не найдена');
  await assertAvailable(item.variantId, quantity);
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
}

export async function removeItem(cartId: string, itemId: string) {
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
}

/** After login: move guest cart lines into the user's cart (quantities summed, capped by stock). */
export async function mergeGuestCart(req: Request, res: Response, userId: string) {
  const token = req.cookies?.[CART_COOKIE];
  if (typeof token !== 'string' || !token) return;
  const guest = await prisma.cart.findUnique({ where: { guestTokenHash: sha256(token) }, include: { items: { include: { variant: true } } } });
  clearCookie(res, CART_COOKIE);
  if (!guest) return;
  const userCart = (await prisma.cart.findUnique({ where: { userId } })) ?? (await prisma.cart.create({ data: { userId } }));
  for (const item of guest.items) {
    const existing = await prisma.cartItem.findUnique({ where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } } });
    const available = Math.max(0, item.variant.stock - item.variant.reserved);
    const quantity = Math.min((existing?.quantity ?? 0) + item.quantity, MAX_LINE_QTY, Math.max(available, 1));
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
      create: { cartId: userCart.id, variantId: item.variantId, quantity },
      update: { quantity },
    });
  }
  await prisma.cart.delete({ where: { id: guest.id } });
}
