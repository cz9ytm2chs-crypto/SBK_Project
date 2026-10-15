import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { loginSchema, type SessionUser } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { PageSpinner } from '@/components/ui/misc';
import { useLogin, useMe } from '@/hooks/auth';
import { Seo } from '@/lib/seo';
import { applyServerErrors, safeNext } from './components/auth-errors';
import { AuthShell, FormAlert, PasswordInput } from './components/auth-ui';

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const { data: me, isLoading } = useMe();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);

  const destination = (user: SessionUser) => next ?? (user.role ? '/admin' : '/account');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  if (isLoading) return <PageSpinner />;
  if (me && !login.isPending && !login.isSuccess) return <Navigate to={destination(me)} replace />;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: ({ user }) => navigate(destination(user), { replace: true }),
      onError: (err) => setFormError(applyServerErrors(err, setError)),
    });
  });

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : '/register';

  return (
    <AuthShell
      eyebrow="Личный кабинет"
      title="Вход"
      description="Заказы, адреса и избранное — в одном месте."
      footer={
        <>
          Впервые в SILT?{' '}
          <Link to={registerHref} className="text-ink underline underline-offset-4 hover:text-rust">
            Создать аккаунт
          </Link>
        </>
      }
    >
      <Seo title="Вход" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} {...register('email')} type="email" inputMode="email" autoComplete="email" autoFocus />}
        </Field>
        <div>
          <Field label="Пароль" error={errors.password?.message} required>
            {(p) => <PasswordInput {...p} {...register('password')} autoComplete="current-password" />}
          </Field>
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs text-stone underline-offset-4 hover:text-ink hover:underline">
              Забыли пароль?
            </Link>
          </div>
        </div>
        <Button type="submit" block size="lg" loading={login.isPending}>
          Войти
        </Button>
      </form>

      <div className="mt-8 border border-dashed border-line px-4 py-3 text-xs leading-relaxed text-stone">
        Демо: demo@silt.store / Demo12345
      </div>
    </AuthShell>
  );
}
