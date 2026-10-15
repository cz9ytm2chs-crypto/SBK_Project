import { Router } from 'express';
import { z } from 'zod';
import { addCartItemSchema, updateCartItemSchema } from '@silt/shared';
import { prisma } from '../../lib/prisma';
import { createRoutes } from '../../lib/route';
import { getProductCards } from '../catalog/catalog.service';
import * as cart from './cart.service';

export const cartRouter = Router();
const r = createRoutes(cartRouter, '/cart', 'Корзина');
const itemParams = z.object({ itemId: z.string().min(1).max(64) });

r.get('/', { summary: 'Корзина с актуальными ценами и остатками' }, async ({ req, res }) => {
  const c = await cart.resolveCart(req, res, false);
  return cart.buildCart(c?.id ?? null);
});

r.post('/items', { summary: 'Добавить вариацию товара', body: addCartItemSchema }, async ({ req, res, body }) => {
  const c = (await cart.resolveCart(req, res, true))!;
  await cart.addItem(c.id, body.variantId, body.quantity);
  return cart.buildCart(c.id);
});

r.patch('/items/:itemId', { summary: 'Изменить количество', params: itemParams, body: updateCartItemSchema }, async ({ req, res, params, body }) => {
  const c = (await cart.resolveCart(req, res, true))!;
  await cart.updateItem(c.id, params.itemId, body.quantity);
  return cart.buildCart(c.id);
});

r.delete('/items/:itemId', { summary: 'Удалить позицию', params: itemParams }, async ({ req, res, params }) => {
  const c = await cart.resolveCart(req, res, false);
  if (c) await cart.removeItem(c.id, params.itemId);
  return cart.buildCart(c?.id ?? null);
});

r.delete('/', { summary: 'Очистить корзину' }, async ({ req, res }) => {
  const c = await cart.resolveCart(req, res, false);
  if (c) await prisma.cartItem.deleteMany({ where: { cartId: c.id } });
  return cart.buildCart(c?.id ?? null);
});

r.get('/recommendations', { summary: 'Рекомендации к корзине' }, async ({ req, res }) => {
  const c = await cart.resolveCart(req, res, false);
  const items = c ? await prisma.cartItem.findMany({ where: { cartId: c.id }, select: { variant: { select: { product: { select: { id: true, categoryId: true } } } } } }) : [];
  const inCart = items.map((i) => i.variant.product.id);
  const categories = [...new Set(items.map((i) => i.variant.product.categoryId))];
  // Complementary items: other categories first, bestsellers as fallback.
  return getProductCards(
    { id: { notIn: inCart }, ...(categories.length ? { categoryId: { notIn: categories } } : {}), variants: { some: { stock: { gt: 0 } } } },
    [{ isBestseller: 'desc' }, { salesCount: 'desc' }],
    4,
  );
});
