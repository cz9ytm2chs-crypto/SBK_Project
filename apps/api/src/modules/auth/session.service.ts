import type { Request, Response } from 'express';
import type { Permission, RoleKey, SessionUser } from '@silt/shared';
import { env } from '../../config/env';
import { Prisma, prisma } from '../../lib/prisma';
import { randomToken, sha256 } from '../../lib/crypto';
import { SESSION_COOKIE, clearCookie, setCookie } from '../../lib/cookies';

const ttlMs = () => env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const ROLLING_UPDATE_MS = 60 * 60 * 1000;

export const userWithRole = {
  role: { include: { permissions: { include: { permission: true } } } },
} as const;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRole }>;

export function toSessionUser(user: NonNullable<UserWithRole>): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    emailVerified: !!user.emailVerifiedAt,
    marketingOptIn: user.marketingOptIn,
    role: (user.role?.key as RoleKey) ?? null,
    permissions: (user.role?.permissions.map((rp) => rp.permission.key) ?? []) as Permission[],
  };
}

export async function createSession(req: Request, res: Response, userId: string) {
  const token = randomToken();
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      userAgent: req.get('user-agent')?.slice(0, 300),
      ip: req.ip,
      expiresAt: new Date(Date.now() + ttlMs()),
    },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  setCookie(res, SESSION_COOKIE, token, ttlMs());
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  clearCookie(res, SESSION_COOKIE);
}

/** Resolves the session cookie into req.user. Invalid / expired sessions are cleared. */
export async function resolveSession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token || typeof token !== 'string') return;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: userWithRole } },
  });
  if (!session || session.expiresAt < new Date() || session.user.isBlocked) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    clearCookie(res, SESSION_COOKIE);
    return;
  }
  // Rolling expiry, written at most once an hour per session.
  if (Date.now() - session.lastSeenAt.getTime() > ROLLING_UPDATE_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + ttlMs()) },
    });
    setCookie(res, SESSION_COOKIE, token, ttlMs());
  }
  req.user = toSessionUser(session.user);
  req.sessionId = session.id;
}
