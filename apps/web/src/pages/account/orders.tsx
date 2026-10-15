import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import type { OrderSummaryDTO, Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/data';
import { EmptyState, ErrorState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, plural } from '@/lib/utils';
import { OrderRow, OrderRowSkeleton } from './components/order-ui';

export default function AccountOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = useQuery({
    queryKey: qk.orders(page),
    queryFn: () => api.get<Paginated<OrderSummaryDTO>>('/orders', { page }),
    placeholderData: keepPreviousData,
  });

  const setPage = (p: number) => {
    setParams(p > 1 ? { page: String(p) } : {});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <Seo title="Мои заказы" noindex />
      <h1 className="display text-3xl">Заказы</h1>
      <p className="mt-2 text-sm text-stone">
        {q.data && q.data.total > 0
          ? `${q.data.total} ${plural(q.data.total, ['заказ', 'заказа', 'заказов'])} за всё время`
          : 'История ваших покупок и статусы доставки.'}
      </p>

      <div className="mt-10">
        {q.isPending ? (
          <OrderRowSkeleton count={5} />
        ) : q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : q.data.items.length === 0 ? (
          <EmptyState
            className="border border-line"
            icon={<Package />}
            title="Заказов пока нет"
            description="Здесь появится история покупок и статусы доставки."
            action={
              <Button asChild>
                <Link to="/catalog">Перейти в каталог</Link>
              </Button>
            }
          />
        ) : (
          <>
            <ul className={cn('border-t border-ink transition-opacity', q.isPlaceholderData && 'opacity-60')} aria-busy={q.isFetching}>
              {q.data.items.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </ul>
            <Pagination className="mt-10" page={q.data.page} pageCount={q.data.pageCount} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
