import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Badge, ErrorState, PageSpinner } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { imageUrl, money } from '@/lib/utils';

/**
 * Return page from the payment provider. It never decides that payment succeeded by itself:
 * it shows the status stored on the server (set by the provider's webhook) and asks the
 * server to re-check the provider while the payment is pending.
 */
export default function CheckoutResultPage() {
  const [sp] = useSearchParams();
  const orderId = sp.get('order') ?? '';
  const token = sp.get('token') ?? undefined;
  const qc = useQueryClient();
  const polls = useRef(0);

  const order = useQuery({
    queryKey: qk.order(orderId),
    queryFn: async () => {
      polls.current++;
      // First and every subsequent check asks the server to reconcile with the provider.
      return api.post<OrderDTO>(`/orders/${orderId}/sync-payment`, undefined, { token });
    },
    enabled: !!orderId,
    refetchInterval: (q) => {
      const o = q.state.data;
      const pending = o && ['CREATED', 'AWAITING_PAYMENT'].includes(o.status) && o.paymentStatus !== 'FAILED';
      return pending && polls.current < 20 ? 3000 : false;
    },
  });

  useEffect(() => {
    qc.invalidateQueries({ queryKey: qk.cart });
  }, [qc]);

  const pay = useMutation({
    mutationFn: () => api.post<{ paymentUrl: string | null }>(`/orders/${orderId}/pay`, undefined, { token }),
    onSuccess: (r) => (r.paymentUrl ? window.location.assign(r.paymentUrl) : toast.error('Не удалось создать платёж')),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!orderId) return <ErrorState message="Заказ не найден" />;
  if (order.isLoading) return <PageSpinner />;
  if (order.isError || !order.data) return <ErrorState message={(order.error as Error)?.message} onRetry={() => order.refetch()} />;

  const o = order.data;
  const paid = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status);
  const failed = o.paymentStatus === 'FAILED' || (sp.get('failed') === '1' && !paid);
  const cancelled = o.status === 'CANCELLED';
  const pending = !paid && !failed && !cancelled;
  const timedOut = pending && polls.current >= 20;

  const head = paid
    ? { icon: <CheckCircle2 className="size-10 text-success" />, title: 'Спасибо! Заказ оплачен', text: `Мы отправили подтверждение на ${o.email}.` }
    : cancelled
      ? { icon: <XCircle className="size-10 text-danger" />, title: 'Заказ отменён', text: 'Время на оплату истекло или заказ был отменён.' }
      : failed
        ? { icon: <XCircle className="size-10 text-danger" />, title: 'Оплата не прошла', text: 'Деньги не списаны. Попробуйте ещё раз или выберите другую карту.' }
        : { icon: <Clock className="size-10 animate-pulse text-warning" />, title: 'Ждём подтверждения оплаты', text: timedOut ? 'Банк ещё не подтвердил платёж. Обновите страницу через пару минут — статус обновится автоматически.' : 'Обычно это занимает несколько секунд.' };

  return (
    <div className="container-x max-w-3xl py-14 md:py-20">
      <Seo title={`Заказ ${o.number}`} noindex />
      <div className="text-center" aria-live="polite">
        <div className="flex justify-center">{head.icon}</div>
        <h1 className="display mt-5 text-3xl">{head.title}</h1>
        <p className="mt-3 text-sm text-stone">{head.text}</p>
        <p className="mt-6 text-sm">
          Номер заказа: <span className="font-medium">{o.number}</span>
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Badge tone={paid ? 'success' : failed || cancelled ? 'danger' : 'warning'}>{ORDER_STATUS_LABELS[o.status]}</Badge>
          <Badge tone="outline">Оплата: {PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
        </div>
        {(failed || (pending && o.canPay)) && o.canPay && (
          <Button className="mt-8" size="lg" onClick={() => pay.mutate()} loading={pay.isPending}>
            {failed ? 'Повторить оплату' : 'Перейти к оплате'}
          </Button>
        )}
      </div>

      <div className="mt-14 bg-paper p-6 sm:p-8">
        <h2 className="label">Состав заказа</h2>
        <ul className="mt-5 divide-y divide-line">
          {o.items.map((i) => (
            <li key={i.id} className="flex gap-4 py-4">
              <div className="w-16 shrink-0 bg-mist">{i.imageUrl && <img src={imageUrl(i.imageUrl, 160)} alt="" className="aspect-[4/5] w-full object-cover" />}</div>
              <div className="flex-1 text-sm">
                <p>{i.productName}</p>
                <p className="text-xs text-stone">
                  {i.color} · {i.size} · {i.quantity} шт.
                </p>
              </div>
              <p className="text-sm tabular-nums">{money(i.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone">Доставка — {o.deliveryMethodName}</dt>
            <dd className="tabular-nums">{o.shippingTotal ? money(o.shippingTotal) : 'Бесплатно'}</dd>
          </div>
          <div className="flex justify-between text-base font-medium">
            <dt>Итого</dt>
            <dd className="tabular-nums">{money(o.total)}</dd>
          </div>
        </dl>
        {(o.shippingAddress || o.pickupPointName) && (
          <p className="mt-5 text-xs text-stone">
            {o.pickupPointName ?? `${o.shippingAddress!.postalCode}, ${o.shippingAddress!.city}, ${o.shippingAddress!.street}, ${o.shippingAddress!.house}`}
          </p>
        )}
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link to="/catalog">Вернуться в магазин</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to={`/account/orders/${o.id}`}>Мои заказы</Link>
        </Button>
      </div>
    </div>
  );
}
