import { Router } from 'express';
import {
  adminOrderQuerySchema,
  nextStaffStatuses,
  orderNoteSchema,
  orderStatusChangeSchema,
  refundSchema,
  shipmentUpdateSchema,
  type OrderStatus,
} from '@silt/shared';
import { audit } from '../../lib/audit';
import { invalidateCatalog } from '../../lib/cache';
import { conflict, forbidden, notFound } from '../../lib/errors';
import { paged, paginate } from '../../lib/pagination';
import { Prisma, prisma } from '../../lib/prisma';
import { createRoutes, idParams } from '../../lib/route';
import { retryEmail } from '../email/email.service';
import * as inventory from '../inventory/inventory.service';
import { orderInclude, toOrderDTO } from '../orders/order.mapper';
import { transitionOrder } from '../orders/order-state';
import { refundOrder, syncOrderPayments } from '../payments/payments.service';

export const adminOrdersRouter = Router();
const r = createRoutes(adminOrdersRouter, '/admin/orders', 'Админ: заказы');

r.get('/', { summary: 'Заказы: поиск по номеру/email/имени, фильтры', permission: 'orders.read', query: adminOrderQuerySchema }, async ({ query }) => {
  const where: Prisma.OrderWhereInput = {
    status: query.status,
    paymentStatus: query.paymentStatus as Prisma.EnumPaymentStatusFilter['equals'],
    createdAt: query.dateFrom || query.dateTo ? { gte: query.dateFrom, lte: query.dateTo } : undefined,
    total: query.minTotal !== undefined || query.maxTotal !== undefined
      ? { gte: query.minTotal !== undefined ? query.minTotal * 100 : undefined, lte: query.maxTotal !== undefined ? query.maxTotal * 100 : undefined }
      : undefined,
  };
  if (query.q) {
    const q = query.q;
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
    ];
  }
  const [items, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...paginate(query.page, query.pageSize),
      select: {
        id: true, number: true, status: true, paymentStatus: true, total: true, createdAt: true,
        firstName: true, lastName: true, email: true, deliveryMethodName: true, paymentProvider: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return {
    ...paged(items, total, query.page, query.pageSize),
    statusCounts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  };
});

r.get('/:id', { summary: 'Заказ: состав, клиент, доставка, платежи, история, заметки', permission: 'orders.read', params: idParams }, async ({ params }) => {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      ...orderInclude,
      statusHistory: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { email: true, firstName: true } } } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { email: true, firstName: true } } } },
      payments: { orderBy: { createdAt: 'desc' }, include: { events: { orderBy: { createdAt: 'desc' }, select: { id: true, type: true, createdAt: true, processedAt: true, error: true } }, refunds: true } },
      movements: { orderBy: { createdAt: 'asc' }, include: { variant: { select: { sku: true } } } },
      user: { select: { id: true, email: true, createdAt: true } },
    },
  });
  if (!order) throw notFound('Заказ не найден');
  const emails = await prisma.emailJob.findMany({ where: { payload: { path: ['number'], equals: order.number } }, orderBy: { createdAt: 'desc' } });
  return {
    ...toOrderDTO(order),
    customerComment: order.customerComment,
    user: order.user,
    nextStatuses: nextStaffStatuses(order.status as OrderStatus),
    history: order.statusHistory.map((h) => ({ id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, comment: h.comment, createdAt: h.createdAt, actor: h.actor ? h.actor.firstName || h.actor.email : 'Система' })),
    notes: order.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt, author: n.author ? n.author.firstName || n.author.email : 'Система' })),
    payments: order.payments.map((p) => ({
      id: p.id, provider: p.provider, providerPaymentId: p.providerPaymentId, status: p.status, amount: p.amount,
      refundedAmount: p.refundedAmount, failureReason: p.failureReason, createdAt: p.createdAt, events: p.events, refunds: p.refunds,
    })),
    movements: order.movements.map((m) => ({ id: m.id, type: m.type, sku: m.variant.sku, quantity: m.quantity, reason: m.reason, createdAt: m.createdAt })),
    emails: emails.map((e) => ({ id: e.id, subject: e.subject, status: e.status, attempts: e.attempts, lastError: e.lastError, createdAt: e.createdAt })),
  };
});

r.post('/:id/status', { summary: 'Изменить статус (по допустимым переходам)', permission: 'orders.update', params: idParams, body: orderStatusChangeSchema }, async ({ req, params, body }) => {
  if (body.status === 'CANCELLED' && !req.user!.permissions.includes('orders.cancel')) throw forbidden('Нет права отменять заказы');
  if (body.status === 'REFUNDED') throw conflict('Возврат оформляется через отдельное действие', 'USE_REFUND');
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: params.id }, include: { shipment: true } });
    if (!order) throw notFound('Заказ не найден');
    const data: Record<string, unknown> = {};
    if (body.status === 'CANCELLED') {
      await inventory.release(tx, order.id, 'RELEASED', 'Отмена администратором');
      Object.assign(data, { cancelledAt: new Date(), reservationExpiresAt: null, paymentStatus: 'CANCELLED' });
    }
    await transitionOrder(tx, order, body.status, 'staff', {
      actorId: req.user!.id,
      comment: body.comment,
      data,
      email: { trackingNumber: order.shipment?.trackingNumber, trackingUrl: order.shipment?.trackingUrl },
    });
    // Keep the shipment status consistent with the order status.
    const shipment = { PROCESSING: 'READY', SHIPPED: 'SHIPPED', DELIVERED: 'DELIVERED' }[body.status as string] as 'READY' | undefined;
    if (shipment && order.shipment)
      await tx.shipment.update({
        where: { orderId: order.id },
        data: {
          status: shipment,
          shippedAt: body.status === 'SHIPPED' ? new Date() : undefined,
          deliveredAt: body.status === 'DELIVERED' ? new Date() : undefined,
        },
      });
    await audit(req, 'order.status', 'Order', order.id, { number: order.number, from: order.status, to: body.status, comment: body.comment }, tx);
  });
  if (body.status === 'CANCELLED') {
    await syncOrderPayments(params.id);
    invalidateCatalog();
  }
  return { ok: true };
});

r.put('/:id/shipment', { summary: 'Данные отправления: перевозчик, трек-номер', permission: 'orders.update', params: idParams, body: shipmentUpdateSchema }, async ({ req, params, body }) => {
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) throw notFound('Заказ не найден');
  await prisma.shipment.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, carrier: body.carrier, trackingNumber: body.trackingNumber, trackingUrl: body.trackingUrl, status: body.status ?? 'PENDING' },
    update: { carrier: body.carrier, trackingNumber: body.trackingNumber, trackingUrl: body.trackingUrl, status: body.status },
  });
  await audit(req, 'order.shipment', 'Order', order.id, { number: order.number, ...body });
  return { ok: true };
});

r.post('/:id/refund', { summary: 'Возврат денежных средств через провайдера', permission: 'orders.refund', params: idParams, body: refundSchema }, async ({ req, params, body }) => {
  const result = await refundOrder(params.id, body, req.user!.id);
  await audit(req, 'order.refund', 'Order', params.id, body);
  return result;
});

r.post('/:id/sync-payment', { summary: 'Сверить статус оплаты с провайдером', permission: 'orders.read', params: idParams }, async ({ params }) => {
  await syncOrderPayments(params.id);
  return { ok: true };
});

r.post('/:id/notes', { summary: 'Внутренняя заметка', permission: 'orders.update', params: idParams, body: orderNoteSchema, status: 201 }, async ({ req, params, body }) => {
  const order = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!order) throw notFound('Заказ не найден');
  return prisma.orderNote.create({ data: { orderId: order.id, authorId: req.user!.id, body: body.body } });
});

r.post('/emails/:id/resend', { summary: 'Повторно отправить письмо', permission: 'orders.update', params: idParams }, async ({ req, params }) => {
  await retryEmail(params.id);
  await audit(req, 'email.resend', 'EmailJob', params.id);
  return { ok: true };
});
