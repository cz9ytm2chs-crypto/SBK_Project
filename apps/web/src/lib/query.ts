import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Do not retry client errors (404, 403…), only network / server failures.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

export const qk = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  home: ['home'] as const,
  categories: ['categories'] as const,
  category: (slug: string) => ['category', slug] as const,
  collections: ['collections'] as const,
  collection: (slug: string) => ['collection', slug] as const,
  products: (params: unknown) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  related: (slug: string) => ['related', slug] as const,
  reviews: (slug: string, page: number) => ['reviews', slug, page] as const,
  productsByIds: (ids: string[]) => ['products-by-ids', ids] as const,
  cart: ['cart'] as const,
  cartRecs: ['cart-recs'] as const,
  favorites: ['favorites'] as const,
  favoriteIds: ['favorite-ids'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: string) => ['order', id] as const,
  addresses: ['addresses'] as const,
  checkoutOptions: ['checkout-options'] as const,
  quote: (code?: string) => ['quote', code] as const,
  suggest: (q: string) => ['suggest', q] as const,
  popular: ['popular-queries'] as const,
  page: (slug: string) => ['page', slug] as const,
  faq: ['faq'] as const,
};
