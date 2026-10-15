import { useQuery } from '@tanstack/react-query';
import { Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { Table, Td, Th } from '@/components/ui/data';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useSettings } from '@/hooks/common';
import { api, ApiError, errorMessage } from '@/lib/api';
import { Markdown } from '@/lib/markdown';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { cn, money, plural } from '@/lib/utils';
import NotFoundPage from '@/pages/not-found';

interface ContentPage {
  slug: string;
  title: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface DeliveryMethodInfo {
  code: string;
  name: string;
  description: string;
  price: number;
  freeFromAmount: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

const PAGES = [
  { slug: 'about', label: 'О бренде' },
  { slug: 'delivery', label: 'Доставка и оплата' },
  { slug: 'returns', label: 'Возврат и обмен' },
  { slug: 'contacts', label: 'Контакты' },
  { slug: 'privacy', label: 'Конфиденциальность' },
  { slug: 'terms', label: 'Соглашение' },
];

const days = (min: number, max: number) => {
  if (max <= 0) return 'В день заказа';
  const range = min === max ? `${max}` : `${min}–${max}`;
  return `${range} ${plural(max, ['день', 'дня', 'дней'])}`;
};

function Contacts() {
  const { data: s, isPending } = useSettings();
  if (isPending)
    return (
      <div className="mb-12 grid gap-px border border-line bg-line sm:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-paper p-6">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
        ))}
      </div>
    );
  if (!s) return null;
  const items = [
    s.contactPhone && { icon: Phone, label: 'Телефон', value: s.contactPhone, href: `tel:${s.contactPhone.replace(/[^+\d]/g, '')}` },
    s.contactEmail && { icon: Mail, label: 'Email', value: s.contactEmail, href: `mailto:${s.contactEmail}` },
    s.workingHours && { icon: Clock, label: 'Часы работы', value: s.workingHours },
    s.address && { icon: MapPin, label: 'Адрес', value: s.address },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; href?: string }[];
  const socials = Object.entries(s.socials ?? {});
  return (
    <div className="mb-12">
      <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value, href }) => (
          <li key={label} className="flex gap-4 bg-paper p-5 sm:p-6">
            <Icon className="mt-0.5 size-4 shrink-0 text-stone" strokeWidth={1.5} aria-hidden />
            <div className="min-w-0">
              <p className="label text-stone">{label}</p>
              {href ? (
                <a href={href} className="mt-1.5 block text-sm break-words hover:underline hover:underline-offset-4">
                  {value}
                </a>
              ) : (
                <p className="mt-1.5 text-sm">{value}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {socials.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {socials.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="capitalize underline underline-offset-4 decoration-line hover:decoration-ink">
              {name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryTable() {
  const q = useQuery({
    queryKey: ['delivery-methods'],
    queryFn: () => api.get<DeliveryMethodInfo[]>('/content/delivery-methods'),
    staleTime: 10 * 60_000,
  });
  if (q.isPending) return <Skeleton className="mb-12 h-48 w-full" />;
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data.length) return null;
  return (
    <div className="mb-12 border border-line bg-paper">
      <Table>
        <caption className="sr-only">Способы доставки</caption>
        <thead>
          <tr>
            <Th>Способ</Th>
            <Th>Срок</Th>
            <Th className="text-right">Стоимость</Th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((m) => (
            <tr key={m.code}>
              <Td className="py-4">
                <p className="font-medium">{m.name}</p>
                {m.description && <p className="mt-0.5 text-xs text-stone">{m.description}</p>}
              </Td>
              <Td className="py-4 whitespace-nowrap">{days(m.estimatedDaysMin, m.estimatedDaysMax)}</Td>
              <Td className="py-4 text-right whitespace-nowrap tabular-nums">
                {m.price === 0 ? 'Бесплатно' : money(m.price)}
                {m.price > 0 && m.freeFromAmount !== null && (
                  <p className="mt-0.5 text-xs text-stone">бесплатно от {money(m.freeFromAmount)}</p>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default function InfoPage() {
  const slug = useLocation().pathname.slice(1).replace(/\/$/, '');
  const q = useQuery({ queryKey: qk.page(slug), queryFn: () => api.get<ContentPage>(`/content/pages/${slug}`), staleTime: 5 * 60_000 });

  if (q.isError && q.error instanceof ApiError && q.error.status === 404) return <NotFoundPage />;

  const nav = PAGES.find((p) => p.slug === slug);
  return (
    <div className="container-x pt-10 pb-16 md:pt-16">
      {q.data ? (
        <Seo title={q.data.seoTitle || q.data.title} description={q.data.seoDescription ?? undefined} />
      ) : (
        <Seo title={nav?.label ?? 'Информация'} />
      )}
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="Информация для покупателей" className="lg:sticky lg:top-28 lg:self-start">
          <p className="label mb-4 hidden text-stone lg:block">Покупателям</p>
          <ul className="-mx-4 flex gap-6 overflow-x-auto border-b border-line px-4 no-scrollbar sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0 lg:border-b-0 lg:px-0">
            {[...PAGES, { slug: 'faq', label: 'Вопросы и ответы' }].map((p) => (
              <li key={p.slug} className="shrink-0">
                <NavLink
                  to={`/${p.slug}`}
                  className={({ isActive }) =>
                    cn(
                      '-mb-px block border-b-2 pb-3 text-sm whitespace-nowrap transition-colors lg:mb-0 lg:border-b-0 lg:border-l-2 lg:py-2 lg:pl-4',
                      isActive ? 'border-ink text-ink' : 'border-transparent text-stone hover:text-ink',
                    )
                  }
                >
                  {p.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <article className="max-w-2xl min-w-0">
          {q.isPending ? (
            <div aria-hidden>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="mt-10 h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-11/12" />
              <Skeleton className="mt-3 h-4 w-4/5" />
              <Skeleton className="mt-10 h-6 w-1/3" />
              <Skeleton className="mt-4 h-4 w-full" />
              <Skeleton className="mt-3 h-4 w-3/4" />
            </div>
          ) : q.isError ? (
            <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
          ) : (
            <>
              <h1 className="display text-3xl md:text-5xl">{q.data.title}</h1>
              <div className="mt-10">
                {slug === 'contacts' && <Contacts />}
                {slug === 'delivery' && <DeliveryTable />}
                <Markdown source={q.data.body} />
              </div>
              {(slug === 'delivery' || slug === 'returns') && (
                <p className="mt-12 border-t border-line pt-6 text-sm text-stone">
                  Остались вопросы?{' '}
                  <Link to="/faq" className="text-ink underline underline-offset-4 hover:text-rust">
                    Вопросы и ответы
                  </Link>{' '}
                  ·{' '}
                  <Link to="/contacts" className="text-ink underline underline-offset-4 hover:text-rust">
                    Контакты
                  </Link>
                </p>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
