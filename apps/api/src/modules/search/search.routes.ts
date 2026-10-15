import { Router } from 'express';
import { z } from 'zod';
import type { SearchSuggestDTO } from '@silt/shared';
import { cached } from '../../lib/cache';
import { prisma } from '../../lib/prisma';
import { createRoutes } from '../../lib/route';
import { searchWhere } from '../catalog/catalog.service';

export const searchRouter = Router();
const r = createRoutes(searchRouter, '/search', 'Поиск');

const qSchema = z.object({ q: z.string().trim().min(1).max(100) });

r.get('/suggest', { summary: 'Подсказки: товары, категории, бренды, запросы', query: qSchema }, async ({ query }) =>
  cached(`catalog:suggest:${query.q.toLowerCase()}`, 60, async (): Promise<SearchSuggestDTO> => {
    const q = query.q;
    const [products, categories, brands, queries] = await Promise.all([
      prisma.product.findMany({
        where: { status: 'PUBLISHED', ...searchWhere(q) },
        orderBy: { salesCount: 'desc' },
        take: 5,
        select: { slug: true, name: true, price: true, images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }], take: 1, select: { url: true } } },
      }),
      prisma.category.findMany({ where: { isActive: true, name: { contains: q, mode: 'insensitive' } }, take: 4, select: { slug: true, name: true } }),
      prisma.brand.findMany({ where: { name: { contains: q, mode: 'insensitive' } }, take: 4, select: { slug: true, name: true } }),
      prisma.searchQuery.findMany({ where: { query: { startsWith: q.toLowerCase() } }, orderBy: { count: 'desc' }, take: 5 }),
    ]);
    return {
      products: products.map((p) => ({ slug: p.slug, name: p.name, price: p.price, image: p.images[0]?.url ?? null })),
      categories,
      brands,
      queries: queries.map((s) => s.query),
    };
  }),
);

r.get('/popular', { summary: 'Популярные запросы' }, () =>
  cached('catalog:popular-queries', 300, async () =>
    (await prisma.searchQuery.findMany({ where: { count: { gte: 2 } }, orderBy: { count: 'desc' }, take: 8 })).map((s) => s.query),
  ),
);

r.post('/log', { summary: 'Учесть выполненный поиск (для популярных запросов)', body: qSchema }, async ({ body }) => {
  const query = body.q.toLowerCase().replace(/\s+/g, ' ');
  if (query.length < 2) return { ok: true };
  await prisma.searchQuery.upsert({
    where: { query },
    create: { query },
    update: { count: { increment: 1 }, lastAt: new Date() },
  });
  return { ok: true };
});
