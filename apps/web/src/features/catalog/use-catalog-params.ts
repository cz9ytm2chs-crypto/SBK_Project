import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { SORT_OPTIONS, type SortOption } from '@silt/shared';

export interface CatalogFilters {
  q?: string;
  brands: string[];
  sizes: string[];
  colors: string[];
  minPrice?: number;
  maxPrice?: number;
  inStock: boolean;
  onSale: boolean;
  sort: SortOption;
  page: number;
}

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

/** All catalog state lives in the URL: shareable, survives reloads, back button works. */
export function useCatalogParams() {
  const [sp, setSp] = useSearchParams();

  const filters: CatalogFilters = useMemo(
    () => ({
      q: sp.get('q') ?? undefined,
      brands: list(sp.get('brands')),
      sizes: list(sp.get('sizes')),
      colors: list(sp.get('colors')),
      minPrice: num(sp.get('minPrice')),
      maxPrice: num(sp.get('maxPrice')),
      inStock: sp.get('inStock') === 'true',
      onSale: sp.get('onSale') === 'true',
      sort: (sp.get('sort') as SortOption) in SORT_OPTIONS ? (sp.get('sort') as SortOption) : 'popular',
      page: Math.max(1, num(sp.get('page')) ?? 1),
    }),
    [sp],
  );

  const update = useCallback(
    (patch: Partial<CatalogFilters>, opts: { keepPage?: boolean } = {}) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === false || v === '' || (Array.isArray(v) && v.length === 0)) next.delete(k);
            else next.set(k, Array.isArray(v) ? v.join(',') : String(v));
          }
          if (next.get('sort') === 'popular') next.delete('sort');
          // Any filter change starts from the first page.
          if (!opts.keepPage && !('page' in patch)) next.delete('page');
          if (next.get('page') === '1') next.delete('page');
          return next;
        },
        { preventScrollReset: true },
      );
    },
    [setSp],
  );

  const toggle = useCallback(
    (key: 'brands' | 'sizes' | 'colors', value: string) => {
      const cur = filters[key];
      update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
    },
    [filters, update],
  );

  const reset = useCallback(() => update({ brands: [], sizes: [], colors: [], minPrice: undefined, maxPrice: undefined, inStock: false, onSale: false }), [update]);

  const activeCount =
    filters.brands.length + filters.sizes.length + filters.colors.length + (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) + (filters.inStock ? 1 : 0) + (filters.onSale ? 1 : 0);

  return { filters, update, toggle, reset, activeCount };
}
