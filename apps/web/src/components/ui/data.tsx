import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { discountPercent } from '@silt/shared';
import type { ComponentProps } from 'react';
import { cn, money } from '@/lib/utils';

// ── Table ──
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}
export const Th = ({ className, ...props }: ComponentProps<'th'>) => (
  <th className={cn('label h-11 border-b border-line px-4 text-left whitespace-nowrap text-stone', className)} {...props} />
);
export const Td = ({ className, ...props }: ComponentProps<'td'>) => (
  <td className={cn('border-b border-line px-4 py-3 align-middle', className)} {...props} />
);
export const Tr = ({ className, ...props }: ComponentProps<'tr'>) => (
  <tr className={cn('transition-colors hover:bg-mist/50', className)} {...props} />
);

// ── Pagination ──
export function Pagination({ page, pageCount, onChange, className }: { page: number; pageCount: number; onChange: (p: number) => void; className?: string }) {
  if (pageCount <= 1) return null;
  const pages: (number | '…')[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }
  const btn = 'flex size-10 items-center justify-center rounded-xs text-sm transition-colors disabled:opacity-30';
  return (
    <nav aria-label="Страницы" className={cn('flex items-center justify-center gap-1', className)}>
      <button className={cn(btn, 'hover:bg-mist')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Предыдущая страница">
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="w-8 text-center text-stone">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(btn, p === page ? 'bg-ink text-milk' : 'hover:bg-mist')}
          >
            {p}
          </button>
        ),
      )}
      <button className={cn(btn, 'hover:bg-mist')} disabled={page >= pageCount} onClick={() => onChange(page + 1)} aria-label="Следующая страница">
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

// ── Quantity stepper ──
export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled,
  size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const h = size === 'sm' ? 'h-8' : 'h-11';
  const w = size === 'sm' ? 'w-8' : 'w-10';
  return (
    <div className={cn('inline-flex items-center rounded-xs border border-line bg-paper', h)} role="group" aria-label="Количество">
      <button type="button" className={cn('flex h-full items-center justify-center text-stone transition-colors hover:text-ink disabled:opacity-30', w)} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Уменьшить">
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-6 text-center text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={cn('flex h-full items-center justify-center text-stone transition-colors hover:text-ink disabled:opacity-30', w)} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Увеличить">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

// ── Price ──
export function Price({ price, compareAtPrice, className, size = 'md' }: { price: number; compareAtPrice?: number | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const off = discountPercent(price, compareAtPrice);
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
      <span className={cn('tabular-nums', size === 'lg' ? 'text-xl font-medium' : 'text-sm', off > 0 && 'text-rust')}>{money(price)}</span>
      {off > 0 && (
        <>
          <span className={cn('text-stone tabular-nums line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{money(compareAtPrice!)}</span>
          {size === 'lg' && <span className="label text-rust">−{off}%</span>}
        </>
      )}
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={`Рейтинг ${value.toFixed(1)} из 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="size-3.5" aria-hidden>
          <defs>
            <linearGradient id={`star-${i}-${value}`}>
              <stop offset={`${Math.min(1, Math.max(0, value - i + 1)) * 100}%`} stopColor="currentColor" />
              <stop offset="0" stopColor="#ddd8cc" />
            </linearGradient>
          </defs>
          <path fill={`url(#star-${i}-${value})`} d="m10 1.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6L10 15l-5.4 3 1.2-6L1.3 7.8l6.1-.7z" />
        </svg>
      ))}
    </span>
  );
}
