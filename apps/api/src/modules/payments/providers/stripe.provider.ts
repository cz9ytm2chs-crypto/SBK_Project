import { env } from '../../../config/env';
import { hmacSha256, safeEqual } from '../../../lib/crypto';
import {
  WebhookVerificationError,
  type PaymentProviderAdapter,
  type ProviderPaymentStatus,
} from './types';

const API = 'https://api.stripe.com/v1';
const TOLERANCE_S = 300;

async function stripe<T>(path: string, init: { method?: string; form?: Record<string, string>; idempotencyKey?: string } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? (init.form ? 'POST' : 'GET'),
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
    },
    body: init.form ? new URLSearchParams(init.form) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(`Stripe API: ${json.error?.message ?? res.status}`);
  return json;
}

interface Session {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired';
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_total: number;
  currency: string;
  payment_intent: string | null;
}

function mapStatus(s: Session): ProviderPaymentStatus {
  if (s.payment_status === 'paid') return 'SUCCEEDED';
  if (s.status === 'expired') return 'CANCELLED';
  return 'PENDING';
}

/**
 * Stripe Checkout (hosted page). Uses the REST API directly to keep dependencies small.
 * Availability: Stripe does not onboard merchants registered in Russia — see docs/PAYMENTS.md.
 */
export const stripeProvider: PaymentProviderAdapter = {
  key: 'STRIPE',
  displayName: 'Банковская карта (Stripe)',
  description: 'Visa, Mastercard, Apple Pay, Google Pay',
  testMode: !!env.STRIPE_SECRET_KEY?.startsWith('sk_test'),
  isConfigured: () => !!env.STRIPE_SECRET_KEY && !!env.STRIPE_WEBHOOK_SECRET,

  async createPayment(input) {
    const s = await stripe<Session>('/checkout/sessions', {
      idempotencyKey: input.idempotencyKey,
      form: {
        mode: 'payment',
        success_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        customer_email: input.customerEmail,
        client_reference_id: input.paymentId,
        'metadata[paymentId]': input.paymentId,
        'payment_intent_data[metadata][paymentId]': input.paymentId,
        'line_items[0][quantity]': '1',
        'line_items[0][price_data][currency]': input.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': String(input.amount),
        'line_items[0][price_data][product_data][name]': input.description,
        expires_at: String(Math.floor(Date.now() / 1000) + 60 * 60),
      },
    });
    return { providerPaymentId: s.id, confirmationUrl: s.url, status: 'PENDING' };
  },

  async getPayment(id) {
    const s = await stripe<Session>(`/checkout/sessions/${encodeURIComponent(id)}`);
    return { status: mapStatus(s), amount: s.amount_total, currency: s.currency.toUpperCase() };
  },

  async parseWebhook({ rawBody, headers }) {
    const header = String(headers['stripe-signature'] ?? '');
    const items = header.split(',').map((kv) => kv.split('='));
    const t = Number(items.find(([k]) => k === 't')?.[1]);
    const signatures = items.filter(([k]) => k === 'v1').map(([, v]) => v);
    if (!t || !signatures.length) throw new WebhookVerificationError('Missing Stripe signature');
    if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_S) throw new WebhookVerificationError('Stale Stripe signature');
    const expected = hmacSha256(env.STRIPE_WEBHOOK_SECRET!, `${t}.${rawBody.toString('utf8')}`);
    if (!signatures.some((s) => safeEqual(s, expected))) throw new WebhookVerificationError('Bad Stripe signature');
    const event = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; data: { object: { id: string; object: string } } };
    const obj = event.data.object;
    return {
      eventId: event.id,
      type: event.type,
      providerPaymentId: obj.object === 'checkout.session' ? obj.id : null,
      payload: event,
    };
  },

  async cancelPayment(id) {
    await stripe(`/checkout/sessions/${encodeURIComponent(id)}/expire`, { method: 'POST', form: {} });
  },

  async refund(id, amount, idempotencyKey) {
    const s = await stripe<Session>(`/checkout/sessions/${encodeURIComponent(id)}`);
    if (!s.payment_intent) throw new Error('Stripe session has no payment intent');
    const r = await stripe<{ id: string; status: string }>('/refunds', {
      idempotencyKey,
      form: { payment_intent: s.payment_intent, amount: String(amount) },
    });
    return { providerRefundId: r.id, succeeded: r.status === 'succeeded' || r.status === 'pending' };
  },
};
