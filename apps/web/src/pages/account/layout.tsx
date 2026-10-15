import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { useRef } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageSpinner } from '@/components/ui/misc';
import { useLogout, useMe } from '@/hooks/auth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Seo } from '@/lib/seo';
import { friendlyError } from '@/pages/auth/components/auth-errors';

const NAV = [
  { to: '/account', label: 'Обзор', end: true },
  { to: '/account/orders', label: 'Заказы' },
  { to: '/account/profile', label: 'Профиль' },
  { to: '/account/addresses', label: 'Адреса' },
  { to: '/favorites', label: 'Избранное' },
];

const navItem = (active: boolean) =>
  cn(
    'shrink-0 whitespace-nowrap text-sm transition-colors',
    // mobile: underline tabs; desktop: vertical list with a left rule
    '-mb-px border-b-2 pb-3 lg:mb-0 lg:block lg:border-b-0 lg:border-l-2 lg:py-2 lg:pb-2 lg:pl-4',
    active ? 'border-ink text-ink' : 'border-transparent text-stone hover:text-ink',
  );

export default function AccountLayout() {
  const { data: user, isLoading } = useMe();
  const { pathname } = useLocation();
  const logout = useLogout();
  const leaving = useRef(false);

  const resend = useMutation({
    mutationFn: () => api.post('/auth/resend-verification'),
    onSuccess: () => toast.success('Письмо отправлено. Проверьте почту'),
    onError: (e) => toast.error(friendlyError(e)),
  });

  if (isLoading) return <PageSpinner />;
  // After an explicit logout send the user home instead of to the login page.
  if (!user) return <Navigate to={leaving.current ? '/' : `/login?next=${encodeURIComponent(pathname)}`} replace />;

  const onLogout = () => {
    leaving.current = true;
    logout.mutate(undefined, { onSuccess: () => toast('Вы вышли из аккаунта') });
  };

  return (
    <div className="container-x pt-8 pb-16 md:pt-12">
      <Seo title="Личный кабинет" noindex />
      <header className="mb-8 md:mb-12">
        <p className="label text-stone">Личный кабинет</p>
        <p className="display mt-2 text-2xl md:text-3xl">
          {user.firstName} {user.lastName}
        </p>
        <p className="mt-1 text-sm text-stone">{user.email}</p>
      </header>

      {!user.emailVerified && (
        <div className="mb-8 flex flex-col gap-4 border border-line bg-mist/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.5} aria-hidden />
            <p className="text-sm leading-relaxed text-graphite">
              Подтвердите email <span className="font-medium text-ink">{user.email}</span> — так мы сможем присылать
              уведомления о заказах и восстановить доступ к аккаунту.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => resend.mutate()}
            loading={resend.isPending}
            disabled={resend.isSuccess}
          >
            {resend.isSuccess ? 'Письмо отправлено' : 'Отправить письмо ещё раз'}
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Разделы кабинета" className="lg:sticky lg:top-28 lg:self-start">
          <div className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b-0 lg:px-0">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navItem(isActive)}>
                {item.label}
              </NavLink>
            ))}
            {user.role && (
              <NavLink to="/admin" className={navItem(false)}>
                Админ-панель
              </NavLink>
            )}
            <button
              type="button"
              onClick={onLogout}
              disabled={logout.isPending}
              className={cn(navItem(false), 'text-left disabled:opacity-50 lg:mt-6 lg:border-t lg:border-l-0 lg:border-line lg:pt-4 lg:pl-0')}
            >
              Выйти
            </button>
          </div>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
