import { Check, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { CategoryDTO, FacetsDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem } from '@/components/ui/disclosure';
import { Checkbox, Switch } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { useCatalogParams } from './use-catalog-params';

type Catalog = ReturnType<typeof useCatalogParams>;

export function FiltersPanel({ facets, catalog, categories, activeCategory }: { facets?: FacetsDTO; catalog: Catalog; categories?: CategoryDTO[]; activeCategory?: string }) {
  const { filters, toggle, update } = catalog;
  return (
    <div>
      {!!categories?.length && (
        <nav aria-label="Категории" className="mb-6 border-b border-line pb-6">
          <p className="label mb-3 text-stone">Категории</p>
          <ul className="space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className={cn('flex justify-between hover:text-ink', activeCategory === c.slug ? 'font-medium text-ink' : 'text-graphite')}>
                  {c.name}
                  <span className="text-xs text-stone">{c.productCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Accordion type="multiple" defaultValue={['sizes', 'colors', 'price', 'brands']}>
        {!!facets?.sizes.length && (
          <AccordionItem value="sizes" title={<FilterTitle count={filters.sizes.length}>Размер</FilterTitle>}>
            <div className="flex flex-wrap gap-2">
              {facets.sizes.map((s) => {
                const on = filters.sizes.includes(s.label);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle('sizes', s.label)}
                    className={cn('h-9 min-w-11 rounded-xs border px-3 text-xs transition-colors', on ? 'border-ink bg-ink text-milk' : 'border-line hover:border-ink')}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </AccordionItem>
        )}
        {!!facets?.colors.length && (
          <AccordionItem value="colors" title={<FilterTitle count={filters.colors.length}>Цвет</FilterTitle>}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {facets.colors.map((c) => {
                const on = filters.colors.includes(c.slug);
                return (
                  <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle('colors', c.slug)} className="flex items-center gap-2.5 text-left text-sm">
                    <span className={cn('flex size-5 items-center justify-center rounded-full ring-1 ring-ink/15 ring-offset-2 ring-offset-paper', on && 'ring-2 ring-ink')} style={{ backgroundColor: c.hex }}>
                      {on && <Check className={cn('size-3', isLight(c.hex) ? 'text-ink' : 'text-white')} strokeWidth={3} />}
                    </span>
                    <span className={on ? 'text-ink' : 'text-graphite'}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </AccordionItem>
        )}
        {facets && facets.price.max > 0 && (
          <AccordionItem value="price" title={<FilterTitle count={filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0}>Цена, ₽</FilterTitle>}>
            <PriceFilter key={`${filters.minPrice}-${filters.maxPrice}`} min={filters.minPrice} max={filters.maxPrice} bounds={facets.price} onApply={(minPrice, maxPrice) => update({ minPrice, maxPrice })} />
          </AccordionItem>
        )}
        {!!facets?.brands.length && (
          <AccordionItem value="brands" title={<FilterTitle count={filters.brands.length}>Бренд</FilterTitle>}>
            <div className="space-y-2.5">
              {facets.brands.map((b) => (
                <label key={b.id} className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={filters.brands.includes(b.slug)} onCheckedChange={() => toggle('brands', b.slug)} />
                  <span className="flex-1">{b.name}</span>
                  <span className="text-xs text-stone">{b.count}</span>
                </label>
              ))}
            </div>
          </AccordionItem>
        )}
      </Accordion>
      <div className="space-y-4 pt-5">
        <label className="flex cursor-pointer items-center justify-between text-sm">
          Только в наличии
          <Switch checked={filters.inStock} onCheckedChange={(v) => update({ inStock: v })} />
        </label>
        <label className="flex cursor-pointer items-center justify-between text-sm">
          Со скидкой
          <Switch checked={filters.onSale} onCheckedChange={(v) => update({ onSale: v })} />
        </label>
      </div>
    </div>
  );
}

function FilterTitle({ children, count }: { children: ReactNode; count: number }) {
  return (
    <span className="flex items-center gap-2">
      {children}
      {count > 0 && <span className="flex size-4.5 items-center justify-center rounded-full bg-ink text-[10px] text-milk">{count}</span>}
    </span>
  );
}

function PriceFilter({ min, max, bounds, onApply }: { min?: number; max?: number; bounds: { min: number; max: number }; onApply: (min?: number, max?: number) => void }) {
  const [from, setFrom] = useState(min?.toString() ?? '');
  const [to, setTo] = useState(max?.toString() ?? '');
  useEffect(() => {
    setFrom(min?.toString() ?? '');
    setTo(max?.toString() ?? '');
  }, [min, max]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = from ? Number(from) : undefined;
    const b = to ? Number(to) : undefined;
    onApply(a !== undefined && b !== undefined && a > b ? b : a, a !== undefined && b !== undefined && a > b ? a : b);
  };
  const input = 'h-10 w-full rounded-xs border border-line bg-paper px-3 text-sm outline-none focus:border-ink';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2">
        <input className={input} inputMode="numeric" aria-label="Цена от" placeholder={`от ${Math.floor(bounds.min / 100)}`} value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} />
        <span className="text-stone">—</span>
        <input className={input} inputMode="numeric" aria-label="Цена до" placeholder={`до ${Math.ceil(bounds.max / 100)}`} value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Button type="submit" size="sm" variant="outline" block>
        Применить
      </Button>
    </form>
  );
}

export function ActiveFilters({ catalog, facets }: { catalog: Catalog; facets?: FacetsDTO }) {
  const { filters, toggle, update, reset, activeCount } = catalog;
  if (!activeCount) return null;
  const chips: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.sizes.map((s) => ({ key: `s-${s}`, label: `Размер ${s}`, onRemove: () => toggle('sizes', s) })),
    ...filters.colors.map((c) => ({ key: `c-${c}`, label: facets?.colors.find((x) => x.slug === c)?.name ?? c, onRemove: () => toggle('colors', c) })),
    ...filters.brands.map((b) => ({ key: `b-${b}`, label: facets?.brands.find((x) => x.slug === b)?.name ?? b, onRemove: () => toggle('brands', b) })),
  ];
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    chips.push({ key: 'price', label: `${filters.minPrice ?? 0} – ${filters.maxPrice ?? '∞'} ₽`, onRemove: () => update({ minPrice: undefined, maxPrice: undefined }) });
  if (filters.inStock) chips.push({ key: 'stock', label: 'В наличии', onRemove: () => update({ inStock: false }) });
  if (filters.onSale) chips.push({ key: 'sale', label: 'Со скидкой', onRemove: () => update({ onSale: false }) });
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Активные фильтры">
      {chips.map((c) => (
        <button key={c.key} type="button" onClick={c.onRemove} className="flex h-8 items-center gap-1.5 rounded-full bg-mist pr-2.5 pl-3.5 text-xs transition-colors hover:bg-line" aria-label={`Убрать фильтр: ${c.label}`}>
          {c.label}
          <X className="size-3.5" />
        </button>
      ))}
      <button type="button" onClick={reset} className="ml-1 text-xs text-stone underline underline-offset-4 hover:text-ink">
        Сбросить всё
      </button>
    </div>
  );
}

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 186;
}
