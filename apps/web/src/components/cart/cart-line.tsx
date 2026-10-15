import { X } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { CartLineDTO } from '@silt/shared';
import { QuantityInput } from '@/components/ui/data';
import { useRemoveCartItem, useUpdateCartItem } from '@/hooks/cart';
import { errorMessage } from '@/lib/api';
import { cn, imageUrl, money } from '@/lib/utils';

const ISSUE_TEXT: Record<NonNullable<CartLineDTO['issue']>, string> = {
  OUT_OF_STOCK: 'Закончился — удалите из корзины',
  QUANTITY_REDUCED: 'Доступно меньше, чем в корзине',
  UNAVAILABLE: 'Товар больше не продаётся',
};

export function CartLine({ line, compact, onNavigate }: { line: CartLineDTO; compact?: boolean; onNavigate?: () => void }) {
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;

  const setQty = (quantity: number) =>
    update.mutate({ itemId: line.id, quantity }, { onError: (e) => toast.error(errorMessage(e)) });
  const onRemove = () =>
    remove.mutate(line.id, { onSuccess: () => toast(`«${line.name}» удалён из корзины`), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <div className={cn('flex gap-4 py-5 transition-opacity', busy && 'opacity-60')}>
      <Link to={`/product/${line.slug}`} onClick={onNavigate} className={cn('shrink-0 bg-mist', compact ? 'w-20' : 'w-24 sm:w-28')}>
        {line.image && <img src={imageUrl(line.image, 240)} alt={line.name} className="aspect-[4/5] w-full object-cover" loading="lazy" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/product/${line.slug}`} onClick={onNavigate} className="text-sm leading-snug hover:underline hover:underline-offset-4">
              {line.name}
            </Link>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-stone">
              <span className="inline-block size-2.5 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: line.colorHex }} />
              {line.color} · {line.size}
            </p>
          </div>
          <button type="button" onClick={onRemove} disabled={busy} className="-mt-1 -mr-1 rounded-xs p-1 text-stone transition-colors hover:text-ink" aria-label={`Удалить ${line.name}`}>
            <X className="size-4" />
          </button>
        </div>
        {line.issue && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {ISSUE_TEXT[line.issue]}
            {line.issue === 'QUANTITY_REDUCED' && ` (${line.available} шт.)`}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          {line.issue === 'OUT_OF_STOCK' || line.issue === 'UNAVAILABLE' ? (
            <span />
          ) : (
            <QuantityInput size="sm" value={line.quantity} max={Math.min(20, Math.max(line.available, 1))} onChange={setQty} disabled={busy} />
          )}
          <div className="text-right">
            <p className="text-sm tabular-nums">{money(line.lineTotal)}</p>
            {line.quantity > 1 && <p className="text-2xs text-stone tabular-nums">{money(line.unitPrice)} × {line.quantity}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FreeShippingProgress({ remaining, threshold }: { remaining: number | null; threshold?: number | null }) {
  if (remaining === null || !threshold) return null;
  const done = remaining <= 0;
  const pct = Math.min(100, Math.round(((threshold - Math.max(remaining, 0)) / threshold) * 100));
  return (
    <div>
      <p className="text-xs text-graphite">{done ? 'Доставка курьером — бесплатно' : <>До бесплатной доставки — <span className="font-medium">{money(remaining)}</span></>}</p>
      <div className="mt-2 h-0.5 w-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
