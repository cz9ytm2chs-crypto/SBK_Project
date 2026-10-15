import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { percentChange } from '../lib';

export function StatCard({
  label,
  value,
  current,
  previous,
  hint,
}: {
  label: string;
  value: string;
  /** Raw numbers for the % change; omit both to hide the comparison. */
  current?: number;
  previous?: number;
  hint?: string;
}) {
  const change = current !== undefined && previous !== undefined ? percentChange(current, previous) : undefined;
  return (
    <div className="border border-line bg-paper p-5">
      <p className="label text-stone">{label}</p>
      <p className="display mt-3 text-2xl tabular-nums">{value}</p>
      <div className="mt-2 min-h-5 text-xs">
        {change === undefined ? (
          hint && <span className="text-stone">{hint}</span>
        ) : change === null ? (
          <span className="text-stone">нет данных за прошлый период</span>
        ) : (
          <p>
            <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums', change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-stone')}>
              {change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : change < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : null}
              {change > 0 ? '+' : ''}
              {change.toLocaleString('ru-RU')}%
            </span>{' '}
            <span className="text-stone">к прошлому периоду</span>
          </p>
        )}
      </div>
    </div>
  );
}

export const StatCardSkeleton = () => (
  <div className="border border-line bg-paper p-5">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="mt-4 h-7 w-32" />
    <Skeleton className="mt-3 h-3 w-40" />
  </div>
);
