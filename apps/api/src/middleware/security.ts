import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { randomToken, safeEqual } from '../lib/crypto';
import { CSRF_COOKIE, setCookie } from '../lib/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Called by payment providers, authenticated by signature instead of CSRF tokens. */
const CSRF_EXEMPT = ['/api/v1/webhooks/', '/api/v1/payments/mock/'];

/**
 * Double-submit CSRF protection: a readable cookie must be echoed in X-CSRF-Token.
 * A cross-site page can make the browser send cookies but cannot read them to set the header.
 */
export const csrf: RequestHandler = (req, res, next) => {
  let token = req.cookies?.[CSRF_COOKIE] as string | undefined;
  if (!token) {
    token = randomToken(24);
    setCookie(res, CSRF_COOKIE, token, 1000 * 60 * 60 * 24 * 30, false);
  }
  const fullPath = req.baseUrl + req.path;
  if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT.some((p) => fullPath.startsWith(p))) return next();

  const origin = req.get('origin');
  if (origin && origin !== env.APP_URL && origin !== env.API_URL)
    return next(new AppError(403, 'CSRF_ORIGIN', 'Недопустимый источник запроса'));

  const header = req.get('x-csrf-token');
  if (!header || !req.cookies?.[CSRF_COOKIE] || !safeEqual(header, req.cookies[CSRF_COOKIE]))
    return next(new AppError(403, 'CSRF_INVALID', 'Сессия устарела, обновите страницу'));
  next();
};

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
    },
  });

export const apiLimiter = limiter(60_000, 600, 'Слишком много запросов, попробуйте позже');
export const authLimiter = limiter(15 * 60_000, 20, 'Слишком много попыток. Повторите через 15 минут');
export const checkoutLimiter = limiter(10 * 60_000, 30, 'Слишком много попыток оформления заказа');
export const searchLimiter = limiter(60_000, 120, 'Слишком много поисковых запросов');
