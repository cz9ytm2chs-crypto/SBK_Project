import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart, MapPin, Package, User } from 'lucide-react';
import { Link } from 'react-router';
import type { AddressDTO, OrderSummaryDTO, Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { useFavoriteIds } from '@/hooks/favorites';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { plural } from '@/lib/utils';
import { formatAddress, OrderRow, OrderRowSkeleton, Panel } from './components/order-ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function AccountOverviewPage() {
  const { data: user } = useMe();
  const favoriteIds = useFavoriteIds();
  const orders = useQuery({ queryKey: qk.orders(1), queryFn: () => api.get<Paginated<OrderSummaryDTO>>('/orders', { page: 1 }) });
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: () => api.get<AddressDTO[]>('/users/me/addresses') });
  const defaultAddress = addresses.data?.find((a) => a.isDefault) ?? addresses.data?.[0];

  const quick = [
    { to: '/account/orders', icon: Package, title: 'Заказы', text: orders.data ? `${orders.data.total} ${plural(orders.data.total, ['заказ', 'заказа', 'заказов'])}` : 'История покупок' },
    { to: '/favorites', icon: Heart, title: 'Избранное', text: `${favoriteIds.length} ${plural(favoriteIds.length, ['товар', 'товара', 'товаров'])}` },
    { to: '/account/addresses', icon: MapPin, title: 'Адреса', text: addresses.data ? `${addresses.data.length} сохранено` : 'Адреса доставки' },
    { to: '/account/profile', icon: User, title: 'Профиль', text: 'Данные и пароль' },
  ];

  return (
    <div>
      <Seo title="Личный кабинет" noindex />
      <h1 className="display text-3xl md:text-4xl">
        {greeting()}, <span className="editorial">{user?.firstName}</span>
      </h1>
      <p className="mt-2 text-sm text-stone">Здесь собраны ваши заказы, адреса и настройки.</p>

      <ul className="mt-10 grid grid-cols-2 border-t border-l border-line xl:grid-cols-4">
        {quick.map(({ to, icon: Icon, title, text }) => (
          <li key={to} className="border-r border-b border-line">
            <Link to={to} className="group flex h-full flex-col gap-6 bg-paper p-5 transition-colors hover:bg-mist/50 sm:p-6">
              <Icon className="size-5 text-stone" strokeWidth={1.25} aria-hidden />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs text-stone">{text}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-12 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent-orders">
          <div className="flex items-baseline justify-between border-b border-ink pb-3">
            <h2 id="recent-orders" className="label">
              Последние заказы
            </h2>
            {!!orders.data?.items.length && (
              <Link to="/account/orders" className="label inline-flex items-center gap-1.5 text-stone hover:text-ink">
                Все заказы <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
          {orders.isPending ? (
            <OrderRowSkeleton />
          ) : orders.isError ? (
            <ErrorState message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
          ) : orders.data.items.length === 0 ? (
            <div className="py-10">
              <p className="text-sm text-stone">Вы ещё ничего не заказывали.</p>
              <Button asChild variant="outline" className="mt-5">
                <Link to="/catalog">Перейти в каталог</Link>
              </Button>
            </div>
          ) : (
            <ul>
              {orders.data.items.slice(0, 3).map((o) => (
                <OrderRow key={o.id} order={o} compact />
              ))}
            </ul>
          )}
        </section>

        <Panel
          title="Адрес по умолчанию"
          action={
            <Link to="/account/addresses" className="label text-stone hover:text-ink">
              {defaultAddress ? 'Изменить' : 'Добавить'}
            </Link>
          }
          className="self-start"
        >
          {addresses.isPending ? (
            <div aria-hidden>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ) : addresses.isError ? (
            <ErrorState message={errorMessage(addresses.error)} onRetry={() => addresses.refetch()} />
          ) : defaultAddress ? (
            <address className="text-sm leading-relaxed not-italic">
              <p className="font-medium">
                {defaultAddress.firstName} {defaultAddress.lastName}
                {defaultAddress.label && <span className="ml-2 font-normal text-stone">· {defaultAddress.label}</span>}
              </p>
              <p className="mt-1 text-graphite">{formatAddress(defaultAddress)}</p>
              <p className="mt-1 text-stone">{defaultAddress.phone}</p>
            </address>
          ) : (
            <p className="text-sm text-stone">Сохраните адрес, чтобы оформлять заказы быстрее.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
