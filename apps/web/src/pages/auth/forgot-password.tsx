import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { forgotPasswordSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { errorCode, friendlyError } from './components/auth-errors';
import { AuthShell, FormAlert } from './components/auth-ui';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const m = useMutation({ mutationFn: (body: { email: string }) => api.post('/auth/forgot-password', body) });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    m.mutate(values, {
      onSuccess: () => setSent(values.email),
      onError: (err) => {
        // Never reveal whether the account exists: only throttling / connectivity problems are shown.
        const code = errorCode(err);
        if (code === 'RATE_LIMITED' || code === 'NETWORK_ERROR') setFormError(friendlyError(err));
        else setSent(values.email);
      },
    });
  });

  const back = (
    <Link to="/login" className="text-ink underline underline-offset-4 hover:text-rust">
      Вернуться ко входу
    </Link>
  );

  if (sent)
    return (
      <AuthShell eyebrow="Восстановление доступа" title="Проверьте почту" footer={back}>
        <Seo title="Восстановление пароля" noindex />
        <div className="flex gap-4 border border-line bg-paper p-5" role="status">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-stone" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-graphite">
            Если аккаунт с адресом <span className="font-medium text-ink">{sent}</span> существует, мы отправили на него
            ссылку для смены пароля. Ссылка действует ограниченное время. Не пришло письмо — проверьте «Спам» или{' '}
            <button type="button" onClick={() => setSent(null)} className="underline underline-offset-4 hover:text-rust">
              попробуйте ещё раз
            </button>
            .
          </p>
        </div>
      </AuthShell>
    );

  return (
    <AuthShell
      eyebrow="Восстановление доступа"
      title="Забыли пароль?"
      description="Укажите email, который использовали при регистрации, — пришлём ссылку для смены пароля."
      footer={back}
    >
      <Seo title="Восстановление пароля" noindex />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <Field label="Email" error={errors.email?.message} required>
          {(p) => <Input {...p} {...register('email')} type="email" inputMode="email" autoComplete="email" autoFocus />}
        </Field>
        <Button type="submit" block size="lg" loading={m.isPending}>
          Отправить ссылку
        </Button>
      </form>
    </AuthShell>
  );
}
