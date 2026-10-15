import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { Badge, Skeleton } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { formatDateShort, imageUrl, money } from '@/lib/utils';
import { EmailStatusBadge, OrderStatusBadge, PaymentStatusBadge, ShipmentStatusBadge } from '../components/badges';
import { MOVEMENT_LABELS } from '../components/movements';
import { NotesPanel, RefundDialog, ShipmentEditor, StatusActions, refundableAmount } from '../components/order-actions';
import { InfoList, PageHeader, Panel, QueryError } from '../components/page';
import { ak, fullName, useCan } from '../lib';
import type { AdminOrder } from '../types';

const REFUND_STATUS: Record<string, string> = { PENDING: 'В обработке', SUCCEEDED: 'Выполнен', FAILED: 'Ошибка' };

function formatAddress(a: Record<string, string> | null) {
  if (!a) return null;
  return [a.postalCode, a.region, a.city, a.street, a.house && `д. ${a.house}`, a.apartment && `кв. ${a.apartment}`].filter(Boolean).join(', ');
}

export default function OrderPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const qc = useQueryClient();
  const [refundOpen, setRefundOpen] = useState(false);
  const q = useQuery({ queryKey: ak.order(id), queryFn: () => api.get<AdminOrder>(`/admin/orders/${id}`) });

  const sync = useMutation({
    mutationFn: () => api.post(`/admin/orders/${id}/sync-payment`),
    onSuccess: async () => {
      toast.success('Статус оплаты сверен с провайдером');
      await qc.invalidateQueries({ queryKey: ak.order(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resend = useMutation({
    mutationFn: (emailId: string) => api.post(`/admin/orders/emails/${emailId}/resend`),
    onSuccess: async () => {
      toast.success('Письмо поставлено в очередь');
      await qc.invalidateQueries({ queryKey: ak.order(id) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader title="Заказ" back={{ to: '/admin/orders', label: 'Заказы' }} />
        <Panel>
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      </>
    );

  const o = q.data;
  const canRefund = can('orders.refund') && refundableAmount(o) > 0;

  return (
    <>
      <Seo title={`Заказ ${o.number}`} noindex />
      <PageHeader
        back={{ to: '/admin/orders', label: 'Заказы' }}
        title={`Заказ ${o.number}`}
        description={`Создан ${formatDateShort(o.createdAt)}${o.paidAt ? ` · оплачен ${formatDateShort(o.paidAt)}` : ''}`}
        eyebrow={
          <span className="flex flex-wrap gap-1.5">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.paymentStatus} />
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => sync.mutate()} loading={sync.isPending}>
              <RefreshCw /> Сверить оплату
            </Button>
            {canRefund && (
              <Button variant="outline" size="sm" onClick={() => setRefundOpen(true)}>
                <RotateCcw /> Возврат
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {(can('orders.update') || can('orders.cancel')) && (
            <Panel title="Обработка заказа">
              <StatusActions order={o} />
            </Panel>
          )}

          <Panel title="Состав заказа" bodyClassName="p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Товар</Th>
                  <Th className="text-right">Цена</Th>
                  <Th className="text-right">Кол-во</Th>
                  <Th className="text-right">Сумма</Th>
                </tr>
              </thead>
              <tbody>
                {o.items.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-11 shrink-0 overflow-hidden bg-mist">
                          {i.imageUrl && <img src={imageUrl(i.imageUrl, 88)} alt="" className="size-full object-cover" loading="lazy" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{i.productName}</p>
                          <p className="text-xs text-stone">
                            {i.color} · {i.size} · <span className="font-mono">{i.sku}</span>
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums">{money(i.unitPrice)}</Td>
                    <Td className="text-right tabular-nums">{i.quantity}</Td>
                    <Td className="text-right tabular-nums">
                      {money(i.lineTotal)}
                      {i.discount > 0 && <p className="text-xs text-rust">−{money(i.discount)}</p>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <dl className="ml-auto grid max-w-xs gap-2 p-5 text-sm">
              {(
                [
                  ['Товары', o.subtotal],
                  ...(o.discountTotal ? [['Скидка', -o.discountTotal] as const] : []),
                  ['Доставка', o.shippingTotal],
                  ['в т. ч. НДС', o.taxTotal],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6">
                  <dt className="text-stone">{k}</dt>
                  <dd className="tabular-nums">{v < 0 ? `−${money(-v)}` : money(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-6 border-t border-line pt-2 font-medium">
                <dt>Итого</dt>
                <dd className="tabular-nums">{money(o.total)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Платежи" bodyClassName="p-0">
            {o.payments.length === 0 ? (
              <p className="p-5 text-sm text-stone">Платежей нет.</p>
            ) : (
              <ul className="divide-y divide-line">
                {o.payments.map((p) => (
                  <li key={p.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {p.provider} · {money(p.amount)}
                        </p>
                        <p className="font-mono text-2xs break-all text-stone">{p.providerPaymentId ?? 'без ID провайдера'}</p>
                        <p className="text-xs text-stone">{formatDateShort(p.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <PaymentStatusBadge status={p.status} />
                        {p.refundedAmount > 0 && <p className="mt-1 text-xs text-stone">Возвращено {money(p.refundedAmount)}</p>}
                      </div>
                    </div>
                    {p.failureReason && <p className="mt-2 text-xs text-danger">{p.failureReason}</p>}
                    {p.refunds.length > 0 && (
                      <div className="mt-4">
                        <p className="label mb-2 text-stone">Возвраты</p>
                        <ul className="space-y-1.5 text-xs">
                          {p.refunds.map((r) => (
                            <li key={r.id} className="flex flex-wrap justify-between gap-2">
                              <span>
                                {money(r.amount)} — {r.reason || 'без причины'}
                              </span>
                              <span className="text-stone">
                                {REFUND_STATUS[r.status] ?? r.status} · {formatDateShort(r.createdAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.events.length > 0 && (
                      <details className="mt-4">
                        <summary className="label cursor-pointer text-stone hover:text-ink">События провайдера ({p.events.length})</summary>
                        <ul className="mt-2 space-y-1.5 text-xs">
                          {p.events.map((e) => (
                            <li key={e.id} className="flex flex-wrap justify-between gap-2">
                              <span className="font-mono">{e.type}</span>
                              <span className={e.error ? 'text-danger' : 'text-stone'}>
                                {e.error ?? (e.processedAt ? 'обработано' : 'не обработано')} · {formatDateShort(e.createdAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="История статусов">
            <ol className="relative space-y-4 border-l border-line pl-5">
              {o.history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[23.5px] size-2 rounded-full bg-ink" aria-hidden />
                  <p className="text-sm">
                    {h.fromStatus && <span className="text-stone">{ORDER_STATUS_LABELS[h.fromStatus]} → </span>}
                    <span className="font-medium">{ORDER_STATUS_LABELS[h.toStatus]}</span>
                  </p>
                  {h.comment && <p className="mt-0.5 text-sm text-graphite">{h.comment}</p>}
                  <p className="mt-0.5 text-2xs text-stone">
                    {h.actor} · {formatDateShort(h.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>

          {o.movements.length > 0 && (
            <Panel title="Движение остатков" bodyClassName="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Дата</Th>
                    <Th>SKU</Th>
                    <Th>Операция</Th>
                    <Th className="text-right">Изменение</Th>
                  </tr>
                </thead>
                <tbody>
                  {o.movements.map((m) => (
                    <Tr key={m.id}>
                      <Td className="text-xs text-stone">{formatDateShort(m.createdAt)}</Td>
                      <Td className="font-mono text-xs">{m.sku}</Td>
                      <Td className="text-xs">
                        {MOVEMENT_LABELS[m.type] ?? m.type}
                        {m.reason && <span className="text-stone"> · {m.reason}</span>}
                      </Td>
                      <Td className="text-right tabular-nums">{m.quantity}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Покупатель">
            <InfoList
              items={[
                ['Имя', fullName(o)],
                ['Email', <a href={`mailto:${o.email}`} className="underline underline-offset-2">{o.email}</a>],
                ['Телефон', o.phone ? <a href={`tel:${o.phone}`}>{o.phone}</a> : '—'],
                [
                  'Аккаунт',
                  o.user ? (
                    can('customers.read') ? (
                      <Link to={`/admin/customers/${o.user.id}`} className="underline underline-offset-2">
                        Профиль покупателя
                      </Link>
                    ) : (
                      'Зарегистрирован'
                    )
                  ) : (
                    <Badge tone="outline">Гость</Badge>
                  ),
                ],
              ]}
            />
            {o.customerComment && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="label mb-1 text-stone">Комментарий покупателя</p>
                <p className="text-sm whitespace-pre-wrap">{o.customerComment}</p>
              </div>
            )}
          </Panel>

          <Panel title="Доставка">
            <InfoList
              items={[
                ['Способ', o.deliveryMethodName],
                ...(o.pickupPointName ? [['Пункт выдачи', o.pickupPointName] as [string, string]] : []),
                ...(o.shippingAddress ? [['Адрес', formatAddress(o.shippingAddress)] as [string, string | null]] : []),
                ['Отправление', o.shipment ? <ShipmentStatusBadge status={o.shipment.status} /> : '—'],
                ...(o.shipment?.trackingNumber
                  ? [
                      [
                        'Трек',
                        o.shipment.trackingUrl ? (
                          <a href={o.shipment.trackingUrl} target="_blank" rel="noreferrer" className="font-mono underline underline-offset-2">
                            {o.shipment.trackingNumber}
                          </a>
                        ) : (
                          <span className="font-mono">{o.shipment.trackingNumber}</span>
                        ),
                      ] as [string, React.ReactNode],
                    ]
                  : []),
              ]}
            />
            <div className="mt-5 border-t border-line pt-5">
              <ShipmentEditor key={JSON.stringify(o.shipment)} order={o} />
            </div>
          </Panel>

          <Panel title="Оплата">
            <InfoList
              items={[
                ['Провайдер', o.paymentProvider],
                ['Статус', PAYMENT_STATUS_LABELS[o.paymentStatus]],
                ['Оплачен', o.paidAt ? formatDateShort(o.paidAt) : '—'],
                ...(o.reservationExpiresAt ? [['Резерв до', formatDateShort(o.reservationExpiresAt)] as [string, string]] : []),
              ]}
            />
          </Panel>

          <Panel title="Внутренние заметки">
            <NotesPanel order={o} />
          </Panel>

          <Panel title="Письма покупателю" bodyClassName="p-0">
            {o.emails.length === 0 ? (
              <p className="p-5 text-sm text-stone">Писем по заказу нет.</p>
            ) : (
              <ul className="divide-y divide-line">
                {o.emails.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm">{e.subject}</p>
                      <p className="text-2xs text-stone">
                        {formatDateShort(e.createdAt)} · попыток: {e.attempts}
                      </p>
                      {e.lastError && <p className="mt-0.5 text-2xs break-words text-danger">{e.lastError}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <EmailStatusBadge status={e.status} />
                      {can('orders.update') && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => resend.mutate(e.id)}
                          disabled={resend.isPending}
                          aria-label={`Отправить повторно: ${e.subject}`}
                          title="Отправить повторно"
                        >
                          <Send />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      {canRefund && <RefundDialog order={o} open={refundOpen} onOpenChange={setRefundOpen} />}
    </>
  );
}
