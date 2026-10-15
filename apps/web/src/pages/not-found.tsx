import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Seo } from '@/lib/seo';

export default function NotFoundPage() {
  return (
    <div className="container-x flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <Seo title="Страница не найдена" noindex />
      <p className="editorial text-7xl text-stone">404</p>
      <h1 className="display mt-6 text-2xl">Такой страницы нет</h1>
      <p className="mt-3 max-w-sm text-sm text-stone">Возможно, ссылка устарела или товар снят с продажи.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/catalog">В каталог</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
