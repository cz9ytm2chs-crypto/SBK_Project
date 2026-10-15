import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type OrderSummaryDTO, type PaymentStatus } from '@silt/shared';
import { Badge, Skeleton } from '@/components/ui/misc';
import { cn, formatDate, imageUrl, money, plural } from '@/lib/utils';

type Tone = 'neutral' | 'dark' | 'success' | 'warning' | 'danger' | 'outline';

const ORDER_TONES: Record<OrderStatus, Tone> = {
  CREATED: 'neutral',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  PROCESSING: 'neutral',
  SHIPPED: 'dark',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
};

const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  PENDING: 'warning',
  REQUIRES_ACTION: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'outline',
  PARTIALLY_REFUNDED: 'neutral',
  REFUNDED: 'outline',
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge tone={ORDER_TONES[status]} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge tone={PAYMENT_TONES[status]} className={className}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

/** One order in a list: number, date, status, thumbnails, total. The whole row is a link. */
export function OrderRow({ order, compact }: { order: OrderSummaryDTO; compact?: boolean }) {
  const shown = order.images.slice(0, compact ? 3 : 4);
  const extra = order.itemCount - shown.length;
  return (
    <li>
      <Link
        to={`/account/orders/${order.id}`}
        className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-4 border-b border-line py-5 transition-colors hover:bg-mist/40 sm:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)_auto_auto] sm:gap-x-6 sm:px-3"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium">№ {order.number}</p>
          <p className="mt-1 text-xs text-stone">
            {formatDate(order.createdAt)} · {order.itemCount} {plural(order.itemCount, ['товар', 'товара', 'товаров'])}
          </p>
        </div>
        <div className="justify-self-end sm:justify-self-start">
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1" aria-hidden>
          {shown.map((src, i) => (
            <div key={i} className="aspect-[4/5] w-11 shrink-0 overflow-hidden bg-mist">
              <img src={imageUrl(src, 120)} alt="" loading="lazy" className="size-full object-cover" />
            </div>
          ))}
          {extra > 0 && <span className="ml-1 text-xs text-stone">+{extra}</span>}
        </div>
        <p className="text-sm tabular-nums sm:text-right">{money(order.total)}</p>
        <ChevronRight className="size-4 justify-self-end text-stone transition-transform group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only">Подробнее о заказе</span>
      </Link>
    </li>
  );
}

export function OrderRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-6 border-b border-line py-5">
          <div className="flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-48" />
          </div>
          <Skeleton className="hidden h-14 w-36 sm:block" />
          <Skeleton className="h-4 w-20" />
        </li>
      ))}
    </ul>
  );
}

/** Thin bordered panel used across the account area. */
export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('border border-line bg-paper', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          {title && <h2 className="label">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

/** "ул. Ленина, д. 5, кв. 10" style one-liner for address objects (saved or order snapshots). */
type AddressLike = { postalCode?: string | null; region?: string | null; city?: string | null; street?: string | null; house?: string | null; apartment?: string | null };
export function formatAddress(a: AddressLike) {
  const parts = [
    a.postalCode,
    a.region,
    a.city,
    a.street,
    a.house && `д. ${a.house}`,
    a.apartment && `кв. ${a.apartment}`,
  ].filter(Boolean);
  return parts.join(', ');
}
