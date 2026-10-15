import { Router } from 'express';
import { forbidden, unauthorized } from '../../lib/errors';
import { adminCatalogRouter } from './catalog.routes';
import { adminContentRouter } from './content.routes';
import { adminCustomersRouter } from './customers.routes';
import { adminDashboardRouter } from './dashboard.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminProductsRouter } from './products.routes';
import { adminSettingsRouter } from './settings.routes';

export const adminRouter = Router();

// Defence in depth: every admin endpoint also declares its own permission.
adminRouter.use((req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!req.user.role) return next(forbidden('Доступ только для сотрудников'));
  next();
});

adminRouter.use('/dashboard', adminDashboardRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/customers', adminCustomersRouter);
adminRouter.use('/', adminCatalogRouter); // /categories, /brands, /collections
adminRouter.use('/content', adminContentRouter);
adminRouter.use('/settings', adminSettingsRouter);
