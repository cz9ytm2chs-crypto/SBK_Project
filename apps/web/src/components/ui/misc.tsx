import type { ComponentProps, ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('size-5 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-xs', className)} aria-hidden {...props} />;
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" className={cn('shrink-0 bg-line', vertical ? 'w-px self-stretch' : 'h-px w-full', className)} />;
}

const badgeVariants = cva('inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.1em] whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-mist text-graphite',
      dark: 'bg-ink text-milk',
      light: 'bg-paper text-ink',
      accent: 'bg-rust text-white',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
      danger: 'bg-danger/10 text-danger',
      outline: 'border border-line text-graphite',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-20 text-center', className)}>
      {icon && <div className="mb-5 text-stone [&_svg]:size-8 [&_svg]:stroke-[1.25]">{icon}</div>}
      <h3 className="display text-xl">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-stone">{description}</p>}
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="label text-danger">Ошибка загрузки</p>
      <p className="mt-3 max-w-md text-sm text-graphite">{message ?? 'Не удалось загрузить данные.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="label mt-6 border-b border-ink pb-0.5 hover:text-rust hover:border-rust">
          Повторить
        </button>
      )}
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-stone" role="status" aria-label="Загрузка">
      <Spinner className="size-6" />
    </div>
  );
}
