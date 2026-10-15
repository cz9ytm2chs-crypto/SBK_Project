import { Router } from 'express';
import { z } from 'zod';
import { deliveryMethodInputSchema, settingsSchema, type PaymentProviderKey } from '@silt/shared';
import { audit } from '../../lib/audit';
import { invalidateCatalog } from '../../lib/cache';
import { badRequest } from '../../lib/errors';
import { paged, paginate } from '../../lib/pagination';
import { prisma } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';
import { getSettings, invalidateSettings } from '../content/settings.service';
import { retryEmail } from '../email/email.service';
import { getProvider, providerStatus } from '../payments/providers';

export const adminSettingsRouter = Router();
const r = createRoutes(adminSettingsRouter, '/admin/settings', 'Админ: настройки');

r.get('/', { summary: 'Настройки магазина', permission: 'settings.read' }, async () => ({
  settings: await getSettings(),
  providers: providerStatus(),
}));

r.put('/', { summary: 'Изменить настройки магазина', permission: 'settings.write', body: settingsSchema }, async ({ req, body }) => {
  const unconfigured = body.enabledPaymentProviders.filter((k) => !getProvider(k as PaymentProviderKey).isConfigured());
  if (unconfigured.length)
    throw badRequest(`Провайдер не настроен на сервере: ${unconfigured.join(', ')}. Добавьте ключи в переменные окружения`, 'PROVIDER_NOT_CONFIGURED');
  const s = await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...body }, update: body });
  await audit(req, 'settings.update', 'SiteSettings', '1', body);
  await invalidateSettings();
  invalidateCatalog();
  return s;
});

r.get('/delivery-methods', { summary: 'Способы доставки', permission: 'settings.read' }, () =>
  prisma.deliveryMethod.findMany({ orderBy: { sortOrder: 'asc' }, include: { pickupPoints: true } }),
);

r.put('/delivery-methods/:id', { summary: 'Изменить способ доставки', permission: 'settings.write', params: idParams, body: deliveryMethodInputSchema }, async ({ req, params, body }) => {
  const m = await prisma.deliveryMethod.update({ where: { id: params.id }, data: body });
  await audit(req, 'delivery.update', 'DeliveryMethod', m.id, body);
  return m;
});

r.get(
  '/emails',
  { summary: 'Очередь писем', permission: 'settings.read', query: z.object({ status: z.enum(['QUEUED', 'SENDING', 'SENT', 'FAILED']).optional(), page: z.coerce.number().int().min(1).default(1) }) },
  async ({ query }) => {
    const where = { status: query.status };
    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(query.page, 30), select: { id: true, to: true, subject: true, template: true, status: true, attempts: true, lastError: true, createdAt: true, sentAt: true } }),
      prisma.emailJob.count({ where }),
    ]);
    return paged(items, total, query.page, 30);
  },
);

r.post('/emails/:id/retry', { summary: 'Повторно отправить письмо', permission: 'settings.write', params: idParams }, async ({ req, params }) => {
  await retryEmail(params.id);
  await audit(req, 'email.resend', 'EmailJob', params.id);
  return { ok: true };
});
