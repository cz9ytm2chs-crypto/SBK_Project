import { useQuery } from '@tanstack/react-query';
import { Dialog as D } from 'radix-ui';
import { ArrowUpRight, Clock, Search, TrendingUp, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SearchSuggestDTO } from '@silt/shared';
import { Spinner } from '@/components/ui/misc';
import { useDebounce } from '@/hooks/common';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { imageUrl, money } from '@/lib/utils';
import { useLocal, useUi } from '@/stores';

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUi();
  const [q, setQ] = useState('');
  const debounced = useDebounce(q.trim(), 250);
  const navigate = useNavigate();
  const { searchHistory, addSearch, clearSearchHistory } = useLocal();

  // Debounced + cached: typing does not fire a request per keystroke.
  const suggest = useQuery({
    queryKey: qk.suggest(debounced.toLowerCase()),
    queryFn: () => api.get<SearchSuggestDTO>('/search/suggest', { q: debounced }),
    enabled: searchOpen && debounced.length >= 2,
    staleTime: 60_000,
  });
  const popular = useQuery({ queryKey: qk.popular, queryFn: () => api.get<string[]>('/search/popular'), enabled: searchOpen, staleTime: 5 * 60_000 });

  const close = () => setSearchOpen(false);
  const go = (query: string) => {
    const v = query.trim();
    if (!v) return;
    addSearch(v);
    close();
    navigate(`/search?q=${encodeURIComponent(v)}`);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(q);
  };
  const s = suggest.data;
  const showSuggest = debounced.length >= 2;
  const nothing = showSuggest && s && !s.products.length && !s.categories.length && !s.brands.length;

  return (
    <D.Root open={searchOpen} onOpenChange={setSearchOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-[fade-in_.2s_ease-out]" />
        <D.Content className="fixed inset-x-0 top-0 z-50 max-h-[90dvh] overflow-y-auto bg-paper shadow-2xl focus:outline-none data-[state=open]:animate-[fade-in_.2s_ease-out]">
          <D.Title className="sr-only">Поиск по магазину</D.Title>
          <D.Description className="sr-only">Введите название товара, категории или бренда</D.Description>
          <form onSubmit={onSubmit} className="container-x flex h-20 items-center gap-4 border-b border-line" role="search">
            <Search className="size-5 shrink-0 text-stone" strokeWidth={1.5} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Худи, джинсы, кроссовки…"
              aria-label="Поисковый запрос"
              maxLength={100}
              className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-stone/70 sm:text-2xl"
            />
            {suggest.isFetching && <Spinner className="size-4 text-stone" />}
            <D.Close className="rounded-xs p-2 hover:bg-mist" aria-label="Закрыть поиск">
              <X className="size-5" />
            </D.Close>
          </form>

          <div className="container-x py-8">
            {!showSuggest ? (
              <div className="grid gap-10 sm:grid-cols-2">
                {searchHistory.length > 0 && (
                  <section>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="label text-stone">Вы искали</h2>
                      <button onClick={clearSearchHistory} className="text-xs text-stone hover:text-ink">
                        Очистить
                      </button>
                    </div>
                    <ul className="space-y-2.5">
                      {searchHistory.map((h) => (
                        <li key={h}>
                          <button onClick={() => go(h)} className="flex items-center gap-3 text-sm hover:underline">
                            <Clock className="size-4 text-stone" /> {h}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {!!popular.data?.length && (
                  <section>
                    <h2 className="label mb-4 text-stone">Популярные запросы</h2>
                    <div className="flex flex-wrap gap-2">
                      {popular.data.map((p) => (
                        <button key={p} onClick={() => go(p)} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-ink">
                          <TrendingUp className="size-3.5 text-stone" /> {p}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : nothing ? (
              <p className="py-6 text-sm text-stone">
                По запросу «{debounced}» ничего не найдено. Попробуйте другое слово или посмотрите{' '}
                <Link to="/catalog" onClick={close} className="text-ink underline">
                  весь каталог
                </Link>
                .
              </p>
            ) : (
              s && (
                <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
                  <div className="space-y-8">
                    {s.queries.length > 0 && (
                      <section>
                        <h2 className="label mb-3 text-stone">Запросы</h2>
                        {s.queries.map((x) => (
                          <button key={x} onClick={() => go(x)} className="block py-1 text-sm hover:underline">
                            {x}
                          </button>
                        ))}
                      </section>
                    )}
                    {s.categories.length > 0 && (
                      <section>
                        <h2 className="label mb-3 text-stone">Категории</h2>
                        {s.categories.map((c) => (
                          <Link key={c.slug} to={`/category/${c.slug}`} onClick={close} className="block py-1 text-sm hover:underline">
                            {c.name}
                          </Link>
                        ))}
                      </section>
                    )}
                    {s.brands.length > 0 && (
                      <section>
                        <h2 className="label mb-3 text-stone">Бренды</h2>
                        {s.brands.map((b) => (
                          <Link key={b.slug} to={`/catalog?brands=${b.slug}`} onClick={close} className="block py-1 text-sm hover:underline">
                            {b.name}
                          </Link>
                        ))}
                      </section>
                    )}
                  </div>
                  <section>
                    <h2 className="label mb-3 text-stone">Товары</h2>
                    <ul className="divide-y divide-line">
                      {s.products.map((p) => (
                        <li key={p.slug}>
                          <Link to={`/product/${p.slug}`} onClick={close} className="flex items-center gap-4 py-3 hover:bg-mist/50">
                            <img src={imageUrl(p.image, 120)} alt="" className="aspect-[4/5] w-12 bg-mist object-cover" />
                            <span className="flex-1 text-sm">{p.name}</span>
                            <span className="text-sm tabular-nums">{money(p.price)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <button onClick={() => go(q)} className="label mt-5 inline-flex items-center gap-1.5 border-b border-ink pb-0.5">
                      Все результаты <ArrowUpRight className="size-3.5" />
                    </button>
                  </section>
                </div>
              )
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
