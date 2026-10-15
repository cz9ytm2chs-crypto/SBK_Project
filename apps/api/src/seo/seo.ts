import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import { env } from '../config/env';
import { cached } from '../lib/cache';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getSettings } from '../modules/content/settings.service';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const abs = (url: string | null | undefined) => (!url ? null : url.startsWith('http') ? url : `${env.APP_URL}${url}`);

const PRIVATE = ['/admin', '/account', '/checkout', '/cart', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/favorites'];
const INFO_PAGES = ['about', 'contacts', 'delivery', 'returns', 'privacy', 'terms'];

export async function robotsTxt() {
  return ['User-agent: *', ...PRIVATE.map((p) => `Disallow: ${p}`), 'Disallow: /search', 'Disallow: /*?*sort=', '', `Sitemap: ${env.APP_URL}/sitemap.xml`, ''].join('\n');
}

export async function sitemapXml() {
  return cached('catalog:sitemap', 3600, async () => {
    const [products, categories, collections] = await Promise.all([
      prisma.product.findMany({ where: { status: 'PUBLISHED' }, select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      prisma.collection.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    ]);
    const url = (loc: string, lastmod?: Date, priority = '0.5') =>
      `<url><loc>${esc(env.APP_URL + loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}<priority>${priority}</priority></url>`;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      url('/', undefined, '1.0'),
      url('/catalog', undefined, '0.9'),
      url('/collections', undefined, '0.7'),
      ...categories.map((c) => url(`/category/${c.slug}`, c.updatedAt, '0.8')),
      ...collections.map((c) => url(`/collections/${c.slug}`, c.updatedAt, '0.7')),
      ...products.map((p) => url(`/product/${p.slug}`, p.updatedAt, '0.8')),
      ...[...INFO_PAGES, 'faq'].map((p) => url(`/${p}`, undefined, '0.3')),
      '</urlset>',
    ].join('');
  });
}

interface Meta {
  title: string;
  description: string;
  image?: string | null;
  type?: string;
  noindex?: boolean;
  jsonLd?: unknown;
}

/** Head tags for a storefront URL, resolved from the database. */
export async function metaFor(pathname: string): Promise<Meta> {
  const s = await getSettings();
  const base: Meta = { title: s.seoTitle, description: s.seoDescription };
  if (PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return { ...base, title: `${s.storeName}`, noindex: true };

  let m: RegExpMatchArray | null;
  if ((m = pathname.match(/^\/product\/([\w-]+)$/))) {
    const p = await prisma.product.findFirst({
      where: { slug: m[1], status: 'PUBLISHED' },
      include: { brand: true, images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }], take: 4 }, variants: { select: { stock: true, reserved: true, sku: true } } },
    });
    if (!p) return { ...base, title: `Товар не найден — ${s.storeName}`, noindex: true };
    const inStock = p.variants.some((v) => v.stock > v.reserved);
    return {
      title: p.seoTitle || `${p.name} — купить в ${s.storeName}`,
      description: p.seoDescription || p.description.slice(0, 155),
      image: abs(p.images[0]?.url),
      type: 'product',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: p.description,
        sku: p.variants[0]?.sku,
        image: p.images.map((i) => abs(i.url)),
        brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
        aggregateRating: p.ratingCount ? { '@type': 'AggregateRating', ratingValue: p.ratingAvg, reviewCount: p.ratingCount } : undefined,
        offers: {
          '@type': 'Offer',
          url: `${env.APP_URL}/product/${p.slug}`,
          priceCurrency: s.currency,
          price: (p.price / 100).toFixed(2),
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
      },
    };
  }
  if ((m = pathname.match(/^\/category\/([\w-]+)$/))) {
    const c = await prisma.category.findFirst({ where: { slug: m[1], isActive: true } });
    if (c) return { title: c.seoTitle || `${c.name} — ${s.storeName}`, description: c.seoDescription || c.description || base.description, image: abs(c.imageUrl) };
  }
  if ((m = pathname.match(/^\/collections\/([\w-]+)$/))) {
    const c = await prisma.collection.findFirst({ where: { slug: m[1], isActive: true } });
    if (c) return { title: c.seoTitle || `${c.name} — коллекция ${s.storeName}`, description: c.seoDescription || c.description, image: abs(c.imageUrl) };
  }
  if ((m = pathname.match(/^\/([\w-]+)$/)) && INFO_PAGES.includes(m[1])) {
    const page = await prisma.contentPage.findUnique({ where: { slug: m[1] } });
    if (page) return { title: page.seoTitle || `${page.title} — ${s.storeName}`, description: page.seoDescription || base.description };
  }
  if (pathname === '/catalog') return { ...base, title: `Каталог — ${s.storeName}` };
  return base;
}

function headTags(meta: Meta, pathname: string) {
  const canonical = `${env.APP_URL}${pathname === '/' ? '' : pathname}`;
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : '',
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:type" content="${meta.type ?? 'website'}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    meta.image ? `<meta property="og:image" content="${esc(meta.image)}">` : '',
    '<meta name="twitter:card" content="summary_large_image">',
    // "<" is escaped so the JSON cannot close the script tag.
    meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n    ');
}

/** Production: serve the built SPA with server-rendered head tags. */
export function mountWeb(app: Express) {
  const dist = env.WEB_DIST_PATH && path.resolve(env.WEB_DIST_PATH);
  if (!dist || !existsSync(path.join(dist, 'index.html'))) {
    if (env.isProd) logger.warn('WEB_DIST_PATH is not set — storefront is not served by the API');
    return;
  }
  const template = readFileSync(path.join(dist, 'index.html'), 'utf8');
  app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/|\/uploads\/).*/, async (req, res, next) => {
    try {
      const tags = headTags(await metaFor(req.path), req.path);
      const html = template.replace(/<title>.*?<\/title>/, '').replace('<!--seo-->', tags);
      res.type('html').set('Cache-Control', 'no-cache').send(html);
    } catch (err) {
      next(err);
    }
  });
}
