import { Router } from 'express';
import { brandInputSchema, categoryInputSchema, collectionInputSchema } from '@silt/shared';
import { audit } from '../../lib/audit';
import { invalidateCatalog } from '../../lib/cache';
import { badRequest, conflict } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';

export const adminCatalogRouter = Router();
const r = createRoutes(adminCatalogRouter, '/admin', 'Админ: категории и коллекции');

// ── Categories ──
r.get('/categories', { summary: 'Все категории', permission: 'products.read' }, () =>
  prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true, children: true } } } }),
);

async function checkParent(id: string | null, parentId: string | null) {
  if (!parentId) return;
  if (parentId === id) throw badRequest('Категория не может быть родителем самой себя');
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw badRequest('Родительская категория не найдена');
  // Two levels keep navigation simple and avoid cycles.
  if (parent.parentId) throw badRequest('Допускается только два уровня вложенности');
}

r.post('/categories', { summary: 'Создать категорию', permission: 'categories.write', body: categoryInputSchema, status: 201 }, async ({ req, body }) => {
  await checkParent(null, body.parentId);
  const c = await prisma.category.create({ data: body });
  await audit(req, 'category.create', 'Category', c.id, { name: c.name });
  invalidateCatalog();
  return c;
});

r.put('/categories/:id', { summary: 'Изменить категорию', permission: 'categories.write', params: idParams, body: categoryInputSchema }, async ({ req, params, body }) => {
  await checkParent(params.id, body.parentId);
  if (body.parentId && (await prisma.category.count({ where: { parentId: params.id } })))
    throw badRequest('У категории есть подкатегории — её нельзя вложить в другую');
  const c = await prisma.category.update({ where: { id: params.id }, data: body });
  await audit(req, 'category.update', 'Category', c.id, { name: c.name });
  invalidateCatalog();
  return c;
});

r.delete('/categories/:id', { summary: 'Удалить пустую категорию', permission: 'categories.write', params: idParams }, async ({ req, params }) => {
  const products = await prisma.product.count({ where: { categoryId: params.id } });
  if (products) throw conflict(`В категории ${products} товаров — сначала перенесите их`, 'CATEGORY_NOT_EMPTY');
  await prisma.category.updateMany({ where: { parentId: params.id }, data: { parentId: null } });
  await prisma.category.delete({ where: { id: params.id } });
  await audit(req, 'category.delete', 'Category', params.id);
  invalidateCatalog();
});

// ── Brands ──
r.get('/brands', { summary: 'Бренды', permission: 'products.read' }, () =>
  prisma.brand.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
);
r.post('/brands', { summary: 'Создать бренд', permission: 'categories.write', body: brandInputSchema, status: 201 }, async ({ req, body }) => {
  const b = await prisma.brand.create({ data: body });
  await audit(req, 'brand.create', 'Brand', b.id, { name: b.name });
  invalidateCatalog();
  return b;
});
r.put('/brands/:id', { summary: 'Изменить бренд', permission: 'categories.write', params: idParams, body: brandInputSchema }, async ({ req, params, body }) => {
  const b = await prisma.brand.update({ where: { id: params.id }, data: body });
  await audit(req, 'brand.update', 'Brand', b.id, { name: b.name });
  invalidateCatalog();
  return b;
});
r.delete('/brands/:id', { summary: 'Удалить бренд', permission: 'categories.write', params: idParams }, async ({ req, params }) => {
  await prisma.brand.delete({ where: { id: params.id } });
  await audit(req, 'brand.delete', 'Brand', params.id);
  invalidateCatalog();
});

// ── Collections ──
r.get('/collections', { summary: 'Коллекции', permission: 'products.read' }, async () =>
  (await prisma.collection.findMany({ orderBy: { sortOrder: 'asc' }, include: { products: { select: { productId: true } } } })).map(({ products, ...c }) => ({
    ...c,
    productIds: products.map((p) => p.productId),
  })),
);

r.post('/collections', { summary: 'Создать коллекцию', permission: 'collections.write', body: collectionInputSchema, status: 201 }, async ({ req, body }) => {
  const { productIds, ...data } = body;
  const c = await prisma.collection.create({
    data: { ...data, products: { create: productIds.map((productId, i) => ({ productId, sortOrder: i })) } },
  });
  await audit(req, 'collection.create', 'Collection', c.id, { name: c.name });
  invalidateCatalog();
  return c;
});

r.put('/collections/:id', { summary: 'Изменить коллекцию', permission: 'collections.write', params: idParams, body: collectionInputSchema }, async ({ req, params, body }) => {
  const { productIds, ...data } = body;
  const c = await prisma.$transaction(async (tx) => {
    await tx.productCollection.deleteMany({ where: { collectionId: params.id } });
    return tx.collection.update({
      where: { id: params.id },
      data: { ...data, products: { create: productIds.map((productId, i) => ({ productId, sortOrder: i })) } },
    });
  });
  await audit(req, 'collection.update', 'Collection', c.id, { name: c.name });
  invalidateCatalog();
  return c;
});

r.delete('/collections/:id', { summary: 'Удалить коллекцию', permission: 'collections.write', params: idParams }, async ({ req, params }) => {
  await prisma.collection.delete({ where: { id: params.id } });
  await audit(req, 'collection.delete', 'Collection', params.id);
  invalidateCatalog();
});
