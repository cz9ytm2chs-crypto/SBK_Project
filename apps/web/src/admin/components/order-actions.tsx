import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ORDER_STATUS_LABELS, SHIPMENT_STATUS_LABELS, shipmentUpdateSchema, type OrderStatus } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/utils';
import { ak, applyServerErrors, rublesToKopecks, useCan } from '../lib';
import type { AdminOrder } from '../types';

function useInvalidateOrder(id: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ak.order(id) }),
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
}

// ── Status transitions ──
export function StatusActions({ order }: { order: AdminOrder }) {
  const can = useCan();
  const invalidate = useInvalidateOrder(order.id);
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [comment, setComment] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/orders/${order.id}/status`, { status: target, comment }),
    onSuccess: async () => {
      toast.success(`Статус: ${ORDER_STATUS_LABELS[target!]}`);
      setTarget(null);
      setComment('');
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const allowed = order.nextStatuses.filter((s) => (s === 'CANCELLED' ? can('orders.cancel') : can('orders.update')));
  if (!allowed.length) return <p className="text-sm text-stone">Нет доступных переходов статуса.</p>;
  const cancelling = target === 'CANCELLED';

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowed.map((s) => (
          <Button key={s} size="sm" variant={s === 'CANCELLED' ? 'outline' : 'primary'} onClick={() => setTarget(s)} className={s === 'CANCELLED' ? 'border-danger text-danger hover:bg-danger hover:text-white' : undefined}>
            {s === 'CANCELLED' ? 'Отменить заказ' : `→ ${ORDER_STATUS_LABELS[s]}`}
          </Button>
        ))}
      </div>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        {target && (
          <DialogContent
            title={cancelling ? `Отменить заказ ${order.number}?` : `Перевести в «${ORDER_STATUS_LABELS[target]}»`}
            description={
              cancelling
                ? 'Резерв товаров будет снят, покупатель получит письмо. Действие необратимо.'
                : target === 'SHIPPED'
                  ? 'Покупатель получит письмо с данными отправления — заполните трек-номер заранее.'
                  : undefined
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                m.mutate();
              }}
              className="space-y-5"
            >
              <Field label={cancelling ? 'Причина отмены' : 'Комментарий (необязательно)'} hint="Сохраняется в истории заказа">
                {(p) => <Textarea {...p} rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />}
              </Field>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
                  Назад
                </Button>
                <Button type="submit" variant={cancelling ? 'danger' : 'primary'} loading={m.isPending}>
                  {cancelling ? 'Отменить заказ' : 'Подтвердить'}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

// ── Shipment ──
type ShipmentForm = z.input<typeof shipmentUpdateSchema>;

export function ShipmentEditor({ order }: { order: AdminOrder }) {
  const can = useCan();
  const invalidate = useInvalidateOrder(order.id);
  const s = order.shipment;
  const form = useForm<ShipmentForm, unknown, z.output<typeof shipmentUpdateSchema>>({
    resolver: zodResolver(shipmentUpdateSchema),
    defaultValues: { carrier: s?.carrier ?? '', trackingNumber: s?.trackingNumber ?? '', trackingUrl: s?.trackingUrl ?? '', status: s?.status ?? 'PENDING' },
  });
  const { register, handleSubmit, formState, reset, setError } = form;
  const m = useMutation({
    mutationFn: (v: z.output<typeof shipmentUpdateSchema>) =>
      api.put(`/admin/orders/${order.id}/shipment`, { ...v, carrier: v.carrier || null, trackingNumber: v.trackingNumber || null, trackingUrl: v.trackingUrl || null }),
    onSuccess: async (_r, v) => {
      toast.success('Данные отправления сохранены');
      reset(v);
      await invalidate();
    },
    onError: (e) => applyServerErrors(e, setError),
  });
  const disabled = !can('orders.update');

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <Field label="Перевозчик" error={formState.errors.carrier?.message}>
          {(p) => <Input {...p} placeholder="СДЭК, Почта России…" {...register('carrier')} />}
        </Field>
        <Field label="Статус отправления" error={formState.errors.status?.message}>
          {(p) => (
            <NativeSelect {...p} {...register('status')}>
              {Object.entries(SHIPMENT_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Трек-номер" error={formState.errors.trackingNumber?.message}>
          {(p) => <Input {...p} className="font-mono text-xs" {...register('trackingNumber')} />}
        </Field>
        <Field label="Ссылка для отслеживания" error={formState.errors.trackingUrl?.message}>
          {(p) => <Input {...p} type="url" placeholder="https://" {...register('trackingUrl')} />}
        </Field>
      </fieldset>
      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" variant="outline" loading={m.isPending} disabled={!formState.isDirty}>
            Сохранить отправление
          </Button>
        </div>
      )}
    </form>
  );
}

// ── Refund ──
const refundFormSchema = z.object({
  amount: z.string().trim().min(1, 'Укажите сумму'),
  reason: z.string().trim().min(3, 'Укажите причину').max(300),
  restock: z.boolean(),
});
type RefundForm = z.infer<typeof refundFormSchema>;

export function refundableAmount(order: AdminOrder) {
  return order.payments
    .filter((p) => p.status === 'SUCCEEDED' || p.status === 'PARTIALLY_REFUNDED')
    .reduce((s, p) => s + p.amount - p.refundedAmount, 0);
}

export function RefundDialog({ order, open, onOpenChange }: { order: AdminOrder; open: boolean; onOpenChange: (o: boolean) => void }) {
  const invalidate = useInvalidateOrder(order.id);
  const remaining = refundableAmount(order);
  const form = useForm<RefundForm>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: { amount: String(remaining / 100), reason: '', restock: true },
  });
  const { register, handleSubmit, formState, control, setError, reset } = form;
  const m = useMutation({
    mutationFn: (body: { amount: number; reason: string; restock: boolean }) => api.post(`/admin/orders/${order.id}/refund`, body),
    onSuccess: async () => {
      toast.success('Возврат оформлен');
      onOpenChange(false);
      reset({ amount: '', reason: '', restock: true });
      await invalidate();
    },
    onError: (e) => applyServerErrors(e, setError, 'Не удалось оформить возврат'),
  });

  const submit = handleSubmit((v) => {
    const amount = rublesToKopecks(v.amount);
    if (!amount || amount < 1) return setError('amount', { message: 'Некорректная сумма' });
    if (amount > remaining) return setError('amount', { message: `Не больше ${money(remaining)}` });
    m.mutate({ amount, reason: v.reason, restock: v.restock });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) reset({ amount: String(remaining / 100), reason: '', restock: true });
        onOpenChange(o);
      }}
    >
      <DialogContent title={`Возврат по заказу ${order.number}`} description={`Доступно к возврату: ${money(remaining)}. Деньги вернутся через платёжного провайдера.`}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Сумма возврата, ₽" required error={formState.errors.amount?.message} hint="По умолчанию — весь остаток">
            {(p) => <Input {...p} inputMode="decimal" {...register('amount')} />}
          </Field>
          <Field label="Причина" required error={formState.errors.reason?.message}>
            {(p) => <Textarea {...p} rows={3} {...register('reason')} />}
          </Field>
          <Controller
            control={control}
            name="restock"
            render={({ field }) => (
              <CheckboxField label="Вернуть товары на склад" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
            )}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="danger" loading={m.isPending}>
              Оформить возврат
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Notes ──
export function NotesPanel({ order }: { order: AdminOrder }) {
  const can = useCan();
  const invalidate = useInvalidateOrder(order.id);
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => api.post(`/admin/orders/${order.id}/notes`, { body }),
    onSuccess: async () => {
      setBody('');
      toast.success('Заметка добавлена');
      await invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-4">
      {can('orders.update') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) m.mutate();
          }}
          className="space-y-2"
        >
          <Field label="Новая заметка" hint="Видна только сотрудникам">
            {(p) => <Textarea {...p} rows={2} className="min-h-0" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="outline" disabled={!body.trim()} loading={m.isPending}>
              Добавить
            </Button>
          </div>
        </form>
      )}
      {order.notes.length === 0 ? (
        <p className="text-sm text-stone">Заметок нет.</p>
      ) : (
        <ul className="space-y-3">
          {order.notes.map((n) => (
            <li key={n.id} className="border-l-2 border-line pl-3">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-2xs text-stone">
                {n.author} · {new Date(n.createdAt).toLocaleString('ru-RU')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
