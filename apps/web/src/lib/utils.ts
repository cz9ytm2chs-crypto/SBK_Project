import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMoney } from '@silt/shared';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const money = (minor: number) => formatMoney(minor);

/**
 * Responsive image URL. Unsplash (imgix) URLs are resized on their CDN; uploaded files
 * are already optimised WebP and returned unchanged.
 */
export function imageUrl(url: string | null | undefined, width: number, ratio = 1.25) {
  if (!url) return '';
  if (!url.includes('images.unsplash.com')) return url;
  const u = new URL(url);
  u.searchParams.set('w', String(width));
  u.searchParams.set('h', String(Math.round(width * ratio)));
  u.searchParams.set('auto', 'format');
  return u.toString();
}

export function srcSet(url: string | null | undefined, widths: number[], ratio = 1.25) {
  if (!url?.includes('images.unsplash.com')) return undefined;
  return widths.map((w) => `${imageUrl(url, w, ratio)} ${w}w`).join(', ');
}

/** Russian plural: plural(5, ['товар', 'товара', 'товаров']). */
export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export const formatDate = (iso: string | Date, withTime = false) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(iso));

export const formatDateShort = (iso: string | Date) =>
  new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export function randomKey() {
  return crypto.randomUUID().replace(/-/g, '');
}
