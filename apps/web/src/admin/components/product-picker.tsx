import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { useDebounce } from '@/hooks/common';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/utils';
import { ak } from '../lib';
import type { AdminProductRow } from '../types';
import { SearchInput } from './inputs';

type Lite = Pick<AdminProductRow, 'id' | 'name' | 'image' | 'status'>;

/** Names/images for already selected ids (the API has no "by ids" endpoint, so read the catalogue in pages of 100). */
function useProductIndex() {
  return useQuery({
    queryKey: ['admin', 'products', 'index'],
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, Lite>();
      for (let page = 1; page <= 20; page++) {
        const r = await api.get<Paginated<AdminProductRow>>('/admin/products', { page, pageSize: 100, sort: 'name' });
        r.items.forEach((p) => map.set(p.id, p));
        if (page >= r.pageCount) break;
      }
      return map;
    },
  });
}

export function ProductPicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const [q, setQ] = useState('');
  const debounced = useDebounce(q, 250);
  const index = useProductIndex();
  const search = useQuery({
    queryKey: ak.products({ q: debounced, pageSize: 10, picker: true }),
    queryFn: () => api.get<Paginated<AdminProductRow>>('/admin/products', { q: debounced, pageSize: 10, sort: 'name' }),
    enabled: debounced.length >= 2,
    placeholderData: keepPreviousData,
  });

  const move = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {!disabled && (
        <div>
          <SearchInput value={q} onChange={setQ} placeholder="Найти товар по названию или SKU" label="Поиск товаров для коллекции" />
          {debounced.length >= 2 && (
            <div className="mt-1 max-h-60 overflow-y-auto border border-line">
              {search.isLoading ? (
                <div className="flex justify-center p-4 text-stone">
                  <Spinner />
                </div>
              ) : !search.data?.items.length ? (
                <p className="p-3 text-xs text-stone">Ничего не найдено</p>
              ) : (
                <ul className="divide-y divide-line">
                  {search.data.items.map((p) => {
                    const added = value.includes(p.id);
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="h-10 w-8 shrink-0 bg-mist">{p.image && <img src={imageUrl(p.image, 64)} alt="" className="size-full object-cover" />}</div>
                        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={added ? 'ghost' : 'outline'}
                          disabled={added || value.length >= 200}
                          onClick={() => onChange([...value, p.id])}
                          aria-label={added ? `${p.name} уже в коллекции` : `Добавить ${p.name}`}
                        >
                          {added ? 'Добавлен' : <Plus />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <p className="label mb-2 text-stone">В коллекции: {value.length}</p>
        {value.length === 0 ? (
          <p className="border border-dashed border-line p-4 text-center text-xs text-stone">Товары не выбраны</p>
        ) : (
          <ol className="divide-y divide-line border border-line">
            {value.map((id, i) => {
              const p = index.data?.get(id);
              return (
                <li key={id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-5 text-2xs text-stone tabular-nums">{i + 1}</span>
                  <div className="h-10 w-8 shrink-0 bg-mist">{p?.image && <img src={imageUrl(p.image, 64)} alt="" className="size-full object-cover" />}</div>
                  <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? (index.isLoading ? 'Загрузка…' : `Товар ${id.slice(-6)}`)}</span>
                  {!disabled && (
                    <div className="flex shrink-0">
                      <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Выше">
                        <ArrowUp />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label="Ниже">
                        <ArrowDown />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Убрать ${p?.name ?? 'товар'}`}>
                        <X />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
