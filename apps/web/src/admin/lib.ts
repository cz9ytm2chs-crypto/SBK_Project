import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { hasPermission, type Permission } from '@silt/shared';
import { ApiError, errorMessage } from '@/lib/api';
import { useMe } from '@/hooks/auth';

/** Query keys of the admin area (all prefixed so a logout can drop them at once). */
export const ak = {
  dashboard: (days: number) => ['admin', 'dashboard', days] as const,
  products: (params: unknown) => ['admin', 'products', params] as const,
  product: (id: string) => ['admin', 'product', id] as const,
  movements: (id: string) => ['admin', 'movements', id] as const,
  references: ['admin', 'references'] as const,
  orders: (params: unknown) => ['admin', 'orders', params] as const,
  order: (id: string) => ['admin', 'order', id] as const,
  customers: (params: unknown) => ['admin', 'customers', params] as const,
  customer: (id: string) => ['admin', 'customer', id] as const,
  roles: ['admin', 'roles'] as const,
  audit: (params: unknown) => ['admin', 'audit', params] as const,
  categories: ['admin', 'categories'] as const,
  brands: ['admin', 'brands'] as const,
  collections: ['admin', 'collections'] as const,
  banners: ['admin', 'banners'] as const,
  homeSections: ['admin', 'home-sections'] as const,
  pages: ['admin', 'pages'] as const,
  page: (slug: string) => ['admin', 'page', slug] as const,
  faq: ['admin', 'faq'] as const,
  reviews: (params: unknown) => ['admin', 'reviews', params] as const,
  settings: ['admin', 'settings'] as const,
  delivery: ['admin', 'delivery'] as const,
  emails: (params: unknown) => ['admin', 'emails', params] as const,
};

/** Permission check for the current staff user. UI hiding only — the API enforces everything. */
export function useCan() {
  const { data } = useMe();
  return useCallback((p: Permission) => hasPermission(data?.permissions, p), [data]);
}

export const isForbidden = (e: unknown) => e instanceof ApiError && e.status === 403;

/** Filters/pagination kept in the URL so the page can be shared and survives reloads. */
export function useUrlState() {
  const [sp, setSp] = useSearchParams();
  const get = useCallback((key: string, fallback = '') => sp.get(key) ?? fallback, [sp]);
  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === null || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          // Any filter change starts from the first page.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );
  const page = Math.max(1, Number(sp.get('page')) || 1);
  return { sp, get, set, page };
}

/** Rubles typed by staff ⇄ integer kopecks stored by the API. */
export const kopecksToRubles = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v / 100));
export function rublesToKopecks(text: string): number | null {
  const s = text.replace(/\s/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** "Футболка Heavyweight" → "futbolka-heavyweight". */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Puts server validation errors next to the matching fields and shows a toast. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>, fallback = 'Не удалось сохранить') {
  if (e instanceof ApiError) {
    const fields = Object.entries(e.fieldErrors);
    fields.forEach(([path, message]) => setError(path as Path<T>, { type: 'server', message }));
    toast.error(fields.length ? 'Проверьте выделенные поля' : e.message || fallback);
    return;
  }
  toast.error(errorMessage(e) || fallback);
}

export const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

export const fullName = (p: { firstName?: string | null; lastName?: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ') || '—';
