import { z } from 'zod';
import { ORDER_STATUSES } from '../order-status';
import { ROLE_KEYS } from '../rbac';
import { emailSchema, nameSchema, passwordSchema } from './auth';

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Укажите slug')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Только латиница, цифры и дефис');

const money = z.number().int('Целое число копеек').min(0).max(100_000_000);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const productVariantInputSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, 'Укажите SKU').max(64),
  sizeId: z.string().min(1, 'Выберите размер'),
  colorId: z.string().min(1, 'Выберите цвет'),
  stock: z.number().int().min(0).max(100000),
  isActive: z.boolean().default(true),
});

export const productImageInputSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1).max(500),
  storageKey: z.string().max(300).nullish(),
  alt: z.string().trim().max(200).default(''),
  colorId: z.string().nullish(),
  isMain: z.boolean().default(false),
});

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Минимум 2 символа').max(140),
    slug: slugSchema,
    description: z.string().trim().min(10, 'Минимум 10 символов').max(5000),
    material: z.string().trim().max(500).default(''),
    care: z.string().trim().max(1000).default(''),
    fit: z.string().trim().max(300).default(''),
    price: money.min(1, 'Укажите цену'),
    compareAtPrice: money.nullish().transform((v) => v || null),
    costPrice: money.nullish().transform((v) => v ?? null),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    isNew: z.boolean().default(false),
    isBestseller: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    categoryId: z.string().min(1, 'Выберите категорию'),
    brandId: z.string().nullish().transform((v) => v || null),
    collectionIds: z.array(z.string()).max(20).default([]),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    variants: z.array(productVariantInputSchema).min(1, 'Добавьте хотя бы одну вариацию'),
    images: z.array(productImageInputSchema).max(12).default([]),
  })
  .superRefine((p, ctx) => {
    if (p.compareAtPrice !== null && p.compareAtPrice <= p.price)
      ctx.addIssue({
        code: 'custom',
        path: ['compareAtPrice'],
        message: 'Старая цена должна быть больше текущей',
      });
    const combos = new Set<string>();
    const skus = new Set<string>();
    p.variants.forEach((v, i) => {
      const key = `${v.sizeId}:${v.colorId}`;
      if (combos.has(key))
        ctx.addIssue({ code: 'custom', path: ['variants', i, 'sizeId'], message: 'Такая комбинация уже есть' });
      if (skus.has(v.sku.toUpperCase()))
        ctx.addIssue({ code: 'custom', path: ['variants', i, 'sku'], message: 'SKU повторяется' });
      combos.add(key);
      skus.add(v.sku.toUpperCase());
    });
  });
export type ProductInput = z.input<typeof productInputSchema>;
export type ProductInputParsed = z.output<typeof productInputSchema>;

export const bulkProductUpdateSchema = z.object({
  productIds: z.array(z.string()).min(1).max(200),
  action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('price_percent'), percent: z.number().min(-90).max(500) }),
    z.object({ type: z.literal('stock_set'), stock: z.number().int().min(0).max(100000) }),
    z.object({ type: z.literal('stock_add'), delta: z.number().int().min(-100000).max(100000) }),
    z.object({ type: z.literal('status'), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) }),
  ]),
});

export const stockAdjustSchema = z.object({
  stock: z.number().int().min(0).max(100000),
  reason: z.string().trim().max(200).default(''),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(1000).default(''),
  imageUrl: optionalText(500),
  parentId: z.string().nullish().transform((v) => v || null),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(1000).default(''),
});

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema,
  description: z.string().trim().max(2000).default(''),
  season: optionalText(40),
  imageUrl: optionalText(500),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  productIds: z.array(z.string()).max(200).default([]),
});
export type CollectionInput = z.input<typeof collectionInputSchema>;

export const orderStatusChangeSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  comment: z.string().trim().max(500).default(''),
});

export const shipmentUpdateSchema = z.object({
  carrier: z.string().trim().max(60).nullish(),
  trackingNumber: z.string().trim().max(60).nullish(),
  trackingUrl: z.string().trim().max(300).nullish(),
  status: z.enum(['PENDING', 'READY', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED']).optional(),
});

export const refundSchema = z.object({
  amount: z.number().int().min(1).optional(), // minor units; default — full remaining amount
  reason: z.string().trim().min(3, 'Укажите причину').max(300),
  restock: z.boolean().default(true),
});

export const orderNoteSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export const adminOrderQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.string().max(30).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minTotal: z.coerce.number().int().min(0).optional(),
  maxTotal: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const staffCreateSchema = z.object({
  email: emailSchema,
  firstName: nameSchema,
  lastName: z.string().trim().max(60).default(''),
  password: passwordSchema,
  role: z.enum(ROLE_KEYS),
});

export const userAccessSchema = z.object({
  role: z.enum(ROLE_KEYS).nullable().optional(),
  isBlocked: z.boolean().optional(),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(1).max(60),
  logoUrl: optionalText(500),
  currency: z.string().length(3),
  contactEmail: z.email(),
  contactPhone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  workingHours: z.string().trim().max(100),
  socials: z.record(z.string(), z.string().max(200)).default({}),
  minOrderAmount: money,
  taxRatePercent: z.number().int().min(0).max(50),
  pricesIncludeTax: z.boolean(),
  enabledPaymentProviders: z.array(z.enum(['MOCK', 'STRIPE', 'YOOKASSA'])).min(1),
  emailNotifications: z.record(z.string(), z.boolean()).default({}),
  reservationTtlMinutes: z.number().int().min(5).max(1440),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(160),
});
export type SettingsInput = z.input<typeof settingsSchema>;

export const deliveryMethodInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  price: money,
  freeFromAmount: money.nullable(),
  estimatedDaysMin: z.number().int().min(0).max(60),
  estimatedDaysMax: z.number().int().min(0).max(60),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).default(0),
});

export const bannerInputSchema = z.object({
  placement: z.enum(['HERO', 'PROMO', 'EDITORIAL']),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(300).default(''),
  eyebrow: z.string().trim().max(60).default(''),
  imageUrl: z.string().min(1).max(500),
  ctaLabel: z.string().trim().max(40).default(''),
  ctaHref: z.string().trim().max(300).default(''),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const contentPageInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(50000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});

export const faqItemInputSchema = z.object({
  category: z.string().trim().min(1).max(60),
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(3000),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const homeSectionUpdateSchema = z.object({
  title: z.string().trim().max(120),
  subtitle: z.string().trim().max(300).default(''),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
});
