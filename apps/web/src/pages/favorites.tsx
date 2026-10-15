import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { Link } from 'react-router';
import type { ProductCardDTO } from '@silt/shared';
import { ProductGrid } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, PageSpinner } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { useFavoriteIds } from '@/hooks/favorites';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { plural } from '@/lib/utils';

/** The by-ids endpoint accepts at most 40 ids. */
const GUEST_LIMIT = 40;

export default function FavoritesPage() {
  const { data: user, isLoading: meLoading } = useMe();
  const ids = useFavoriteIds();
  const guestIds = ids.slice(0, GUEST_LIMIT);

  const account = useQuery({
    queryKey: qk.favorites,
    queryFn: () => api.get<ProductCardDTO[]>('/favorites'),
    enabled: !!user,
  });
  const guest = useQuery({
    queryKey: qk.productsByIds(guestIds),
    queryFn: () => api.get<ProductCardDTO[]>('/products/by-ids', { ids: guestIds }),
    enabled: !meLoading && !user && guestIds.length > 0,
    placeholderData: keepPreviousData,
  });

  // Same query as useFavoriteIds — tells us whether the server ids have loaded yet.
  const serverIds = useQuery({ queryKey: qk.favoriteIds, queryFn: () => api.get<string[]>('/favorites/ids'), enabled: !!user });

  const q = user ? account : guest;
  // Hide items the moment their heart is toggled off (the refetch follows).
  const known = user ? !!serverIds.data : true;
  const products = (q.data ?? []).filter((p) => !known || ids.includes(p.id));
  const emptyGuest = !user && guestIds.length === 0;
  const loading = meLoading || (!emptyGuest && q.isPending);

  return (
    <div className="container-x pt-10 pb-16 md:pt-14">
      <Seo title="Избранное" noindex />
      <header className="flex flex-col gap-3 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {user && (
            <Link to="/account" className="label text-stone hover:text-ink">
              Личный кабинет
            </Link>
          )}
          <h1 className="display mt-2 text-3xl md:text-4xl">Избранное</h1>
        </div>
        {!loading && products.length > 0 && (
          <p className="text-sm text-stone">
            {products.length} {plural(products.length, ['товар', 'товара', 'товаров'])}
          </p>
        )}
      </header>

      {!user && !meLoading && (
        <div className="mt-6 flex flex-col gap-3 border border-line bg-paper px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-graphite">Войдите, чтобы сохранить избранное в аккаунте и видеть его на всех устройствах.</p>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/login?next=%2Ffavorites">Войти</Link>
          </Button>
        </div>
      )}

      <div className="mt-10">
        {meLoading ? (
          <PageSpinner />
        ) : loading ? (
          <ProductGrid loading skeletons={Math.min(Math.max(ids.length, 4), 8)} />
        ) : q.isError && !emptyGuest ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Heart />}
            title="Здесь пока пусто"
            description="Нажмите на сердечко на карточке товара, чтобы сохранить вещь и вернуться к ней позже."
            action={
              <Button asChild>
                <Link to="/catalog">Перейти в каталог</Link>
              </Button>
            }
          />
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </div>
  );
}
