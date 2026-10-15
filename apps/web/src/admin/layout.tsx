import {
  ExternalLink,
  FileText,
  FolderTree,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router';
import { ROLE_LABELS, hasPermission, type Permission } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { PageSpinner } from '@/components/ui/misc';
import { useLogout, useMe } from '@/hooks/auth';
import { Seo } from '@/lib/seo';
import { cn } from '@/lib/utils';
import { AccessDenied } from './components/page';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown when the user has any of these permissions. */
  any: Permission[];
  end?: boolean;
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Дашборд', icon: LayoutDashboard, any: ['dashboard.view'], end: true },
  { to: '/admin/orders', label: 'Заказы', icon: ShoppingBag, any: ['orders.read'] },
  { to: '/admin/products', label: 'Товары', icon: Package, any: ['products.read'] },
  { to: '/admin/categories', label: 'Категории и бренды', icon: FolderTree, any: ['categories.write', 'products.read'] },
  { to: '/admin/collections', label: 'Коллекции', icon: Layers, any: ['collections.write'] },
  { to: '/admin/customers', label: 'Покупатели', icon: Users, any: ['customers.read'] },
  { to: '/admin/content', label: 'Контент', icon: FileText, any: ['content.write', 'reviews.moderate'] },
  { to: '/admin/settings', label: 'Настройки', icon: Settings, any: ['settings.read'] },
  { to: '/admin/audit', label: 'Журнал действий', icon: ScrollText, any: ['audit.read'] },
];

export const visibleNav = (permissions: readonly string[] | undefined) =>
  ADMIN_NAV.filter((i) => i.any.some((p) => hasPermission(permissions, p)));

function Brand() {
  return (
    <Link to="/admin" className="flex items-baseline gap-2.5" aria-label="SILT Admin — дашборд">
      <span className="text-lg font-semibold tracking-[0.32em]">SILT</span>
      <span className="label text-rust">Admin</span>
    </Link>
  );
}

function SidebarNav({ permissions, onNavigate }: { permissions: readonly string[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Разделы админки" className="flex flex-col gap-0.5 p-3">
      {visibleNav(permissions).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xs px-3 py-2.5 text-sm transition-colors',
              isActive ? 'bg-ink text-milk' : 'text-graphite hover:bg-mist hover:text-ink',
            )
          }
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { data: user, isLoading } = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (isLoading) return <PageSpinner />;
  if (!user) return <Navigate to={'/login?next=' + encodeURIComponent(location.pathname + location.search)} replace />;
  if (!user.role)
    return (
      <>
        <Seo title="Нет доступа" noindex />
        <AccessDenied full message="Панель управления доступна только сотрудникам магазина." />
      </>
    );

  const signOut = () => {
    navigate('/', { replace: true });
    logout.mutate();
  };

  return (
    <div className="min-h-dvh bg-milk lg:grid lg:grid-cols-[15.5rem_1fr]">
      <Seo title="Панель управления" noindex />
      <a href="#admin-main" className="sr-only z-[70] bg-ink px-4 py-2 text-milk focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Перейти к содержимому
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-6">
          <Brand />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav permissions={user.permissions} />
        </div>
        <div className="border-t border-line p-3">
          <Link to="/" className="flex items-center gap-3 rounded-xs px-3 py-2.5 text-sm text-graphite transition-colors hover:bg-mist">
            <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden /> На сайт
          </Link>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" title="Меню" className="max-w-72">
          <SidebarNav permissions={user.permissions} onNavigate={() => setMenuOpen(false)} />
          <div className="border-t border-line p-3">
            <Link to="/" className="flex items-center gap-3 rounded-xs px-3 py-2.5 text-sm text-graphite hover:bg-mist">
              <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden /> На сайт
            </Link>
          </div>
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-paper/95 px-4 sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</p>
              <p className="label mt-0.5 text-stone">{ROLE_LABELS[user.role]}</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
              <Link to="/">
                <ExternalLink /> На сайт
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} loading={logout.isPending} aria-label="Выйти из аккаунта">
              <LogOut /> <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </header>

        <main id="admin-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
