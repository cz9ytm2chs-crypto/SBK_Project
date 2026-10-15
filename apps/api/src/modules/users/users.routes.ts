import { Router } from 'express';
import { z } from 'zod';
import { addressSchema, updateProfileSchema, type AddressDTO } from '@silt/shared';
import { badRequest, notFound } from '../../lib/errors';
import { prisma, type Tx } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';
import { me } from '../auth/auth.service';
import { cardInclude, toCard } from '../catalog/catalog.mapper';

export const usersRouter = Router();
const r = createRoutes(usersRouter, '/users', 'Профиль');

r.patch('/me', { summary: 'Изменить профиль', body: updateProfileSchema, auth: 'user' }, async ({ req, body }) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { firstName: body.firstName, lastName: body.lastName, phone: body.phone || null, marketingOptIn: body.marketingOptIn },
  });
  return { user: await me(req.user!.id) };
});

const toAddress = (a: AddressDTO & Record<string, unknown>): AddressDTO => ({
  id: a.id,
  label: a.label,
  firstName: a.firstName,
  lastName: a.lastName,
  phone: a.phone,
  country: a.country,
  region: a.region,
  city: a.city,
  street: a.street,
  house: a.house,
  apartment: a.apartment,
  postalCode: a.postalCode,
  isDefault: a.isDefault,
});

async function clearDefault(tx: Tx, userId: string) {
  await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
}

r.get('/me/addresses', { summary: 'Адреса доставки', auth: 'user' }, async ({ req }) =>
  (await prisma.address.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })).map(toAddress),
);

r.post('/me/addresses', { summary: 'Добавить адрес', body: addressSchema, auth: 'user', status: 201 }, async ({ req, body }) => {
  const userId = req.user!.id;
  const count = await prisma.address.count({ where: { userId } });
  if (count >= 10) throw badRequest('Можно сохранить не больше 10 адресов', 'ADDRESS_LIMIT');
  return prisma.$transaction(async (tx) => {
    const isDefault = body.isDefault || count === 0;
    if (isDefault) await clearDefault(tx, userId);
    return toAddress(await tx.address.create({ data: { ...body, isDefault, userId } }));
  });
});

r.put('/me/addresses/:id', { summary: 'Изменить адрес', params: idParams, body: addressSchema, auth: 'user' }, async ({ req, params, body }) => {
  const userId = req.user!.id;
  const existing = await prisma.address.findFirst({ where: { id: params.id, userId } });
  if (!existing) throw notFound('Адрес не найден');
  return prisma.$transaction(async (tx) => {
    if (body.isDefault) await clearDefault(tx, userId);
    return toAddress(await tx.address.update({ where: { id: params.id }, data: body }));
  });
});

r.delete('/me/addresses/:id', { summary: 'Удалить адрес', params: idParams, auth: 'user' }, async ({ req, params }) => {
  await prisma.address.deleteMany({ where: { id: params.id, userId: req.user!.id } });
});

// ── Favorites ──
export const favoritesRouter = Router();
const f = createRoutes(favoritesRouter, '/favorites', 'Избранное');
const productParams = z.object({ productId: z.string().min(1).max(64) });

f.get('/', { summary: 'Избранные товары', auth: 'user' }, async ({ req }) => {
  const rows = await prisma.favorite.findMany({
    where: { userId: req.user!.id, product: { status: 'PUBLISHED' } },
    orderBy: { createdAt: 'desc' },
    include: { product: { include: cardInclude } },
  });
  return rows.map((r) => toCard(r.product));
});

f.get('/ids', { summary: 'id избранных товаров', auth: 'user' }, async ({ req }) =>
  (await prisma.favorite.findMany({ where: { userId: req.user!.id }, select: { productId: true } })).map((r) => r.productId),
);

f.post('/:productId', { summary: 'Добавить в избранное', params: productParams, auth: 'user' }, async ({ req, params }) => {
  const product = await prisma.product.findFirst({ where: { id: params.productId, status: 'PUBLISHED' }, select: { id: true } });
  if (!product) throw notFound('Товар не найден');
  await prisma.favorite.upsert({
    where: { userId_productId: { userId: req.user!.id, productId: product.id } },
    create: { userId: req.user!.id, productId: product.id },
    update: {},
  });
  return { ok: true };
});

f.delete('/:productId', { summary: 'Убрать из избранного', params: productParams, auth: 'user' }, async ({ req, params }) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.id, productId: params.productId } });
});

f.post(
  '/sync',
  { summary: 'Перенести гостевое избранное в аккаунт', body: z.object({ productIds: z.array(z.string().max(64)).max(100) }), auth: 'user' },
  async ({ req, body }) => {
    const valid = await prisma.product.findMany({ where: { id: { in: body.productIds }, status: 'PUBLISHED' }, select: { id: true } });
    await prisma.favorite.createMany({
      data: valid.map((p) => ({ userId: req.user!.id, productId: p.id })),
      skipDuplicates: true,
    });
    return (await prisma.favorite.findMany({ where: { userId: req.user!.id }, select: { productId: true } })).map((r) => r.productId);
  },
);
