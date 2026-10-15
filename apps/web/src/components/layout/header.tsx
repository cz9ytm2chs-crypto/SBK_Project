import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useMe } from '@/hooks/auth';
import { useCart } from '@/hooks/cart';
import { useCategories, useSettings } from '@/hooks/common';
import { useFavoriteIds } from '@/hooks/favorites';
import { cn, money } from '@/lib/utils';
import { useUi } from '@/stores';
import { Logo } from './logo';

function IconButton({ label, onClick, to, count, children }: { label: string; onClick?: () => void; to?: string; count?: number; children: React.ReactNode }) {
  const cls = 'relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-mist [&_svg]:size-5 [&_svg]:stroke-[1.5]';
  const badge = !!count && (
    <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-medium text-milk tabular-nums">
      {count > 99 ? '99+' : count}
    </span>
  );
  const a11y = count ? `${label}: ${count}` : label;
  return to ? (
    <Link to={to} className={cls} aria-label={a11y}>
      {children}
      {badge}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} aria-label={a11y}>
      {children}
      {badge}
    </button>
  );
}

export function Header() {
  const { data: categories } = useCategories();
  const { data: cart } = useCart();
  const { data: user } = useMe();
  const { data: settings } = useSettings();
  const favorites = useFavoriteIds();
  const { setCartOpen, setSearchOpen, setMenuOpen } = useUi();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, setMenuOpen]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn('relative py-1 text-[0.8125rem] transition-colors hover:text-ink', isActive ? 'text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-ink' : 'text-graphite');

  return (
    <>
      {settings?.freeShippingFrom ? (
        <div className="bg-ink py-2 text-center text-2xs tracking-[0.12em] text-milk uppercase">
          Бесплатная доставка от {money(settings.freeShippingFrom)}
        </div>
      ) : null}
      <header className={cn('sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300', scrolled ? 'border-line bg-milk/95 backdrop-blur' : 'border-transparent bg-milk')}>
        <div className="container-x flex h-16 items-center gap-6">
          <div className="flex flex-1 items-center gap-2 lg:hidden">
            <IconButton label="Меню" onClick={() => setMenuOpen(true)}>
              <Menu />
            </IconButton>
            <IconButton label="Поиск" onClick={() => setSearchOpen(true)}>
              <Search />
            </IconButton>
          </div>
          <Logo className="shrink-0" />
          <nav aria-label="Категории" className="hidden flex-1 items-center gap-6 pl-6 lg:flex">
            <NavLink to="/catalog" end className={navClass}>
              Каталог
            </NavLink>
            {categories?.map((c) => (
              <NavLink key={c.id} to={`/category/${c.slug}`} className={navClass}>
                {c.name.split(' ')[0]}
              </NavLink>
            ))}
            <NavLink to="/collections" className={navClass}>
              Коллекции
            </NavLink>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-1 lg:flex-none">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mr-2 hidden h-10 w-52 items-center gap-2.5 rounded-full border border-line px-4 text-left text-sm text-stone transition-colors hover:border-stone lg:flex"
            >
              <Search className="size-4" strokeWidth={1.5} />
              Поиск
            </button>
            <span className="hidden sm:block">
              <IconButton label={user ? 'Личный кабинет' : 'Войти'} to={user ? '/account' : '/login'}>
                <User />
              </IconButton>
            </span>
            <IconButton label="Избранное" to="/favorites" count={favorites.length}>
              <Heart />
            </IconButton>
            <IconButton label="Корзина" onClick={() => setCartOpen(true)} count={cart?.itemCount}>
              <ShoppingBag />
            </IconButton>
          </div>
        </div>
      </header>
    </>
  );
}
