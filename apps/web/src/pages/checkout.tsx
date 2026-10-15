import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { CartLineDTO, CheckoutOptionsDTO, ContactStep, PaymentProviderKey, PlaceOrderInput, PlaceOrderResultDTO, ShippingAddress, TotalsDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField } from '@/components/ui/form';
import { ErrorState, PageSpinner, Skeleton } from '@/components/ui/misc';
import { AddressStep, ContactForm, DeliveryStep, PaymentStep, Stepper } from '@/features/checkout/steps';
import { useMe } from '@/hooks/auth';
import { useCart } from '@/hooks/cart';
import { api, ApiError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { imageUrl, money, randomKey } from '@/lib/utils';

interface Quote {
  items: CartLineDTO[];
  totals: TotalsDTO;
  currency: string;
  minOrderAmount: number;
}

export default function CheckoutPage() {
  const { data: user, isLoading: userLoading } = useMe();
  const { data: cart, isLoading: cartLoading } = useCart();
  const options = useQuery({ queryKey: qk.checkoutOptions, queryFn: () => api.get<CheckoutOptionsDTO>('/checkout/options') });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<ContactStep>();
  const [address, setAddress] = useState<ShippingAddress>();
  const [saveAddress, setSaveAddress] = useState(false);
  const [delivery, setDelivery] = useState<string>();
  const [pickupPointId, setPickupPointId] = useState<string>();
  const [payment, setPayment] = useState<PaymentProviderKey>();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [comment, setComment] = useState('');
  // One key per checkout attempt: double clicks and retries return the same order.
  const idempotencyKey = useRef(randomKey());

  const quote = useQuery({
    queryKey: qk.quote(delivery),
    queryFn: () => api.get<Quote>('/checkout/quote', { deliveryMethodCode: delivery }),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!delivery && options.data?.deliveryMethods[0]) setDelivery(options.data.deliveryMethods[0].code);
    if (!payment && options.data?.paymentMethods[0]) setPayment(options.data.paymentMethods[0].provider);
  }, [options.data, delivery, payment]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const place = useMutation({
    mutationFn: (body: PlaceOrderInput) => api.post<PlaceOrderResultDTO>('/checkout/orders', body),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: qk.cart });
      if (r.paymentUrl) window.location.assign(r.paymentUrl);
      else navigate(`/checkout/result?order=${r.orderId}&token=${encodeURIComponent(r.accessToken)}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && ['CART_CHANGED', 'OUT_OF_STOCK', 'CART_EMPTY', 'MIN_ORDER_AMOUNT'].includes(e.code)) {
        toast.error(e.message);
        qc.invalidateQueries({ queryKey: qk.cart });
        navigate('/cart');
        return;
      }
      if (e instanceof ApiError && e.code === 'IDEMPOTENCY_MISMATCH') idempotencyKey.current = randomKey();
      toast.error(errorMessage(e));
    },
  });

  if (userLoading || cartLoading) return <PageSpinner />;
  if (!cart?.items.length && !place.isPending && !place.isSuccess) return <Navigate to="/cart" replace />;
  if (options.isError) return <ErrorState onRetry={() => options.refetch()} />;

  const methods = options.data?.deliveryMethods ?? [];
  const selectedMethod = methods.find((m) => m.code === delivery);

  const submit = () => {
    if (!contact || !delivery || !payment) return;
    place.mutate({
      idempotencyKey: idempotencyKey.current,
      contact,
      deliveryMethodCode: delivery,
      address: selectedMethod?.requiresAddress ? address : undefined,
      pickupPointId: selectedMethod?.type === 'PICKUP_POINT' ? pickupPointId : undefined,
      paymentProvider: payment,
      comment,
      saveAddress: saveAddress && !!selectedMethod?.requiresAddress,
      acceptTerms: acceptTerms as true,
      acceptPrivacy: acceptPrivacy as true,
    });
  };

  return (
    <div className="container-x pt-8 pb-10 md:pt-12">
      <Seo title="Оформление заказа" noindex />
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <h1 className="display text-3xl md:text-4xl">Оформление заказа</h1>
        <Stepper step={step} onGo={setStep} />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px] lg:gap-16">
        <div className="bg-paper p-5 sm:p-8">
          {step === 0 && (
            <ContactForm
              defaults={contact ?? { email: user?.email ?? '', firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' }}
              onNext={(v) => {
                setContact(v);
                setStep(1);
              }}
            />
          )}
          {step === 1 && (
            <AddressStep
              defaults={address}
              loggedIn={!!user}
              saveAddress={saveAddress}
              setSaveAddress={setSaveAddress}
              onBack={() => setStep(0)}
              onSkip={() => {
                const pickup = methods.find((m) => !m.requiresAddress);
                if (pickup && selectedMethod?.requiresAddress) setDelivery(pickup.code);
                setStep(2);
              }}
              onNext={(v) => {
                setAddress(v);
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <DeliveryStep
              options={methods}
              value={delivery}
              pickupPointId={pickupPointId}
              hasAddress={!!address}
              subtotal={quote.data?.totals.subtotal ?? 0}
              onChange={setDelivery}
              onPickupPoint={setPickupPointId}
              onBack={() => setStep(1)}
              onEditAddress={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && <PaymentStep options={options.data?.paymentMethods ?? []} value={payment} onChange={setPayment} onBack={() => setStep(2)} onNext={() => setStep(4)} />}
          {step === 4 && contact && (
            <div>
              <h2 className="display text-xl">Проверьте заказ</h2>
              <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
                <Row label="Получатель" onEdit={() => setStep(0)}>
                  {contact.firstName} {contact.lastName}
                  <br />
                  {contact.email} · {contact.phone}
                </Row>
                <Row label="Доставка" onEdit={() => setStep(2)}>
                  {selectedMethod?.name}
                  <br />
                  {selectedMethod?.requiresAddress && address
                    ? `${address.postalCode}, ${address.city}, ${address.street}, ${address.house}${address.apartment ? `, кв. ${address.apartment}` : ''}`
                    : selectedMethod?.type === 'PICKUP_POINT'
                      ? selectedMethod.pickupPoints.find((p) => p.id === pickupPointId)?.address
                      : selectedMethod?.description}
                </Row>
                <Row label="Оплата" onEdit={() => setStep(3)}>
                  {options.data?.paymentMethods.find((p) => p.provider === payment)?.name}
                </Row>
              </dl>
              <label className="mt-6 block">
                <span className="mb-1.5 block text-xs font-medium text-graphite">Комментарий к заказу</span>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} className="w-full rounded-xs border border-line bg-paper p-3 text-sm outline-none focus:border-ink" />
              </label>
              <div className="mt-6 space-y-3">
                <CheckboxField
                  checked={acceptTerms}
                  onCheckedChange={(v) => setAcceptTerms(v === true)}
                  label={
                    <>
                      Я принимаю{' '}
                      <Link to="/terms" target="_blank" className="underline">
                        условия покупки
                      </Link>
                    </>
                  }
                />
                <CheckboxField
                  checked={acceptPrivacy}
                  onCheckedChange={(v) => setAcceptPrivacy(v === true)}
                  label={
                    <>
                      Согласен на{' '}
                      <Link to="/privacy" target="_blank" className="underline">
                        обработку персональных данных
                      </Link>
                    </>
                  }
                />
              </div>
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  ← Назад
                </Button>
                <Button size="lg" onClick={submit} loading={place.isPending || place.isSuccess} disabled={!acceptTerms || !acceptPrivacy} className="sm:min-w-64">
                  <Lock /> Оплатить {quote.data ? money(quote.data.totals.total) : ''}
                </Button>
              </div>
              <p className="mt-4 text-xs text-stone">Товары будут зарезервированы на время оплаты. Итоговая сумма пересчитывается сервером.</p>
            </div>
          )}
        </div>

        <Summary quote={quote.data} loading={quote.isLoading} />
      </div>
    </div>
  );
}

function Row({ label, children, onEdit }: { label: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex gap-4 py-4">
      <dt className="w-28 shrink-0 text-stone">{label}</dt>
      <dd className="flex-1">{children}</dd>
      <button onClick={onEdit} className="self-start text-xs text-stone underline underline-offset-4 hover:text-ink">
        Изменить
      </button>
    </div>
  );
}

function Summary({ quote, loading }: { quote?: Quote; loading: boolean }) {
  if (loading || !quote) return <Skeleton className="h-80 w-full" />;
  const t = quote.totals;
  return (
    <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Сводка заказа">
      <h2 className="label">Ваш заказ</h2>
      <ul className="mt-5 max-h-80 space-y-4 overflow-y-auto pr-1">
        {quote.items.map((i) => (
          <li key={i.id} className="flex gap-3">
            <div className="relative w-16 shrink-0 bg-mist">
              {i.image && <img src={imageUrl(i.image, 160)} alt="" className="aspect-[4/5] w-full object-cover" />}
              <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-ink text-[10px] text-milk">{i.quantity}</span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">{i.name}</p>
              <p className="text-xs text-stone">
                {i.color} · {i.size}
              </p>
              {i.issue && <p className="text-xs text-danger">Наличие изменилось</p>}
            </div>
            <p className="text-sm tabular-nums">{money(i.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
        <div className="flex justify-between">
          <dt className="text-graphite">Товары</dt>
          <dd className="tabular-nums">{money(t.subtotal)}</dd>
        </div>
        {t.discountTotal > 0 && (
          <div className="flex justify-between text-rust">
            <dt>Скидка</dt>
            <dd className="tabular-nums">−{money(t.discountTotal)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-graphite">Доставка</dt>
          <dd className="tabular-nums">{t.shippingTotal === 0 ? 'Бесплатно' : money(t.shippingTotal)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-4 text-base font-medium">
          <dt>Итого</dt>
          <dd className="tabular-nums">{money(t.total)}</dd>
        </div>
        <p className="text-xs text-stone">В том числе НДС {money(t.taxTotal)}</p>
      </dl>
    </aside>
  );
}
