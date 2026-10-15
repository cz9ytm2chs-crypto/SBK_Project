import { Router } from 'express';
import { z } from 'zod';
import { PAID_ORDER_STATUSES, staffCreateSchema, userAccessSchema } from '@silt/shared';
import { audit } from '../../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { hashPassword } from '../../lib/crypto';
import { paged, paginate } from '../../lib/pagination';
import { Prisma, prisma } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';

export const adminCustomersRouter = Router();
const r = createRoutes(adminCustomersRouter, '/admin/customers', 'Админ: покупатели');

const PAID = [...PAID_ORDER_STATUSES] as Prisma.EnumOrderStatusFilter['in'];

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum(['customers', 'staff', 'blocked']).default('customers'),
  sort: z.enum(['new', 'spent']).default('new'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

r.get('/', { summary: 'Покупатели и сотрудники', permission: 'customers.read', query: listQuery }, async ({ query }) => {
  const where: Prisma.UserWhereInput = {
    roleId: query.type === 'staff' ? { not: null } : query.type === 'customers' ? null : undefined,
    isBlocked: query.type === 'blocked' ? true : undefined,
  };
  if (query.q)
    where.OR = [
      { email: { contains: query.q, mode: 'insensitive' } },
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } },
      { phone: { contains: query.q } },
    ];
  const select = { id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, lastLoginAt: true, isBlocked: true, emailVerifiedAt: true, role: { select: { key: true } } } as const;
  const spentBy = async (ids: string[]) =>
    new Map(
      (
        await prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids }, status: { in: PAID } }, _sum: { total: true }, _count: { _all: true } })
      ).map((s) => [s.userId, { spent: s._sum.total ?? 0, count: s._count._all }]),
    );

  let users;
  let stats;
  const total = await prisma.user.count({ where });
  if (query.sort === 'spent') {
    // Rank every matching user by paid total, then take the requested page.
    const ids = (await prisma.user.findMany({ where, select: { id: true }, orderBy: { createdAt: 'desc' } })).map((u) => u.id);
    stats = await spentBy(ids);
    const pageIds = ids
      .sort((a, b) => (stats!.get(b)?.spent ?? 0) - (stats!.get(a)?.spent ?? 0))
      .slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const rows = await prisma.user.findMany({ where: { id: { in: pageIds } }, select });
    users = pageIds.map((id) => rows.find((u) => u.id === id)!);
  } else {
    users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(query.page, query.pageSize), select });
    stats = await spentBy(users.map((u) => u.id));
  }
  const items = users.map((u) => ({
    ...u,
    role: u.role?.key ?? null,
    ordersCount: stats!.get(u.id)?.count ?? 0,
    totalSpent: stats!.get(u.id)?.spent ?? 0,
  }));
  return paged(items, total, query.page, query.pageSize);
});

r.get('/:id', { summary: 'Профиль покупателя с историей заказов', permission: 'customers.read', params: idParams }, async ({ params }) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true, createdAt: true, lastLoginAt: true,
      isBlocked: true, emailVerifiedAt: true, marketingOptIn: true, role: { select: { key: true } },
      addresses: true,
      orders: { orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, number: true, status: true, paymentStatus: true, total: true, createdAt: true } },
    },
  });
  if (!user) throw notFound('Пользователь не найден');
  const agg = await prisma.order.aggregate({ where: { userId: user.id, status: { in: PAID } }, _sum: { total: true }, _count: { _all: true } });
  return { ...user, role: user.role?.key ?? null, totalSpent: agg._sum.total ?? 0, paidOrders: agg._count._all };
});

r.patch('/:id/access', { summary: 'Блокировка и роль (роль — только Super Admin)', permission: 'customers.manage', params: idParams, body: userAccessSchema }, async ({ req, params, body }) => {
  if (params.id === req.user!.id) throw badRequest('Нельзя изменить доступ самому себе', 'SELF_ACCESS');
  const target = await prisma.user.findUnique({ where: { id: params.id }, include: { role: true } });
  if (!target) throw notFound('Пользователь не найден');
  const isSuper = req.user!.permissions.includes('staff.manage');
  if (body.role !== undefined && !isSuper) throw forbidden('Роли назначает только Super Admin');
  // Only a Super Admin may touch other staff accounts.
  if (target.role && !isSuper) throw forbidden('Доступ сотрудников меняет только Super Admin');
  if (target.role?.key === 'SUPER_ADMIN' && body.role !== undefined && body.role !== 'SUPER_ADMIN') {
    const supers = await prisma.user.count({ where: { role: { key: 'SUPER_ADMIN' }, isBlocked: false } });
    if (supers <= 1) throw conflict('Нельзя лишить роли последнего Super Admin', 'LAST_SUPER_ADMIN');
  }
  const role = body.role ? await prisma.role.findUniqueOrThrow({ where: { key: body.role } }) : null;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { isBlocked: body.isBlocked, roleId: body.role === undefined ? undefined : (role?.id ?? null) },
    });
    // Access changes take effect immediately: end the user's sessions.
    if (body.isBlocked || body.role !== undefined) await tx.session.deleteMany({ where: { userId: target.id } });
    await audit(req, 'user.access', 'User', target.id, { email: target.email, before: { role: target.role?.key ?? null, isBlocked: target.isBlocked }, after: body }, tx);
  });
  return { ok: true };
});

r.post('/staff', { summary: 'Создать сотрудника (только Super Admin)', permission: 'staff.manage', body: staffCreateSchema, status: 201 }, async ({ req, body }) => {
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict('Пользователь с таким email уже существует', 'EMAIL_TAKEN');
  const role = await prisma.role.findUniqueOrThrow({ where: { key: body.role } });
  const user = await prisma.user.create({
    data: { email: body.email, firstName: body.firstName, lastName: body.lastName, passwordHash: await hashPassword(body.password), roleId: role.id, emailVerifiedAt: new Date() },
  });
  await audit(req, 'staff.create', 'User', user.id, { email: user.email, role: body.role });
  return { id: user.id };
});

r.get('/roles/list', { summary: 'Роли и их права', permission: 'customers.read' }, async () =>
  (await prisma.role.findMany({ include: { permissions: { include: { permission: true } } } })).map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    permissions: r.permissions.map((p) => p.permission.key),
  })),
);

export const auditQuery = z.object({
  action: z.string().max(60).optional(),
  actorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

r.get('/audit/log', { summary: 'Журнал действий администраторов', permission: 'audit.read', query: auditQuery }, async ({ query }) => {
  const where: Prisma.AuditLogWhereInput = { action: query.action ? { startsWith: query.action } : undefined, actorId: query.actorId };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...paginate(query.page, 50), include: { actor: { select: { email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return paged(items, total, query.page, 50);
});
