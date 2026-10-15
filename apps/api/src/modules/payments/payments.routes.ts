import express, { Router } from 'express';
import { formatMoney, type PaymentProviderKey } from '@silt/shared';
import { env } from '../../config/env';
import { notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { completeMockPayment } from './providers/mock.provider';
import { handleWebhook } from './payments.service';

// ── Test gateway hosted page (MOCK provider only, never in production) ──
export const mockGatewayRouter = Router();

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

mockGatewayRouter.use((_req, _res, next) => (env.mockPaymentsEnabled ? next() : next(notFound())));

mockGatewayRouter.get('/checkout/:id', async (req, res, next) => {
  try {
    const p = await prisma.mockGatewayPayment.findUnique({ where: { id: req.params.id } });
    if (!p) throw notFound('Платёж не найден');
    const meta = p.metadata as { orderNumber?: string };
    res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${env.APP_URL}`);
    res.type('html').send(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Тестовая оплата</title><style>
body{margin:0;font-family:system-ui,sans-serif;background:#efede8;color:#141414;display:grid;place-items:center;min-height:100vh}
.card{background:#fff;padding:40px;max-width:420px;width:calc(100% - 32px);box-sizing:border-box}
.badge{display:inline-block;background:#c2410c;color:#fff;font-size:11px;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px}
h1{font-size:22px;font-weight:500;margin:20px 0 4px}.sum{font-size:32px;margin:16px 0 24px}
p{color:#666;font-size:14px;line-height:1.5}button{width:100%;padding:16px;border:0;font-size:14px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-top:8px}
.ok{background:#141414;color:#fff}.fail{background:#fff;border:1px solid #141414}</style></head><body><main class="card">
<span class="badge">Тестовый режим</span><h1>Заказ ${esc(meta.orderNumber ?? '')}</h1>
<p>Это тестовый платёжный шлюз для разработки. Реальные деньги не списываются, данные карты не запрашиваются.</p>
<div class="sum">${formatMoney(p.amount, p.currency)}</div>
${p.status === 'pending'
  ? `<form method="post" action="/api/v1/payments/mock/checkout/${esc(p.id)}/complete"><button class="ok" name="outcome" value="succeeded">Оплатить</button>
<button class="fail" name="outcome" value="canceled">Отклонить платёж</button></form>`
  : `<p>Платёж уже обработан: ${esc(p.status)}</p><form method="get" action="${esc(p.returnUrl)}"><button class="ok">Вернуться в магазин</button></form>`}
</main></body></html>`);
  } catch (err) {
    next(err);
  }
});

mockGatewayRouter.post('/checkout/:id/complete', express.urlencoded({ extended: false, limit: '2kb' }), async (req, res, next) => {
  try {
    const outcome = req.body?.outcome === 'succeeded' ? 'succeeded' : 'canceled';
    const p = await completeMockPayment(req.params.id, outcome);
    if (!p) throw notFound('Платёж не найден');
    res.redirect(303, p.returnUrl + (outcome === 'canceled' ? '&failed=1' : ''));
  } catch (err) {
    next(err);
  }
});

// ── Provider webhooks: raw body is required for signature checks ──
export const webhooksRouter = Router();
webhooksRouter.use(express.raw({ type: '*/*', limit: '256kb' }));

const PROVIDERS: Record<string, PaymentProviderKey> = { mock: 'MOCK', stripe: 'STRIPE', yookassa: 'YOOKASSA' };

webhooksRouter.post('/:provider', async (req, res, next) => {
  try {
    const key = PROVIDERS[req.params.provider];
    if (!key) throw notFound();
    const result = await handleWebhook(key, {
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''),
      headers: req.headers,
      ip: req.ip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
