import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2Off } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { errorCode, friendlyError } from './components/auth-errors';
import { AuthShell } from './components/auth-ui';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const qc = useQueryClient();
  const { data: me } = useMe();
  const started = useRef(false);

  const verify = useMutation({
    mutationFn: () => api.post('/auth/verify-email', { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.me }),
  });
  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification'),
    onSuccess: () => toast.success('Письмо отправлено. Проверьте почту'),
    onError: (e) => toast.error(friendlyError(e)),
  });

  const hasToken = token.length >= 20;
  useEffect(() => {
    // Tokens are single-use: guard against the StrictMode double effect.
    if (!hasToken || started.current) return;
    started.current = true;
    verify.mutate();
  }, [hasToken, verify]);

  const seo = <Seo title="Подтверждение email" noindex />;

  if (hasToken && (verify.isIdle || verify.isPending))
    return (
      <AuthShell eyebrow="Подтверждение email" title="Проверяем ссылку…">
        {seo}
        <div className="flex items-center gap-3 text-sm text-stone" role="status">
          <Spinner className="size-4" /> Это займёт пару секунд
        </div>
      </AuthShell>
    );

  if (verify.isSuccess)
    return (
      <AuthShell eyebrow="Подтверждение email" title="Email подтверждён">
        {seo}
        <div className="flex gap-4 border border-line bg-paper p-5" role="status">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-graphite">Спасибо! Адрес подтверждён — теперь вы будете получать уведомления о заказах.</p>
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link to={me ? '/account' : '/login'}>{me ? 'В личный кабинет' : 'Войти'}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="flex-1">
            <Link to="/catalog">В каталог</Link>
          </Button>
        </div>
      </AuthShell>
    );

  const expired = !hasToken || errorCode(verify.error) === 'TOKEN_INVALID' || errorCode(verify.error) === 'VALIDATION_ERROR';

  return (
    <AuthShell eyebrow="Подтверждение email" title={expired ? 'Ссылка устарела' : 'Не удалось подтвердить'}>
      {seo}
      <div className="flex gap-4 border border-line bg-paper p-5" role="alert">
        <Link2Off className="mt-0.5 size-5 shrink-0 text-stone" strokeWidth={1.5} aria-hidden />
        <p className="text-sm leading-relaxed text-graphite">
          {expired
            ? 'Ссылка для подтверждения недействительна или срок её действия истёк. Возможно, адрес уже подтверждён.'
            : friendlyError(verify.error)}
        </p>
      </div>
      <div className="mt-8 flex flex-col gap-3">
        {!expired && (
          <Button size="lg" variant="outline" onClick={() => verify.mutate()} loading={verify.isPending}>
            Повторить
          </Button>
        )}
        {me ? (
          me.emailVerified ? (
            <Button asChild size="lg">
              <Link to="/account">Адрес уже подтверждён — в кабинет</Link>
            </Button>
          ) : (
            <Button size="lg" onClick={() => resend.mutate()} loading={resend.isPending} disabled={resend.isSuccess}>
              {resend.isSuccess ? 'Письмо отправлено' : 'Отправить письмо ещё раз'}
            </Button>
          )
        ) : (
          <>
            <Button asChild size="lg">
              <Link to="/login?next=%2Faccount">Войти, чтобы получить новую ссылку</Link>
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
