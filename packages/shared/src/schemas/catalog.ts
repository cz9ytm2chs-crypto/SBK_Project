import { z } from 'zod';

export const SORT_OPTIONS = {
  popular: 'По популярности',
  new: 'Новинки',
  price_asc: 'Сначала дешевле',
  price_desc: 'Сначала дороже',
  discount: 'По размеру скидки',
} as const;
export type SortOption = keyof typeof SORT_OPTIONS;

const csv = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    (Array.isArray(v) ? v : (v ?? '').split(','))
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30),
  );

const intParam = z.coerce.number().int().nonnegative();

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(80).optional(),
  collection: z.string().max(80).optional(),
  brands: csv,
  sizes: csv,
  colors: csv,
  minPrice: intParam.optional(), // rubles in query, converted on server
  maxPrice: intParam.optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  onSale: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  flag: z.enum(['new', 'bestseller', 'featured']).optional(),
  sort: z.enum(Object.keys(SORT_OPTIONS) as [SortOption, ...SortOption[]]).default('popular'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(10, 'Минимум 10 символов').max(2000),
  fitFeedback: z.enum(['small', 'true', 'large']).optional(),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Некорректный email')),
  source: z.string().max(40).default('footer'),
});
