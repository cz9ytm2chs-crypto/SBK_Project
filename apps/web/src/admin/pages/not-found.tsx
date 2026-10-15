import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Seo } from '@/lib/seo';

export default function AdminNotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <Seo title="Раздел не найден" noindex />
      <p className="label text-stone">404</p>
      <h1 className="display mt-3 text-2xl">Такого раздела нет</h1>
      <p className="mt-2 max-w-sm text-sm text-stone">Проверьте адрес или вернитесь на главную панели управления.</p>
      <Button asChild className="mt-8">
        <Link to="/admin">К дашборду</Link>
      </Button>
    </div>
  );
}
