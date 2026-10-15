import { useQuery } from '@tanstack/react-query';
import { Heart, RotateCcw, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import type { ProductCardDTO, ProductDetailDTO } from '@silt/shared';
import { Gallery } from '@/components/product/gallery';
import { ProductRail } from '@/components/product/product-card';
import { Reviews } from '@/components/product/reviews';
import { SizeGuide } from '@/components/product/size-guide';
import { Button } from '@/components/ui/button';
import { Price, QuantityInput, Stars } from '@/components/ui/data';
import { Accordion, AccordionItem } from '@/components/ui/disclosure';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useAddToCart } from '@/hooks/cart';
import { useSettings } from '@/hooks/common';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/favorites';
import { api, ApiError, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, money } from '@/lib/utils';
import { useLocal, useUi } from '@/stores';
import { Breadcrumbs } from './catalog';
import NotFoundPage from './not-found';

export default function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, isLoading, error, refetch } = useQuery({ queryKey: qk.product(slug), queryFn: () => api.get<ProductDetailDTO>(`/products/${slug}`) });
  const addViewed = useLocal((s) => s.addViewed);
  useEffect(() => {
    if (product) addViewed(product.id);
  }, [product, addViewed]);

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !product) return <ProductSkeleton />;

  return (
    <>
      <Seo
        title={product.seoTitle || `${product.name} — купить`}
        description={product.seoDescription || product.description.slice(0, 155)}
        image={product.images[0]?.url}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.images.map((i) => i.url),
          sku: product.variants[0]?.sku,
          brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
          aggregateRating: product.ratingCount ? { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount } : undefined,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'RUB',
            price: (product.price / 100).toFixed(2),
            availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: window.location.href,
          },
        }}
      />
      <ProductView key={product.id} product={product} />
    </>
  );
}

function ProductView({ product }: { product: ProductDetailDTO }) {
  const [colorId, setColorId] = useState(() => product.colors.find((c) => product.variants.some((v) => v.colorId === c.id && v.available > 0))?.id ?? product.colors[0]?.id);
  const singleSize = product.sizes.length === 1;
  const [sizeId, setSizeId] = useState<string | undefined>(singleSize ? product.sizes[0].id : undefined);
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const add = useAddToCart();
  const setCartOpen = useUi((s) => s.setCartOpen);
  const favorites = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const { data: settings } = useSettings();
  const isFav = favorites.includes(product.id);

  // Only real size/colour combinations exist as variants; anything else cannot be selected.
  const variantFor = (s?: string, c?: string) => product.variants.find((v) => v.sizeId === s && v.colorId === c);
  const variant = variantFor(sizeId, colorId);
  const available = variant?.available ?? 0;
  const color = product.colors.find((c) => c.id === colorId);
  const images = useMemo(() => {
    const byColor = product.images.filter((i) => i.colorId === colorId);
    return byColor.length ? [...byColor, ...product.images.filter((i) => !i.colorId)] : product.images;
  }, [product.images, colorId]);

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, available || 1)));
  }, [available]);

  const onAdd = () => {
    if (!sizeId) {
      setSizeError(true);
      return;
    }
    if (!variant || available <= 0) return;
    add.mutate(
      { variantId: variant.id, quantity: qty },
      {
        onSuccess: () =>
          toast.success('Добавлено в корзину', {
            description: `${product.name} · ${color?.name} · ${product.sizes.find((s) => s.id === sizeId)?.label} · ${qty} шт.`,
            action: { label: 'Корзина', onClick: () => setCartOpen(true) },
          }),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const sizeGroup = product.sizes[0]?.group ?? 'APPAREL';

  return (
    <div className="pb-10">
      <div className="container-x pt-6">
        <Breadcrumbs items={[{ to: '/catalog', label: 'Каталог' }, { to: `/category/${product.category.slug}`, label: product.category.name }]} />
      </div>

      <div className="container-x mt-6 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14 xl:gap-20">
        <Gallery images={images} name={product.name} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          {product.brand && <p className="label text-stone">{product.brand}</p>}
          <h1 className="display mt-2 text-2xl leading-tight md:text-[2rem]">{product.name}</h1>
          {product.ratingCount > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-xs text-stone hover:text-ink">
              <Stars value={product.ratingAvg} /> {product.ratingAvg.toFixed(1)} · {product.ratingCount} отзывов
            </a>
          )}
          <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" className="mt-5" />

          {/* Colour */}
          {product.colors.length > 0 && (
            <fieldset className="mt-8">
              <legend className="mb-3 text-sm">
                Цвет: <span className="text-stone">{color?.name}</span>
              </legend>
              <div className="flex flex-wrap gap-2.5">
                {product.colors.map((c) => {
                  const any = product.variants.some((v) => v.colorId === c.id && v.available > 0);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setColorId(c.id);
                        if (sizeId && !variantFor(sizeId, c.id)) setSizeId(undefined);
                      }}
                      aria-pressed={c.id === colorId}
                      aria-label={`${c.name}${any ? '' : ' — нет в наличии'}`}
                      title={c.name}
                      className={cn('relative size-9 rounded-full ring-1 ring-ink/15 ring-offset-[3px] ring-offset-milk transition-shadow', c.id === colorId && 'ring-2 ring-ink', !any && 'opacity-40')}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Size */}
          <fieldset className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <legend className="text-sm">
                Размер{sizeId && <span className="text-stone">: {product.sizes.find((s) => s.id === sizeId)?.label}</span>}
              </legend>
              <SizeGuide group={sizeGroup} />
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => {
                const v = variantFor(s.id, colorId);
                const out = !v || v.available <= 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!v}
                    onClick={() => {
                      setSizeId(s.id);
                      setSizeError(false);
                    }}
                    aria-pressed={s.id === sizeId}
                    aria-label={`${s.label}${!v ? ' — нет такого сочетания' : out ? ' — нет в наличии' : ''}`}
                    className={cn(
                      'relative h-11 min-w-14 rounded-xs border px-4 text-sm transition-colors',
                      s.id === sizeId ? 'border-ink bg-ink text-milk' : 'border-line bg-paper hover:border-ink',
                      out && s.id !== sizeId && 'text-stone line-through decoration-stone/60',
                      !v && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 min-h-5 text-xs" aria-live="polite">
              {sizeError ? (
                <span className="text-danger">Выберите размер</span>
              ) : variant ? (
                available <= 0 ? (
                  <span className="text-danger">Этого размера нет в наличии</span>
                ) : available <= 3 ? (
                  <span className="text-warning">Осталось {available} шт.</span>
                ) : (
                  <span className="text-success">В наличии</span>
                )
              ) : null}
            </div>
          </fieldset>

          <div className="mt-4 flex gap-3">
            {variant && available > 0 && <QuantityInput value={qty} onChange={setQty} max={Math.min(available, 20)} />}
            <Button size="lg" className="flex-1" onClick={onAdd} loading={add.isPending} disabled={!product.inStock || (!!variant && available <= 0)}>
              {!product.inStock ? 'Нет в наличии' : variant && available <= 0 ? 'Нет в наличии' : `В корзину · ${money(product.price * qty)}`}
            </Button>
            <Button variant="outline" size="icon" className="size-14" onClick={() => toggleFavorite(product.id)} aria-pressed={isFav} aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}>
              <Heart className={cn('!size-5', isFav && 'fill-ink')} strokeWidth={1.5} />
            </Button>
          </div>

          <ul className="mt-6 space-y-2 text-xs text-graphite">
            <li className="flex items-center gap-2.5">
              <Truck className="size-4 text-stone" strokeWidth={1.5} />
              {settings?.freeShippingFrom ? `Бесплатная доставка от ${money(settings.freeShippingFrom)}` : 'Доставка по всей России'}
            </li>
            <li className="flex items-center gap-2.5">
              <RotateCcw className="size-4 text-stone" strokeWidth={1.5} />
              14 дней на возврат
            </li>
          </ul>

          <Accordion type="multiple" defaultValue={['description']} className="mt-8 border-t border-line">
            <AccordionItem value="description" title="Описание">
              <p>{product.description}</p>
              {product.fit && <p className="mt-3 text-stone">{product.fit}</p>}
            </AccordionItem>
            <AccordionItem value="material" title="Состав и уход">
              {product.material && (
                <p>
                  <span className="text-stone">Состав: </span>
                  {product.material}
                </p>
              )}
              {product.care && <p className="mt-3">{product.care}</p>}
            </AccordionItem>
            <AccordionItem value="delivery" title="Доставка и возврат">
              <p>Курьером 1–3 дня, в пункт выдачи 2–5 дней, самовывоз из шоурума — бесплатно. Вернуть товар можно в течение 14 дней.</p>
              <p className="mt-3">
                <Link to="/delivery" className="underline underline-offset-4">
                  Условия доставки
                </Link>{' '}
                ·{' '}
                <Link to="/returns" className="underline underline-offset-4">
                  Возврат и обмен
                </Link>
              </p>
            </AccordionItem>
          </Accordion>
          {product.collections.length > 0 && (
            <p className="mt-6 text-xs text-stone">
              Коллекция:{' '}
              {product.collections.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 && ', '}
                  <Link to={`/collections/${c.slug}`} className="text-ink underline underline-offset-4">
                    {c.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div id="reviews" className="container-x mt-24 scroll-mt-24">
        <Reviews slug={product.slug} />
      </div>
      <Related slug={product.slug} />
      <RecentlyViewed currentId={product.id} />
    </div>
  );
}

function Related({ slug }: { slug: string }) {
  const { data, isLoading } = useQuery({ queryKey: qk.related(slug), queryFn: () => api.get<ProductCardDTO[]>(`/products/${slug}/related`) });
  if (!isLoading && !data?.length) return null;
  return (
    <section className="container-x mt-24">
      <h2 className="display mb-8 text-2xl">Вам может понравиться</h2>
      <ProductRail products={data} loading={isLoading} />
    </section>
  );
}

function RecentlyViewed({ currentId }: { currentId: string }) {
  const ids = useLocal((s) => s.recentlyViewed).filter((id) => id !== currentId).slice(0, 8);
  const { data } = useQuery({ queryKey: qk.productsByIds(ids), queryFn: () => api.get<ProductCardDTO[]>('/products/by-ids', { ids }), enabled: ids.length > 0 });
  if (!data?.length) return null;
  return (
    <section className="container-x mt-24">
      <h2 className="display mb-8 text-2xl">Вы недавно смотрели</h2>
      <ProductRail products={data} />
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div className="container-x mt-12 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-8 h-11 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}

