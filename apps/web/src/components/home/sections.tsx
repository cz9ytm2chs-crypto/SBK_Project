import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Leaf, PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { BannerDTO, CategoryDTO, CollectionDTO } from '@silt/shared';
import { NewsletterForm } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn, imageUrl, srcSet } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

export function SectionHeader({ title, subtitle, href, linkLabel = 'Смотреть все' }: { title: string; subtitle?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
      <div>
        <h2 className="display text-2xl md:text-[2rem]">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-stone">{subtitle}</p>}
      </div>
      {href && (
        <Link to={href} className="label group flex shrink-0 items-center gap-2 border-b border-ink pb-1">
          {linkLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function Section({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('container-x py-14 md:py-20', className)}>{children}</section>;
}

// ── Hero ──
export function Hero({ banners }: { banners: BannerDTO[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (banners.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), 7000);
    return () => clearInterval(t);
  }, [banners.length, paused]);
  const b = banners[index];
  if (!b) return <Skeleton className="h-[78vh] w-full" />;

  return (
    <section
      className="relative h-[82svh] min-h-[520px] w-full overflow-hidden bg-graphite"
      aria-roledescription="карусель"
      aria-label="Главные предложения"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync">
        <motion.img
          key={b.id}
          src={imageUrl(b.imageUrl, 1600, 0.6)}
          srcSet={srcSet(b.imageUrl, [800, 1200, 1600, 2200], 0.6)}
          sizes="100vw"
          alt=""
          fetchPriority={index === 0 ? 'high' : 'auto'}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 size-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent" />
      <div className="container-x relative flex h-full flex-col justify-end pb-14 md:pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl text-milk"
          >
            {b.eyebrow && <p className="label mb-4 text-milk/80">{b.eyebrow}</p>}
            <h1 className="display text-[2.5rem] leading-[1.02] sm:text-6xl lg:text-7xl">{b.title}</h1>
            {b.subtitle && <p className="mt-5 max-w-lg text-base text-milk/80">{b.subtitle}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {b.ctaHref && (
                <Button asChild variant="light" size="lg">
                  <Link to={b.ctaHref}>{b.ctaLabel || 'Смотреть'}</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg" className="border-milk text-milk hover:bg-milk hover:text-ink">
                <Link to="/catalog">Весь каталог</Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
        {banners.length > 1 && (
          <div className="mt-10 flex gap-2" role="tablist" aria-label="Слайды">
            {banners.map((x, i) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={i === index}
                aria-label={`Слайд ${i + 1}: ${x.title}`}
                onClick={() => setIndex(i)}
                className="relative h-0.5 w-12 overflow-hidden bg-milk/30"
              >
                <span className={cn('absolute inset-y-0 left-0 bg-milk', i === index ? 'w-full transition-[width] duration-[7000ms] ease-linear' : 'w-0')} key={i === index ? `a${index}` : 'b'} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Categories ──
export function CategoryGrid({ categories }: { categories: CategoryDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
      {categories.map((c, i) => (
        <motion.div key={c.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: (i % 3) * 0.06 }}>
          <Link to={`/category/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-mist">
            {c.imageUrl && (
              <img src={imageUrl(c.imageUrl, 700)} srcSet={srcSet(c.imageUrl, [400, 700, 1000])} sizes="(min-width:768px) 33vw, 50vw" alt="" loading="lazy" className="size-full object-cover transition-transform duration-[1.2s] ease-out-soft group-hover:scale-[1.04]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent to-50%" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-milk md:p-6">
              <div>
                <h3 className="display text-lg md:text-2xl">{c.name}</h3>
                <p className="mt-1 text-xs text-milk/75">{c.productCount} товаров</p>
              </div>
              <ArrowRight className="size-5 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

// ── Collections ──
export function CollectionsBlock({ collections }: { collections: CollectionDTO[] }) {
  const [first, ...rest] = collections;
  if (!first) return null;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <CollectionCard c={first} large />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
        {rest.slice(0, 2).map((c) => (
          <CollectionCard key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

function CollectionCard({ c, large }: { c: CollectionDTO; large?: boolean }) {
  return (
    <motion.div {...fadeUp} className={cn(large ? 'aspect-[4/5] lg:aspect-auto lg:h-full' : 'aspect-[16/11] lg:aspect-auto')}>
      <Link to={`/collections/${c.slug}`} className="group relative block size-full min-h-64 overflow-hidden bg-mist">
        {c.imageUrl && <img src={imageUrl(c.imageUrl, large ? 1200 : 900, large ? 1.2 : 0.7)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-[1.2s] ease-out-soft group-hover:scale-[1.03]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent to-60%" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-milk md:p-8">
          {c.season && <p className="label text-milk/75">{c.season}</p>}
          <h3 className={cn('display mt-2', large ? 'text-3xl md:text-4xl' : 'text-2xl')}>{c.name}</h3>
          {large && <p className="mt-3 max-w-md text-sm text-milk/80">{c.description}</p>}
          <span className="label mt-5 inline-flex items-center gap-2 border-b border-milk pb-1">
            Смотреть <ArrowRight className="size-3.5" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ── Promo ──
export function PromoBlock({ banner }: { banner?: BannerDTO }) {
  if (!banner) return null;
  return (
    <section className="bg-ink text-milk">
      <div className="grid md:grid-cols-2">
        <div className="relative aspect-[4/3] md:aspect-auto">
          <img src={imageUrl(banner.imageUrl, 1200, 0.75)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        </div>
        <motion.div {...fadeUp} className="flex flex-col justify-center px-6 py-14 md:px-14 lg:px-20">
          {banner.eyebrow && <p className="label text-rust">{banner.eyebrow}</p>}
          <h2 className="display mt-4 text-3xl md:text-5xl">{banner.title}</h2>
          {banner.subtitle && <p className="mt-4 max-w-md text-milk/70">{banner.subtitle}</p>}
          {banner.ctaHref && (
            <Button asChild variant="accent" size="lg" className="mt-8 self-start">
              <Link to={banner.ctaHref}>{banner.ctaLabel || 'Смотреть'}</Link>
            </Button>
          )}
        </motion.div>
      </div>
    </section>
  );
}

// ── Benefits ──
const BENEFITS = [
  { icon: Truck, title: 'Бесплатная доставка', text: 'Курьером от 10 000 ₽, в пункт выдачи от 7 000 ₽' },
  { icon: RotateCcw, title: '14 дней на возврат', text: 'Вернём деньги на карту без лишних вопросов' },
  { icon: PackageCheck, title: 'Примерка в шоуруме', text: 'Самовывоз и примерка в Москве' },
  { icon: Leaf, title: 'Честное производство', text: 'Шьём малыми партиями, без перепроизводства' },
];
export function Benefits() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-10 border-y border-line py-12 lg:grid-cols-4">
      {BENEFITS.map(({ icon: Icon, title, text }) => (
        <div key={title}>
          <Icon className="size-6 stroke-[1.25]" />
          <h3 className="mt-4 text-sm font-medium">{title}</h3>
          <p className="mt-1.5 text-sm text-stone">{text}</p>
        </div>
      ))}
    </div>
  );
}

// ── Editorial ──
export function Editorial({ banners }: { banners: BannerDTO[] }) {
  if (!banners.length) return null;
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-5">
      {banners.slice(0, 2).map((b, i) => (
        <motion.article key={b.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }} className={cn(i === 1 && 'md:mt-24')}>
          <Link to={b.ctaHref || '/catalog'} className="group block">
            <div className="aspect-[7/5] overflow-hidden bg-mist">
              <img src={imageUrl(b.imageUrl, 1000, 0.72)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-[1.2s] ease-out-soft group-hover:scale-[1.03]" />
            </div>
            <p className="label mt-5 text-stone">{b.eyebrow}</p>
            <h3 className="mt-2 text-2xl">
              <span className="editorial text-3xl">{b.title}</span>
            </h3>
            <p className="mt-2 max-w-md text-sm text-stone">{b.subtitle}</p>
          </Link>
        </motion.article>
      ))}
    </div>
  );
}

// ── Social ──
export function Social({ images, title, subtitle, url }: { images: string[]; title: string; subtitle?: string; url?: string }) {
  if (!images.length) return null;
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="display text-2xl md:text-3xl">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-stone">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-3 gap-1 md:grid-cols-6">
        {images.map((src, i) => (
          <a key={i} href={url ?? '#'} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden bg-mist" aria-label={`Публикация ${i + 1} в соцсетях`}>
            <img src={src} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <span className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/20" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Newsletter ──
export function NewsletterBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center bg-mist px-6 py-16 text-center md:py-20">
      <p className="editorial text-2xl text-stone">Письма от SILT</p>
      <h2 className="display mt-2 text-3xl md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 max-w-md text-sm text-stone">{subtitle}</p>}
      <div className="mt-8 flex w-full justify-center">
        <NewsletterForm source="home" />
      </div>
      <p className="mt-4 text-xs text-stone">
        Подписываясь, вы соглашаетесь с <Link to="/privacy" className="underline">политикой конфиденциальности</Link>.
      </p>
    </div>
  );
}
