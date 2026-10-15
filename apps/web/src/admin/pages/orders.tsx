import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Table, Td, Th, Tr } from '@/components/ui/data';
import { Input } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn, formatDateShort, money, plural } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge } from '../components/badges';
import { FilterSelect, SearchInput } from '../components/inputs';
import { ListFooter, PageHeader, QueryError, TableSkeleton } from '../components/page';
import { ak, fullName, useUrlState } from '../lib';
import type { AdminOrderList } from '../types';

const PAGE_SIZE = 20;

/** Local date (yyyy-mm-dd) → ISO bound covering the whole day. */
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

export default function OrdersPage() {
  const { get, set, page } = useUrlState();
  const f = {
    q: get('q'),
    status: get('status'),
    paymentStatus: get('paymentStatus'),
    dateFrom: get('dateFrom'),
    dateTo: get('dateTo'),
    minTotal: get('minTotal'),
    maxTotal: get('maxTotal'),
  };
  const params = {
    q: f.q,
    status: f.status,
    paymentStatus: f.paymentStatus,
    dateFrom: dayStart(f.dateFrom),
    dateTo: dayEnd(f.dateTo),
    // The API takes rubles here and converts to kopecks itself.
    minTotal: f.minTotal,
    maxTotal: f.maxTotal,
    page,
    pageSize: PAGE_SIZE,
  };
  const list = useQuery({
    queryKey: ak.orders(params),
    queryFn: () => api.get<AdminOrderList>('/admin/orders', params),
    placeholderData: keepPreviousData,
  });

  const hasFilters = Object.values(f).some(Boolean);
  const counts = list.data?.statusCounts ?? {};
  const allCount = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  const items = list.data?.items ?? [];

  const chip = (value: string, label: string, count?: number) => (
    <button
      key={value || 'all'}
      type="button"
      onClick={() => set({ status: value })}
      aria-pressed={f.status === value}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 border px-3 text-xs transition-colors',
        f.status === value ? 'border-ink bg-ink text-milk' : 'border-line bg-paper text-graphite hover:border-stone',
      )}
    >
      {label}
      {count !== undefined && <span className={cn('tabular-nums', f.status === value ? 'text-milk/70' : 'text-stone')}>{count}</span>}
    </button>
  );

  return (
    <>
      <Seo title="Заказы" noindex />
      <PageHeader title="Заказы" description={list.data ? `${list.data.total} ${plural(list.data.total, ['заказ', 'заказа', 'заказов'])}` : undefined} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="group" aria-label="Фильтр по статусу">
        {chip('', 'Все', allCount || undefined)}
        {ORDER_STATUSES.map((s) => chip(s, ORDER_STATUS_LABELS[s], counts[s] ?? 0))}
      </div>

      <div className="border border-line bg-paper">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={f.q} onChange={(q) => set({ q })} placeholder="Номер, email, имя или телефон" />
          <FilterSelect
            label="Оплата"
            value={f.paymentStatus}
            onChange={(paymentStatus) => set({ paymentStatus })}
            options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))}
          />
          <div className="flex items-center gap-1.5">
            <Input type="date" aria-label="Дата с" value={f.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} className="h-10 w-36 text-xs" />
            <span className="text-stone">—</span>
            <Input type="date" aria-label="Дата по" value={f.dateTo} onChange={(e) => set({ dateTo: e.target.value })} className="h-10 w-36 text-xs" />
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              inputMode="numeric"
              aria-label="Сумма от, ₽"
              placeholder="от ₽"
              value={f.minTotal}
              onChange={(e) => set({ minTotal: e.target.value.replace(/\D/g, '') })}
              className="h-10 w-24 text-xs"
            />
            <span className="text-stone">—</span>
            <Input
              inputMode="numeric"
              aria-label="Сумма до, ₽"
              placeholder="до ₽"
              value={f.maxTotal}
              onChange={(e) => set({ maxTotal: e.target.value.replace(/\D/g, '') })}
              className="h-10 w-24 text-xs"
            />
          </div>
          {hasFilters && (
            <Button
              variant="link"
              size="sm"
              className="ml-1"
              onClick={() => set({ q: null, status: null, paymentStatus: null, dateFrom: null, dateTo: null, minTotal: null, maxTotal: null })}
            >
              Сбросить
            </Button>
          )}
        </div>

        {list.isLoading ? (
          <TableSkeleton cols={6} />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title={hasFilters ? 'Заказы не найдены' : 'Заказов пока нет'}
            description={hasFilters ? 'Измените условия поиска или сбросьте фильтры.' : 'Здесь появятся заказы покупателей.'}
          />
        ) : (
          <>
            <div className={cn('transition-opacity', list.isFetching && 'opacity-60')}>
              <Table>
                <thead>
                  <tr>
                    <Th>Заказ</Th>
                    <Th>Покупатель</Th>
                    <Th>Статус</Th>
                    <Th>Оплата</Th>
                    <Th>Доставка</Th>
                    <Th className="text-right">Сумма</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <Tr key={o.id}>
                      <Td>
                        <Link to={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                          {o.number}
                        </Link>
                        <p className="text-xs text-stone">{formatDateShort(o.createdAt)}</p>
                      </Td>
                      <Td>
                        <p>{fullName(o)}</p>
                        <p className="text-xs text-stone">{o.email}</p>
                      </Td>
                      <Td>
                        <OrderStatusBadge status={o.status} />
                      </Td>
                      <Td>
                        <PaymentStatusBadge status={o.paymentStatus} />
                        <p className="mt-0.5 text-2xs text-stone">{o.paymentProvider}</p>
                      </Td>
                      <Td className="text-xs text-graphite">{o.deliveryMethodName}</Td>
                      <Td className="text-right">
                        <span className="tabular-nums">{money(o.total)}</span>
                        <p className="text-xs text-stone">
                          {o._count.items} {plural(o._count.items, ['позиция', 'позиции', 'позиций'])}
                        </p>
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
    </>
  );
}
