import type {
  CategoryDTO,
  CollectionDTO,
  FacetsDTO,
  ProductListDTO,
  ProductListQuery,
} from '@silt/shared';
import { cached } from '../../lib/cache';
import { notFound } from '../../lib/errors';
import { paged, paginate } from '../../lib/pagination';
import { Prisma, prisma } from '../../lib/prisma';
import { cardInclude, detailInclude, inStockVariant, toCard, toDetail } from './catalog.mapper';

const TTL = 60;

const ORDER_BY: Record<ProductListQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  popular: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }, { id: 'asc' }],
  new: [{ publishedAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ price: 'asc' }, { id: 'asc' }],
  price_desc: [{ price: 'desc' }, { id: 'asc' }],
  discount: [{ discountPercent: 'desc' }, { salesCount: 'desc' }, { id: 'asc' }],
};

async function categoryIdsWithChildren(slug: string) {
  const cat = await prisma.category.findFirst({
    where: { slug, isActive: true },
    select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
  });
  if (!cat) throw notFound('Категория не найдена');
  return [cat.id, ...cat.children.map((c) => c.id)];
}

export function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
  return {
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: 'insensitive' } },
        { description: { contains: t, mode: 'insensitive' } },
        { brand: { name: { contains: t, mode: 'insensitive' } } },
        { category: { name: { contains: t, mode: 'insensitive' } } },
      ],
    })),
  };
}

/** Scope = what the page shows before user filters (category / collection / search). */
async function scopeWhere(q: ProductListQuery): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = { status: 'PUBLISHED' };
  const and: Prisma.ProductWhereInput[] = [];
  if (q.category) where.categoryId = { in: await categoryIdsWithChildren(q.category) };
  if (q.collection) where.collections = { some: { collection: { slug: q.collection, isActive: true } } };
  if (q.q) and.push(searchWhere(q.q));
  if (q.flag === 'new') where.isNew = true;
  if (q.flag === 'bestseller') where.isBestseller = true;
  if (q.flag === 'featured') where.isFeatured = true;
  if (and.length) where.AND = and;
  return where;
}

function filterWhere(q: ProductListQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (q.brands.length) and.push({ brand: { slug: { in: q.brands } } });
  // Size + colour + stock filters must match the same variant.
  const variant: Prisma.ProductVariantWhereInput = { isActive: true };
  if (q.sizes.length) variant.size = { label: { in: q.sizes } };
  if (q.colors.length) variant.color = { slug: { in: q.colors } };
  if (q.inStock) Object.assign(variant, inStockVariant());
  if (q.sizes.length || q.colors.length || q.inStock) and.push({ variants: { some: variant } });
  if (q.minPrice !== undefined) and.push({ price: { gte: q.minPrice * 100 } });
  if (q.maxPrice !== undefined) and.push({ price: { lte: q.maxPrice * 100 } });
  if (q.onSale) and.push({ discountPercent: { gt: 0 } });
  return and.length ? { AND: and } : {};
}

async function facets(scope: Prisma.ProductWhereInput): Promise<FacetsDTO> {
  const [brandGroups, variants, price] = await Promise.all([
    prisma.product.groupBy({ by: ['brandId'], where: scope, _count: { _all: true } }),
    prisma.productVariant.findMany({
      where: { isActive: true, product: scope },
      select: { productId: true, size: true, color: true },
    }),
    prisma.product.aggregate({ where: scope, _min: { price: true }, _max: { price: true } }),
  ]);
  const brandIds = brandGroups.map((b) => b.brandId).filter((id): id is string => !!id);
  const brands = await prisma.brand.findMany({ where: { id: { in: brandIds } }, orderBy: { name: 'asc' } });
  const brandCount = new Map(brandGroups.map((b) => [b.brandId, b._count._all]));

  const sizes = new Map<string, { s: (typeof variants)[number]['size']; products: Set<string> }>();
  const colors = new Map<string, { c: (typeof variants)[number]['color']; products: Set<string> }>();
  for (const v of variants) {
    if (!sizes.has(v.size.id)) sizes.set(v.size.id, { s: v.size, products: new Set() });
    sizes.get(v.size.id)!.products.add(v.productId);
    if (!colors.has(v.color.id)) colors.set(v.color.id, { c: v.color, products: new Set() });
    colors.get(v.color.id)!.products.add(v.productId);
  }
  return {
    brands: brands.map((b) => ({ id: b.id, name: b.name, slug: b.slug, count: brandCount.get(b.id) ?? 0 })),
    sizes: [...sizes.values()]
      .sort((a, b) => a.s.sortOrder - b.s.sortOrder)
      .map(({ s, products }) => ({ id: s.id, label: s.label, group: s.group, count: products.size })),
    colors: [...colors.values()]
      .sort((a, b) => a.c.sortOrder - b.c.sortOrder)
      .map(({ c, products }) => ({ id: c.id, name: c.name, slug: c.slug, hex: c.hex, count: products.size })),
    price: { min: price._min.price ?? 0, max: price._max.price ?? 0 },
  };
}

export async function listProducts(q: ProductListQuery): Promise<ProductListDTO> {
  return cached(`catalog:list:${JSON.stringify(q)}`, 30, async () => {
    const scope = await scopeWhere(q);
    const where: Prisma.ProductWhereInput = { AND: [scope, filterWhere(q)] };
    const [items, total, facetData] = await Promise.all([
      prisma.product.findMany({ where, include: cardInclude, orderBy: ORDER_BY[q.sort], ...paginate(q.page, q.pageSize) }),
      prisma.product.count({ where }),
      facets(scope),
    ]);
    return { ...paged(items.map(toCard), total, q.page, q.pageSize), facets: facetData };
  });
}

export async function getProductsByIds(ids: string[]) {
  const items = await prisma.product.findMany({
    where: { id: { in: ids.slice(0, 40) }, status: 'PUBLISHED' },
    include: cardInclude,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return items.map(toCard).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function getProduct(slug: string) {
  return cached(`catalog:product:${slug}`, TTL, async () => {
    const p = await prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, include: detailInclude });
    if (!p) throw notFound('Товар не найден');
    return toDetail(p);
  });
}

export async function getRelated(slug: string) {
  return cached(`catalog:related:${slug}`, TTL, async () => {
    const p = await prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true, categoryId: true, brandId: true } });
    if (!p) throw notFound('Товар не найден');
    const items = await prisma.product.findMany({
      where: { status: 'PUBLISHED', id: { not: p.id }, OR: [{ categoryId: p.categoryId }, { brandId: p.brandId ?? undefined }] },
      include: cardInclude,
      orderBy: [{ salesCount: 'desc' }],
      take: 8,
    });
    return items.map(toCard);
  });
}

export async function getProductCards(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take: number) {
  const items = await prisma.product.findMany({ where: { status: 'PUBLISHED', ...where }, include: cardInclude, orderBy, take });
  return items.map(toCard);
}

function toCategory(c: Prisma.CategoryGetPayload<{ include: { _count: { select: { products: true } } } }>): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
  };
}

/** Category tree, loaded from the DB (never hard-coded in the UI). */
export async function listCategories(): Promise<CategoryDTO[]> {
  return cached('catalog:categories', TTL, async () => {
    const all = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: { where: { status: 'PUBLISHED' } } } } },
    });
    const dtos = all.map(toCategory);
    const roots = dtos.filter((c) => !c.parentId);
    roots.forEach((r) => {
      r.children = dtos.filter((c) => c.parentId === r.id);
      r.productCount = (r.productCount ?? 0) + r.children.reduce((s, c) => s + (c.productCount ?? 0), 0);
    });
    return roots;
  });
}

export async function getCategory(slug: string) {
  const all = await listCategories();
  const flat = all.flatMap((c) => [c, ...(c.children ?? [])]);
  const found = flat.find((c) => c.slug === slug);
  if (!found) throw notFound('Категория не найдена');
  const parent = found.parentId ? flat.find((c) => c.id === found.parentId) ?? null : null;
  return { ...found, parent: parent ? { slug: parent.slug, name: parent.name } : null };
}

export async function listCollections(): Promise<CollectionDTO[]> {
  return cached('catalog:collections', TTL, async () => {
    const rows = await prisma.collection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { products: { where: { product: { status: 'PUBLISHED' } } } } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      season: c.season,
      imageUrl: c.imageUrl,
      isFeatured: c.isFeatured,
      productCount: c._count.products,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
    }));
  });
}

export async function getCollection(slug: string) {
  const found = (await listCollections()).find((c) => c.slug === slug);
  if (!found) throw notFound('Коллекция не найдена');
  return found;
}

export async function listBrands() {
  return cached('catalog:brands', TTL, () =>
    prisma.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }),
  );
}
