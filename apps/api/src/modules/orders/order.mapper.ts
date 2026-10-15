import type { OrderDTO, OrderSummaryDTO, PaymentProviderKey } from '@silt/shared';
import { Prisma } from '../../lib/prisma';

export const orderInclude = {
  items: true,
  shipment: true,
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderDTO(o: OrderFull): OrderDTO {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    email: o.email,
    phone: o.phone,
    firstName: o.firstName,
    lastName: o.lastName,
    deliveryMethodName: o.deliveryMethodName,
    shippingAddress: (o.shippingAddress as Record<string, string> | null) ?? null,
    pickupPointName: o.pickupPointName,
    currency: o.currency,
    subtotal: o.subtotal,
    discountTotal: o.discountTotal,
    shippingTotal: o.shippingTotal,
    taxTotal: o.taxTotal,
    total: o.total,
    paymentProvider: o.paymentProvider as PaymentProviderKey,
    reservationExpiresAt: o.reservationExpiresAt?.toISOString() ?? null,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productSlug: i.productSlug,
      productName: i.productName,
      sku: i.sku,
      size: i.size,
      color: i.color,
      imageUrl: i.imageUrl,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discount: i.discount,
      lineTotal: i.lineTotal,
      variantId: i.variantId,
    })),
    shipment: o.shipment
      ? {
          status: o.shipment.status,
          carrier: o.shipment.carrier,
          trackingNumber: o.shipment.trackingNumber,
          trackingUrl: o.shipment.trackingUrl,
          shippedAt: o.shipment.shippedAt?.toISOString() ?? null,
          deliveredAt: o.shipment.deliveredAt?.toISOString() ?? null,
        }
      : null,
    statusHistory: o.statusHistory.map((h) => ({ toStatus: h.toStatus, comment: h.comment, createdAt: h.createdAt.toISOString() })),
    canPay:
      ['CREATED', 'AWAITING_PAYMENT'].includes(o.status) &&
      (!o.reservationExpiresAt || o.reservationExpiresAt > new Date()),
  };
}

export function toOrderSummary(o: Prisma.OrderGetPayload<{ include: { items: true } }>): OrderSummaryDTO {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: o.total,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    createdAt: o.createdAt.toISOString(),
    images: o.items.map((i) => i.imageUrl).filter((u): u is string => !!u).slice(0, 4),
  };
}
