import request from 'supertest';
import { ROLE_PERMISSIONS, type RoleKey } from '@silt/shared';
import { createApp } from '../src/app';
import { cache } from '../src/lib/cache';
import { hashPassword } from '../src/lib/crypto';
import { prisma } from '../src/lib/prisma';

export const app = createApp();
export { prisma };

export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  await cache.delPrefix('');
}

export const PASSWORD = 'Password123';

/** Minimal shop: roles, staff, a customer, one product with two variants, delivery methods. */
export async function seedFixtures() {
  await resetDb();
  for (const key of Object.keys(ROLE_PERMISSIONS) as RoleKey[]) {
    await prisma.role.create({
      data: {
        key,
        name: key,
        permissions: {
          create: ROLE_PERMISSIONS[key].map((p) => ({
            permission: { connectOrCreate: { where: { key: p }, create: { key: p } } },
          })),
        },
      },
    });
  }
  const passwordHash = await hashPassword(PASSWORD);
  const mkUser = async (email: string, role?: RoleKey) =>
    prisma.user.create({
      data: { email, passwordHash, firstName: 'Test', lastName: 'User', emailVerifiedAt: new Date(), role: role ? { connect: { key: role } } : undefined },
    });
  const users = {
    customer: await mkUser('customer@test.dev'),
    superAdmin: await mkUser('super@test.dev', 'SUPER_ADMIN'),
    admin: await mkUser('admin@test.dev', 'ADMIN'),
    manager: await mkUser('manager@test.dev', 'MANAGER'),
    content: await mkUser('content@test.dev', 'CONTENT_MANAGER'),
  };

  await prisma.siteSettings.create({ data: { id: 1, enabledPaymentProviders: ['MOCK'], minOrderAmount: 0, taxRatePercent: 20, reservationTtlMinutes: 30 } });
  await prisma.deliveryMethod.create({ data: { code: 'courier', name: 'Курьер', type: 'COURIER', price: 500_00, freeFromAmount: 10000_00, sortOrder: 0 } });
  await prisma.deliveryMethod.create({ data: { code: 'pickup', name: 'Самовывоз', type: 'PICKUP', price: 0, requiresAddress: false, sortOrder: 1 } });

  const category = await prisma.category.create({ data: { name: 'Футболки', slug: 'tshirts' } });
  const size = await prisma.size.create({ data: { label: 'M', group: 'APPAREL' } });
  const sizeL = await prisma.size.create({ data: { label: 'L', group: 'APPAREL' } });
  const color = await prisma.color.create({ data: { name: 'Чёрный', slug: 'black', hex: '#000000' } });
  const product = await prisma.product.create({
    data: {
      name: 'Тестовая футболка',
      slug: 'test-tee',
      description: 'Описание тестовой футболки',
      price: 3000_00,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      categoryId: category.id,
      images: { create: { url: '/uploads/test.webp', isMain: true } },
    },
  });
  const variantM = await prisma.productVariant.create({ data: { productId: product.id, sku: 'TEE-BLK-M', sizeId: size.id, colorId: color.id, stock: 5 } });
  const variantL = await prisma.productVariant.create({ data: { productId: product.id, sku: 'TEE-BLK-L', sizeId: sizeL.id, colorId: color.id, stock: 1 } });
  return { users, product, variantM, variantL, category };
}

/** HTTP client with a cookie jar and automatic CSRF header, like a browser. */
export async function client() {
  const agent = request.agent(app);
  const first = await agent.get('/api/v1/auth/me');
  const csrf = (first.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('silt_csrf='))!.split(';')[0].split('=')[1];
  const withCsrf = <T extends request.Test>(t: T) => t.set('X-CSRF-Token', csrf);
  return {
    agent,
    get: (url: string) => agent.get(url),
    post: (url: string, body?: object) => withCsrf(agent.post(url).send(body ?? {})),
    put: (url: string, body?: object) => withCsrf(agent.put(url).send(body ?? {})),
    patch: (url: string, body?: object) => withCsrf(agent.patch(url).send(body ?? {})),
    delete: (url: string) => withCsrf(agent.delete(url)),
  };
}

export async function login(email: string, password = PASSWORD) {
  const c = await client();
  const res = await c.post('/api/v1/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}

export const orderBody = (variantKey: string, overrides: object = {}) => ({
  idempotencyKey: `test-${variantKey}-${Math.random().toString(36).slice(2)}-xxxxxxxx`,
  contact: { email: 'buyer@test.dev', phone: '+7 900 000-00-00', firstName: 'Иван', lastName: 'Петров' },
  deliveryMethodCode: 'courier',
  address: { city: 'Москва', street: 'Тверская', house: '1', postalCode: '125009' },
  paymentProvider: 'MOCK',
  acceptTerms: true,
  acceptPrivacy: true,
  ...overrides,
});
