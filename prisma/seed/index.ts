/* Demo data for local development and staging. Wipes all tables first. */
import { Prisma, PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { discountPercent, PERMISSIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from '@silt/shared';
import { BRANDS, CATEGORIES, COLLECTIONS, COLORS, detail, EDITORIAL, img, PRODUCTS, SIZES, SUBCATEGORIES } from './catalog-data';
import { FAQ, HOME_SECTIONS, PAGES } from './content-data';

const prisma = new PrismaClient();

// Deterministic pseudo-random numbers so every seed run produces the same shop.
let state = 42;
const rand = () => ((state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const hash = (p: string) => argon2.hash(p, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

/** Demo accounts — local development only. */
export const DEMO_USERS = {
  superAdmin: { email: 'admin@silt.store', password: 'Admin12345', firstName: 'Анна', lastName: 'Соколова', role: 'SUPER_ADMIN' as const },
  admin: { email: 'ops@silt.store', password: 'Admin12345', firstName: 'Игорь', lastName: 'Ветров', role: 'ADMIN' as const },
  manager: { email: 'manager@silt.store', password: 'Manager12345', firstName: 'Мария', lastName: 'Орлова', role: 'MANAGER' as const },
  content: { email: 'content@silt.store', password: 'Content12345', firstName: 'Денис', lastName: 'Ким', role: 'CONTENT_MANAGER' as const },
  customer: { email: 'demo@silt.store', password: 'Demo12345', firstName: 'Ольга', lastName: 'Иванова', role: null },
};

const CUSTOMER_NAMES = [
  ['Алексей', 'Морозов'], ['Екатерина', 'Белова'], ['Дмитрий', 'Лебедев'], ['Софья', 'Новикова'],
  ['Максим', 'Козлов'], ['Полина', 'Смирнова'], ['Артём', 'Попов'], ['Вера', 'Зайцева'],
];

const REVIEWS = [
  { rating: 5, title: 'Отличное качество', body: 'Ткань плотная, после нескольких стирок вещь выглядит как новая. Размер подошёл идеально.', fit: 'true' },
  { rating: 5, title: 'Буду брать ещё', body: 'Очень приятный материал и аккуратные швы. Доставили за два дня, упаковка без лишнего пластика.', fit: 'true' },
  { rating: 4, title: 'Хорошо, но маломерит', body: 'Вещь понравилась, но взял бы на размер больше — сидит плотнее, чем ожидал.', fit: 'small' },
  { rating: 4, title: 'Стоит своих денег', body: 'Добротно сделано, цвет точно как на фото. Минус звезда за долгую доставку в регион.', fit: 'true' },
  { rating: 5, title: 'Любимая вещь сезона', body: 'Ношу почти каждый день. Сочетается со всем гардеробом, получаю много комплиментов.', fit: 'large' },
  { rating: 3, title: 'Неплохо', body: 'Качество хорошее, но оттенок оказался чуть темнее, чем на сайте. В остальном всё устраивает.', fit: 'true' },
];

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length)
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

async function seedAccess() {
  const perms = await Promise.all(
    Object.entries(PERMISSIONS).map(([key, description]) => prisma.permission.create({ data: { key, description } })),
  );
  const byKey = new Map(perms.map((p) => [p.key, p.id]));
  const roles = new Map<string, string>();
  for (const key of ROLE_KEYS) {
    const role = await prisma.role.create({
      data: {
        key,
        name: ROLE_LABELS[key],
        permissions: { create: ROLE_PERMISSIONS[key].map((p) => ({ permissionId: byKey.get(p)! })) },
      },
    });
    roles.set(key, role.id);
  }

  const users: Record<string, string> = {};
  // On a public demo the staff password comes from the environment, never from the README.
  const staffPassword = process.env.SEED_STAFF_PASSWORD;
  for (const [k, u] of Object.entries(DEMO_USERS)) {
    const created = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: await hash(u.role && staffPassword ? staffPassword : u.password),
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.role ? null : '+7 916 555-12-34',
        emailVerifiedAt: new Date(),
        roleId: u.role ? roles.get(u.role) : null,
        createdAt: new Date(Date.now() - 120 * 86400_000),
      },
    });
    users[k] = created.id;
  }
  await prisma.address.create({
    data: { userId: users.customer, label: 'Дом', firstName: 'Ольга', lastName: 'Иванова', phone: '+7 916 555-12-34', city: 'Москва', street: 'ул. Покровка', house: '17', apartment: '24', postalCode: '101000', isDefault: true },
  });

  const customerPassword = await hash('Customer12345');
  const customers = [users.customer];
  for (const [i, [firstName, lastName]] of CUSTOMER_NAMES.entries()) {
    const c = await prisma.user.create({
      data: {
        email: `customer${i + 1}@example.com`,
        passwordHash: customerPassword,
        firstName,
        lastName,
        emailVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - between(5, 200) * 86400_000),
      },
    });
    customers.push(c.id);
  }
  return { users, customers };
}

async function seedCatalog() {
  const colors = new Map<string, string>();
  for (const [i, c] of COLORS.entries()) colors.set(c.slug, (await prisma.color.create({ data: { ...c, sortOrder: i } })).id);
  const sizes = new Map<string, string>();
  for (const [i, s] of SIZES.entries()) sizes.set(s.label, (await prisma.size.create({ data: { ...s, sortOrder: i } })).id);
  const brands = new Map<string, string>();
  for (const b of BRANDS) brands.set(b.slug, (await prisma.brand.create({ data: b })).id);

  const categories = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries())
    categories.set(
      c.slug,
      (
        await prisma.category.create({
          data: { slug: c.slug, name: c.name, description: c.description, imageUrl: c.image, sortOrder: i, seoTitle: `${c.name} — купить в SILT`, seoDescription: c.description },
        })
      ).id,
    );
  for (const [i, c] of SUBCATEGORIES.entries())
    categories.set(c.slug, (await prisma.category.create({ data: { slug: c.slug, name: c.name, parentId: categories.get(c.parent), sortOrder: i } })).id);

  const collections = new Map<string, string>();
  for (const [i, c] of COLLECTIONS.entries())
    collections.set(
      c.slug,
      (
        await prisma.collection.create({
          data: { slug: c.slug, name: c.name, season: c.season, description: c.description, imageUrl: c.image, isFeatured: c.featured, sortOrder: i },
        })
      ).id,
    );

  const products: { id: string; slug: string; categoryId: string; price: number; name: string; image: string; variants: { id: string; sku: string; size: string; color: string }[] }[] = [];
  for (const [pi, p] of PRODUCTS.entries()) {
    const price = p.price * 100;
    const compareAtPrice = p.compareAt ? p.compareAt * 100 : null;
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        material: p.material,
        care: p.care,
        fit: p.fit,
        price,
        compareAtPrice,
        discountPercent: discountPercent(price, compareAtPrice),
        costPrice: Math.round(price * 0.38),
        status: 'PUBLISHED',
        isNew: p.flags?.includes('new') ?? false,
        isBestseller: p.flags?.includes('bestseller') ?? false,
        isFeatured: p.flags?.includes('featured') ?? false,
        categoryId: categories.get(p.category)!,
        brandId: brands.get(p.brand),
        salesCount: p.sales,
        publishedAt: new Date(Date.now() - (PRODUCTS.length - pi) * 3 * 86400_000),
        collections: { create: (p.collections ?? []).map((slug, i) => ({ collectionId: collections.get(slug)!, sortOrder: i })) },
        images: {
          create: [
            ...p.photos.map((id, i) => ({ url: img(id), alt: p.name, sortOrder: i, isMain: i === 0 })),
            // A close-up crop of the main photo works as the hover image and gallery detail.
            { url: detail(p.photos[0]), alt: `${p.name} — деталь`, sortOrder: p.photos.length, isMain: false },
          ],
        },
      },
    });
    const variants = [];
    const skuBase = p.slug.split('-').map((w) => w.slice(0, 3)).join('').toUpperCase().slice(0, 10);
    for (const color of p.colors)
      for (const size of p.sizes) {
        // Some variants are sold out on purpose to demonstrate unavailable sizes.
        const stock = p.stock ?? (rand() < 0.12 ? 0 : between(1, 25));
        const v = await prisma.productVariant.create({
          data: {
            productId: created.id,
            sku: `${skuBase}-${color.slice(0, 3).toUpperCase()}-${size.replace(' ', '')}`,
            sizeId: sizes.get(size)!,
            colorId: colors.get(color)!,
            stock,
          },
        });
        if (stock > 0)
          await prisma.inventoryMovement.create({ data: { variantId: v.id, type: 'RESTOCK', quantity: stock, stockAfter: stock, reservedAfter: 0, reason: 'Начальный остаток' } });
        variants.push({ id: v.id, sku: v.sku, size, color: COLORS.find((c) => c.slug === color)!.name });
      }
    products.push({ id: created.id, slug: created.slug, categoryId: created.categoryId, price, name: p.name, image: img(p.photos[0]), variants });
  }
  return products;
}

async function seedContent() {
  await prisma.siteSettings.create({
    data: {
      id: 1,
      storeName: 'SILT',
      currency: 'RUB',
      contactEmail: 'hello@silt.store',
      contactPhone: '+7 (495) 120-45-67',
      address: 'Москва, ул. Большая Новодмитровская, 36, стр. 4',
      workingHours: 'Ежедневно 10:00–21:00',
      socials: { instagram: 'https://instagram.com/silt.store', telegram: 'https://t.me/siltstore', vk: 'https://vk.com/siltstore' },
      minOrderAmount: 1000_00,
      taxRatePercent: 20,
      enabledPaymentProviders: ['MOCK'],
      emailNotifications: { orderCreated: true, orderPaid: true, orderShipped: true, orderCancelled: true },
      reservationTtlMinutes: 30,
      seoTitle: 'SILT — одежда и аксессуары',
      seoDescription: 'Современная одежда из качественных тканей: футболки, худи, джинсы, куртки, обувь и аксессуары. Доставка по России.',
    },
  });

  const courier = await prisma.deliveryMethod.create({
    data: { code: 'courier', name: 'Курьером', type: 'COURIER', description: 'Доставка до двери в удобный интервал', price: 490_00, freeFromAmount: 10000_00, estimatedDaysMin: 1, estimatedDaysMax: 3, sortOrder: 0 },
  });
  void courier;
  await prisma.deliveryMethod.create({
    data: {
      code: 'pickup_point',
      name: 'В пункт выдачи',
      type: 'PICKUP_POINT',
      description: 'Более 3 000 пунктов по России',
      price: 290_00,
      freeFromAmount: 7000_00,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
      requiresAddress: false,
      sortOrder: 1,
      pickupPoints: {
        create: [
          { name: 'Пункт выдачи «Чистые пруды»', address: 'Москва, Чистопрудный бульвар, 12к2', workingHours: '10:00–22:00' },
          { name: 'Пункт выдачи «Белорусская»', address: 'Москва, ул. Лесная, 7', workingHours: '09:00–21:00' },
          { name: 'Пункт выдачи «Невский»', address: 'Санкт-Петербург, Невский пр., 88', workingHours: '10:00–21:00' },
        ],
      },
    },
  });
  await prisma.deliveryMethod.create({
    data: { code: 'pickup', name: 'Самовывоз из шоурума', type: 'PICKUP', description: 'Москва, Дизайн-завод «Флакон». На следующий день после оплаты', price: 0, estimatedDaysMin: 1, estimatedDaysMax: 1, requiresAddress: false, sortOrder: 2 },
  });

  await prisma.banner.createMany({
    data: [
      { placement: 'HERO', eyebrow: 'Осень — Зима 2026', title: 'Тёплые фактуры, спокойные цвета', subtitle: 'Пальто из шерсти с кашемиром, кожа растительного дубления и плотный футер.', imageUrl: EDITORIAL.hero1, ctaLabel: 'Смотреть коллекцию', ctaHref: '/collections/fall-winter-26', sortOrder: 0 },
      { placement: 'HERO', eyebrow: 'Utility', title: 'Одежда, которая работает', subtitle: 'Карманы, прочные ткани и функциональный крой.', imageUrl: EDITORIAL.hero2, ctaLabel: 'В каталог', ctaHref: '/collections/utility', sortOrder: 1 },
      { placement: 'PROMO', eyebrow: 'Только онлайн', title: 'До −25% на избранные модели', subtitle: 'Цены уже снижены. Количество ограничено.', imageUrl: EDITORIAL.promo, ctaLabel: 'Смотреть предложения', ctaHref: '/catalog?onSale=true&sort=discount', sortOrder: 0 },
      { placement: 'EDITORIAL', eyebrow: 'Журнал', title: 'Как собрать капсулу из 12 вещей', subtitle: 'Базовые футболки, прямые джинсы и одна хорошая куртка.', imageUrl: EDITORIAL.editorial1, ctaLabel: 'Essentials', ctaHref: '/collections/essentials', sortOrder: 0 },
      { placement: 'EDITORIAL', eyebrow: 'Шоурум', title: 'Приходите примерить', subtitle: 'Дизайн-завод «Флакон», ежедневно с 11 до 21.', imageUrl: EDITORIAL.editorial2, ctaLabel: 'Контакты', ctaHref: '/contacts', sortOrder: 1 },
    ],
  });

  for (const [i, s] of HOME_SECTIONS.entries())
    await prisma.homeSection.create({ data: { ...s, sortOrder: i, config: s.key === 'social' ? { images: EDITORIAL.social } : {} } });
  for (const p of PAGES) await prisma.contentPage.create({ data: { slug: p.slug, title: p.title, body: p.body, seoDescription: p.seoDescription } });
  for (const [i, f] of FAQ.entries()) await prisma.faqItem.create({ data: { ...f, sortOrder: i } });

  for (const [q, count] of [['худи', 48], ['джинсы', 41], ['кроссовки', 37], ['футболка', 30], ['куртка', 22], ['пальто', 15], ['кепка', 9]] as const)
    await prisma.searchQuery.create({ data: { query: q, count } });
}

async function seedReviews(products: Awaited<ReturnType<typeof seedCatalog>>, customers: string[]) {
  for (const p of products.slice(0, 30)) {
    const authors = [...customers].sort(() => rand() - 0.5).slice(0, between(0, 4));
    for (const userId of authors) {
      const r = pick(REVIEWS);
      await prisma.review.create({
        data: { productId: p.id, userId, rating: r.rating, title: r.title, body: r.body, fitFeedback: r.fit, status: 'APPROVED', verifiedPurchase: rand() > 0.3, createdAt: new Date(Date.now() - between(1, 90) * 86400_000) },
      });
    }
    const agg = await prisma.review.aggregate({ where: { productId: p.id }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.product.update({ where: { id: p.id }, data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all } });
  }
}

/** Historical orders so the dashboard has data. They do not change stock (demo history). */
async function seedOrders(products: Awaited<ReturnType<typeof seedCatalog>>, customers: string[]) {
  const people = await prisma.user.findMany({ where: { id: { in: customers } } });
  const statuses = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'SHIPPED', 'PROCESSING', 'PAID', 'CANCELLED', 'REFUNDED'] as const;
  for (let i = 0; i < 70; i++) {
    const daysAgo = between(0, 59);
    const createdAt = new Date(Date.now() - daysAgo * 86400_000 - between(0, 20) * 3600_000);
    const user = pick(people);
    const lines = Array.from({ length: between(1, 3) }, () => {
      const p = pick(products);
      const v = pick(p.variants);
      return { p, v, quantity: between(1, 2) };
    });
    const subtotal = lines.reduce((s, l) => s + l.p.price * l.quantity, 0);
    const shippingTotal = subtotal >= 10000_00 ? 0 : 490_00;
    const total = subtotal + shippingTotal;
    const status = daysAgo < 2 ? pick(['PAID', 'PROCESSING'] as const) : pick([...statuses]);
    const paid = status !== 'CANCELLED';
    const d = createdAt.toISOString().slice(2, 10).replace(/-/g, '');
    const history: Prisma.OrderStatusHistoryCreateWithoutOrderInput[] = [
      { toStatus: 'CREATED', comment: 'Заказ оформлен', createdAt },
      { fromStatus: 'CREATED', toStatus: 'AWAITING_PAYMENT', createdAt },
    ];
    const flow = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;
    if (status === 'CANCELLED') history.push({ fromStatus: 'AWAITING_PAYMENT', toStatus: 'CANCELLED', comment: 'Истёк срок оплаты', createdAt: new Date(createdAt.getTime() + 1800_000) });
    else {
      const last = status === 'REFUNDED' ? 3 : flow.indexOf(status);
      let prev: (typeof flow)[number] | 'AWAITING_PAYMENT' = 'AWAITING_PAYMENT';
      for (let s = 0; s <= last; s++) {
        history.push({ fromStatus: prev, toStatus: flow[s], createdAt: new Date(createdAt.getTime() + s * 86400_000 + 600_000) });
        prev = flow[s];
      }
      if (status === 'REFUNDED') history.push({ fromStatus: 'DELIVERED', toStatus: 'REFUNDED', comment: 'Возврат: не подошёл размер', createdAt: new Date(createdAt.getTime() + 6 * 86400_000) });
    }
    await prisma.order.create({
      data: {
        number: `SL-${d}-${String(1000 + i)}`,
        userId: user.id,
        status,
        paymentStatus: status === 'CANCELLED' ? 'CANCELLED' : status === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED',
        email: user.email,
        phone: '+7 900 000-00-00',
        firstName: user.firstName,
        lastName: user.lastName,
        deliveryMethodCode: 'courier',
        deliveryMethodName: 'Курьером',
        shippingAddress: { country: 'RU', region: '', city: 'Москва', street: 'ул. Тверская', house: String(between(1, 30)), apartment: String(between(1, 120)), postalCode: '125009' },
        subtotal,
        shippingTotal,
        taxTotal: Math.round((total * 20) / 120),
        total,
        paymentProvider: 'MOCK',
        idempotencyKey: `seed-${i}-${createdAt.getTime()}`,
        paidAt: paid ? new Date(createdAt.getTime() + 300_000) : null,
        cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + 1800_000) : null,
        createdAt,
        items: {
          create: lines.map((l) => ({
            productId: l.p.id,
            variantId: l.v.id,
            productName: l.p.name,
            productSlug: l.p.slug,
            sku: l.v.sku,
            size: l.v.size,
            color: l.v.color,
            imageUrl: l.p.image,
            unitPrice: l.p.price,
            quantity: l.quantity,
            lineTotal: l.p.price * l.quantity,
          })),
        },
        payments: {
          create: {
            provider: 'MOCK',
            providerPaymentId: `mock_seed_${i}`,
            status: status === 'CANCELLED' ? 'CANCELLED' : status === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED',
            amount: total,
            refundedAmount: status === 'REFUNDED' ? total : 0,
            currency: 'RUB',
            idempotencyKey: `seed-pay-${i}`,
            createdAt,
          },
        },
        shipment: {
          create: {
            status: status === 'DELIVERED' || status === 'REFUNDED' ? 'DELIVERED' : status === 'SHIPPED' ? 'SHIPPED' : status === 'PROCESSING' ? 'READY' : 'PENDING',
            carrier: ['SHIPPED', 'DELIVERED', 'REFUNDED'].includes(status) ? 'СДЭК' : null,
            trackingNumber: ['SHIPPED', 'DELIVERED', 'REFUNDED'].includes(status) ? `1${between(100000000, 999999999)}` : null,
          },
        },
        statusHistory: { create: history },
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'staging' && process.env.SEED_FORCE !== 'true')
    throw new Error('Refusing to wipe a production database. Set SEED_FORCE=true if you really mean it.');
  console.log('Seeding SILT demo data…');
  await wipe();
  const { customers } = await seedAccess();
  const products = await seedCatalog();
  await seedContent();
  await seedReviews(products, customers);
  await seedOrders(products, customers);
  console.log(`Done: ${products.length} products, ${customers.length} customers.`);
  console.log(`Admin: admin@silt.store / ${process.env.SEED_STAFF_PASSWORD ? '(SEED_STAFF_PASSWORD)' : 'Admin12345'} · Customer: demo@silt.store / Demo12345`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
