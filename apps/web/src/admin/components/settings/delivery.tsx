import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { deliveryMethodInputSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, Textarea } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { money } from '@/lib/utils';
import { ak, applyServerErrors } from '../../lib';
import type { DeliveryMethodRow } from '../../types';
import { ActiveBadge } from '../badges';
import { MoneyInput } from '../inputs';
import { QueryError, TableSkeleton } from '../page';

type In = z.input<typeof deliveryMethodInputSchema>;
type Out = z.output<typeof deliveryMethodInputSchema>;

const TYPE_LABELS: Record<DeliveryMethodRow['type'], string> = { COURIER: 'Курьер', PICKUP: 'Самовывоз', PICKUP_POINT: 'Пункт выдачи' };

const toForm = (m: DeliveryMethodRow): In => ({
  name: m.name,
  description: m.description,
  price: m.price,
  freeFromAmount: m.freeFromAmount,
  estimatedDaysMin: m.estimatedDaysMin,
  estimatedDaysMax: m.estimatedDaysMax,
  isActive: m.isActive,
  sortOrder: m.sortOrder,
});

function DeliveryDialog({ method, onClose }: { method: DeliveryMethodRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, formState, reset, setError } = useForm<In, unknown, Out>({
    resolver: zodResolver(deliveryMethodInputSchema),
    defaultValues: method ? toForm(method) : undefined,
  });
  useEffect(() => {
    if (method) reset(toForm(method));
  }, [method, reset]);
  const m = useMutation({
    mutationFn: (v: Out) => {
      if (v.estimatedDaysMax < v.estimatedDaysMin) throw Object.assign(new Error('Максимальный срок меньше минимального'), { field: true });
      return api.put(`/admin/settings/delivery-methods/${method!.id}`, v);
    },
    onSuccess: () => {
      toast.success('Способ доставки сохранён');
      qc.invalidateQueries({ queryKey: ak.delivery });
      qc.invalidateQueries({ queryKey: ['checkout-options'] });
      onClose();
    },
    onError: (e) => {
      if ((e as { field?: boolean }).field) setError('estimatedDaysMax', { message: e.message });
      else applyServerErrors(e, setError);
    },
  });
  const e = formState.errors;
  return (
    <Dialog open={!!method} onOpenChange={(o) => !o && onClose()}>
      {method && (
        <DialogContent title={method.name} description={`${TYPE_LABELS[method.type]} · код ${method.code}`}>
          <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label="Название" required error={e.name?.message} className="sm:col-span-2">
              {(p) => <Input {...p} {...register('name')} />}
            </Field>
            <Field label="Описание" error={e.description?.message} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={2} className="min-h-0" {...register('description')} />}
            </Field>
            <Field label="Стоимость" error={e.price?.message}>
              {(p) => <Controller control={control} name="price" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={(v) => field.onChange(v ?? 0)} />} />}
            </Field>
            <Field label="Бесплатно от" error={e.freeFromAmount?.message} hint="Пусто — всегда платно">
              {(p) => <Controller control={control} name="freeFromAmount" render={({ field }) => <MoneyInput {...p} nullable value={field.value} onChange={field.onChange} />} />}
            </Field>
            <Field label="Срок от, дней" error={e.estimatedDaysMin?.message}>
              {(p) => <Input {...p} type="number" min={0} max={60} {...register('estimatedDaysMin', { valueAsNumber: true })} />}
            </Field>
            <Field label="Срок до, дней" error={e.estimatedDaysMax?.message}>
              {(p) => <Input {...p} type="number" min={0} max={60} {...register('estimatedDaysMax', { valueAsNumber: true })} />}
            </Field>
            <Field label="Порядок" error={e.sortOrder?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />}
            </Field>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <CheckboxField className="self-end pb-3" label="Доступен при оформлении" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
            />
            <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" loading={m.isPending}>
                Сохранить
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export function DeliveryTab({ canWrite }: { canWrite: boolean }) {
  const q = useQuery({ queryKey: ak.delivery, queryFn: () => api.get<DeliveryMethodRow[]>('/admin/settings/delivery-methods') });
  const [editing, setEditing] = useState<DeliveryMethodRow | null>(null);
  if (q.isLoading) return <TableSkeleton rows={3} cols={5} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={<Truck />} title="Способов доставки нет" />;
  return (
    <div className="border border-line bg-paper">
      <Table>
        <thead>
          <tr>
            <Th>Способ</Th>
            <Th className="text-right">Стоимость</Th>
            <Th className="text-right">Бесплатно от</Th>
            <Th>Срок</Th>
            <Th>Статус</Th>
            <Th>
              <span className="sr-only">Действия</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((m) => (
            <Tr key={m.id}>
              <Td>
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-stone">
                  {TYPE_LABELS[m.type]}
                  {m.pickupPoints.length > 0 && ` · пунктов: ${m.pickupPoints.length}`}
                </p>
              </Td>
              <Td className="text-right tabular-nums">{m.price ? money(m.price) : 'бесплатно'}</Td>
              <Td className="text-right tabular-nums">{m.freeFromAmount !== null ? money(m.freeFromAmount) : '—'}</Td>
              <Td className="tabular-nums">
                {m.estimatedDaysMin === m.estimatedDaysMax ? m.estimatedDaysMin : `${m.estimatedDaysMin}–${m.estimatedDaysMax}`} дн.
              </Td>
              <Td>
                <ActiveBadge active={m.isActive} />
              </Td>
              <Td className="text-right">
                {canWrite && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditing(m)} aria-label={`Редактировать «${m.name}»`}>
                    <Pencil />
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <DeliveryDialog method={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
