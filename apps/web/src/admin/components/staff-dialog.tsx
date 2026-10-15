import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { ROLE_KEYS, ROLE_LABELS, staffCreateSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect } from '@/components/ui/form';
import { api } from '@/lib/api';
import { applyServerErrors } from '../lib';

type StaffForm = z.input<typeof staffCreateSchema>;
const EMPTY: StaffForm = { email: '', firstName: '', lastName: '', password: '', role: 'MANAGER' };

export function StaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset, setError } = useForm<StaffForm, unknown, z.output<typeof staffCreateSchema>>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: EMPTY,
  });
  const m = useMutation({
    mutationFn: (v: z.output<typeof staffCreateSchema>) => api.post<{ id: string }>('/admin/customers/staff', v),
    onSuccess: () => {
      toast.success('Сотрудник создан');
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      reset(EMPTY);
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError, 'Не удалось создать сотрудника'),
  });
  const e = formState.errors;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset(EMPTY);
        onOpenChange(o);
      }}
    >
      <DialogContent title="Новый сотрудник" description="Учётная запись сразу получит доступ к панели управления согласно роли.">
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Имя" required error={e.firstName?.message}>
            {(p) => <Input {...p} autoComplete="off" {...register('firstName')} />}
          </Field>
          <Field label="Фамилия" error={e.lastName?.message}>
            {(p) => <Input {...p} autoComplete="off" {...register('lastName')} />}
          </Field>
          <Field label="Email" required error={e.email?.message} className="sm:col-span-2">
            {(p) => <Input {...p} type="email" autoComplete="off" {...register('email')} />}
          </Field>
          <Field label="Временный пароль" required error={e.password?.message} hint="Передайте сотруднику безопасным способом" className="sm:col-span-2">
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
          </Field>
          <Field label="Роль" required error={e.role?.message} className="sm:col-span-2">
            {(p) => (
              <NativeSelect {...p} {...register('role')}>
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={m.isPending}>
              Создать
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
