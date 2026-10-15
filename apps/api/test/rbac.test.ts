import { beforeAll, describe, expect, it } from 'vitest';
import { client, login, prisma, seedFixtures } from './helpers';

const settingsBody = {
  storeName: 'SILT',
  currency: 'RUB',
  contactEmail: 'hello@silt.store',
  contactPhone: '',
  address: '',
  workingHours: '',
  minOrderAmount: 0,
  taxRatePercent: 20,
  pricesIncludeTax: true,
  enabledPaymentProviders: ['MOCK'],
  reservationTtlMinutes: 30,
  seoTitle: 'SILT',
  seoDescription: '',
};

describe('role-based access control (enforced by the API)', () => {
  beforeAll(seedFixtures);

  it('anonymous → 401, customer → 403 on admin endpoints', async () => {
    const anon = await client();
    expect((await anon.get('/api/v1/admin/orders')).status).toBe(401);
    const customer = await login('customer@test.dev');
    expect((await customer.get('/api/v1/admin/orders')).status).toBe(403);
    expect((await customer.get('/api/v1/admin/dashboard')).status).toBe(403);
  });

  it('manager: orders yes, settings and staff no', async () => {
    const m = await login('manager@test.dev');
    expect((await m.get('/api/v1/admin/orders')).status).toBe(200);
    expect((await m.put('/api/v1/admin/settings', settingsBody)).status).toBe(403);
    expect((await m.post('/api/v1/admin/customers/staff', { email: 'x@test.dev', firstName: 'X', password: 'Secret12345', role: 'ADMIN' })).status).toBe(403);
    expect((await m.delete('/api/v1/admin/products/whatever')).status).toBe(403);
  });

  it('content manager cannot see orders or customers', async () => {
    const c = await login('content@test.dev');
    expect((await c.get('/api/v1/admin/orders')).status).toBe(403);
    expect((await c.get('/api/v1/admin/customers')).status).toBe(403);
    expect((await c.get('/api/v1/admin/products')).status).toBe(200);
  });

  it('only a super admin can create staff; admin cannot escalate', async () => {
    const admin = await login('admin@test.dev');
    expect((await admin.post('/api/v1/admin/customers/staff', { email: 'x@test.dev', firstName: 'X', password: 'Secret12345', role: 'SUPER_ADMIN' })).status).toBe(403);
    const customer = await prisma.user.findUniqueOrThrow({ where: { email: 'customer@test.dev' } });
    const escalate = await admin.patch(`/api/v1/admin/customers/${customer.id}/access`, { role: 'ADMIN' });
    expect(escalate.status).toBe(403);

    const sup = await login('super@test.dev');
    const created = await sup.post('/api/v1/admin/customers/staff', { email: 'newstaff@test.dev', firstName: 'Staff', password: 'Secret12345', role: 'MANAGER' });
    expect(created.status).toBe(201);
    // Every staff action is audited.
    expect(await prisma.auditLog.count({ where: { action: 'staff.create' } })).toBe(1);
  });

  it('admin changes settings and the change is audited', async () => {
    const admin = await login('admin@test.dev');
    expect((await admin.put('/api/v1/admin/settings', settingsBody)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'settings.update' } })).toBeGreaterThan(0);
  });

  it('customers cannot read other customers orders', async () => {
    const order = await prisma.order.create({
      data: {
        number: 'SL-TEST-1',
        email: 'other@test.dev',
        phone: '+70000000000',
        firstName: 'A',
        lastName: 'B',
        deliveryMethodCode: 'pickup',
        deliveryMethodName: 'Самовывоз',
        subtotal: 100,
        total: 100,
        paymentProvider: 'MOCK',
        idempotencyKey: 'rbac-test-order',
      },
    });
    const customer = await login('customer@test.dev');
    expect((await customer.get(`/api/v1/orders/${order.id}`)).status).toBe(404);
    expect((await customer.get(`/api/v1/orders/${order.id}?token=forged`)).status).toBe(404);
  });
});
