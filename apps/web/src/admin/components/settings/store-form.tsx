import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { settingsSchema, type SettingsInput } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, CheckboxField, Field, Input, Textarea } from '@/components/ui/form';
import { Badge } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { ak, applyServerErrors } from '../../lib';
import type { SettingsResponse, StoreSettings } from '../../types';
import { CharCount, MoneyInput } from '../inputs';
import { Panel } from '../page';
import { useUnsavedChangesGuard } from '../unsaved-guard';

type Out = z.output<typeof settingsSchema>;

const SOCIALS: Record<string, string> = { instagram: 'Instagram', telegram: 'Telegram', vk: 'ВКонтакте', youtube: 'YouTube', pinterest: 'Pinterest' };
const NOTIFICATIONS: Record<string, string> = {
  orderCreated: 'Заказ оформлен',
  orderPaid: 'Заказ оплачен',
  orderShipped: 'Заказ отправлен',
  orderCancelled: 'Заказ отменён',
};

const toForm = (s: StoreSettings): SettingsInput => ({
  storeName: s.storeName,
  logoUrl: s.logoUrl ?? '',
  currency: s.currency,
  contactEmail: s.contactEmail,
  contactPhone: s.contactPhone,
  address: s.address,
  workingHours: s.workingHours,
  socials: { ...Object.fromEntries(Object.keys(SOCIALS).map((k) => [k, ''])), ...s.socials },
  minOrderAmount: s.minOrderAmount,
  taxRatePercent: s.taxRatePercent,
  pricesIncludeTax: s.pricesIncludeTax,
  enabledPaymentProviders: s.enabledPaymentProviders,
  emailNotifications: { ...Object.fromEntries(Object.keys(NOTIFICATIONS).map((k) => [k, false])), ...s.emailNotifications },
  reservationTtlMinutes: s.reservationTtlMinutes,
  seoTitle: s.seoTitle,
  seoDescription: s.seoDescription,
});

export function StoreSettingsForm({ data, canWrite }: { data: SettingsResponse; canWrite: boolean }) {
  const qc = useQueryClient();
  const form = useForm<SettingsInput, unknown, Out>({ resolver: zodResolver(settingsSchema), defaultValues: toForm(data.settings) });
  const { register, control, handleSubmit, formState, reset, watch, setError } = form;
  useUnsavedChangesGuard(formState.isDirty && canWrite);

  const m = useMutation({
    mutationFn: (v: Out) => {
      // Drop empty social links instead of storing "".
      const socials = Object.fromEntries(Object.entries(v.socials).filter(([, url]) => url.trim()));
      return api.put<StoreSettings>('/admin/settings', { ...v, socials });
    },
    onSuccess: (saved) => {
      toast.success('Настройки сохранены');
      reset(toForm(saved));
      qc.setQueryData<SettingsResponse>(ak.settings, (old) => (old ? { ...old, settings: saved } : old));
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => applyServerErrors(e, setError, 'Не удалось сохранить настройки'),
  });
  const e = formState.errors;
  const socialKeys = Object.keys(watch('socials') ?? {});
  const notificationKeys = Object.keys(watch('emailNotifications') ?? {});

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} noValidate>
      <fieldset disabled={!canWrite} className="grid min-w-0 gap-6 xl:grid-cols-2">
        <Panel title="Магазин">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Название" required error={e.storeName?.message}>
              {(p) => <Input {...p} {...register('storeName')} />}
            </Field>
            <Field label="Валюта" required error={e.currency?.message} hint="Код ISO 4217">
              {(p) => <Input {...p} maxLength={3} className="uppercase" {...register('currency', { setValueAs: (v: string) => v.toUpperCase() })} />}
            </Field>
            <Field label="URL логотипа" error={e.logoUrl?.message} className="sm:col-span-2">
              {(p) => <Input {...p} type="url" placeholder="https://" {...register('logoUrl')} />}
            </Field>
          </div>
        </Panel>

        <Panel title="Контакты">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={e.contactEmail?.message}>
              {(p) => <Input {...p} type="email" {...register('contactEmail')} />}
            </Field>
            <Field label="Телефон" error={e.contactPhone?.message}>
              {(p) => <Input {...p} type="tel" {...register('contactPhone')} />}
            </Field>
            <Field label="Адрес" error={e.address?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register('address')} />}
            </Field>
            <Field label="Часы работы" error={e.workingHours?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register('workingHours')} />}
            </Field>
          </div>
        </Panel>

        <Panel title="Соцсети">
          <div className="grid gap-4 sm:grid-cols-2">
            {socialKeys.map((k) => (
              <Field key={k} label={SOCIALS[k] ?? k} error={e.socials?.[k]?.message}>
                {(p) => <Input {...p} type="url" placeholder="https://" {...register(`socials.${k}`)} />}
              </Field>
            ))}
          </div>
        </Panel>

        <Panel title="Заказы и налоги">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Минимальная сумма заказа" error={e.minOrderAmount?.message} hint="0 — без ограничения">
              {(p) => (
                <Controller
                  control={control}
                  name="minOrderAmount"
                  render={({ field }) => <MoneyInput {...p} value={field.value} onChange={(v) => field.onChange(v ?? 0)} onBlur={field.onBlur} />}
                />
              )}
            </Field>
            <Field label="Резерв неоплаченного заказа, мин" error={e.reservationTtlMinutes?.message} hint="От 5 до 1440 минут">
              {(p) => <Input {...p} type="number" min={5} max={1440} {...register('reservationTtlMinutes', { valueAsNumber: true })} />}
            </Field>
            <Field label="Ставка НДС, %" error={e.taxRatePercent?.message}>
              {(p) => <Input {...p} type="number" min={0} max={50} {...register('taxRatePercent', { valueAsNumber: true })} />}
            </Field>
            <Controller
              control={control}
              name="pricesIncludeTax"
              render={({ field }) => (
                <CheckboxField className="self-end pb-3" label="Цены включают НДС" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={!canWrite} />
              )}
            />
          </div>
        </Panel>

        <Panel title="Платёжные провайдеры">
          <Controller
            control={control}
            name="enabledPaymentProviders"
            render={({ field }) => (
              <ul className="space-y-3">
                {data.providers.map((p) => {
                  const checked = field.value.includes(p.key);
                  const id = `provider-${p.key}`;
                  return (
                    <li key={p.key} className="flex items-start gap-3">
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={checked}
                        disabled={!canWrite || (!p.configured && !checked)}
                        onCheckedChange={(on) => field.onChange(on ? [...field.value, p.key] : field.value.filter((k) => k !== p.key))}
                      />
                      <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                        <span className="flex flex-wrap items-center gap-2">
                          {p.name}
                          {p.configured ? <Badge tone="success">Настроен</Badge> : <Badge tone="outline">Нет ключей на сервере</Badge>}
                          {p.testMode && <Badge tone="warning">Тестовый режим</Badge>}
                        </span>
                        <span className="font-mono text-2xs text-stone">{p.key}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          />
          {e.enabledPaymentProviders && <p className="mt-2 text-xs text-danger">Выберите хотя бы одного провайдера</p>}
          <p className="mt-4 text-xs text-stone">Ключи провайдеров задаются в переменных окружения сервера и здесь не отображаются.</p>
        </Panel>

        <Panel title="Письма покупателям">
          <div className="space-y-3">
            {notificationKeys.map((k) => (
              <Controller
                key={k}
                control={control}
                name={`emailNotifications.${k}`}
                render={({ field }) => (
                  <CheckboxField label={NOTIFICATIONS[k] ?? k} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={!canWrite} />
                )}
              />
            ))}
          </div>
        </Panel>

        <Panel title="SEO по умолчанию" className="xl:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title" error={e.seoTitle?.message}>
              {(p) => (
                <div>
                  <Input {...p} {...register('seoTitle')} />
                  <div className="mt-1 text-right">
                    <CharCount value={watch('seoTitle')} max={70} />
                  </div>
                </div>
              )}
            </Field>
            <Field label="Description" error={e.seoDescription?.message}>
              {(p) => (
                <div>
                  <Textarea {...p} rows={2} className="min-h-0" {...register('seoDescription')} />
                  <div className="mt-1 text-right">
                    <CharCount value={watch('seoDescription')} max={160} />
                  </div>
                </div>
              )}
            </Field>
          </div>
        </Panel>
      </fieldset>

      {canWrite && (
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {formState.isDirty && <span className="mr-auto text-xs text-stone">Есть несохранённые изменения</span>}
          <Button type="button" variant="ghost" disabled={!formState.isDirty} onClick={() => reset()}>
            Отменить
          </Button>
          <Button type="submit" loading={m.isPending} disabled={!formState.isDirty}>
            Сохранить настройки
          </Button>
        </div>
      )}
    </form>
  );
}
