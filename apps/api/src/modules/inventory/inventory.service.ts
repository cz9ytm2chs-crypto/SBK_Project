import { AppError, badRequest } from '../../lib/errors';
import { Prisma, type Tx } from '../../lib/prisma';

export interface StockLine {
  variantId: string;
  quantity: number;
}

interface Row {
  stock: number;
  reserved: number;
}

/** Same lock order in every transaction prevents deadlocks between concurrent orders. */
const sorted = <T extends StockLine>(lines: T[]) => [...lines].sort((a, b) => a.variantId.localeCompare(b.variantId));

/**
 * Holds stock for an unpaid order. The conditional UPDATE is atomic: the row is locked and
 * `stock - reserved >= q` is re-checked after the lock, so parallel checkouts cannot oversell.
 * Must run inside a transaction — any failure rolls back all reservations of the order.
 */
export async function reserve(tx: Tx, orderId: string, lines: StockLine[], expiresAt: Date) {
  for (const line of sorted(lines)) {
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "ProductVariant"
      SET "reserved" = "reserved" + ${line.quantity}, "updatedAt" = NOW()
      WHERE "id" = ${line.variantId} AND "isActive" = true AND "stock" - "reserved" >= ${line.quantity}
      RETURNING "stock", "reserved"`);
    if (rows.length === 0)
      throw new AppError(409, 'OUT_OF_STOCK', 'Часть товаров закончилась, пока вы оформляли заказ', {
        variantId: line.variantId,
      });
    await tx.inventoryReservation.create({
      data: { orderId, variantId: line.variantId, quantity: line.quantity, expiresAt },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId: line.variantId,
        type: 'RESERVE',
        quantity: 0,
        stockAfter: rows[0].stock,
        reservedAfter: rows[0].reserved,
        orderId,
        reason: 'Резерв под заказ',
      },
    });
  }
}

/** Payment confirmed: reserved units leave the warehouse. */
export async function consume(tx: Tx, orderId: string) {
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: 'ACTIVE' } });
  for (const r of sorted(reservations)) {
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${r.quantity}, "reserved" = GREATEST("reserved" - ${r.quantity}, 0), "updatedAt" = NOW()
      WHERE "id" = ${r.variantId}
      RETURNING "stock", "reserved"`);
    await tx.inventoryReservation.update({ where: { id: r.id }, data: { status: 'CONSUMED' } });
    await tx.inventoryMovement.create({
      data: {
        variantId: r.variantId,
        type: 'SALE',
        quantity: -r.quantity,
        stockAfter: rows[0]?.stock ?? 0,
        reservedAfter: rows[0]?.reserved ?? 0,
        orderId,
        reason: 'Продажа',
      },
    });
  }
  return reservations.length;
}

/** Cancellation or payment timeout: return held units to free stock. */
export async function release(tx: Tx, orderId: string, status: 'RELEASED' | 'EXPIRED', reason: string) {
  const reservations = await tx.inventoryReservation.findMany({ where: { orderId, status: 'ACTIVE' } });
  for (const r of sorted(reservations)) {
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "ProductVariant"
      SET "reserved" = GREATEST("reserved" - ${r.quantity}, 0), "updatedAt" = NOW()
      WHERE "id" = ${r.variantId}
      RETURNING "stock", "reserved"`);
    await tx.inventoryReservation.update({ where: { id: r.id }, data: { status } });
    await tx.inventoryMovement.create({
      data: {
        variantId: r.variantId,
        type: 'RELEASE',
        quantity: 0,
        stockAfter: rows[0]?.stock ?? 0,
        reservedAfter: rows[0]?.reserved ?? 0,
        orderId,
        reason,
      },
    });
  }
  return reservations.length;
}

/**
 * Late payment for an order whose reservation already expired: try to take the stock directly.
 * Returns false when there is no longer enough stock (the payment must then be refunded).
 */
export async function takeDirect(tx: Tx, orderId: string, lines: StockLine[]) {
  for (const line of sorted(lines)) {
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "ProductVariant"
      SET "stock" = "stock" - ${line.quantity}, "updatedAt" = NOW()
      WHERE "id" = ${line.variantId} AND "stock" - "reserved" >= ${line.quantity}
      RETURNING "stock", "reserved"`);
    if (!rows.length) return false;
    await tx.inventoryMovement.create({
      data: {
        variantId: line.variantId,
        type: 'SALE',
        quantity: -line.quantity,
        stockAfter: rows[0].stock,
        reservedAfter: rows[0].reserved,
        orderId,
        reason: 'Продажа (оплата после истечения резерва)',
      },
    });
  }
  return true;
}

/** Returned goods go back on the shelf. */
export async function restock(tx: Tx, orderId: string, lines: StockLine[], actorId: string | null) {
  for (const line of sorted(lines)) {
    const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
      UPDATE "ProductVariant" SET "stock" = "stock" + ${line.quantity}, "updatedAt" = NOW()
      WHERE "id" = ${line.variantId}
      RETURNING "stock", "reserved"`);
    if (!rows.length) continue; // variant deleted since the sale
    await tx.inventoryMovement.create({
      data: {
        variantId: line.variantId,
        type: 'RETURN',
        quantity: line.quantity,
        stockAfter: rows[0].stock,
        reservedAfter: rows[0].reserved,
        orderId,
        actorId,
        reason: 'Возврат товара',
      },
    });
  }
}

/** Manual stock correction from the admin panel. Cannot go below what is already reserved. */
export async function setStock(tx: Tx, variantId: string, stock: number, actorId: string | null, reason: string) {
  const current = await tx.$queryRaw<Row[]>(Prisma.sql`
    SELECT "stock", "reserved" FROM "ProductVariant" WHERE "id" = ${variantId} FOR UPDATE`);
  if (!current.length) throw badRequest('Вариация не найдена', 'NOT_FOUND');
  if (stock < current[0].reserved)
    throw badRequest(
      `Остаток не может быть меньше зарезервированного (${current[0].reserved} шт.)`,
      'STOCK_BELOW_RESERVED',
    );
  const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
    UPDATE "ProductVariant" SET "stock" = ${stock}, "updatedAt" = NOW()
    WHERE "id" = ${variantId} RETURNING "stock", "reserved"`);
  const delta = stock - current[0].stock;
  if (delta !== 0)
    await tx.inventoryMovement.create({
      data: {
        variantId,
        type: delta > 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantity: delta,
        stockAfter: rows[0].stock,
        reservedAfter: rows[0].reserved,
        actorId,
        reason: reason || (delta > 0 ? 'Поступление' : 'Корректировка'),
      },
    });
}
