import { beforeEach, describe, expect, it } from 'vitest';
import { expireUnpaidOrders } from '../src/jobs';
import { client, orderBody, prisma, seedFixtures } from './helpers';

let fx: Awaited<ReturnType<typeof seedFixtures>>;

async function cartWith(variantId: string, quantity: number) {
  const c = await client();
  const res = await c.post('/api/v1/cart/items', { variantId, quantity });
  expect(res.status).toBe(200);
  return c;
}

describe('cart', () => {
  beforeEach(async () => {
    fx = await seedFixtures();
  });

  it('calculates totals on the server', async () => {
    const c = await cartWith(fx.variantM.id, 2);
    const cart = (await c.get('/api/v1/cart')).body;
    expect(cart.totals.subtotal).toBe(6000_00);
    expect(cart.itemCount).toBe(2);
    const quote = (await c.get('/api/v1/checkout/quote?deliveryMethodCode=courier')).body;
    expect(quote.totals.shippingTotal).toBe(500_00);
    expect(quote.totals.total).toBe(6500_00);
  });

  it('gives free shipping above the threshold', async () => {
    await prisma.product.update({ where: { id: fx.product.id }, data: { price: 6000_00 } });
    const c = await cartWith(fx.variantM.id, 2);
    expect((await c.get('/api/v1/checkout/quote?deliveryMethodCode=courier')).body.totals.shippingTotal).toBe(0);
  });

  it('rejects more than available and non-existent variants', async () => {
    const c = await client();
    const tooMany = await c.post('/api/v1/cart/items', { variantId: fx.variantM.id, quantity: 6 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('NOT_ENOUGH_STOCK');
    expect((await c.post('/api/v1/cart/items', { variantId: 'no-such-variant', quantity: 1 })).status).toBe(404);
  });

  it('flags lines whose price or stock changed', async () => {
    const c = await cartWith(fx.variantM.id, 3);
    await prisma.productVariant.update({ where: { id: fx.variantM.id }, data: { stock: 1 } });
    await prisma.product.update({ where: { id: fx.product.id }, data: { price: 3500_00 } });
    const cart = (await c.get('/api/v1/cart')).body;
    expect(cart.items[0].issue).toBe('QUANTITY_REDUCED');
    expect(cart.items[0].unitPrice).toBe(3500_00);
    const order = await c.post('/api/v1/checkout/orders', orderBody('x'));
    expect(order.status).toBe(409);
    expect(order.body.error.code).toBe('CART_CHANGED');
  });
});

describe('checkout and inventory', () => {
  beforeEach(async () => {
    fx = await seedFixtures();
  });

  it('creates an order with snapshots and reserves stock', async () => {
    const c = await cartWith(fx.variantM.id, 2);
    const res = await c.post('/api/v1/checkout/orders', orderBody('m'));
    expect(res.status).toBe(201);
    expect(res.body.paymentUrl).toContain('/payments/mock/checkout/');
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId }, include: { items: true } });
    expect(order.status).toBe('AWAITING_PAYMENT');
    expect(order.total).toBe(6500_00);
    expect(order.items[0]).toMatchObject({ productName: 'Тестовая футболка', sku: 'TEE-BLK-M', size: 'M', color: 'Чёрный', unitPrice: 3000_00, quantity: 2 });
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } });
    expect(v).toMatchObject({ stock: 5, reserved: 2 });
    expect(await prisma.inventoryMovement.count({ where: { orderId: order.id, type: 'RESERVE' } })).toBe(1);
    // Cart is emptied, order snapshot survives product edits.
    expect((await c.get('/api/v1/cart')).body.items).toHaveLength(0);
    await prisma.product.update({ where: { id: fx.product.id }, data: { name: 'Переименовано', price: 1 } });
    expect((await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } })).productName).toBe('Тестовая футболка');
  });

  it('is idempotent: the same key returns the same order', async () => {
    const c = await cartWith(fx.variantM.id, 1);
    const body = orderBody('idem');
    const [a, b] = await Promise.all([c.post('/api/v1/checkout/orders', body), c.post('/api/v1/checkout/orders', body)]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.orderId).toBe(b.body.orderId);
    expect(await prisma.order.count()).toBe(1);
  });

  it('never sells the last unit twice under parallel checkouts', async () => {
    // Five buyers race for one unit of size L.
    const buyers = await Promise.all(Array.from({ length: 5 }, () => cartWith(fx.variantL.id, 1)));
    const results = await Promise.all(buyers.map((c, i) => c.post('/api/v1/checkout/orders', orderBody(`race-${i}`))));
    const ok = results.filter((r) => r.status === 201);
    const failed = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(4);
    const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantL.id } });
    expect(v.reserved).toBe(1);
    expect(v.stock - v.reserved).toBe(0);
  });

  it('releases the reservation when payment time runs out', async () => {
    const c = await cartWith(fx.variantM.id, 2);
    const res = await c.post('/api/v1/checkout/orders', orderBody('exp'));
    await prisma.order.update({ where: { id: res.body.orderId }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireUnpaidOrders();
    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId } });
    expect(order.status).toBe('CANCELLED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } })).reserved).toBe(0);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id, status: 'EXPIRED' } })).toBe(1);
  });

  it('customer can cancel an unpaid order, stock comes back', async () => {
    const c = await cartWith(fx.variantM.id, 1);
    const res = await c.post('/api/v1/checkout/orders', orderBody('cancel'));
    const cancel = await c.post(`/api/v1/orders/${res.body.orderId}/cancel?token=${res.body.accessToken}`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantM.id } })).reserved).toBe(0);
  });

  it('does not trust prices sent by the client', async () => {
    const c = await cartWith(fx.variantM.id, 1);
    const res = await c.post('/api/v1/checkout/orders', { ...orderBody('price'), total: 1, subtotal: 1, price: 1 });
    expect(res.status).toBe(201);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: res.body.orderId } })).total).toBe(3500_00);
  });

  it('requires an address for courier delivery and consent checkboxes', async () => {
    const c = await cartWith(fx.variantM.id, 1);
    expect((await c.post('/api/v1/checkout/orders', orderBody('noaddr', { address: undefined }))).body.error.code).toBe('ADDRESS_REQUIRED');
    expect((await c.post('/api/v1/checkout/orders', orderBody('noterms', { acceptTerms: false }))).status).toBe(400);
  });
});
