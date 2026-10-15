import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { useMe } from '@/hooks/auth';
import { useCategories } from '@/hooks/common';
import { useUi } from '@/stores';

export function MobileMenu() {
  const { menuOpen, setMenuOpen } = useUi();
  const { data: categories } = useCategories();
  const { data: user } = useMe();
  const row = 'flex items-center justify-between border-b border-line py-4 text-lg';
  return (
    <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
      <SheetContent side="left" title="Меню">
        <nav className="px-5 pb-10" aria-label="Мобильное меню">
          <Link to="/catalog" className={row}>
            Весь каталог <ArrowRight className="size-4 text-stone" />
          </Link>
          {categories?.map((c) => (
            <Link key={c.id} to={`/category/${c.slug}`} className={row}>
              {c.name}
              <span className="text-xs text-stone">{c.productCount}</span>
            </Link>
          ))}
          <Link to="/collections" className={row}>
            Коллекции <ArrowRight className="size-4 text-stone" />
          </Link>
          <div className="mt-8 grid gap-3 text-sm text-graphite">
            <Link to={user ? '/account' : '/login'}>{user ? 'Личный кабинет' : 'Войти или зарегистрироваться'}</Link>
            <Link to="/favorites">Избранное</Link>
            <Link to="/delivery">Доставка</Link>
            <Link to="/returns">Возврат и обмен</Link>
            <Link to="/contacts">Контакты</Link>
          </div>
        </nav>
      </SheetContent>
    </Dialog>
  );
}
