import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { changePasswordSchema, updateProfileSchema, type SessionUser, type UpdateProfileInput } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField, Field, Input } from '@/components/ui/form';
import { Badge, PageSpinner } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { applyServerErrors } from '@/pages/auth/components/auth-errors';
import { FormAlert, PasswordInput, PasswordStrength } from '@/pages/auth/components/auth-ui';
import { Panel } from './components/order-ui';

function ProfileForm({ user }: { user: SessionUser }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', marketingOptIn: user.marketingOptIn },
  });

  const m = useMutation({
    mutationFn: (body: UpdateProfileInput) => api.patch<{ user: SessionUser }>('/users/me', body),
    onSuccess: ({ user: fresh }) => {
      qc.setQueryData(qk.me, fresh);
      reset({ firstName: fresh.firstName, lastName: fresh.lastName, phone: fresh.phone ?? '', marketingOptIn: fresh.marketingOptIn });
      toast.success('Профиль сохранён');
    },
    onError: (err) => setFormError(applyServerErrors(err, setError)),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        m.mutate(v);
      })}
      noValidate
      className="space-y-5"
    >
      <FormAlert>{formError}</FormAlert>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Имя" error={errors.firstName?.message} required>
          {(p) => <Input {...p} {...register('firstName')} autoComplete="given-name" />}
        </Field>
        <Field label="Фамилия" error={errors.lastName?.message}>
          {(p) => <Input {...p} {...register('lastName')} autoComplete="family-name" />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Телефон" error={errors.phone?.message} hint="Для связи по заказам">
          {(p) => <Input {...p} {...register('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 900 000-00-00" />}
        </Field>
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-graphite">
            Email
            {user.emailVerified ? <Badge tone="success">Подтверждён</Badge> : <Badge tone="warning">Не подтверждён</Badge>}
          </p>
          <p className="flex h-11 items-center border-b border-line text-sm text-stone">{user.email}</p>
        </div>
      </div>
      <Controller
        control={control}
        name="marketingOptIn"
        render={({ field }) => (
          <CheckboxField
            checked={!!field.value}
            onCheckedChange={(v) => field.onChange(v === true)}
            label="Получать письма о новых коллекциях и закрытых распродажах"
          />
        )}
      />
      <div className="pt-2">
        <Button type="submit" loading={m.isPending} disabled={!isDirty}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '' } });
  const newPassword = watch('newPassword') ?? '';

  const m = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', body),
    onSuccess: () => {
      reset();
      toast.success('Пароль изменён, другие сеансы завершены');
    },
    onError: (err) => setFormError(applyServerErrors(err, setError, { INVALID_PASSWORD: 'currentPassword' })),
  });

  return (
    <form
      onSubmit={handleSubmit((v) => {
        setFormError(null);
        m.mutate(v);
      })}
      noValidate
      className="space-y-5"
    >
      <FormAlert>{formError}</FormAlert>
      <Field label="Текущий пароль" error={errors.currentPassword?.message} required>
        {(p) => <PasswordInput {...p} {...register('currentPassword')} autoComplete="current-password" />}
      </Field>
      <div>
        <Field label="Новый пароль" error={errors.newPassword?.message} required>
          {(p) => <PasswordInput {...p} {...register('newPassword')} autoComplete="new-password" />}
        </Field>
        {!errors.newPassword && <PasswordStrength password={newPassword} />}
      </div>
      <p className="text-xs leading-relaxed text-stone">После смены пароля мы завершим все остальные сеансы — на других устройствах нужно будет войти заново.</p>
      <div className="pt-2">
        <Button type="submit" variant="outline" loading={m.isPending}>
          Изменить пароль
        </Button>
      </div>
    </form>
  );
}

export default function AccountProfilePage() {
  const { data: user } = useMe();
  if (!user) return <PageSpinner />;
  return (
    <div>
      <Seo title="Профиль" noindex />
      <h1 className="display text-3xl">Профиль</h1>
      <p className="mt-2 text-sm text-stone">Личные данные и безопасность аккаунта.</p>
      <div className="mt-10 grid max-w-3xl gap-8">
        <Panel title="Личные данные">
          <ProfileForm key={user.id} user={user} />
        </Panel>
        <Panel title="Пароль">
          <PasswordForm />
        </Panel>
      </div>
    </div>
  );
}
