import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS, type OrderDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { api, ApiError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, formatDate, imageUrl, money, plural } from '@/lib/utils';
import { useUi } from '@/stores';
import { formatAddress, OrderStatusBadge, Panel, PaymentStatusBadge } from './components/order-ui';

function BackLink() {
  return (
    <Link to="/account/orders" className="label inline-flex items-center gap-2 text-stone transition-colors hover:text-ink">
      <ArrowLeft className="size-3.5" aria-hidden /> Все заказы
    </Link>
  );
}

function OrderSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-40" />
      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="aspect-[4/5] w-20" />
              <div className="flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function Timeline({ order }: { order: OrderDTO }) {
  const history = [...order.statusHistory].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  if (!history.length) return <p className="text-sm text-stone">История статусов пока пуста.</p>;
  return (
    <ol className="relative">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        return (
          <li key={`${h.toStatus}-${h.createdAt}`} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute top-3 left-[5px] h-full w-px bg-line" aria-hidden />}
            <span
              className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full border', last ? 'border-ink bg-ink' : 'border-stone bg-paper')}
              aria-hidden
            />
            <div className="min-w-0">
              <p className={cn('text-sm', last ? 'font-medium text-ink' : 'text-graphite')}>{ORDER_STATUS_LABELS[h.toStatus]}</p>
              <p className="mt-0.5 text-xs text-stone">{formatDate(h.createdAt, true)}</p>
              {h.comment && <p className="mt-1 text-xs text-stone">{h.comment}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4 text-sm', strong && 'border-t border-line pt-3 text-base font-medium')}>
      <dt className={cn(!strong && 'text-stone')}>{label}</dt>
      <dd className={cn('tabular-nums', accent && 'text-rust')}>{value}</dd>
    </div>
  );
}

export default function AccountOrderPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: qk.order(id), queryFn: () => api.get<OrderDTO>(`/orders/${id}`), enabled: !!id });

  const updateOrder = (order: OrderDTO) => {
    qc.setQueryData(qk.order(id), order);
    qc.invalidateQueries({ queryKey: ['orders'] });
  };

  const pay = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string | null }>(`/orders/${id}/pay`),
    onSuccess: ({ paymentUrl }) => {
      if (paymentUrl) window.location.href = paymentUrl;
      else toast.error('Не удалось открыть страницу оплаты. Попробуйте ещё раз');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: () => api.post<OrderDTO>(`/orders/${id}/cancel`),
    onSuccess: (order) => {
      updateOrder(order);
      toast(order.status === 'CANCELLED' ? 'Заказ отменён' : 'Заказ уже оплачен — отмена невозможна');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const sync = useMutation({
    mutationFn: () => api.post<OrderDTO>(`/orders/${id}/sync-payment`),
    onSuccess: (order) => {
      updateOrder(order);
      toast(order.paymentStatus === 'SUCCEEDED' ? 'Оплата получена, спасибо!' : 'Оплата пока не поступила');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reorder = useMutation({
    mutationFn: () => api.post<{ added: number; skipped: string[] }>(`/orders/${id}/reorder`),
    onSuccess: async ({ added, skipped }) => {
      await qc.invalidateQueries({ queryKey: qk.cart });
      if (added > 0) {
        toast.success(`В корзину добавлено ${added} ${plural(added, ['позиция', 'позиции', 'позиций'])}`, {
          description: skipped.length ? `Нет в наличии: ${skipped.join(', ')}` : undefined,
        });
        useUi.getState().setCartOpen(true);
      } else {
        toast.error('Товаров из этого заказа сейчас нет в наличии', {
          description: skipped.length ? skipped.join(', ') : undefined,
        });
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onCancel = async () => {
    const ok = await confirm({
      title: 'Отменить заказ?',
      description: 'Резерв товаров будет снят. Это действие нельзя отменить.',
      confirmLabel: 'Отменить заказ',
      danger: true,
    });
    if (ok) cancel.mutate();
  };

  if (q.isPending)
    return (
      <div>
        <Seo title="Заказ" noindex />
        <OrderSkeleton />
      </div>
    );

  if (q.isError) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 400);
    return (
      <div>
        <Seo title="Заказ" noindex />
        <BackLink />
        {notFound ? (
          <EmptyState
            title="Заказ не найден"
            description="Возможно, ссылка устарела или заказ оформлен с другого аккаунта."
            action={
              <Button asChild variant="outline">
                <Link to="/account/orders">К списку заказов</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        )}
      </div>
    );
  }

  const order = q.data;
  const busy = pay.isPending || cancel.isPending || sync.isPending;
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const address = order.shippingAddress;
  const shipment = order.shipment;

  return (
    <div>
      <Seo title={`Заказ № ${order.number}`} noindex />
      <BackLink />

      <header className="mt-6 flex flex-col gap-5 border-b border-line pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="display text-3xl">Заказ № {order.number}</h1>
          <p className="mt-2 text-sm text-stone">
            от {formatDate(order.createdAt, true)} · {itemCount} {plural(itemCount, ['товар', 'товара', 'товаров'])}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {order.canPay && (
            <Button variant="accent" onClick={() => pay.mutate()} loading={pay.isPending} disabled={busy}>
              Оплатить {money(order.total)}
            </Button>
          )}
          {order.status === 'AWAITING_PAYMENT' && (
            <Button variant="outline" onClick={() => sync.mutate()} loading={sync.isPending} disabled={busy}>
              <RefreshCw aria-hidden /> Проверить оплату
            </Button>
          )}
          <Button variant="outline" onClick={() => reorder.mutate()} loading={reorder.isPending}>
            Повторить заказ
          </Button>
          {order.canPay && (
            <Button variant="ghost" className="text-danger" onClick={onCancel} loading={cancel.isPending} disabled={busy}>
              Отменить заказ
            </Button>
          )}
        </div>
      </header>

      {order.canPay && order.reservationExpiresAt && (
        <p className="mt-6 border-l-2 border-rust bg-rust/5 px-4 py-3 text-sm text-graphite" role="status">
          Товары зарезервированы до {formatDate(order.reservationExpiresAt, true)}. Оплатите заказ, чтобы мы начали его собирать.
        </p>
      )}

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="order-items">
            <h2 id="order-items" className="label border-b border-ink pb-3">
              Состав заказа
            </h2>
            <ul>
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 border-b border-line py-5 sm:gap-6">
                  <Link to={`/product/${item.productSlug}`} className="aspect-[4/5] w-20 shrink-0 overflow-hidden bg-mist sm:w-24">
                    {item.imageUrl && (
                      <img src={imageUrl(item.imageUrl, 200)} alt={item.productName} loading="lazy" className="size-full object-cover" />
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 sm:flex-row">
                    <div className="min-w-0">
                      <Link to={`/product/${item.productSlug}`} className="text-sm hover:underline hover:underline-offset-4">
                        {item.productName}
                      </Link>
                      <dl className="mt-2 space-y-0.5 text-xs text-stone">
                        <div>
                          <dt className="inline">Размер: </dt>
                          <dd className="inline text-graphite">{item.size}</dd>
                        </div>
                        <div>
                          <dt className="inline">Цвет: </dt>
                          <dd className="inline text-graphite">{item.color}</dd>
                        </div>
                        <div>
                          <dt className="inline">Артикул: </dt>
                          <dd className="inline">{item.sku}</dd>
                        </div>
                      </dl>
                    </div>
                    <div className="text-sm tabular-nums sm:text-right">
                      <p className="font-medium">{money(item.lineTotal)}</p>
                      <p className="mt-1 text-xs text-stone">
                        {item.quantity} × {money(item.unitPrice)}
                      </p>
                      {item.discount > 0 && <p className="mt-0.5 text-xs text-rust">скидка −{money(item.discount)}</p>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="order-timeline">
            <h2 id="order-timeline" className="label border-b border-ink pb-3">
              История заказа
            </h2>
            <div className="pt-6">
              <Timeline order={order} />
            </div>
          </section>
        </div>

        <aside className="space-y-6 self-start">
          <Panel title="Сумма">
            <dl className="space-y-2.5">
              <Row label="Товары" value={money(order.subtotal)} />
              {order.discountTotal > 0 && <Row label="Скидка" value={`−${money(order.discountTotal)}`} accent />}
              <Row label="Доставка" value={order.shippingTotal > 0 ? money(order.shippingTotal) : 'Бесплатно'} />
              <Row label="Итого" value={money(order.total)} strong />
            </dl>
            {order.taxTotal > 0 && <p className="mt-2 text-right text-xs text-stone">в т. ч. НДС {money(order.taxTotal)}</p>}
            {order.paidAt && <p className="mt-4 text-xs text-stone">Оплачен {formatDate(order.paidAt, true)}</p>}
          </Panel>

          <Panel title="Доставка">
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-stone">Способ</p>
                <p className="mt-1">{order.deliveryMethodName}</p>
              </div>
              {address && (
                <div>
                  <p className="text-xs text-stone">Адрес</p>
                  <p className="mt-1 leading-relaxed">{formatAddress(address)}</p>
                </div>
              )}
              {order.pickupPointName && (
                <div>
                  <p className="text-xs text-stone">Пункт выдачи</p>
                  <p className="mt-1">{order.pickupPointName}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-stone">Получатель</p>
                <p className="mt-1">
                  {order.firstName} {order.lastName}
                </p>
                <p className="text-stone">{order.phone}</p>
                <p className="text-stone">{order.email}</p>
              </div>
              {shipment && (
                <div className="border-t border-line pt-4">
                  <p className="text-xs text-stone">Отправление</p>
                  <p className="mt-1">
                    {SHIPMENT_STATUS_LABELS[shipment.status]}
                    {shipment.carrier && <span className="text-stone"> · {shipment.carrier}</span>}
                  </p>
                  {shipment.trackingNumber && (
                    <p className="mt-1">
                      Трек-номер:{' '}
                      {shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:text-rust"
                        >
                          {shipment.trackingNumber}
                          <ExternalLink className="size-3.5" aria-hidden />
                          <span className="sr-only">(откроется в новой вкладке)</span>
                        </a>
                      ) : (
                        <span className="font-medium select-all">{shipment.trackingNumber}</span>
                      )}
                    </p>
                  )}
                  {shipment.shippedAt && <p className="mt-1 text-xs text-stone">Отправлен {formatDate(shipment.shippedAt)}</p>}
                  {shipment.deliveredAt && <p className="mt-0.5 text-xs text-stone">Доставлен {formatDate(shipment.deliveredAt)}</p>}
                </div>
              )}
            </div>
          </Panel>

          <p className="text-xs leading-relaxed text-stone">
            Вопрос по заказу? Посмотрите{' '}
            <Link to="/faq" className="underline underline-offset-4 hover:text-ink">
              ответы на частые вопросы
            </Link>{' '}
            или{' '}
            <Link to="/contacts" className="underline underline-offset-4 hover:text-ink">
              свяжитесь с нами
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
