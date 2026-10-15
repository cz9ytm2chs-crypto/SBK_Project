import { Router } from 'express';
import { z } from 'zod';
import { productListQuerySchema, reviewSchema } from '@silt/shared';
import { createRoutes, slugParams } from '../../lib/route';
import * as catalog from './catalog.service';
import * as reviews from './reviews.service';

export const productsRouter = Router();
const products = createRoutes(productsRouter, '/products', 'Каталог');

products.get('/', { summary: 'Список товаров с фильтрами, сортировкой и фасетами', query: productListQuerySchema }, ({ query }) =>
  catalog.listProducts(query),
);

products.get(
  '/by-ids',
  {
    summary: 'Карточки товаров по id (недавно просмотренные, избранное гостя)',
    query: z.object({ ids: z.string().max(2000).transform((s) => s.split(',').filter(Boolean)) }),
  },
  ({ query }) => catalog.getProductsByIds(query.ids),
);

products.get('/:slug', { summary: 'Карточка товара', params: slugParams }, ({ params }) => catalog.getProduct(params.slug));

products.get('/:slug/related', { summary: 'Похожие товары', params: slugParams }, ({ params }) =>
  catalog.getRelated(params.slug),
);

products.get(
  '/:slug/reviews',
  { summary: 'Отзывы и рейтинг', params: slugParams, query: z.object({ page: z.coerce.number().int().min(1).default(1) }) },
  ({ params, query, req }) => reviews.listReviews(params.slug, query.page, req.user?.id ?? null),
);

products.post(
  '/:slug/reviews',
  { summary: 'Оставить отзыв (уходит на модерацию)', params: slugParams, body: reviewSchema, auth: 'user', status: 201 },
  ({ params, body, req }) => reviews.createReview(params.slug, req.user!.id, body),
);

export const categoriesRouter = Router();
const categories = createRoutes(categoriesRouter, '/categories', 'Каталог');
categories.get('/', { summary: 'Дерево категорий' }, () => catalog.listCategories());
categories.get('/:slug', { summary: 'Категория', params: slugParams }, ({ params }) => catalog.getCategory(params.slug));

export const collectionsRouter = Router();
const collections = createRoutes(collectionsRouter, '/collections', 'Каталог');
collections.get('/', { summary: 'Коллекции' }, () => catalog.listCollections());
collections.get('/:slug', { summary: 'Коллекция', params: slugParams }, ({ params }) => catalog.getCollection(params.slug));

export const brandsRouter = Router();
createRoutes(brandsRouter, '/brands', 'Каталог').get('/', { summary: 'Бренды' }, () => catalog.listBrands());
