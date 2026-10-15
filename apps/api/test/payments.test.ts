import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { signMockPayload } from '../src/modules/payments/providers/mock.provider';
import { app, client, login, orderBody, prisma, seedFixtures } from './helpers';

let fx: Awaited<ReturnType<typeof seedFixtures>>;

async function placeOrder(quantity = 2) {
  const c = await client();
  await c.post('/api/v1/cart/items', { variantId: fx.variantM.id, quantity });
  const res = await c.post('/api/v1/checkout/orders', orderBody('pay'));
  expect(res.status).toBe(201);
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: res.body.orderId } });
  return { c, orderId: res.body.orderId as string, token: res.body.accessToken as string, payment };
}

/** What the mock gateway does when the buyer presses "Pay": change state, then send a signed webhook. */
async function gatewayPays(providerPaymentId: string, eventId = `evt_${Math.random()}`) {
  await prisma.mockGatewayPayment.update({ where: { id: providerPaymentId }, data: { status: 'succeeded' } });
  return sendWebhook({ id: eventId, type: 'payment.succeeded', paymentId: providerPaymentId });
}

function sendWebhook(payload: object, signature?: string) {
  const body = JSON.stringify(payload);
  return request(app)
    .post('/api/v1/webhooks/mock')
    .set('content-type', 'application/json')
    .set('x-mock-signature', signature ?? signMockPayload(body))
    .send(body);
}

describe('payment webhooks', () => {
  beforeEach(async () => {
    fx = await seedFixtures();
  });

  it('a valid webhook marks the order paid and writes off stock', async () => {
    const { orderId, payment } = await placeOrder();
    const res = await gatewayPays(payment.providerPaymentId!);
    expect(res.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('PAID');
    expect(order.paymentStatus).toBe('SUCCEEDED');
    expect(order.paidAt).not.toBeNull();
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } });
    expect(v).toMatchObject({ stock: 3, reserved: 0 });
    expect(await prisma.inventoryMovement.count({ where: { orderId, type: 'SALE' } })).toBe(1);
    expect(await prisma.emailJob.count({ where: { template: 'order_paid' } })).toBe(1);
  });

  it('rejects a forged or stale signature', async () => {
    const { orderId, payment } = await placeOrder();
    await prisma.mockGatewayPayment.update({ where: { id: payment.providerPaymentId! }, data: { status: 'succeeded' } });
    const forged = await sendWebhook({ id: 'evt_x', type: 'payment.succeeded', paymentId: payment.providerPaymentId }, 't=1,v1=deadbeef');
    expect(forged.status).toBe(400);
    const stale = await sendWebhook({ id: 'evt_y', type: 'payment.succeeded', paymentId: payment.providerPaymentId }, signMockPayload('{}', 1000));
    expect(stale.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('AWAITING_PAYMENT');
  });

  it('a replayed event is processed only once', async () => {
    const { payment } = await placeOrder();
    await gatewayPays(payment.providerPaymentId!, 'evt_same');
    const again = await sendWebhook({ id: 'evt_same', type: 'payment.succeeded', paymentId: payment.providerPaymentId });
    expect(again.body).toEqual({ duplicate: true });
    expect(await prisma.paymentEvent.count({ where: { providerEventId: 'evt_same' } })).toBe(1);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } })).stock).toBe(3);
  });

  it('the webhook body is only a trigger: status comes from the provider', async () => {
    const { orderId, payment } = await placeOrder();
    // Signed "succeeded" event, but the gateway says the payment is still pending.
    await sendWebhook({ id: 'evt_lie', type: 'payment.succeeded', paymentId: payment.providerPaymentId });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('AWAITING_PAYMENT');
  });

  it('refuses to mark paid when the paid amount differs', async () => {
    const { orderId, payment } = await placeOrder();
    await prisma.mockGatewayPayment.update({ where: { id: payment.providerPaymentId! }, data: { amount: 1 } });
    await gatewayPays(payment.providerPaymentId!);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('AWAITING_PAYMENT');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).failureReason).toBe('AMOUNT_MISMATCH');
  });

  it('the return page alone does not mark an order paid; re-check uses the provider', async () => {
    const { c, orderId, token, payment } = await placeOrder();
    const before = await c.post(`/api/v1/orders/${orderId}/sync-payment?token=${token}`);
    expect(before.body.status).toBe('AWAITING_PAYMENT');
    // Webhook lost, but the provider knows the payment succeeded → re-check fixes it.
    await prisma.mockGatewayPayment.update({ where: { id: payment.providerPaymentId! }, data: { status: 'succeeded' } });
    const after = await c.post(`/api/v1/orders/${orderId}/sync-payment?token=${token}`);
    expect(after.body.status).toBe('PAID');
  });

  it('admin flow: process, ship with tracking, refund', async () => {
    const { orderId, payment } = await placeOrder(1);
    await gatewayPays(payment.providerPaymentId!);
    const admin = await login('admin@test.dev');
    // Staff can never mark an order as paid themselves.
    const fake = await admin.post(`/api/v1/admin/orders/${orderId}/status`, { status: 'PAID' });
    expect(fake.status).toBe(409);
    expect((await admin.post(`/api/v1/admin/orders/${orderId}/status`, { status: 'SHIPPED' })).status).toBe(409); // cannot skip steps
    expect((await admin.post(`/api/v1/admin/orders/${orderId}/status`, { status: 'PROCESSING' })).status).toBe(200);
    expect((await admin.put(`/api/v1/admin/orders/${orderId}/shipment`, { carrier: 'СДЭК', trackingNumber: '123456' })).status).toBe(200);
    expect((await admin.post(`/api/v1/admin/orders/${orderId}/status`, { status: 'SHIPPED' })).status).toBe(200);
    const refund = await admin.post(`/api/v1/admin/orders/${orderId}/refund`, { reason: 'Не подошёл размер', restock: true });
    expect(refund.status).toBe(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { statusHistory: true } });
    expect(order.status).toBe('REFUNDED');
    expect(order.paymentStatus).toBe('REFUNDED');
    expect(order.statusHistory.map((h) => h.toStatus)).toEqual(['CREATED', 'AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'REFUNDED']);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } })).stock).toBe(5);
    expect(await prisma.auditLog.count({ where: { action: 'order.refund' } })).toBe(1);
  });
});
