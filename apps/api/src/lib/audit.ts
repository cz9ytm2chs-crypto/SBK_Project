import type { Request } from 'express';
import { Prisma, prisma, type Tx } from './prisma';

/** Records a staff action. Pass `tx` to make the log part of the same transaction. */
export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  data?: unknown,
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      actorId: req.user?.id ?? null,
      action,
      entityType,
      entityId,
      data: data === undefined ? Prisma.JsonNull : (data as Prisma.InputJsonValue),
      ip: req.ip,
    },
  });
}
