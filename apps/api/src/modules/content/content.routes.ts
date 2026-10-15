import { Router } from 'express';
import { newsletterSchema, type HomeDTO } from '@silt/shared';
import { cached } from '../../lib/cache';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { createRoutes, slugParams } from '../../lib/route';
import { getProductCards, listCategories, listCollections } from '../catalog/catalog.service';
import { getPublicSettings } from './settings.service';

export const contentRouter = Router();
const r = createRoutes(contentRouter, '/content', 'Контент');

r.get('/settings', { summary: 'Публичные настройки магазина' }, () => getPublicSettings());

r.get('/home', { summary: 'Данные главной страницы' }, () =>
  cached('catalog:home', 60, async (): Promise<HomeDTO> => {
    const now = new Date();
    const [sections, banners, newArrivals, bestsellers, categories, collections, onSale] = await Promise.all([
      prisma.homeSection.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.banner.findMany({
        where: {
          isActive: true,
          AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: { sortOrder: 'asc' },
      }),
      getProductCards({ isNew: true }, [{ publishedAt: 'desc' }], 8),
      getProductCards({ isBestseller: true }, [{ salesCount: 'desc' }], 8),
      listCategories(),
      listCollections(),
      getProductCards({ discountPercent: { gt: 0 } }, [{ discountPercent: 'desc' }], 4),
    ]);
    return {
      sections: sections.map((s) => ({ key: s.key, title: s.title, subtitle: s.subtitle, config: (s.config ?? {}) as Record<string, unknown> })),
      banners: banners.map((b) => ({
        id: b.id,
        placement: b.placement,
        title: b.title,
        subtitle: b.subtitle,
        eyebrow: b.eyebrow,
        imageUrl: b.imageUrl,
        ctaLabel: b.ctaLabel,
        ctaHref: b.ctaHref,
      })),
      newArrivals,
      bestsellers,
      categories,
      collections,
      onSale,
    };
  }),
);

r.get('/pages/:slug', { summary: 'Информационная страница', params: slugParams }, async ({ params }) => {
  const page = await cached(`content:page:${params.slug}`, 300, () => prisma.contentPage.findUnique({ where: { slug: params.slug } }));
  if (!page) throw notFound('Страница не найдена');
  return { slug: page.slug, title: page.title, body: page.body, seoTitle: page.seoTitle, seoDescription: page.seoDescription };
});

r.get('/faq', { summary: 'Вопросы и ответы' }, () =>
  cached('content:faq', 300, () =>
    prisma.faqItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, category: true, question: true, answer: true },
    }),
  ),
);

r.get('/delivery-methods', { summary: 'Способы доставки (для инфо-страниц)' }, () =>
  prisma.deliveryMethod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { code: true, name: true, description: true, price: true, freeFromAmount: true, estimatedDaysMin: true, estimatedDaysMax: true },
  }),
);

export const newsletterRouter = Router();
createRoutes(newsletterRouter, '/newsletter', 'Контент').post(
  '/',
  { summary: 'Подписка на рассылку', body: newsletterSchema },
  async ({ body }) => {
    await prisma.newsletterSubscription.upsert({
      where: { email: body.email },
      create: { email: body.email, source: body.source },
      update: { status: 'SUBSCRIBED', unsubscribedAt: null },
    });
    // Same response whether or not the email was already subscribed (no enumeration).
    return { ok: true };
  },
);

