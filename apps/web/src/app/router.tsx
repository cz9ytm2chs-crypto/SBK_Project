import { createBrowserRouter, type RouteObject } from 'react-router';
import { StoreLayout } from '@/components/layout/store-layout';
import { PageSpinner } from '@/components/ui/misc';
import { RouteError } from '@/pages/route-error';

/** Each page is its own chunk (code splitting). */
const page = (load: () => Promise<{ default: React.ComponentType }>): Pick<RouteObject, 'lazy'> => ({
  lazy: async () => ({ Component: (await load()).default }),
});

export const router = createBrowserRouter([
  {
    element: <StoreLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSpinner />,
    children: [
      { index: true, ...page(() => import('@/pages/home')) },
      { path: 'catalog', ...page(() => import('@/pages/catalog')) },
      { path: 'category/:slug', ...page(() => import('@/pages/catalog')) },
      { path: 'collections', ...page(() => import('@/pages/collections')) },
      { path: 'collections/:slug', ...page(() => import('@/pages/catalog')) },
      { path: 'search', ...page(() => import('@/pages/catalog')) },
      { path: 'product/:slug', ...page(() => import('@/pages/product')) },
      { path: 'cart', ...page(() => import('@/pages/cart')) },
      { path: 'checkout', ...page(() => import('@/pages/checkout')) },
      { path: 'checkout/result', ...page(() => import('@/pages/checkout-result')) },
      { path: 'favorites', ...page(() => import('@/pages/favorites')) },
      { path: 'faq', ...page(() => import('@/pages/faq')) },
      ...['about', 'contacts', 'delivery', 'returns', 'privacy', 'terms'].map((slug) => ({ path: slug, ...page(() => import('@/pages/info')) })),
      { path: 'login', ...page(() => import('@/pages/auth/login')) },
      { path: 'register', ...page(() => import('@/pages/auth/register')) },
      { path: 'forgot-password', ...page(() => import('@/pages/auth/forgot-password')) },
      { path: 'reset-password', ...page(() => import('@/pages/auth/reset-password')) },
      { path: 'verify-email', ...page(() => import('@/pages/auth/verify-email')) },
      {
        path: 'account',
        ...page(() => import('@/pages/account/layout')),
        children: [
          { index: true, ...page(() => import('@/pages/account/overview')) },
          { path: 'profile', ...page(() => import('@/pages/account/profile')) },
          { path: 'addresses', ...page(() => import('@/pages/account/addresses')) },
          { path: 'orders', ...page(() => import('@/pages/account/orders')) },
          { path: 'orders/:id', ...page(() => import('@/pages/account/order')) },
        ],
      },
      { path: '*', ...page(() => import('@/pages/not-found')) },
    ],
  },
  {
    path: 'admin',
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageSpinner />,
    ...page(() => import('@/admin/layout')),
    children: [
      { index: true, ...page(() => import('@/admin/pages/dashboard')) },
      { path: 'products', ...page(() => import('@/admin/pages/products')) },
      { path: 'products/new', ...page(() => import('@/admin/pages/product-form')) },
      { path: 'products/:id/edit', ...page(() => import('@/admin/pages/product-form')) },
      { path: 'orders', ...page(() => import('@/admin/pages/orders')) },
      { path: 'orders/:id', ...page(() => import('@/admin/pages/order')) },
      { path: 'customers', ...page(() => import('@/admin/pages/customers')) },
      { path: 'customers/:id', ...page(() => import('@/admin/pages/customer')) },
      { path: 'categories', ...page(() => import('@/admin/pages/categories')) },
      { path: 'collections', ...page(() => import('@/admin/pages/collections')) },
      { path: 'content', ...page(() => import('@/admin/pages/content')) },
      { path: 'settings', ...page(() => import('@/admin/pages/settings')) },
      { path: 'audit', ...page(() => import('@/admin/pages/audit')) },
      { path: '*', ...page(() => import('@/admin/pages/not-found')) },
    ],
  },
]);
