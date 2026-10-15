import type { ColorDTO, ProductCardDTO, ProductDetailDTO } from '@silt/shared';
import { Prisma, prisma } from '../../lib/prisma';

export const cardInclude = {
  brand: { select: { name: true } },
  category: { select: { slug: true, name: true } },
  images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }], take: 2, select: { url: true } },
  variants: {
    where: { isActive: true },
    select: { stock: true, reserved: true, color: { select: { id: true, name: true, slug: true, hex: true, sortOrder: true } } },
  },
} satisfies Prisma.ProductInclude;

export type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function uniqueColors(variants: CardProduct['variants']): ColorDTO[] {
  const map = new Map<string, ColorDTO & { sortOrder: number }>();
  variants.forEach((v) => map.set(v.color.id, v.color));
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder).map(({ sortOrder: _s, ...c }) => c);
}

export function toCard(p: CardProduct): ProductCardDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand?.name ?? null,
    category: p.category,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    discountPercent: p.discountPercent,
    image: p.images[0]?.url ?? null,
    hoverImage: p.images[1]?.url ?? null,
    colors: uniqueColors(p.variants),
    isNew: p.isNew,
    isBestseller: p.isBestseller,
    inStock: p.variants.some((v) => v.stock - v.reserved > 0),
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
  };
}

export const detailInclude = {
  brand: { select: { name: true } },
  category: { select: { slug: true, name: true } },
  images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }] },
  variants: {
    where: { isActive: true },
    include: { size: true, color: true },
  },
  collections: { include: { collection: { select: { slug: true, name: true, isActive: true } } } },
} satisfies Prisma.ProductInclude;

export type DetailProduct = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;

export function toDetail(p: DetailProduct): ProductDetailDTO {
  const sizes = new Map(p.variants.map((v) => [v.size.id, v.size]));
  const card = toCard({
    ...p,
    images: p.images.slice(0, 2),
    variants: p.variants.map((v) => ({ stock: v.stock, reserved: v.reserved, color: v.color })),
  });
  return {
    ...card,
    description: p.description,
    material: p.material,
    care: p.care,
    fit: p.fit,
    images: p.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt || p.name, colorId: i.colorId, isMain: i.isMain })),
    sizes: [...sizes.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ id: s.id, label: s.label, group: s.group })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      sizeId: v.sizeId,
      colorId: v.colorId,
      available: Math.max(0, v.stock - v.reserved),
    })),
    collections: p.collections.filter((c) => c.collection.isActive).map((c) => ({ slug: c.collection.slug, name: c.collection.name })),
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
}

/** Variant has free stock: stock > reserved (column comparison). */
export const inStockVariant = (): Prisma.ProductVariantWhereInput => ({
  isActive: true,
  stock: { gt: prisma.productVariant.fields.reserved },
});
