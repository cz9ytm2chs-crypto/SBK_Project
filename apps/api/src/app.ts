import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './lib/errors';
import { logger } from './lib/logger';
import { buildOpenApi } from './lib/openapi';
import { prisma } from './lib/prisma';
import { UPLOAD_DIR } from './lib/storage';
import { loadSession } from './middleware/auth';
import { apiLimiter, csrf, searchLimiter } from './middleware/security';
import { adminRouter } from './modules/admin';
import { authRouter } from './modules/auth/auth.routes';
import { cartRouter } from './modules/cart/cart.routes';
import { brandsRouter, categoriesRouter, collectionsRouter, productsRouter } from './modules/catalog/catalog.routes';
import { contentRouter, newsletterRouter } from './modules/content/content.routes';
import { checkoutRouter, ordersRouter } from './modules/orders/orders.routes';
import { mockGatewayRouter, webhooksRouter } from './modules/payments/payments.routes';
import { searchRouter } from './modules/search/search.routes';
import { favoritesRouter, usersRouter } from './modules/users/users.routes';
import { mountWeb, robotsTxt, sitemapXml } from './seo/seo';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'script-src': ["'self'"],
          'connect-src': ["'self'"],
          'form-action': ["'self'", ...(env.STRIPE_SECRET_KEY ? ['https://checkout.stripe.com'] : [])],
          'frame-ancestors': ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // product images are used by the web origin
    }),
  );
  app.use(cors({ origin: env.APP_URL, credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url?.startsWith('/uploads') ?? false } }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });
  app.get('/robots.txt', async (_req, res, next) => robotsTxt().then((t) => res.type('text/plain').send(t), next));
  app.get('/sitemap.xml', async (_req, res, next) => sitemapXml().then((x) => res.type('application/xml').send(x), next));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, fallthrough: false }));

  // Webhooks need the raw body and are authenticated by signature — mounted before JSON parsing.
  app.use('/api/v1/webhooks', webhooksRouter);

  const api = Router();
  api.use(express.json({ limit: '200kb' }));
  api.use(cookieParser());
  api.use(apiLimiter);
  api.use(csrf);
  api.use(loadSession);
  api.use((_req, res, next) => {
    // API responses are personalised — never cache them in shared caches.
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use('/payments/mock', mockGatewayRouter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/favorites', favoritesRouter);
  api.use('/products', productsRouter);
  api.use('/categories', categoriesRouter);
  api.use('/collections', collectionsRouter);
  api.use('/brands', brandsRouter);
  api.use('/search', searchLimiter, searchRouter);
  api.use('/content', contentRouter);
  api.use('/newsletter', newsletterRouter);
  api.use('/cart', cartRouter);
  api.use('/checkout', checkoutRouter);
  api.use('/orders', ordersRouter);
  api.use('/admin', adminRouter);
  app.use('/api/v1', api);

  const openapi = buildOpenApi();
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'SILT API' }));

  mountWeb(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
