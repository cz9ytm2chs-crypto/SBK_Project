import { BlockList, isIPv6 } from 'node:net';
import { env } from '../../../config/env';
import {
  WebhookVerificationError,
  type PaymentProviderAdapter,
  type ProviderPaymentStatus,
} from './types';

const API = 'https://api.yookassa.ru/v3';

/** YooKassa notifications are not signed; they come only from these networks (YooKassa docs). */
const allowed = new BlockList();
allowed.addSubnet('185.71.76.0', 27);
allowed.addSubnet('185.71.77.0', 27);
allowed.addSubnet('77.75.153.0', 25);
allowed.addAddress('77.75.156.11');
allowed.addAddress('77.75.156.35');
allowed.addSubnet('77.75.154.128', 25);
allowed.addSubnet('2a02:5180::', 32, 'ipv6');

function ipAllowed(ip: string | undefined) {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, '');
  return allowed.check(clean, isIPv6(clean) ? 'ipv6' : 'ipv4');
}

async function yk<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const auth = Buffer.from(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`).toString('base64');
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/json',
      ...(init.idempotencyKey ? { 'idempotence-key': init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json()) as T & { description?: string };
  if (!res.ok) throw new Error(`YooKassa API: ${json.description ?? res.status}`);
  return json;
}

interface YkPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  confirmation?: { confirmation_url?: string };
  cancellation_details?: { reason: string };
}

const STATUS: Record<YkPayment['status'], ProviderPaymentStatus> = {
  pending: 'PENDING',
  waiting_for_capture: 'REQUIRES_ACTION',
  succeeded: 'SUCCEEDED',
  canceled: 'FAILED',
};

const toMinor = (value: string) => Math.round(Number(value) * 100);
const toValue = (minor: number) => (minor / 100).toFixed(2);

/**
 * YooKassa (redirect confirmation, auto-capture). Requires a Russian legal entity / sole proprietor.
 * Because notifications are unsigned, the webhook only triggers a re-fetch of the payment via API.
 */
export const yookassaProvider: PaymentProviderAdapter = {
  key: 'YOOKASSA',
  displayName: 'Банковская карта, СБП (ЮKassa)',
  description: 'Карты МИР, Visa, Mastercard, СБП, SberPay',
  testMode: !!env.YOOKASSA_SECRET_KEY?.startsWith('test_'),
  isConfigured: () => !!env.YOOKASSA_SHOP_ID && !!env.YOOKASSA_SECRET_KEY,

  async createPayment(input) {
    const p = await yk<YkPayment>('/payments', {
      idempotencyKey: input.idempotencyKey,
      body: {
        amount: { value: toValue(input.amount), currency: input.currency },
        capture: true,
        confirmation: { type: 'redirect', return_url: input.returnUrl },
        description: input.description.slice(0, 128),
        metadata: { paymentId: input.paymentId, orderNumber: input.orderNumber },
      },
    });
    return { providerPaymentId: p.id, confirmationUrl: p.confirmation?.confirmation_url ?? null, status: STATUS[p.status] };
  },

  async getPayment(id) {
    const p = await yk<YkPayment>(`/payments/${encodeURIComponent(id)}`);
    return {
      status: STATUS[p.status],
      amount: toMinor(p.amount.value),
      currency: p.amount.currency,
      failureReason: p.cancellation_details?.reason,
    };
  },

  async parseWebhook({ rawBody, ip }) {
    if (!ipAllowed(ip)) throw new WebhookVerificationError('Notification from unknown IP');
    const body = JSON.parse(rawBody.toString('utf8')) as { event: string; object: { id: string } };
    if (!body?.object?.id) throw new WebhookVerificationError('Malformed notification');
    return {
      eventId: `${body.event}:${body.object.id}`,
      type: body.event,
      providerPaymentId: body.event.startsWith('payment.') ? body.object.id : null,
      payload: body,
    };
  },

  async cancelPayment(id) {
    await yk(`/payments/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {}, idempotencyKey: `cancel-${id}` });
  },

  async refund(id, amount, idempotencyKey) {
    const r = await yk<{ id: string; status: string }>('/refunds', {
      idempotencyKey,
      body: { payment_id: id, amount: { value: toValue(amount), currency: 'RUB' } },
    });
    return { providerRefundId: r.id, succeeded: r.status === 'succeeded' || r.status === 'pending' };
  },
};
