import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCategories, useSettings } from '@/hooks/common';
import { api, errorMessage } from '@/lib/api';
import { Logo } from './logo';

export function NewsletterForm({ source = 'footer', dark }: { source?: string; dark?: boolean }) {
  const [email, setEmail] = useState('');
  const m = useMutation({
    mutationFn: () => api.post('/newsletter', { email, source }),
    onSuccess: () => {
      toast.success('Вы подписаны на рассылку');
      setEmail('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast.error('Введите корректный email');
    m.mutate();
  };
  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md gap-2">
      <label className="sr-only" htmlFor={`nl-${source}`}>
        Email
      </label>
      <input
        id={`nl-${source}`}
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Ваш email"
        className={dark ? 'h-12 min-w-0 flex-1 border-b border-milk/30 bg-transparent text-sm text-milk outline-none placeholder:text-milk/50 focus:border-milk' : 'h-12 min-w-0 flex-1 border-b border-ink/30 bg-transparent text-sm outline-none placeholder:text-stone focus:border-ink'}
      />
      <Button type="submit" variant={dark ? 'light' : 'primary'} size="md" loading={m.isPending} className="h-12">
        Подписаться
      </Button>
    </form>
  );
}

export function Footer() {
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const col = 'space-y-2.5 text-sm text-milk/70';
  const link = 'transition-colors hover:text-milk';
  return (
    <footer className="mt-24 bg-ink text-milk">
      <div className="container-x grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-milk/60">
            Одежда, которая живёт долго. Плотные ткани, спокойные цвета и честное производство.
          </p>
          <div className="mt-8">
            <p className="label mb-2 text-milk/50">Рассылка</p>
            <NewsletterForm dark />
          </div>
        </div>
        <nav aria-label="Каталог">
          <p className="label mb-4 text-milk/50">Каталог</p>
          <ul className={col}>
            {categories?.map((c) => (
              <li key={c.id}>
                <Link to={`/category/${c.slug}`} className={link}>
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/collections" className={link}>
                Коллекции
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Покупателям">
          <p className="label mb-4 text-milk/50">Покупателям</p>
          <ul className={col}>
            {[
              ['/delivery', 'Доставка'],
              ['/returns', 'Возврат и обмен'],
              ['/faq', 'Вопросы и ответы'],
              ['/about', 'О бренде'],
              ['/account/orders', 'Мои заказы'],
            ].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className={link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="label mb-4 text-milk/50">Контакты</p>
          <ul className={col}>
            {settings?.contactPhone && (
              <li>
                <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, '')}`} className={link}>
                  {settings.contactPhone}
                </a>
              </li>
            )}
            {settings?.contactEmail && (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className={link}>
                  {settings.contactEmail}
                </a>
              </li>
            )}
            {settings?.workingHours && <li>{settings.workingHours}</li>}
            {settings?.address && <li>{settings.address}</li>}
          </ul>
          <div className="mt-6 flex gap-4 text-sm">
            {Object.entries(settings?.socials ?? {}).map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-milk/70 hover:text-milk">
                {name}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-milk/10">
        <div className="container-x flex flex-col gap-3 py-6 text-xs text-milk/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SILT. Все права защищены.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-milk">
              Политика конфиденциальности
            </Link>
            <Link to="/terms" className="hover:text-milk">
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
