import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  bulkProductUpdateSchema,
  discountPercent,
  productInputSchema,
  stockAdjustSchema,
  type ProductInputParsed,
} from '@silt/shared';
import { audit } from '../../lib/audit';
import { invalidateCatalog } from '../../lib/cache';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { paged, paginate } from '../../lib/pagination';
import { Prisma, prisma, type Tx } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';
import { MAX_UPLOAD_BYTES, storage, storeProductImage } from '../../lib/storage';
import * as inventory from '../inventory/inventory.service';

export const adminProductsRouter = Router();
const r = createRoutes(adminProductsRouter, '/admin/products', 'Админ: товары');

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  stock: z.enum(['low', 'out']).optional(),
  sort: z.enum(['updated', 'name', 'price_asc', 'price_desc', 'sales']).default('updated'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const SORT: Record<z.infer<typeof listQuery>['sort'], Prisma.ProductOrderByWithRelationInput> = {
  updated: { updatedAt: 'desc' },
  name: { name: 'asc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  sales: { salesCount: 'desc' },
};

r.get('/', { summary: 'Список товаров: поиск, фильтры, сортировка', permission: 'products.read', query: listQuery }, async ({ query }) => {
  const where: Prisma.ProductWhereInput = {
    status: query.status,
    categoryId: query.categoryId,
    brandId: query.brandId,
  };
  if (query.q)
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { slug: { contains: query.q, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
    ];
  if (query.stock === 'out') where.variants = { none: { stock: { gt: prisma.productVariant.fields.reserved } } };
  if (query.stock === 'low') where.variants = { some: { stock: { lte: 3 } } };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORT[query.sort],
      ...paginate(query.page, query.pageSize),
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } },
        variants: { select: { stock: true, reserved: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return paged(
    items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      category: p.category.name,
      brand: p.brand?.name ?? null,
      image: p.images[0]?.url ?? null,
      stock: p.variants.reduce((s, v) => s + v.stock, 0),
      available: p.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0),
      variantCount: p.variants.length,
      isNew: p.isNew,
      isBestseller: p.isBestseller,
      isFeatured: p.isFeatured,
      salesCount: p.salesCount,
      updatedAt: p.updatedAt,
    })),
    total,
    query.page,
    query.pageSize,
  );
});

r.get('/references', { summary: 'Справочники для формы товара', permission: 'products.read' }, async () => {
  const [categories, brands, sizes, colors, collections] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }], select: { id: true, name: true, parentId: true } }),
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.size.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.color.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.collection.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
  ]);
  return { categories, brands, sizes, colors, collections };
});

r.get('/:id', { summary: 'Товар для редактирования', permission: 'products.read', params: idParams }, async ({ params, req }) => {
  const p = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      variants: { orderBy: [{ size: { sortOrder: 'asc' } }, { color: { sortOrder: 'asc' } }] },
      images: { orderBy: { sortOrder: 'asc' } },
      collections: { select: { collectionId: true } },
    },
  });
  if (!p) throw notFound('Товар не найден');
  const canSeeCost = req.user!.permissions.includes('products.write');
  return {
    ...p,
    costPrice: canSeeCost ? p.costPrice : null,
    collectionIds: p.collections.map((c) => c.collectionId),
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock, reserved: v.reserved, isActive: v.isActive })),
  };
});

/** Writes variants: stock changes go through the inventory ledger, removed variants are deactivated or deleted. */
async function syncVariants(tx: Tx, productId: string, variants: ProductInputParsed['variants'], actorId: string, canEditStock: boolean) {
  const existing = await tx.productVariant.findMany({ where: { productId } });
  const keep = new Set(variants.filter((v) => v.id).map((v) => v.id!));
  for (const old of existing.filter((e) => !keep.has(e.id))) {
    const used = await tx.orderItem.count({ where: { variantId: old.id } });
    if (old.reserved > 0) throw conflict(`Вариация ${old.sku} зарезервирована в заказах и не может быть удалена`, 'VARIANT_RESERVED');
    if (used) await tx.productVariant.update({ where: { id: old.id }, data: { isActive: false } });
    else await tx.productVariant.delete({ where: { id: old.id } });
  }
  for (const v of variants) {
    const sku = v.sku.toUpperCase();
    if (v.id) {
      const prev = existing.find((e) => e.id === v.id);
      if (!prev) throw badRequest('Вариация не принадлежит товару');
      await tx.productVariant.update({ where: { id: v.id }, data: { sku, sizeId: v.sizeId, colorId: v.colorId, isActive: v.isActive } });
      if (prev.stock !== v.stock) {
        if (!canEditStock) throw forbidden('Нет права изменять остатки');
        await inventory.setStock(tx, v.id, v.stock, actorId, 'Изменение в карточке товара');
      }
    } else {
      const created = await tx.productVariant.create({ data: { productId, sku, sizeId: v.sizeId, colorId: v.colorId, isActive: v.isActive, stock: 0 } });
      if (v.stock > 0) await inventory.setStock(tx, created.id, v.stock, actorId, 'Начальный остаток');
    }
  }
}

async function syncImages(tx: Tx, productId: string, images: ProductInputParsed['images']) {
  const existing = await tx.productImage.findMany({ where: { productId } });
  const keep = new Set(images.filter((i) => i.id).map((i) => i.id!));
  const removed = existing.filter((e) => !keep.has(e.id));
  await tx.productImage.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } });
  const mainIndex = Math.max(0, images.findIndex((i) => i.isMain));
  for (const [i, img] of images.entries()) {
    const data = { url: img.url, storageKey: img.storageKey ?? null, alt: img.alt, colorId: img.colorId || null, sortOrder: i, isMain: i === mainIndex };
    if (img.id) await tx.productImage.update({ where: { id: img.id }, data });
    else await tx.productImage.create({ data: { ...data, productId } });
  }
  return removed.filter((e) => e.storageKey).map((e) => e.storageKey!);
}

function productData(body: ProductInputParsed) {
  return {
    name: body.name,
    slug: body.slug,
    description: body.description,
    material: body.material,
    care: body.care,
    fit: body.fit,
    price: body.price,
    compareAtPrice: body.compareAtPrice,
    discountPercent: discountPercent(body.price, body.compareAtPrice),
    costPrice: body.costPrice,
    status: body.status,
    isNew: body.isNew,
    isBestseller: body.isBestseller,
    isFeatured: body.isFeatured,
    categoryId: body.categoryId,
    brandId: body.brandId,
    seoTitle: body.seoTitle,
    seoDescription: body.seoDescription,
  };
}

r.post('/', { summary: 'Создать товар', permission: 'products.write', body: productInputSchema, status: 201 }, async ({ req, body }) => {
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        ...productData(body),
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
        collections: { create: body.collectionIds.map((collectionId) => ({ collectionId })) },
      },
    });
    // Initial stock is part of creating a product, so products.write is enough here.
    await syncVariants(tx, p.id, body.variants, req.user!.id, true);
    await syncImages(tx, p.id, body.images);
    await audit(req, 'product.create', 'Product', p.id, { name: p.name, price: p.price, status: p.status }, tx);
    return p;
  });
  invalidateCatalog();
  return { id: product.id };
});

r.put('/:id', { summary: 'Изменить товар', permission: 'products.write', params: idParams, body: productInputSchema }, async ({ req, params, body }) => {
  const before = await prisma.product.findUnique({ where: { id: params.id } });
  if (!before) throw notFound('Товар не найден');
  const canEditStock = req.user!.permissions.includes('inventory.write');
  const removedKeys = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: params.id },
      data: {
        ...productData(body),
        publishedAt: body.status === 'PUBLISHED' ? (before.publishedAt ?? new Date()) : before.publishedAt,
      },
    });
    await tx.productCollection.deleteMany({ where: { productId: params.id, collectionId: { notIn: body.collectionIds } } });
    for (const collectionId of body.collectionIds)
      await tx.productCollection.upsert({
        where: { productId_collectionId: { productId: params.id, collectionId } },
        create: { productId: params.id, collectionId },
        update: {},
      });
    await syncVariants(tx, params.id, body.variants, req.user!.id, canEditStock);
    const removed = await syncImages(tx, params.id, body.images);
    const changes: Record<string, unknown> = {};
    if (before.price !== body.price) changes.price = { from: before.price, to: body.price };
    if (before.status !== body.status) changes.status = { from: before.status, to: body.status };
    await audit(req, 'product.update', 'Product', params.id, { name: body.name, ...changes }, tx);
    return removed;
  });
  removedKeys.forEach((k) => storage.remove(k).catch(() => undefined));
  invalidateCatalog();
  return { id: params.id };
});

r.delete('/:id', { summary: 'Удалить товар (с продажами — архивируется)', permission: 'products.delete', params: idParams }, async ({ req, params }) => {
  const p = await prisma.product.findUnique({ where: { id: params.id }, include: { images: true, variants: { select: { reserved: true } } } });
  if (!p) throw notFound('Товар не найден');
  if (p.variants.some((v) => v.reserved > 0)) throw conflict('Товар зарезервирован в неоплаченных заказах', 'PRODUCT_RESERVED');
  const sold = await prisma.orderItem.count({ where: { productId: p.id } });
  if (sold) {
    // Order history keeps its snapshots; archived products disappear from the shop.
    await prisma.product.update({ where: { id: p.id }, data: { status: 'ARCHIVED' } });
    await audit(req, 'product.archive', 'Product', p.id, { name: p.name });
    invalidateCatalog();
    return { archived: true };
  }
  await prisma.product.delete({ where: { id: p.id } });
  p.images.filter((i) => i.storageKey).forEach((i) => storage.remove(i.storageKey!).catch(() => undefined));
  await audit(req, 'product.delete', 'Product', p.id, { name: p.name });
  invalidateCatalog();
  return { deleted: true };
});

r.post('/bulk', { summary: 'Массовое изменение цен, остатков, статуса', permission: 'products.write', body: bulkProductUpdateSchema }, async ({ req, body }) => {
  const { action, productIds } = body;
  if ((action.type === 'stock_set' || action.type === 'stock_add') && !req.user!.permissions.includes('inventory.write'))
    throw forbidden('Нет права изменять остатки');
  await prisma.$transaction(
    async (tx) => {
      if (action.type === 'price_percent') {
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });
        for (const p of products) {
          const price = Math.max(100, Math.round((p.price * (100 + action.percent)) / 100 / 100) * 100);
          const compareAtPrice = p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : null;
          await tx.product.update({ where: { id: p.id }, data: { price, compareAtPrice, discountPercent: discountPercent(price, compareAtPrice) } });
        }
      } else if (action.type === 'status') {
        await tx.product.updateMany({ where: { id: { in: productIds } }, data: { status: action.status } });
        if (action.status === 'PUBLISHED')
          await tx.product.updateMany({ where: { id: { in: productIds }, publishedAt: null }, data: { publishedAt: new Date() } });
      } else {
        const variants = await tx.productVariant.findMany({ where: { productId: { in: productIds } } });
        for (const v of variants) {
          const target = action.type === 'stock_set' ? action.stock : Math.max(v.reserved, v.stock + action.delta);
          await inventory.setStock(tx, v.id, Math.max(target, v.reserved), req.user!.id, 'Массовое изменение');
        }
      }
      await audit(req, `product.bulk.${action.type}`, 'Product', null, { productIds, action }, tx);
    },
    { timeout: 30_000 },
  );
  invalidateCatalog();
  return { updated: productIds.length };
});

r.put(
  '/variants/:id/stock',
  { summary: 'Установить остаток вариации', permission: 'inventory.write', params: idParams, body: stockAdjustSchema },
  async ({ req, params, body }) => {
    await prisma.$transaction(async (tx) => {
      await inventory.setStock(tx, params.id, body.stock, req.user!.id, body.reason);
      await audit(req, 'inventory.set', 'ProductVariant', params.id, body, tx);
    });
    invalidateCatalog();
    return { ok: true };
  },
);

r.get('/:id/movements', { summary: 'Журнал движения остатков товара', permission: 'products.read', params: idParams }, async ({ params }) =>
  prisma.inventoryMovement.findMany({
    where: { variant: { productId: params.id } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { variant: { select: { sku: true } }, actor: { select: { email: true } }, order: { select: { number: true } } },
  }),
);

// ── Image upload ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|avif)$/.test(file.mimetype)),
});

adminProductsRouter.post('/images', (req, res, next) => {
  if (!req.user?.permissions.includes('products.write')) return next(forbidden());
  upload.single('file')(req, res, async (err: unknown) => {
    try {
      if (err instanceof multer.MulterError)
        throw badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Файл больше 8 МБ' : 'Ошибка загрузки', 'UPLOAD_ERROR');
      if (err) throw err;
      if (!req.file) throw badRequest('Допустимы JPEG, PNG, WebP, AVIF', 'INVALID_IMAGE');
      res.status(201).json(await storeProductImage(req.file.buffer));
    } catch (e) {
      next(e);
    }
  });
});
