import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router';
import { Skeleton } from '@/components/ui/misc';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { useMe } from '@/hooks/auth';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn, formatDateShort, money } from '@/lib/utils';
import { OrderStatusBadge } from '../components/badges';
import { AccessDenied, PageHeader, Panel, QueryError } from '../components/page';
import { RevenueChart } from '../components/revenue-chart';
import { StatCard, StatCardSkeleton } from '../components/stat-card';
import { visibleNav } from '../layout';
import { ak, fullName, useCan, useUrlState } from '../lib';
import type { DashboardData } from '../types';

const PERIODS = [7, 30, 90] as const;

export default function DashboardPage() {
  const can = useCan();
  const { data: me } = useMe();
  const { get, set } = useUrlState();
  const days = PERIODS.includes(Number(get('days')) as 7) ? Number(get('days')) : 30;
  const q = useQuery({
    queryKey: ak.dashboard(days),
    queryFn: () => api.get<DashboardData>('/admin/dashboard', { days }),
    enabled: can('dashboard.view'),
    placeholderData: (prev) => prev,
  });

  // Staff without dashboard access land on their first available section.
  if (!can('dashboard.view')) {
    const first = visibleNav(me?.permissions).find((i) => i.to !== '/admin');
    return first ? <Navigate to={first.to} replace /> : <AccessDenied />;
  }

  const d = q.data;
  return (
    <>
      <Seo title="Дашборд" noindex />
      <PageHeader
        title="Дашборд"
        description={`Оплаченные заказы за последние ${days} дней в сравнении с предыдущим периодом`}
        actions={
          <div role="group" aria-label="Период" className="inline-flex border border-line bg-paper">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set({ days: p === 30 ? null : p })}
                aria-pressed={days === p}
                className={cn('label h-9 px-4 transition-colors', days === p ? 'bg-ink text-milk' : 'text-graphite hover:bg-mist')}
              >
                {p} дней
              </button>
            ))}
          </div>
        }
      />

      {q.isError && !d ? (
        <Panel>
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : (
        <div className={cn('space-y-6 transition-opacity', q.isFetching && d && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {!d ? (
              Array.from({ length: 5 }, (_, i) => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard label="Выручка" value={money(d.current.revenue)} current={d.current.revenue} previous={d.previous.revenue} />
                <StatCard label="Заказы" value={d.current.orders.toLocaleString('ru-RU')} current={d.current.orders} previous={d.previous.orders} />
                <StatCard label="Средний чек" value={money(d.current.averageOrder)} current={d.current.averageOrder} previous={d.previous.averageOrder} />
                <StatCard label="Новые покупатели" value={d.current.newCustomers.toLocaleString('ru-RU')} current={d.current.newCustomers} previous={d.previous.newCustomers} />
                <StatCard label="Всего покупателей" value={d.totalCustomers.toLocaleString('ru-RU')} hint="зарегистрированные аккаунты" />
              </>
            )}
          </div>

          <Panel title="Выручка по дням, ₽">{d ? <RevenueChart data={d.series} /> : <Skeleton className="h-72 w-full" />}</Panel>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <Panel
              title="Последние заказы"
              bodyClassName="p-0"
              actions={
                can('orders.read') && (
                  <Link to="/admin/orders" className="label text-stone hover:text-ink">
                    Все заказы →
                  </Link>
                )
              }
            >
              {!d ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : d.recentOrders.length === 0 ? (
                <p className="p-5 text-sm text-stone">Заказов пока нет.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Заказ</Th>
                      <Th>Покупатель</Th>
                      <Th>Статус</Th>
                      <Th className="text-right">Сумма</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentOrders.map((o) => (
                      <Tr key={o.id}>
                        <Td>
                          <Link to={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                            {o.number}
                          </Link>
                          <p className="text-xs text-stone">{formatDateShort(o.createdAt)}</p>
                        </Td>
                        <Td>{fullName(o)}</Td>
                        <Td>
                          <OrderStatusBadge status={o.status} />
                        </Td>
                        <Td className="text-right tabular-nums">{money(o.total)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>

            <div className="space-y-6">
              <Panel title="Топ товаров за период">
                {!d ? (
                  <Skeleton className="h-32 w-full" />
                ) : d.topProducts.length === 0 ? (
                  <p className="text-sm text-stone">Продаж за период нет.</p>
                ) : (
                  <ol className="space-y-3">
                    {d.topProducts.map((p, i) => {
                      const max = d.topProducts[0].revenue || 1;
                      return (
                        <li key={p.productId}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <Link to={`/admin/products/${p.productId}/edit`} className="min-w-0 truncate hover:underline">
                              <span className="mr-2 text-stone tabular-nums">{i + 1}.</span>
                              {p.name}
                            </Link>
                            <span className="shrink-0 tabular-nums">{money(p.revenue)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <div className="h-1 flex-1 bg-mist">
                              <div className="h-full bg-ink" style={{ width: `${(p.revenue / max) * 100}%` }} />
                            </div>
                            <span className="text-2xs text-stone tabular-nums">{p.quantity} шт.</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Panel>

              <Panel title="Заканчиваются" bodyClassName="p-0">
                {!d ? (
                  <Skeleton className="m-5 h-24" />
                ) : d.lowStock.length === 0 ? (
                  <p className="p-5 text-sm text-stone">Все опубликованные товары в наличии.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.lowStock.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                        <div className="min-w-0">
                          <Link to={`/admin/products/${v.productId}/edit`} className="block truncate hover:underline">
                            {v.name}
                          </Link>
                          <p className="font-mono text-2xs text-stone">{v.sku}</p>
                        </div>
                        <span className={cn('label shrink-0 tabular-nums', v.available <= 0 ? 'text-danger' : 'text-warning')}>
                          {v.available <= 0 ? 'нет' : `${v.available} шт.`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
