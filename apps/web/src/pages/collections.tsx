import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { CollectionDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, imageUrl, plural, srcSet } from '@/lib/utils';

function CollectionCard({ c, index, large }: { c: CollectionDTO; index: number; large?: boolean }) {
  const href = `/collections/${c.slug}`;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: (index % 2) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={cn('group relative', large && 'md:col-span-2')}
    >
      <Link to={href} className="block" aria-label={c.name}>
        <div className={cn('relative overflow-hidden bg-mist', large ? 'aspect-[4/5] md:aspect-[16/9]' : 'aspect-[4/5]')}>
          {c.imageUrl && (
            <img
              src={imageUrl(c.imageUrl, large ? 1600 : 900, large ? 0.5625 : 1.25)}
              srcSet={srcSet(c.imageUrl, large ? [800, 1200, 1600, 2000] : [500, 900, 1200], large ? 0.5625 : 1.25)}
              sizes={large ? '100vw' : '(min-width: 768px) 50vw, 100vw'}
              alt=""
              loading={index < 2 ? 'eager' : 'lazy'}
              decoding="async"
              className="size-full object-cover transition-transform duration-[1200ms] ease-out-soft group-hover:scale-[1.03]"
            />
          )}
          {c.isFeatured && (
            <span className="label absolute top-4 left-4 bg-paper px-2 py-1 text-ink">Избранная коллекция</span>
          )}
        </div>
      </Link>
      <div className={cn('mt-5 grid gap-3', large && 'md:grid-cols-[1fr_1.2fr] md:gap-12')}>
        <div>
          {c.season && <p className="label text-stone">{c.season}</p>}
          <h2 className={cn('display mt-2', large ? 'text-3xl md:text-4xl' : 'text-2xl')}>
            <Link to={href} className="hover:underline hover:underline-offset-[6px] hover:decoration-1">
              {c.name}
            </Link>
          </h2>
        </div>
        <div>
          {c.description && <p className={cn('text-sm leading-relaxed text-graphite', !large && 'line-clamp-3')}>{c.description}</p>}
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-3">
            {typeof c.productCount === 'number' && (
              <span className="text-xs text-stone">
                {c.productCount} {plural(c.productCount, ['изделие', 'изделия', 'изделий'])}
              </span>
            )}
            <Link to={href} className="label ml-auto inline-flex items-center gap-2 transition-colors hover:text-rust" tabIndex={-1} aria-hidden>
              Смотреть <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export default function CollectionsPage() {
  const q = useQuery({ queryKey: qk.collections, queryFn: () => api.get<CollectionDTO[]>('/collections'), staleTime: 5 * 60_000 });
  // The first featured collection opens the page as a wide editorial card.
  const list = q.data ?? [];
  const leadIndex = Math.max(0, list.findIndex((c) => c.isFeatured));
  const ordered = list.length ? [list[leadIndex], ...list.filter((_, i) => i !== leadIndex)] : [];

  return (
    <div className="container-x pt-10 pb-16 md:pt-16">
      <Seo title="Коллекции" description="Сезонные коллекции и капсулы SILT: спокойные цвета, плотные ткани, вещи на годы." />
      <header className="grid gap-6 border-b border-line pb-10 md:grid-cols-[1fr_1fr] md:items-end">
        <div>
          <p className="label text-stone">Lookbook</p>
          <h1 className="display mt-3 text-4xl md:text-6xl">
            Коллекции <span className="editorial">SILT</span>
          </h1>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-stone md:justify-self-end">
          Капсулы, собранные вокруг одной идеи: фактуры, цвета или сезона. Вещи внутри коллекции легко сочетаются друг с другом.
        </p>
      </header>

      <div className="mt-12">
        {q.isPending ? (
          <div className="grid gap-x-6 gap-y-16 md:grid-cols-2" aria-hidden>
            <Skeleton className="aspect-[4/5] md:col-span-2 md:aspect-[16/9]" />
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="aspect-[4/5]" />
                <Skeleton className="mt-5 h-3 w-24" />
                <Skeleton className="mt-3 h-6 w-1/2" />
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : ordered.length === 0 ? (
          <EmptyState
            title="Коллекции скоро появятся"
            description="А пока загляните в каталог — новинки уже там."
            action={
              <Button asChild>
                <Link to="/catalog">В каталог</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-x-6 gap-y-16 md:grid-cols-2 md:gap-y-20">
            {ordered.map((c, i) => (
              <CollectionCard key={c.id} c={c} index={i} large={i === 0 && ordered.length > 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
