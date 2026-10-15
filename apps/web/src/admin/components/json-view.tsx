import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Collapsible pretty-printed JSON (audit log, provider events). */
export function JsonView({ data, label = 'Данные' }: { data: unknown; label?: string }) {
  const [open, setOpen] = useState(false);
  if (data === null || data === undefined || (typeof data === 'object' && Object.keys(data as object).length === 0))
    return <span className="text-stone">—</span>;
  const preview = JSON.stringify(data);
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex max-w-full items-center gap-1 text-left text-xs text-graphite hover:text-ink"
      >
        <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')} aria-hidden />
        <span className="sr-only">{open ? 'Скрыть' : 'Показать'} {label.toLowerCase()}</span>
        {!open && <span className="truncate font-mono text-2xs text-stone">{preview.slice(0, 80)}</span>}
      </button>
      {open && (
        <pre className="mt-2 max-h-80 max-w-[min(48rem,80vw)] overflow-auto border border-line bg-milk p-3 font-mono text-2xs leading-relaxed whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
