import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/disclosure';
import { Seo } from '@/lib/seo';
import { BannersTab } from '../components/content/banners';
import { FaqTab } from '../components/content/faq';
import { HomeSectionsTab } from '../components/content/home-sections';
import { PagesTab } from '../components/content/pages';
import { ReviewsTab } from '../components/content/reviews';
import { AccessDenied, PageHeader } from '../components/page';
import { useCan, useUrlState } from '../lib';

export default function ContentPage() {
  const can = useCan();
  const { get, set } = useUrlState();
  const tabs = [
    ...(can('content.write')
      ? [
          { value: 'banners', label: 'Баннеры', node: <BannersTab /> },
          { value: 'home', label: 'Главная', node: <HomeSectionsTab /> },
          { value: 'pages', label: 'Страницы', node: <PagesTab /> },
          { value: 'faq', label: 'FAQ', node: <FaqTab /> },
        ]
      : []),
    ...(can('reviews.moderate') ? [{ value: 'reviews', label: 'Отзывы', node: <ReviewsTab /> }] : []),
  ];
  const tab = tabs.find((t) => t.value === get('tab'))?.value ?? tabs[0]?.value;

  return (
    <>
      <Seo title="Контент" noindex />
      <PageHeader title="Контент" description={can('content.write') ? 'Баннеры, блоки главной, информационные страницы, FAQ и модерация отзывов' : 'Модерация отзывов покупателей'} />
      {!tab ? (
        <AccessDenied />
      ) : (
        <Tabs value={tab} onValueChange={(v) => set({ tab: v === tabs[0].value ? null : v })}>
          <TabsList className="mb-6">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value} className="focus-visible:outline-none">
              {t.node}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  );
}
