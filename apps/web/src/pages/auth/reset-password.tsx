import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Link2Off } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { resetPasswordSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { applyServerErrors, errorCode } from './components/auth-errors';
import { AuthShell, FormAlert, PasswordInput, PasswordStrength } from './components/auth-ui';

const formSchema = resetPasswordSchema
  .omit({ token: true })
  .extend({ confirm: z.string().min(1, 'Повторите пароль') })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Пароли не совпадают' });

function InvalidLink() {
  return (
    <AuthShell eyebrow="Восстановление доступа" title="Ссылка устарела">
      <Seo title="Новый пароль" noindex />
      <div className="flex gap-4 border border-line bg-paper p-5">
        <Link2Off className="mt-0.5 size-5 shrink-0 text-stone" strokeWidth={1.5} aria-hidden />
        <p className="text-sm leading-relaxed text-graphite">
          Ссылка для смены пароля недействительна или срок её действия истёк. Запросите новую — это займёт минуту.
        </p>
      </div>
      <Button asChild block size="lg" className="mt-8">
        <Link to="/forgot-password">Запросить новую ссылку</Link>
      </Button>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [formError, setFormError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(formSchema), defaultValues: { password: '', confirm: '' } });
  const password = watch('password') ?? '';

  const m = useMutation({ mutationFn: (password: string) => api.post('/auth/reset-password', { token, password }) });

  if (token.length < 20 || expired) return <InvalidLink />;

  if (m.isSuccess)
    return (
      <AuthShell eyebrow="Восстановление доступа" title="Пароль обновлён">
        <Seo title="Новый пароль" noindex />
        <div className="flex gap-4 border border-line bg-paper p-5" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-graphite">
            Готово. Все прежние сеансы завершены — войдите с новым паролем.
          </p>
        </div>
        <Button asChild block size="lg" className="mt-8">
          <Link to="/login">Войти</Link>
        </Button>
      </AuthShell>
    );

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    m.mutate(values.password, {
      onError: (err) => {
        // A malformed token fails schema validation on the server — treat it the same as an expired one.
        if (errorCode(err) === 'TOKEN_INVALID' || (err instanceof ApiError && err.fieldErrors.token)) setExpired(true);
        else setFormError(applyServerErrors(err, setError));
      },
    });
  });

  return (
    <AuthShell eyebrow="Восстановление доступа" title="Новый пароль" description="Придумайте новый пароль для входа в аккаунт.">
      <Seo title="Новый пароль" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        {/* Hidden username helps password managers update the right entry. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <div>
          <Field label="Новый пароль" error={errors.password?.message} required>
            {(p) => <PasswordInput {...p} {...register('password')} autoComplete="new-password" autoFocus />}
          </Field>
          {!errors.password && <PasswordStrength password={password} />}
        </div>
        <Field label="Повторите пароль" error={errors.confirm?.message} required>
          {(p) => <PasswordInput {...p} {...register('confirm')} autoComplete="new-password" />}
        </Field>
        <Button type="submit" block size="lg" loading={m.isPending}>
          Сохранить пароль
        </Button>
      </form>
    </AuthShell>
  );
}
