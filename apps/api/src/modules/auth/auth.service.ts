import type { Request, Response } from 'express';
import type { LoginInput } from '@silt/shared';
import { env } from '../../config/env';
import { AppError, badRequest, conflict } from '../../lib/errors';
import { fakeVerify, hashPassword, randomToken, sha256, verifyPassword } from '../../lib/crypto';
import { prisma } from '../../lib/prisma';
import { mergeGuestCart } from '../cart/cart.service';
import { enqueueEmail } from '../email/email.service';
import { createSession, toSessionUser, userWithRole } from './session.service';

const VERIFY_TTL = 24 * 60 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;

async function issueToken(userId: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET', ttl: number) {
  // Only one live token of each type per user.
  await prisma.verificationToken.deleteMany({ where: { userId, type } });
  const token = randomToken();
  await prisma.verificationToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttl) },
  });
  return token;
}

async function consumeToken(token: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
  const row = await prisma.verificationToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date())
    throw badRequest('Ссылка недействительна или устарела', 'TOKEN_INVALID');
  await prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export async function sendVerification(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return;
  const token = await issueToken(userId, 'EMAIL_VERIFY', VERIFY_TTL);
  await enqueueEmail(user.email, 'verify_email', {
    firstName: user.firstName,
    url: `${env.APP_URL}/verify-email?token=${token}`,
  });
}

export async function register(
  req: Request,
  res: Response,
  input: { email: string; password: string; firstName: string; lastName: string; marketingOptIn: boolean },
) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict('Пользователь с таким email уже зарегистрирован', 'EMAIL_TAKEN');
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      marketingOptIn: input.marketingOptIn,
    },
  });
  await sendVerification(user.id);
  await mergeGuestCart(req, res, user.id);
  await createSession(req, res, user.id);
  return me(user.id);
}

export async function login(req: Request, res: Response, input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    await fakeVerify(input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
  }
  if (!(await verifyPassword(user.passwordHash, input.password)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Неверный email или пароль');
  if (user.isBlocked) throw new AppError(403, 'ACCOUNT_BLOCKED', 'Аккаунт заблокирован. Свяжитесь с поддержкой');
  await mergeGuestCart(req, res, user.id);
  await createSession(req, res, user.id);
  return me(user.id);
}

export async function me(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userWithRole });
  return toSessionUser(user);
}

export async function verifyEmail(token: string) {
  const userId = await consumeToken(token, 'EMAIL_VERIFY');
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

/** Always answers the same way so the endpoint cannot be used to discover accounts. */
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.isBlocked) return;
  const token = await issueToken(user.id, 'PASSWORD_RESET', RESET_TTL);
  await enqueueEmail(user.email, 'password_reset', {
    firstName: user.firstName,
    url: `${env.APP_URL}/reset-password?token=${token}`,
  });
}

export async function resetPassword(token: string, password: string) {
  const userId = await consumeToken(token, 'PASSWORD_RESET');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } }),
    // Resetting the password signs out every device.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}

export async function changePassword(userId: string, sessionId: string | undefined, current: string, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(user.passwordHash, current)))
    throw badRequest('Текущий пароль указан неверно', 'INVALID_PASSWORD');
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } }),
  ]);
}
