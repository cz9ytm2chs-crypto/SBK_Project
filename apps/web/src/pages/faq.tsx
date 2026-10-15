import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem } from '@/components/ui/disclosure';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useSettings } from '@/hooks/common';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const anchor = (i: number) => `faq-${i}`;

export default function FaqPage() {
  const q = useQuery({ queryKey: qk.faq, queryFn: () => api.get<FaqItem[]>('/content/faq'), staleTime: 5 * 60_000 });
  const { data: settings } = useSettings();

  const groups: { category: string; items: FaqItem[] }[] = [];
  for (const item of q.data ?? []) {
    const category = item.category || 'Общие вопросы';
    const g = groups.find((x) => x.category === category);
    if (g) g.items.push(item);
    else groups.push({ category, items: [item] });
  }

  const jsonLd = q.data?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: q.data.map((i) => ({ '@type': 'Question', name: i.question, acceptedAnswer: { '@type': 'Answer', text: i.answer } })),
      }
    : undefined;

  return (
    <div className="container-x pt-10 pb-16 md:pt-16">
      <Seo title="Вопросы и ответы" description="Ответы на частые вопросы о заказе, доставке, оплате, возврате и уходе за вещами SILT." jsonLd={jsonLd} />
      <header className="max-w-3xl">
        <p className="label text-stone">Помощь</p>
        <h1 className="display mt-3 text-4xl md:text-5xl">
          Вопросы <span className="editorial">и ответы</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-stone">Собрали ответы на то, о чём нас спрашивают чаще всего.</p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
        {groups.length > 1 && (
          <nav aria-label="Разделы" className="lg:sticky lg:top-28 lg:self-start">
            <ul className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0 lg:border-b-0 lg:px-0">
              {groups.map((g, i) => (
                <li key={g.category} className="shrink-0">
                  <a
                    href={`#${anchor(i)}`}
                    className="block pb-3 text-sm whitespace-nowrap text-stone transition-colors hover:text-ink lg:border-l-2 lg:border-transparent lg:py-2 lg:pl-4 lg:hover:border-line"
                  >
                    {g.category}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={groups.length > 1 ? 'max-w-3xl min-w-0' : 'max-w-3xl min-w-0 lg:col-span-2'}>
          {q.isPending ? (
            <div aria-hidden className="space-y-12">
              {[0, 1].map((g) => (
                <div key={g}>
                  <Skeleton className="h-4 w-40" />
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="mt-6 h-5 w-full" />
                  ))}
                </div>
              ))}
            </div>
          ) : q.isError ? (
            <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : groups.length === 0 ? (
            <EmptyState title="Вопросов пока нет" description="Напишите нам — мы с радостью ответим." />
          ) : (
            <div className="space-y-14">
              {groups.map((g, i) => (
                <section key={g.category} id={anchor(i)} aria-labelledby={`${anchor(i)}-title`} className="scroll-mt-28">
                  <h2 id={`${anchor(i)}-title`} className="label border-b border-ink pb-3">
                    {g.category}
                  </h2>
                  <Accordion type="multiple">
                    {g.items.map((item) => (
                      <AccordionItem key={item.id} value={item.id} title={item.question}>
                        <p className="whitespace-pre-line">{item.answer}</p>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>
          )}

          <aside className="mt-16 flex flex-col gap-6 bg-ink p-8 text-milk md:flex-row md:items-center md:justify-between md:p-10">
            <div>
              <p className="label text-milk/50">Не нашли ответ?</p>
              <p className="display mt-3 text-2xl">
                Мы <span className="editorial">на связи</span>
              </p>
              <p className="mt-2 text-sm text-milk/70">
                {settings?.workingHours ? `${settings.workingHours}. ` : ''}Отвечаем на письма в течение рабочего дня.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              {settings?.contactEmail && (
                <Button asChild variant="light">
                  <a href={`mailto:${settings.contactEmail}`}>Написать</a>
                </Button>
              )}
              <Button asChild variant="outline" className="border-milk text-milk hover:bg-milk hover:text-ink">
                <Link to="/contacts">Контакты</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
