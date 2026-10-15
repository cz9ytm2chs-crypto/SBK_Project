import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { isForbidden } from '../lib';

export function PageHeader({
  title,
  description,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="label mb-3 inline-flex items-center gap-1 text-stone transition-colors hover:text-ink">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <div className="label mb-2 text-stone">{eyebrow}</div>}
        <h1 className="display text-2xl lg:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-stone">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** White card with an optional uppercase title. */
export function Panel({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('border border-line bg-paper', className)}>
      {(title || actions) && (
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5 py-2.5">
          {title && <h2 className="label text-graphite">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function AccessDenied({ message, full }: { message?: string; full?: boolean }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 text-center', full ? 'min-h-dvh py-24' : 'py-20')}>
      <ShieldAlert className="size-8 stroke-[1.25] text-stone" aria-hidden />
      <p className="label mt-5 text-stone">403</p>
      <h2 className="display mt-2 text-xl">Нет доступа</h2>
      <p className="mt-2 max-w-sm text-sm text-stone">{message ?? 'У вашей учётной записи нет прав для этого раздела. Обратитесь к администратору.'}</p>
      {full && (
        <Button asChild variant="outline" className="mt-7">
          <Link to="/">Вернуться в магазин</Link>
        </Button>
      )}
    </div>
  );
}

/** Error block that turns a 403 into an access-denied state. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (isForbidden(error)) return <AccessDenied message={errorMessage(error)} />;
  return <ErrorState message={errorMessage(error)} onRetry={onRetry} />;
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Definition list for detail pages. */
export function InfoList({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid gap-y-2.5 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt className="text-stone">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Showing 21–40 of 312". */
export function ListFooter({ total, page, pageSize, children }: { total: number; page: number; pageSize: number; children?: ReactNode }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-stone tabular-nums">
        {from}–{to} из {total}
      </p>
      {children}
    </div>
  );
}
