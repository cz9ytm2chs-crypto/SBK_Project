import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Stars } from '@/components/ui/data';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { cn, formatDateShort } from '@/lib/utils';
import { ak } from '../../lib';
import type { AdminReview, ReviewStatus } from '../../types';
import { REVIEW_STATUS_LABELS } from '../badges';
import { ListFooter, QueryError, TableSkeleton } from '../page';

export function ReviewsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>('PENDING');
  const [page, setPage] = useState(1);
  const params = { status, page };
  const q = useQuery({
    queryKey: ak.reviews(params),
    queryFn: () => api.get<Paginated<AdminReview>>('/admin/content/reviews', params),
    placeholderData: keepPreviousData,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => api.patch(`/admin/content/reviews/${id}`, { status }),
    onSuccess: (_r, v) => {
      toast.success(v.status === 'APPROVED' ? 'Отзыв опубликован' : 'Отзыв отклонён');
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const items = q.data?.items ?? [];

  return (
    <div className="border border-line bg-paper">
      <div className="flex gap-2 border-b border-line p-3" role="group" aria-label="Статус отзывов">
        {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={cn('h-8 border px-3 text-xs transition-colors', status === s ? 'border-ink bg-ink text-milk' : 'border-line text-graphite hover:border-stone')}
          >
            {REVIEW_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<MessageSquare />} title={status === 'PENDING' ? 'Новых отзывов нет' : 'Отзывов нет'} />
      ) : (
        <>
          <ul className={cn('divide-y divide-line transition-opacity', q.isFetching && 'opacity-60')}>
            {items.map((r) => (
              <li key={r.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} />
                    {r.verifiedPurchase && <Badge tone="success">Покупка подтверждена</Badge>}
                    <a href={`/product/${r.product.slug}`} target="_blank" rel="noreferrer" className="text-xs text-stone underline underline-offset-2">
                      {r.product.name}
                    </a>
                  </div>
                  {r.title && <p className="mt-2 text-sm font-medium">{r.title}</p>}
                  <p className="mt-1 text-sm whitespace-pre-wrap text-graphite">{r.body}</p>
                  <p className="mt-2 text-2xs text-stone">
                    {r.user.firstName || r.user.email} · {r.user.email} · {formatDateShort(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  {r.status !== 'APPROVED' && (
                    <Button size="sm" variant="primary" onClick={() => moderate.mutate({ id: r.id, status: 'APPROVED' })} disabled={moderate.isPending}>
                      <Check /> Одобрить
                    </Button>
                  )}
                  {r.status !== 'REJECTED' && (
                    <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, status: 'REJECTED' })} disabled={moderate.isPending}>
                      <X /> Отклонить
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <ListFooter total={q.data!.total} page={page} pageSize={q.data!.pageSize}>
            <Pagination page={page} pageCount={q.data!.pageCount} onChange={setPage} />
          </ListFooter>
        </>
      )}
    </div>
  );
}
