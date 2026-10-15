import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Price, Table, Td, Th, Tr } from '@/components/ui/data';
import { useConfirm } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/disclosure';
import { Checkbox } from '@/components/ui/form';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn, imageUrl, plural } from '@/lib/utils';
import { ProductStatusBadge } from '../components/badges';
import { BulkDialog, type BulkKind } from '../components/bulk-dialog';
import { FilterSelect, SearchInput } from '../components/inputs';
import { ListFooter, PageHeader, QueryError, TableSkeleton } from '../components/page';
import { ak, useCan, useUrlState } from '../lib';
import type { AdminProductRow, ProductReferences } from '../types';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const can = useCan();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { sp, get, set, page } = useUrlState();
  const params = {
    q: get('q'),
    status: get('status'),
    categoryId: get('categoryId'),
    stock: get('stock'),
    sort: get('sort', 'updated'),
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useQuery({
    queryKey: ak.products(params),
    queryFn: () => api.get<Paginated<AdminProductRow>>('/admin/products', params),
    placeholderData: keepPreviousData,
  });
  const refs = useQuery({ queryKey: ak.references, queryFn: () => api.get<ProductReferences>('/admin/products/references'), staleTime: 5 * 60_000 });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkKind | null>(null);
  const filterKey = sp.toString();
  useEffect(() => {
    setSelected(new Set());
  }, [filterKey]);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ archived?: boolean; deleted?: boolean }>(`/admin/products/${id}`),
    onSuccess: (r) => {
      toast.success(r?.archived ? 'У товара есть продажи — он перенесён в архив' : 'Товар удалён');
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onDelete = async (p: AdminProductRow) => {
    const ok = await confirm({
      title: `Удалить «${p.name}»?`,
      description: 'Если товар уже продавался, он будет перенесён в архив, а история заказов сохранится.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) remove.mutate(p.id);
  };

  const items = list.data?.items ?? [];
  const allChecked = items.length > 0 && items.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(items.map((p) => p.id)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const hasFilters = !!(params.q || params.status || params.categoryId || params.stock);
  const canWrite = can('products.write');
  const canStock = can('inventory.write');
  const categories = refs.data?.categories ?? [];
  const parents = categories.filter((c) => !c.parentId);
  const categoryOptions = parents.flatMap((p) => [
    { value: p.id, label: p.name },
    ...categories.filter((c) => c.parentId === p.id).map((c) => ({ value: c.id, label: `— ${c.name}` })),
  ]);

  return (
    <>
      <Seo title="Товары" noindex />
      <PageHeader
        title="Товары"
        description={list.data ? `${list.data.total} ${plural(list.data.total, ['товар', 'товара', 'товаров'])}` : undefined}
        actions={
          canWrite && (
            <Button asChild>
              <Link to="/admin/products/new">
                <Plus /> Добавить товар
              </Link>
            </Button>
          )
        }
      />

      <div className="border border-line bg-paper">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={params.q} onChange={(q) => set({ q })} placeholder="Название, slug или SKU" />
          <FilterSelect
            label="Статус"
            value={params.status}
            onChange={(status) => set({ status })}
            options={[
              { value: 'PUBLISHED', label: 'Опубликованные' },
              { value: 'DRAFT', label: 'Черновики' },
              { value: 'ARCHIVED', label: 'Архив' },
            ]}
          />
          <FilterSelect label="Категория" value={params.categoryId} onChange={(categoryId) => set({ categoryId })} options={categoryOptions} />
          <FilterSelect
            label="Остаток"
            value={params.stock}
            onChange={(stock) => set({ stock })}
            options={[
              { value: 'low', label: 'Мало (≤ 3)' },
              { value: 'out', label: 'Нет в наличии' },
            ]}
          />
          <FilterSelect
            label="Сортировка"
            allLabel={null}
            value={params.sort}
            onChange={(sort) => set({ sort: sort === 'updated' ? null : sort })}
            options={[
              { value: 'updated', label: 'Сначала изменённые' },
              { value: 'name', label: 'По названию' },
              { value: 'price_asc', label: 'Сначала дешёвые' },
              { value: 'price_desc', label: 'Сначала дорогие' },
              { value: 'sales', label: 'По продажам' },
            ]}
          />
          {hasFilters && (
            <Button variant="link" size="sm" className="ml-1" onClick={() => set({ q: null, status: null, categoryId: null, stock: null })}>
              Сбросить
            </Button>
          )}
        </div>

        {selected.size > 0 && canWrite && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-mist/60 px-4 py-2.5" role="region" aria-label="Массовые действия">
            <span className="text-sm">
              Выбрано: <b className="tabular-nums">{selected.size}</b>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="primary">
                  Действия <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setBulk('price_percent')}>Изменить цену на %</DropdownMenuItem>
                <DropdownMenuItem disabled={!canStock} onSelect={() => setBulk('stock_set')}>
                  Установить остаток
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canStock} onSelect={() => setBulk('stock_add')}>
                  Добавить к остатку
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setBulk('status:PUBLISHED')}>Опубликовать</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBulk('status:DRAFT')}>Снять с публикации</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBulk('status:ARCHIVED')}>В архив</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Снять выделение
            </Button>
          </div>
        )}

        {list.isLoading ? (
          <TableSkeleton cols={6} />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={hasFilters ? 'Ничего не найдено' : 'Товаров пока нет'}
            description={hasFilters ? 'Измените условия поиска или сбросьте фильтры.' : 'Создайте первый товар каталога.'}
            action={
              !hasFilters &&
              canWrite && (
                <Button asChild>
                  <Link to="/admin/products/new">Добавить товар</Link>
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={cn('transition-opacity', list.isFetching && 'opacity-60')}>
              <Table>
                <thead>
                  <tr>
                    {canWrite && (
                      <Th className="w-10 pr-0">
                        <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Выбрать все на странице" />
                      </Th>
                    )}
                    <Th>Товар</Th>
                    <Th>Статус</Th>
                    <Th className="text-right">Цена</Th>
                    <Th className="text-right">Остаток</Th>
                    <Th>Метки</Th>
                    <Th className="w-24">
                      <span className="sr-only">Действия</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <Tr key={p.id} className={cn(selected.has(p.id) && 'bg-mist/60')}>
                      {canWrite && (
                        <Td className="pr-0">
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Выбрать «${p.name}»`} />
                        </Td>
                      )}
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-10 shrink-0 overflow-hidden bg-mist">
                            {p.image && <img src={imageUrl(p.image, 80)} alt="" loading="lazy" className="size-full object-cover" />}
                          </div>
                          <div className="min-w-0">
                            <Link to={`/admin/products/${p.id}/edit`} className="font-medium underline-offset-4 hover:underline">
                              {p.name}
                            </Link>
                            <p className="truncate text-xs text-stone">
                              {p.category}
                              {p.brand && ` · ${p.brand}`} · {p.variantCount} {plural(p.variantCount, ['вариация', 'вариации', 'вариаций'])}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <ProductStatusBadge status={p.status} />
                      </Td>
                      <Td className="text-right">
                        <Price price={p.price} compareAtPrice={p.compareAtPrice} className="justify-end" />
                      </Td>
                      <Td className="text-right tabular-nums">
                        <span className={cn(p.available === 0 ? 'text-danger' : p.available <= 3 ? 'text-warning' : undefined)}>{p.available}</span>
                        <span className="text-stone"> / {p.stock}</span>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {p.isNew && <Badge tone="outline">New</Badge>}
                          {p.isBestseller && <Badge tone="outline">Хит</Badge>}
                          {p.isFeatured && <Badge tone="outline">Витрина</Badge>}
                          {p.compareAtPrice && p.compareAtPrice > p.price && <Badge tone="accent">Скидка</Badge>}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Редактировать «${p.name}»`}>
                            <Link to={`/admin/products/${p.id}/edit`}>
                              <Pencil />
                            </Link>
                          </Button>
                          {can('products.delete') && (
                            <Button variant="ghost" size="icon-sm" onClick={() => onDelete(p)} aria-label={`Удалить «${p.name}»`} disabled={remove.isPending}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ListFooter total={list.data!.total} page={page} pageSize={PAGE_SIZE}>
              <Pagination page={page} pageCount={list.data!.pageCount} onChange={(p) => set({ page: p === 1 ? null : p })} />
            </ListFooter>
          </>
        )}
      </div>

      <BulkDialog kind={bulk} productIds={[...selected]} onClose={() => setBulk(null)} onDone={() => {
        setBulk(null);
        setSelected(new Set());
      }} />
    </>
  );
}
