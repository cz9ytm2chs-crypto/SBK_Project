import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { contactStepSchema, shippingAddressSchema, type AddressDTO, type CheckoutOptionsDTO, type ContactStep, type PaymentProviderKey, type ShippingAddress } from '@silt/shared';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { CheckboxField, Field, Input, RadioCard, RadioGroup } from '@/components/ui/form';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { cn, money } from '@/lib/utils';

export const STEPS = ['Контакты', 'Адрес', 'Доставка', 'Оплата', 'Подтверждение'] as const;

export function Stepper({ step, onGo }: { step: number; onGo: (s: number) => void }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Шаги оформления">
      {STEPS.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={i >= step}
            onClick={() => onGo(i)}
            aria-current={i === step ? 'step' : undefined}
            className={cn('flex items-center gap-2 text-xs', i === step ? 'text-ink' : i < step ? 'text-graphite hover:text-ink' : 'text-stone/60')}
          >
            <span className={cn('flex size-6 items-center justify-center rounded-full border text-[11px] tabular-nums', i === step ? 'border-ink bg-ink text-milk' : i < step ? 'border-ink' : 'border-line')}>{i + 1}</span>
            <span className="hidden sm:inline">{s}</span>
          </button>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

function StepActions({ onBack, nextLabel = 'Продолжить', loading, disabled }: { onBack?: () => void; nextLabel?: string; loading?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          ← Назад
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" size="lg" loading={loading} disabled={disabled} className="sm:min-w-56">
        {nextLabel}
      </Button>
    </div>
  );
}

// ── 1. Contacts ──
export function ContactForm({ defaults, onNext }: { defaults: Partial<ContactStep>; onNext: (v: ContactStep) => void }) {
  const { register, handleSubmit, formState } = useForm<ContactStep>({ resolver: zodResolver(contactStepSchema), defaultValues: defaults });
  const e = formState.errors;
  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h2 className="display text-xl">Контактные данные</h2>
      <p className="mt-1 text-sm text-stone">На этот email придёт подтверждение и статус заказа.</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Имя" required error={e.firstName?.message}>
          {(p) => <Input {...p} {...register('firstName')} autoComplete="given-name" />}
        </Field>
        <Field label="Фамилия" required error={e.lastName?.message}>
          {(p) => <Input {...p} {...register('lastName')} autoComplete="family-name" />}
        </Field>
        <Field label="Email" required error={e.email?.message}>
          {(p) => <Input {...p} {...register('email')} type="email" autoComplete="email" inputMode="email" />}
        </Field>
        <Field label="Телефон" required error={e.phone?.message}>
          {(p) => <Input {...p} {...register('phone')} type="tel" autoComplete="tel" placeholder="+7 900 000-00-00" />}
        </Field>
      </div>
      <StepActions />
    </form>
  );
}

// ── 2. Address ──
type AddressForm = z.input<typeof shippingAddressSchema>;
export function AddressStep({
  defaults,
  loggedIn,
  saveAddress,
  setSaveAddress,
  onNext,
  onSkip,
  onBack,
}: {
  defaults?: ShippingAddress;
  loggedIn: boolean;
  saveAddress: boolean;
  setSaveAddress: (v: boolean) => void;
  onNext: (v: ShippingAddress) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const { register, handleSubmit, formState, reset } = useForm<AddressForm, unknown, ShippingAddress>({ resolver: zodResolver(shippingAddressSchema), defaultValues: defaults ?? { country: 'RU' } });
  const saved = useQuery({ queryKey: qk.addresses, queryFn: () => api.get<AddressDTO[]>('/users/me/addresses'), enabled: loggedIn });
  const e = formState.errors;
  const fill = (a: AddressDTO) => reset({ country: a.country, region: a.region, city: a.city, street: a.street, house: a.house, apartment: a.apartment, postalCode: a.postalCode });

  return (
    <form onSubmit={handleSubmit(onNext)} noValidate>
      <h2 className="display text-xl">Адрес доставки</h2>
      <p className="mt-1 text-sm text-stone">
        Заберёте сами из шоурума или пункта выдачи?{' '}
        <button type="button" onClick={onSkip} className="text-ink underline underline-offset-4">
          Пропустить адрес
        </button>
      </p>
      {!!saved.data?.length && (
        <div className="mt-6 flex flex-wrap gap-2">
          {saved.data.map((a) => (
            <button key={a.id} type="button" onClick={() => fill(a)} className="rounded-xs border border-line px-3 py-2 text-left text-xs hover:border-ink">
              <span className="font-medium">{a.label || 'Адрес'}</span>
              <span className="block text-stone">
                {a.city}, {a.street}, {a.house}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-6">
        <Field label="Город" required error={e.city?.message} className="sm:col-span-3">
          {(p) => <Input {...p} {...register('city')} autoComplete="address-level2" />}
        </Field>
        <Field label="Регион" error={e.region?.message} className="sm:col-span-3">
          {(p) => <Input {...p} {...register('region')} autoComplete="address-level1" />}
        </Field>
        <Field label="Улица" required error={e.street?.message} className="sm:col-span-4">
          {(p) => <Input {...p} {...register('street')} autoComplete="address-line1" />}
        </Field>
        <Field label="Дом" required error={e.house?.message} className="sm:col-span-2">
          {(p) => <Input {...p} {...register('house')} />}
        </Field>
        <Field label="Квартира / офис" error={e.apartment?.message} className="sm:col-span-3">
          {(p) => <Input {...p} {...register('apartment')} autoComplete="address-line2" />}
        </Field>
        <Field label="Индекс" required error={e.postalCode?.message} className="sm:col-span-3">
          {(p) => <Input {...p} {...register('postalCode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" />}
        </Field>
      </div>
      {loggedIn && <CheckboxField className="mt-5" label="Сохранить адрес в профиле" checked={saveAddress} onCheckedChange={(v) => setSaveAddress(v === true)} />}
      <StepActions onBack={onBack} />
    </form>
  );
}

// ── 3. Delivery ──
export function DeliveryStep({
  options,
  value,
  pickupPointId,
  hasAddress,
  subtotal,
  onChange,
  onPickupPoint,
  onNext,
  onBack,
  onEditAddress,
}: {
  options: CheckoutOptionsDTO['deliveryMethods'];
  value?: string;
  pickupPointId?: string;
  hasAddress: boolean;
  subtotal: number;
  onChange: (code: string) => void;
  onPickupPoint: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  onEditAddress: () => void;
}) {
  const selected = options.find((o) => o.code === value);
  const blocked = !selected || (selected.requiresAddress && !hasAddress) || (selected.type === 'PICKUP_POINT' && !pickupPointId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) onNext();
      }}
    >
      <h2 className="display text-xl">Способ доставки</h2>
      <RadioGroup value={value} onValueChange={onChange} className="mt-6" aria-label="Способ доставки">
        {options.map((o) => {
          const free = o.freeFromAmount !== null && subtotal >= o.freeFromAmount;
          return (
            <RadioCard key={o.code} value={o.code}>
              <span className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">{o.name}</span>
                  <span className="mt-1 block text-xs text-stone">{o.description}</span>
                  <span className="mt-1 block text-xs text-stone">
                    {o.estimatedDaysMin === o.estimatedDaysMax ? `${o.estimatedDaysMin} дн.` : `${o.estimatedDaysMin}–${o.estimatedDaysMax} дн.`}
                    {o.freeFromAmount !== null && !free && ` · бесплатно от ${money(o.freeFromAmount)}`}
                  </span>
                  {o.requiresAddress && !hasAddress && <span className="mt-2 block text-xs text-danger">Нужен адрес доставки</span>}
                </span>
                <span className="shrink-0 text-sm tabular-nums">{o.price === 0 || free ? 'Бесплатно' : money(o.price)}</span>
              </span>
            </RadioCard>
          );
        })}
      </RadioGroup>
      {selected?.requiresAddress && !hasAddress && (
        <Button type="button" variant="link" className="mt-3" onClick={onEditAddress}>
          Указать адрес
        </Button>
      )}
      {selected?.type === 'PICKUP_POINT' && (
        <fieldset className="mt-6">
          <legend className="mb-3 text-sm font-medium">Пункт выдачи</legend>
          <RadioGroup value={pickupPointId} onValueChange={onPickupPoint} aria-label="Пункт выдачи">
            {selected.pickupPoints.map((p) => (
              <RadioCard key={p.id} value={p.id}>
                <span className="block text-sm">{p.name}</span>
                <span className="mt-1 block text-xs text-stone">
                  {p.address} · {p.workingHours}
                </span>
              </RadioCard>
            ))}
          </RadioGroup>
        </fieldset>
      )}
      <StepActions onBack={onBack} disabled={blocked} />
    </form>
  );
}

// ── 4. Payment ──
export function PaymentStep({
  options,
  value,
  onChange,
  onNext,
  onBack,
}: {
  options: CheckoutOptionsDTO['paymentMethods'];
  value?: PaymentProviderKey;
  onChange: (v: PaymentProviderKey) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) onNext();
      }}
    >
      <h2 className="display text-xl">Способ оплаты</h2>
      <p className="mt-1 text-sm text-stone">Оплата проходит на защищённой странице платёжной системы. Мы не храним данные карт.</p>
      {options.length === 0 ? (
        <p role="alert" className="mt-6 text-sm text-danger">
          Онлайн-оплата временно недоступна. Попробуйте позже или свяжитесь с нами.
        </p>
      ) : (
        <RadioGroup value={value} onValueChange={(v) => onChange(v as PaymentProviderKey)} className="mt-6" aria-label="Способ оплаты">
          {options.map((o) => (
            <RadioCard key={o.provider} value={o.provider}>
              <span className="flex items-center gap-2 text-sm font-medium">
                {o.name}
                {o.testMode && <Badge tone="warning">Тестовый режим</Badge>}
              </span>
              <span className="mt-1 block text-xs text-stone">{o.description}</span>
            </RadioCard>
          ))}
        </RadioGroup>
      )}
      <StepActions onBack={onBack} disabled={!value} />
    </form>
  );
}
