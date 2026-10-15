import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { ChevronRight, SearchX, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { SORT_OPTIONS, type CategoryDTO, type CollectionDTO, type ProductListDTO, type SortOption } from '@silt/shared';
import { ProductGrid } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/data';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { ActiveFilters, FiltersPanel } from '@/features/catalog/filters';
import { useCatalogParams } from '@/features/catalog/use-catalog-params';
import { useCategories } from '@/hooks/common';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, imageUrl, plural } from '@/lib/utils';
import { useLocal } from '@/stores';
import NotFoundPage from './not-found';

type Mode = { kind: 'all' } | { kind: 'category'; slug: string } | { kind: 'collection'; slug: string } | { kind: 'search' };

export default function CatalogPage() {
  const { slug } = useParams();
  const { pathname } = useLocation();
  const mode: Mode = pathname.startsWith('/category/') ? { kind: 'category', slug: slug! } : pathname.startsWith('/collections/') ? { kind: 'collection', slug: slug! } : pathname.startsWith('/search') ? { kind: 'search' } : { kind: 'all' };

  const catalog = useCatalogParams();
  const { filters, update, reset, activeCount } = catalog;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: categories } = useCategories();
  const addSearch = useLocal((s) => s.addSearch);

  const category = useQuery({
    queryKey: qk.category(slug ?? ''),
    queryFn: () => api.get<CategoryDTO & { parent: { slug: string; name: string } | null }>(`/categories/${slug}`),
    enabled: mode.kind === 'category',
  });
  const collection = useQuery({
    queryKey: qk.collection(slug ?? ''),
    queryFn: () => api.get<CollectionDTO>(`/collections/${slug}`),
    enabled: mode.kind === 'collection',
  });

  const params = {
    ...filters,
    category: mode.kind === 'category' ? mode.slug : undefined,
    collection: mode.kind === 'collection' ? mode.slug : undefined,
    pageSize: 24,
  };
  const products = useQuery({
    queryKey: qk.products(params),
    queryFn: () => api.get<ProductListDTO>('/products', params),
    placeholderData: keepPreviousData, // keep the grid while filters change — no flicker
    enabled: mode.kind !== 'search' || !!filters.q,
  });

  // Count a search once per query for "popular queries".
  const logged = useRef<string>('');
  const log = useMutation({ mutationFn: (q: string) => api.post('/search/log', { q }) });
  useEffect(() => {
    if (mode.kind === 'search' && filters.q && products.data && !products.isPlaceholderData && logged.current !== filters.q) {
      logged.current = filters.q;
      addSearch(filters.q);
      if (products.data.total > 0) log.mutate(filters.q);
    }
  }, [mode.kind, filters.q, products.data, products.isPlaceholderData, addSearch, log]);

  const notFound = [category.error, collection.error, products.error].some((e) => e instanceof ApiError && e.status === 404);
  if (notFound) return <NotFoundPage />;

  const meta =
    mode.kind === 'category'
      ? { title: category.data?.name, description: category.data?.description, seoTitle: category.data?.seoTitle, seoDescription: category.data?.seoDescription, image: category.data?.imageUrl }
      : mode.kind === 'collection'
        ? { title: collection.data?.name, description: collection.data?.description, seoTitle: collection.data?.seoTitle, seoDescription: collection.data?.seoDescription, image: collection.data?.imageUrl, eyebrow: collection.data?.season }
        : mode.kind === 'search'
          ? { title: filters.q ? `«${filters.q}»` : 'Поиск', description: undefined }
          : { title: 'Каталог', description: 'Одежда, обувь и аксессуары SILT' };

  const data = products.data;
  const total = data?.total ?? 0;
  const subcategories = mode.kind === 'category' ? category.data?.children : undefined;
  const headerLoading = (mode.kind === 'category' && category.isLoading) || (mode.kind === 'collection' && collection.isLoading);

  return (
    <div>
      <Seo
        title={meta.seoTitle || (mode.kind === 'search' ? `Поиск: ${filters.q ?? ''}` : meta.title ?? 'Каталог')}
        description={meta.seoDescription || meta.description || undefined}
        image={meta.image}
        noindex={mode.kind === 'search' || activeCount > 0 || filters.page > 1}
      />

      {mode.kind === 'collection' && collection.data?.imageUrl ? (
        <section className="relative h-[46vh] min-h-80 overflow-hidden bg-graphite text-milk">
          <img src={imageUrl(collection.data.imageUrl, 1800, 0.5)} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
          <div className="container-x relative flex h-full flex-col justify-end pb-10">
            <Breadcrumbs items={[{ to: '/collections', label: 'Коллекции' }]} light />
            {meta.eyebrow && <p className="label mt-4 text-milk/75">{meta.eyebrow}</p>}
            <h1 className="display mt-2 text-4xl md:text-6xl">{meta.title}</h1>
            <p className="mt-3 max-w-xl text-sm text-milk/80">{meta.description}</p>
          </div>
        </section>
      ) : (
        <div className="container-x pt-8 md:pt-12">
          <Breadcrumbs
            items={[
              { to: '/catalog', label: 'Каталог' },
              ...(category.data?.parent ? [{ to: `/category/${category.data.parent.slug}`, label: category.data.parent.name }] : []),
            ]}
          />
          {headerLoading ? (
            <Skeleton className="mt-4 h-10 w-64" />
          ) : (
            <h1 className="display mt-4 text-3xl md:text-5xl">
              {mode.kind === 'search' && <span className="text-stone">Результаты поиска </span>}
              {meta.title}
            </h1>
          )}
          {meta.description && mode.kind !== 'all' && <p className="mt-3 max-w-2xl text-sm text-stone">{meta.description}</p>}
          {!!subcategories?.length && (
            <div className="mt-6 flex flex-wrap gap-2">
              {subcategories.map((c) => (
                <Link key={c.id} to={`/category/${c.slug}`} className="rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-ink">
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="container-x mt-8 lg:grid lg:grid-cols-[240px_1fr] lg:gap-12">
        <aside className="hidden lg:block" aria-label="Фильтры">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 pb-10 no-scrollbar">
            <FiltersPanel facets={data?.facets} catalog={catalog} categories={mode.kind === 'all' || mode.kind === 'search' ? categories : undefined} />
          </div>
        </aside>

        <div>
          <div className="sticky top-16 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-line bg-milk/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-none lg:bg-transparent lg:px-0 lg:pt-0">
            <p className="text-sm whitespace-nowrap text-stone" aria-live="polite">
              {products.isLoading ? 'Загрузка…' : `${total} ${plural(total, ['товар', 'товара', 'товаров'])}`}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal /> Фильтры{activeCount ? ` · ${activeCount}` : ''}
              </Button>
              <label className="sr-only" htmlFor="sort">
                Сортировка
              </label>
              <NativeSelect id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortOption })} className="h-9 w-auto border-transparent bg-transparent pr-8 text-sm hover:border-line">
                {Object.entries(SORT_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="mt-4 mb-6">
            <ActiveFilters catalog={catalog} facets={data?.facets} />
          </div>

          {products.isError ? (
            <ErrorState message={(products.error as Error).message} onRetry={() => products.refetch()} />
          ) : mode.kind === 'search' && !filters.q ? (
            <EmptyState title="Введите запрос" description="Ищите по названию, описанию, категории или бренду." />
          ) : !products.isLoading && total === 0 ? (
            activeCount > 0 ? (
              <EmptyState icon={<SlidersHorizontal />} title="Ничего не найдено" description="Попробуйте убрать часть фильтров." action={<Button onClick={reset}>Сбросить фильтры</Button>} />
            ) : mode.kind === 'search' ? (
              <EmptyState
                icon={<SearchX />}
                title={`По запросу «${filters.q}» ничего не найдено`}
                description="Проверьте написание или попробуйте более общий запрос: «худи», «джинсы», «кроссовки»."
                action={
                  <Button asChild>
                    <Link to="/catalog">Перейти в каталог</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState title="Здесь пока пусто" description="Товары скоро появятся. Загляните в другие разделы." action={<Button asChild><Link to="/catalog">Весь каталог</Link></Button>} />
            )
          ) : (
            <div className={cn('transition-opacity duration-300', products.isPlaceholderData && 'opacity-50')}>
              <ProductGrid products={data?.items} loading={products.isLoading} skeletons={12} className="xl:grid-cols-3 2xl:grid-cols-4" />
            </div>
          )}

          {data && (
            <Pagination
              className="mt-14"
              page={data.page}
              pageCount={data.pageCount}
              onChange={(page) => {
                update({ page }, { keepPage: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="left"
          title="Фильтры"
          footer={
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={reset} disabled={!activeCount}>
                Сбросить
              </Button>
              <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                Показать {total}
              </Button>
            </div>
          }
        >
          <div className="px-5 py-4">
            <FiltersPanel facets={data?.facets} catalog={catalog} categories={mode.kind === 'all' || mode.kind === 'search' ? categories : undefined} />
          </div>
        </SheetContent>
      </Dialog>
    </div>
  );
}

export function Breadcrumbs({ items, light }: { items: { to: string; label: string }[]; light?: boolean }) {
  return (
    <nav aria-label="Хлебные крошки">
      <ol className={cn('flex flex-wrap items-center gap-1.5 text-xs', light ? 'text-milk/70' : 'text-stone')}>
        <li>
          <Link to="/" className={light ? 'hover:text-milk' : 'hover:text-ink'}>
            Главная
          </Link>
        </li>
        {items.map((i) => (
          <li key={i.to} className="flex items-center gap-1.5">
            <ChevronRight className="size-3" />
            <Link to={i.to} className={light ? 'hover:text-milk' : 'hover:text-ink'}>
              {i.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
