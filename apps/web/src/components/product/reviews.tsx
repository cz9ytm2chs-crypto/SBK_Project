import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import { reviewSchema, type ReviewInput, type ReviewSummaryDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Stars } from '@/components/ui/data';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { cn, formatDate, plural } from '@/lib/utils';

const FIT = { small: 'Маломерит', true: 'Размер в размер', large: 'Большемерит' } as const;

export function Reviews({ slug }: { slug: string }) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data: user } = useMe();
  const { pathname } = useLocation();
  const { data, isLoading } = useQuery({ queryKey: qk.reviews(slug, page), queryFn: () => api.get<ReviewSummaryDTO>(`/products/${slug}/reviews`, { page }) });

  if (isLoading || !data) return <Skeleton className="h-40 w-full" />;
  const pageCount = Math.ceil(data.count / 10);

  return (
    <section aria-labelledby="reviews-title" className="grid gap-10 lg:grid-cols-[320px_1fr] lg:gap-16">
      <div>
        <h2 id="reviews-title" className="display text-2xl">
          Отзывы
        </h2>
        {data.count > 0 ? (
          <>
            <div className="mt-5 flex items-end gap-3">
              <span className="display text-5xl tabular-nums">{data.average.toFixed(1)}</span>
              <div className="pb-1.5">
                <Stars value={data.average} />
                <p className="mt-1 text-xs text-stone">
                  {data.count} {plural(data.count, ['отзыв', 'отзыва', 'отзывов'])}
                </p>
              </div>
            </div>
            <div className="mt-6 space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((r) => (
                <div key={r} className="flex items-center gap-3 text-xs">
                  <span className="w-3 text-stone">{r}</span>
                  <div className="h-1 flex-1 bg-line">
                    <div className="h-full bg-ink" style={{ width: `${(data.distribution[r] / data.count) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-stone tabular-nums">{data.distribution[r]}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-stone">Отзывов пока нет. Будьте первым!</p>
        )}
        <div className="mt-8">
          {user ? (
            data.canReview ? (
              <Button variant="outline" onClick={() => setOpen(true)}>
                Написать отзыв
              </Button>
            ) : (
              <p className="text-xs text-stone">Вы уже оставили отзыв на этот товар.</p>
            )
          ) : (
            <p className="text-sm text-stone">
              <Link to={`/login?next=${encodeURIComponent(pathname)}`} className="text-ink underline underline-offset-4">
                Войдите
              </Link>
              , чтобы оставить отзыв.
            </p>
          )}
        </div>
      </div>

      <div>
        <ul className="divide-y divide-line">
          {data.items.map((r) => (
            <li key={r.id} className="py-6 first:pt-0">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} />
                {r.fitFeedback && <span className="text-xs text-stone">{FIT[r.fitFeedback as keyof typeof FIT]}</span>}
                {r.verifiedPurchase && <Badge tone="success">Покупка подтверждена</Badge>}
              </div>
              {r.title && <h3 className="mt-3 text-sm font-medium">{r.title}</h3>}
              <p className="mt-2 text-sm leading-relaxed text-graphite">{r.body}</p>
              <p className="mt-3 text-xs text-stone">
                {r.author} · {formatDate(r.createdAt)}
              </p>
            </li>
          ))}
        </ul>
        <Pagination className="mt-6" page={page} pageCount={pageCount} onChange={setPage} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Ваш отзыв" description="Отзыв появится на сайте после модерации.">
          <ReviewForm slug={slug} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control, formState } = useForm<ReviewInput>({ resolver: zodResolver(reviewSchema), defaultValues: { rating: 5, title: '', body: '' } });
  const m = useMutation({
    mutationFn: (v: ReviewInput) => api.post<{ message: string }>(`/products/${slug}/reviews`, v),
    onSuccess: (r) => {
      toast.success(r.message);
      qc.invalidateQueries({ queryKey: ['reviews', slug] });
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-5">
      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-graphite">Оценка</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => field.onChange(n)} aria-label={`${n} из 5`} aria-pressed={field.value === n} className={cn('text-2xl transition-colors', n <= field.value ? 'text-ink' : 'text-line')}>
                  ★
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Controller
        control={control}
        name="fitFeedback"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-graphite">Посадка</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FIT) as (keyof typeof FIT)[]).map((k) => (
                <button key={k} type="button" aria-pressed={field.value === k} onClick={() => field.onChange(field.value === k ? undefined : k)} className={cn('rounded-full border px-3 py-1.5 text-xs', field.value === k ? 'border-ink bg-ink text-milk' : 'border-line')}>
                  {FIT[k]}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      />
      <Field label="Заголовок" error={formState.errors.title?.message}>
        {(p) => <Input {...p} {...register('title')} maxLength={120} />}
      </Field>
      <Field label="Отзыв" required error={formState.errors.body?.message}>
        {(p) => <Textarea {...p} {...register('body')} rows={5} maxLength={2000} />}
      </Field>
      <Button type="submit" block loading={m.isPending}>
        Отправить
      </Button>
    </form>
  );
}
