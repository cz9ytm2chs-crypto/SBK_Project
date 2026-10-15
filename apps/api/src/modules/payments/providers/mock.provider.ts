import { env } from '../../../config/env';
import { hmacSha256, randomToken, safeEqual } from '../../../lib/crypto';
import { logger } from '../../../lib/logger';
import { prisma } from '../../../lib/prisma';
import {
  WebhookVerificationError,
  type CreatePaymentInput,
  type PaymentProviderAdapter,
  type ProviderPaymentStatus,
  type WebhookRequest,
} from './types';

const SIGNATURE_TOLERANCE_S = 300;

const STATUS: Record<string, ProviderPaymentStatus> = {
  pending: 'PENDING',
  succeeded: 'SUCCEEDED',
  canceled: 'FAILED',
};

export function signMockPayload(body: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${hmacSha256(env.MOCK_WEBHOOK_SECRET, `${timestamp}.${body}`)}`;
}

/**
 * Local test gateway. Has its own hosted "payment page" and sends signed webhooks,
 * so the app goes through exactly the same flow as with a real provider.
 * Disabled in production regardless of configuration.
 */
export const mockProvider: PaymentProviderAdapter = {
  key: 'MOCK',
  displayName: 'Тестовая оплата',
  description: 'Тестовый режим: деньги не списываются',
  testMode: true,
  isConfigured: () => env.mockPaymentsEnabled,

  async createPayment(input: CreatePaymentInput) {
    const id = `mock_${randomToken(12)}`;
    await prisma.mockGatewayPayment.create({
      data: {
        id,
        amount: input.amount,
        currency: input.currency,
        returnUrl: input.returnUrl,
        metadata: { paymentId: input.paymentId, orderNumber: input.orderNumber, description: input.description },
      },
    });
    return {
      providerPaymentId: id,
      confirmationUrl: `${env.API_URL}/api/v1/payments/mock/checkout/${id}`,
      status: 'PENDING',
    };
  },

  async getPayment(id) {
    const p = await prisma.mockGatewayPayment.findUniqueOrThrow({ where: { id } });
    return { status: STATUS[p.status] ?? 'PENDING', amount: p.amount, currency: p.currency, failureReason: p.status === 'canceled' ? 'Платёж отклонён банком (тест)' : undefined };
  },

  async parseWebhook({ rawBody, headers }: WebhookRequest) {
    const header = String(headers['x-mock-signature'] ?? '');
    const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
    const t = Number(parts.t);
    if (!t || !parts.v1) throw new WebhookVerificationError('Missing signature');
    if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) throw new WebhookVerificationError('Stale signature');
    const expected = hmacSha256(env.MOCK_WEBHOOK_SECRET, `${t}.${rawBody.toString('utf8')}`);
    if (!safeEqual(expected, parts.v1)) throw new WebhookVerificationError('Bad signature');
    const body = JSON.parse(rawBody.toString('utf8')) as { id: string; type: string; paymentId: string };
    return { eventId: body.id, type: body.type, providerPaymentId: body.paymentId, payload: body };
  },

  async cancelPayment(id) {
    await prisma.mockGatewayPayment.updateMany({ where: { id, status: 'pending' }, data: { status: 'canceled' } });
  },

  async refund(_id, _amount) {
    return { providerRefundId: `mock_refund_${randomToken(8)}`, succeeded: true };
  },
};

/** Called by the mock payment page: changes gateway state and notifies the shop by webhook. */
export async function completeMockPayment(id: string, outcome: 'succeeded' | 'canceled') {
  const p = await prisma.mockGatewayPayment.findUnique({ where: { id } });
  if (!p) return null;
  if (p.status === 'pending') await prisma.mockGatewayPayment.update({ where: { id }, data: { status: outcome } });
  const body = JSON.stringify({
    id: `evt_${randomToken(12)}`,
    type: outcome === 'succeeded' ? 'payment.succeeded' : 'payment.canceled',
    paymentId: id,
  });
  // Delivered like a real provider would: an HTTP call to the public webhook URL.
  fetch(`${env.API_URL}/api/v1/webhooks/mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mock-signature': signMockPayload(body) },
    body,
  }).catch((err) => logger.error({ err }, 'Mock webhook delivery failed'));
  return p;
}
