import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { registerSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField, Field, Input } from '@/components/ui/form';
import { PageSpinner } from '@/components/ui/misc';
import { useMe, useRegister } from '@/hooks/auth';
import { Seo } from '@/lib/seo';
import { applyServerErrors, safeNext } from './components/auth-errors';
import { AuthShell, FormAlert, PasswordInput, PasswordStrength } from './components/auth-ui';

// The shared schema requires `acceptTerms: true`; the form starts unchecked, so accept a boolean here.
const formSchema = registerSchema.extend({
  acceptTerms: z.boolean().refine((v) => v, 'Необходимо согласие с условиями'),
});

const linkCls = 'text-ink underline underline-offset-4 hover:text-rust';

export default function RegisterPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const { data: me, isLoading } = useMe();
  const signUp = useRegister();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', marketingOptIn: false, acceptTerms: false },
  });
  const password = watch('password') ?? '';

  if (sentTo)
    return (
      <AuthShell eyebrow="Почти готово" title="Проверьте почту">
        <Seo title="Регистрация" noindex />
        <div className="flex gap-4 border border-line bg-paper p-5" role="status">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-stone" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-graphite">
            Аккаунт создан. Мы отправили письмо для подтверждения на <span className="font-medium text-ink">{sentTo}</span>.
            Перейдите по ссылке из письма, чтобы подтвердить адрес. Если письма нет — проверьте папку «Спам».
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link to={next ?? '/account'}>{next ? 'Продолжить' : 'В личный кабинет'}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="flex-1">
            <Link to="/catalog">В каталог</Link>
          </Button>
        </div>
      </AuthShell>
    );

  if (isLoading) return <PageSpinner />;
  if (me && !signUp.isPending && !signUp.isSuccess) return <Navigate to={next ?? '/account'} replace />;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    signUp.mutate(
      { ...values, acceptTerms: true },
      {
        onSuccess: ({ user }) => setSentTo(user.email),
        onError: (err) => setFormError(applyServerErrors(err, setError, { EMAIL_TAKEN: 'email' })),
      },
    );
  });

  return (
    <AuthShell
      eyebrow="Личный кабинет"
      title="Регистрация"
      description="История заказов, сохранённые адреса и избранное на всех устройствах."
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className={linkCls}>
            Войти
          </Link>
        </>
      }
    >
      <Seo title="Регистрация" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Имя" error={errors.firstName?.message} required>
            {(p) => <Input {...p} {...register('firstName')} autoComplete="given-name" autoFocus />}
          </Field>
          <Field label="Фамилия" error={errors.lastName?.message}>
            {(p) => <Input {...p} {...register('lastName')} autoComplete="family-name" />}
          </Field>
        </div>
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} {...register('email')} type="email" inputMode="email" autoComplete="email" />}
        </Field>
        <div>
          <Field label="Пароль" error={errors.password?.message} required>
            {(p) => <PasswordInput {...p} {...register('password')} autoComplete="new-password" />}
          </Field>
          {!errors.password && <PasswordStrength password={password} />}
        </div>

        <div className="space-y-4 pt-2">
          <Controller
            control={control}
            name="marketingOptIn"
            render={({ field }) => (
              <CheckboxField
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                label="Хочу получать письма о новых коллекциях и закрытых распродажах"
              />
            )}
          />
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field }) => (
              <div>
                <CheckboxField
                  checked={!!field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={!!errors.acceptTerms}
                  label={
                    <>
                      Принимаю{' '}
                      <Link to="/terms" target="_blank" className={linkCls}>
                        пользовательское соглашение
                      </Link>{' '}
                      и{' '}
                      <Link to="/privacy" target="_blank" className={linkCls}>
                        политику конфиденциальности
                      </Link>
                      <span className="text-rust"> *</span>
                    </>
                  }
                />
                {errors.acceptTerms && (
                  <p role="alert" className="mt-1.5 pl-[30px] text-xs text-danger">
                    {errors.acceptTerms.message}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <Button type="submit" block size="lg" loading={signUp.isPending}>
          Создать аккаунт
        </Button>
      </form>
    </AuthShell>
  );
}
