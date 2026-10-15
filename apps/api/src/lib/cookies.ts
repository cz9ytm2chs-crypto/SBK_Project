import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE = 'silt_sid';
export const CSRF_COOKIE = 'silt_csrf';
export const CART_COOKIE = 'silt_cart';

export const baseCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
});

export function setCookie(res: Response, name: string, value: string, maxAgeMs: number, httpOnly = true) {
  res.cookie(name, value, { ...baseCookie(), httpOnly, maxAge: maxAgeMs });
}

export function clearCookie(res: Response, name: string) {
  res.clearCookie(name, { ...baseCookie() });
}
