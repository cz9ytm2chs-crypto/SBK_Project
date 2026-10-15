import { Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { ProductCardDTO } from '@silt/shared';
import { Price } from '@/components/ui/data';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/favorites';
import { cn, imageUrl, srcSet } from '@/lib/utils';

const SIZES = '(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw';

export function ProductCard({ product, priority, index = 0 }: { product: ProductCardDTO; priority?: boolean; index?: number }) {
  const favorites = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();
  const isFav = favorites.includes(product.id);
  const href = `/product/${product.slug}`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        <Link to={href} aria-label={product.name} className="block size-full">
          {product.image && (
            <img
              src={imageUrl(product.image, 600)}
              srcSet={srcSet(product.image, [400, 600, 900])}
              sizes={SIZES}
              alt={product.name}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              className={cn('size-full object-cover transition-[opacity,transform] duration-700 ease-out-soft', product.hoverImage && 'group-hover:opacity-0', !product.inStock && 'opacity-70')}
            />
          )}
          {product.hoverImage && (
            <img
              src={imageUrl(product.hoverImage, 600)}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 size-full scale-[1.03] object-cover opacity-0 transition-[opacity,transform] duration-700 ease-out-soft group-hover:scale-100 group-hover:opacity-100"
            />
          )}
        </Link>
        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {!product.inStock && <Badge tone="light">Нет в наличии</Badge>}
          {product.inStock && product.discountPercent > 0 && <Badge tone="accent">−{product.discountPercent}%</Badge>}
          {product.inStock && product.isNew && <Badge tone="light">Новинка</Badge>}
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(product.id)}
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
          className="absolute top-2 right-2 z-10 rounded-full p-2 text-ink transition-[opacity,transform] hover:scale-110 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 data-[active=true]:opacity-100"
          data-active={isFav}
        >
          <Heart className={cn('size-[18px]', isFav && 'fill-ink')} strokeWidth={1.5} />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-1 px-0.5">
        <div className="flex items-start justify-between gap-3">
          <Link to={href} className="text-sm leading-snug after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </div>
        {product.brand && <p className="text-xs text-stone">{product.brand}</p>}
        <Price price={product.price} compareAtPrice={product.compareAtPrice} />
        {product.colors.length > 1 && (
          <div className="mt-1 flex items-center gap-1.5" aria-label={`Цвета: ${product.colors.map((c) => c.name).join(', ')}`}>
            {product.colors.slice(0, 5).map((c) => (
              <span key={c.id} title={c.name} className="size-2.5 rounded-full ring-1 ring-ink/15" style={{ backgroundColor: c.hex }} />
            ))}
            {product.colors.length > 5 && <span className="text-2xs text-stone">+{product.colors.length - 5}</span>}
          </div>
        )}
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="aspect-[4/5] w-full" />
      <Skeleton className="mt-3 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

export function ProductGrid({ products, loading, skeletons = 8, className }: { products?: ProductCardDTO[]; loading?: boolean; skeletons?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4', className)}>
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products?.map((p, i) => <ProductCard key={p.id} product={p} index={i} priority={i < 4} />)}
    </div>
  );
}

/** Horizontal, scroll-snapping row for home page / product page recommendations. */
export function ProductRail({ products, loading }: { products?: ProductCardDTO[]; loading?: boolean }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar sm:-mx-6 sm:px-6 md:gap-5 lg:-mx-10 lg:px-10">
      {(loading ? Array.from({ length: 4 }) : (products ?? [])).map((p, i) => (
        <div key={(p as ProductCardDTO | undefined)?.id ?? i} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%]">
          {loading ? <ProductCardSkeleton /> : <ProductCard product={p as ProductCardDTO} index={i} />}
        </div>
      ))}
    </div>
  );
}
