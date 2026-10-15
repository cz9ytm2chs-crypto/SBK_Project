import { useQuery } from '@tanstack/react-query';
import { Fragment } from 'react';
import type { HomeDTO } from '@silt/shared';
import { Benefits, CategoryGrid, CollectionsBlock, Editorial, Hero, NewsletterBlock, PromoBlock, Section, SectionHeader, Social } from '@/components/home/sections';
import { ProductRail } from '@/components/product/product-card';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useSettings } from '@/hooks/common';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';

export default function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: qk.home, queryFn: () => api.get<HomeDTO>('/content/home'), staleTime: 60_000 });
  const { data: settings } = useSettings();

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data)
    return (
      <div>
        <Skeleton className="h-[82svh] w-full" />
        <div className="container-x py-16">
          <ProductRail loading />
        </div>
      </div>
    );

  const banners = (p: string) => data.banners.filter((b) => b.placement === p);

  // Section order and visibility come from the admin panel (HomeSection).
  const render = (key: string, title: string, subtitle: string, config: Record<string, unknown>) => {
    switch (key) {
      case 'hero':
        return <Hero banners={banners('HERO')} />;
      case 'categories':
        return (
          <Section>
            <SectionHeader title={title} subtitle={subtitle} href="/catalog" linkLabel="Весь каталог" />
            <CategoryGrid categories={data.categories} />
          </Section>
        );
      case 'new':
        return data.newArrivals.length ? (
          <Section>
            <SectionHeader title={title} subtitle={subtitle} href="/catalog?sort=new" />
            <ProductRail products={data.newArrivals} />
          </Section>
        ) : null;
      case 'collections':
        return (
          <Section>
            <SectionHeader title={title} subtitle={subtitle} href="/collections" linkLabel="Все коллекции" />
            <CollectionsBlock collections={data.collections.filter((c) => c.isFeatured)} />
          </Section>
        );
      case 'bestsellers':
        return data.bestsellers.length ? (
          <Section>
            <SectionHeader title={title} subtitle={subtitle} href="/catalog?sort=popular" />
            <ProductRail products={data.bestsellers} />
          </Section>
        ) : null;
      case 'promo':
        return <PromoBlock banner={banners('PROMO')[0]} />;
      case 'benefits':
        return (
          <Section className="py-6 md:py-10">
            <Benefits />
          </Section>
        );
      case 'editorial':
        return (
          <Section>
            <Editorial banners={banners('EDITORIAL')} />
          </Section>
        );
      case 'social':
        return (
          <Section>
            <Social images={(config.images as string[]) ?? []} title={title} subtitle={subtitle} url={settings?.socials?.instagram} />
          </Section>
        );
      case 'newsletter':
        return (
          <Section className="py-6 md:py-10">
            <NewsletterBlock title={title} subtitle={subtitle} />
          </Section>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Seo
        title={settings?.seoTitle ?? 'SILT — одежда и аксессуары'}
        description={settings?.seoDescription}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Organization', name: 'SILT', url: window.location.origin, logo: `${window.location.origin}/favicon.svg` }}
      />
      {data.sections.map((s) => (
        <Fragment key={s.key}>{render(s.key, s.title, s.subtitle, s.config)}</Fragment>
      ))}
    </>
  );
}
