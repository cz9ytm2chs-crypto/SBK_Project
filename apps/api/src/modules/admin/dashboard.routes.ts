import { Router } from 'express';
import { z } from 'zod';
import { PAID_ORDER_STATUSES } from '@silt/shared';
import { Prisma, prisma } from '../../lib/prisma';
import { createRoutes } from '../../lib/route';

export const adminDashboardRouter = Router();
const r = createRoutes(adminDashboardRouter, '/admin/dashboard', 'Админ: дашборд');

const PAID = [...PAID_ORDER_STATUSES] as Prisma.EnumOrderStatusFilter['in'];

async function periodStats(from: Date, to: Date) {
  const where: Prisma.OrderWhereInput = { status: { in: PAID }, paidAt: { gte: from, lt: to } };
  const [agg, customers] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true }, _count: { _all: true } }),
    prisma.user.count({ where: { roleId: null, createdAt: { gte: from, lt: to } } }),
  ]);
  const revenue = agg._sum.total ?? 0;
  const orders = agg._count._all;
  return { revenue, orders, averageOrder: orders ? Math.round(revenue / orders) : 0, newCustomers: customers };
}

r.get(
  '/',
  { summary: 'Ключевые показатели за период и сравнение с предыдущим', permission: 'dashboard.view', query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) },
  async ({ query }) => {
    const now = new Date();
    const from = new Date(now.getTime() - query.days * 86400_000);
    const prevFrom = new Date(from.getTime() - query.days * 86400_000);

    const [current, previous, totalCustomers, daily, top, recent, lowStock] = await Promise.all([
      periodStats(from, now),
      periodStats(prevFrom, from),
      prisma.user.count({ where: { roleId: null } }),
      prisma.$queryRaw<{ day: Date; revenue: bigint; orders: bigint }[]>(Prisma.sql`
        SELECT date_trunc('day', "paidAt") AS day, SUM("total")::bigint AS revenue, COUNT(*)::bigint AS orders
        FROM "Order"
        WHERE "paidAt" >= ${from} AND "status" IN ('PAID','PROCESSING','SHIPPED','DELIVERED')
        GROUP BY 1 ORDER BY 1`),
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        where: { order: { status: { in: PAID }, paidAt: { gte: from } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 5,
      }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, number: true, firstName: true, lastName: true, total: true, status: true, paymentStatus: true, createdAt: true },
      }),
      prisma.$queryRaw<{ id: string; sku: string; available: number; productId: string; name: string }[]>(Prisma.sql`
        SELECT v."id", v."sku", (v."stock" - v."reserved")::int AS available, p."id" AS "productId", p."name"
        FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
        WHERE p."status" = 'PUBLISHED' AND v."isActive" AND v."stock" - v."reserved" <= 3
        ORDER BY available ASC, p."name" LIMIT 10`),
    ]);

    // Fill missing days with zeros so the chart has a continuous axis.
    const byDay = new Map(daily.map((d) => [d.day.toISOString().slice(0, 10), d]));
    const series = Array.from({ length: query.days }, (_, i) => {
      const day = new Date(from.getTime() + (i + 1) * 86400_000).toISOString().slice(0, 10);
      const d = byDay.get(day);
      return { date: day, revenue: Number(d?.revenue ?? 0), orders: Number(d?.orders ?? 0) };
    });

    return {
      current,
      previous,
      totalCustomers,
      series,
      topProducts: top.map((t) => ({ productId: t.productId, name: t.productName, quantity: t._sum.quantity ?? 0, revenue: t._sum.lineTotal ?? 0 })),
      recentOrders: recent,
      lowStock,
    };
  },
);
