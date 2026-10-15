import { Router } from 'express';
import { z } from 'zod';
import {
  bannerInputSchema,
  contentPageInputSchema,
  faqItemInputSchema,
  homeSectionUpdateSchema,
} from '@silt/shared';
import { audit } from '../../lib/audit';
import { cache, invalidateCatalog } from '../../lib/cache';
import { notFound } from '../../lib/errors';
import { paged, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { createRoutes, idParams, slugParams } from '../../lib/route';
import { refreshProductRating } from '../catalog/reviews.service';

export const adminContentRouter = Router();
const r = createRoutes(adminContentRouter, '/admin/content', 'Админ: контент');

const invalidateContent = () => {
  invalidateCatalog();
  cache.delPrefix('content:').catch(() => undefined);
};

// ── Banners ──
r.get('/banners', { summary: 'Баннеры', permission: 'content.write' }, () =>
  prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] }),
);
r.post('/banners', { summary: 'Создать баннер', permission: 'content.write', body: bannerInputSchema, status: 201 }, async ({ req, body }) => {
  const b = await prisma.banner.create({ data: body });
  await audit(req, 'banner.create', 'Banner', b.id, { title: b.title });
  invalidateContent();
  return b;
});
r.put('/banners/:id', { summary: 'Изменить баннер', permission: 'content.write', params: idParams, body: bannerInputSchema }, async ({ req, params, body }) => {
  const b = await prisma.banner.update({ where: { id: params.id }, data: body });
  await audit(req, 'banner.update', 'Banner', b.id, { title: b.title });
  invalidateContent();
  return b;
});
r.delete('/banners/:id', { summary: 'Удалить баннер', permission: 'content.write', params: idParams }, async ({ req, params }) => {
  await prisma.banner.delete({ where: { id: params.id } });
  await audit(req, 'banner.delete', 'Banner', params.id);
  invalidateContent();
});

// ── Home sections ──
r.get('/home-sections', { summary: 'Блоки главной страницы', permission: 'content.write' }, () =>
  prisma.homeSection.findMany({ orderBy: { sortOrder: 'asc' } }),
);
r.put('/home-sections/:id', { summary: 'Изменить блок главной', permission: 'content.write', params: idParams, body: homeSectionUpdateSchema }, async ({ req, params, body }) => {
  const s = await prisma.homeSection.update({ where: { id: params.id }, data: body });
  await audit(req, 'home.update', 'HomeSection', s.id, body);
  invalidateContent();
  return s;
});

// ── Pages (about, delivery, returns, privacy, terms, contacts) ──
r.get('/pages', { summary: 'Информационные страницы', permission: 'content.write' }, () =>
  prisma.contentPage.findMany({ orderBy: { slug: 'asc' }, select: { id: true, slug: true, title: true, updatedAt: true } }),
);
r.get('/pages/:slug', { summary: 'Страница', permission: 'content.write', params: slugParams }, async ({ params }) => {
  const p = await prisma.contentPage.findUnique({ where: { slug: params.slug } });
  if (!p) throw notFound('Страница не найдена');
  return p;
});
r.put('/pages/:slug', { summary: 'Изменить страницу и SEO-тексты', permission: 'content.write', params: slugParams, body: contentPageInputSchema }, async ({ req, params, body }) => {
  const p = await prisma.contentPage.update({ where: { slug: params.slug }, data: body });
  await audit(req, 'page.update', 'ContentPage', p.id, { slug: p.slug });
  invalidateContent();
  return p;
});

// ── FAQ ──
r.get('/faq', { summary: 'FAQ', permission: 'content.write' }, () => prisma.faqItem.findMany({ orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] }));
r.post('/faq', { summary: 'Добавить вопрос', permission: 'content.write', body: faqItemInputSchema, status: 201 }, async ({ req, body }) => {
  const f = await prisma.faqItem.create({ data: body });
  await audit(req, 'faq.create', 'FaqItem', f.id);
  invalidateContent();
  return f;
});
r.put('/faq/:id', { summary: 'Изменить вопрос', permission: 'content.write', params: idParams, body: faqItemInputSchema }, async ({ req, params, body }) => {
  const f = await prisma.faqItem.update({ where: { id: params.id }, data: body });
  await audit(req, 'faq.update', 'FaqItem', f.id);
  invalidateContent();
  return f;
});
r.delete('/faq/:id', { summary: 'Удалить вопрос', permission: 'content.write', params: idParams }, async ({ req, params }) => {
  await prisma.faqItem.delete({ where: { id: params.id } });
  await audit(req, 'faq.delete', 'FaqItem', params.id);
  invalidateContent();
});

// ── Reviews moderation ──
r.get(
  '/reviews',
  { summary: 'Отзывы на модерации', permission: 'reviews.moderate', query: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'), page: z.coerce.number().int().min(1).default(1) }) },
  async ({ query }) => {
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate(query.page, 20),
        include: { product: { select: { name: true, slug: true } }, user: { select: { email: true, firstName: true } } },
      }),
      prisma.review.count({ where }),
    ]);
    return paged(items, total, query.page, 20);
  },
);
r.patch(
  '/reviews/:id',
  { summary: 'Одобрить или отклонить отзыв', permission: 'reviews.moderate', params: idParams, body: z.object({ status: z.enum(['APPROVED', 'REJECTED']) }) },
  async ({ req, params, body }) => {
    const review = await prisma.review.update({ where: { id: params.id }, data: { status: body.status } });
    await refreshProductRating(review.productId);
    await audit(req, 'review.moderate', 'Review', review.id, body);
    invalidateCatalog();
    return { ok: true };
  },
);
