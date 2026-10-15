import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShoppingBag } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import type { ProductCardDTO } from '@silt/shared';
import { CartLine, FreeShippingProgress } from '@/components/cart/cart-line';
import { ProductRail } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useCart } from '@/hooks/cart';
import { useSettings } from '@/hooks/common';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { money, plural } from '@/lib/utils';

export default function CartPage() {
  const { data: cart, isLoading, isError, refetch } = useCart();
  const { data: settings } = useSettings();
  const recs = useQuery({ queryKey: qk.cartRecs, queryFn: () => api.get<ProductCardDTO[]>('/cart/recommendations'), enabled: !!cart });

  // Prices and stock are re-checked by the server every time the cart page opens.
  useEffect(() => {
    refetch();
  }, [refetch]);

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const items = cart?.items ?? [];
  const issues = items.filter((i) => i.issue);
  const belowMin = !!cart && cart.minOrderAmount > 0 && cart.totals.subtotal < cart.minOrderAmount;
  const canCheckout = items.length > 0 && !issues.length && !belowMin;

  return (
    <div className="container-x pt-10 pb-10 md:pt-14">
      <Seo title="Корзина" noindex />
      <h1 className="display text-3xl md:text-5xl">Корзина</h1>

      {isLoading ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : !items.length ? (
        <EmptyState
          className="mt-6 bg-paper"
          icon={<ShoppingBag />}
          title="В корзине пока ничего нет"
          description="Загляните в каталог — новые поступления каждую неделю."
          action={
            <Button asChild size="lg">
              <Link to="/catalog">Перейти в каталог</Link>
            </Button>
          }
        />
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
          <div>
            <p className="label border-b border-line pb-4 text-stone">
              {cart!.itemCount} {plural(cart!.itemCount, ['товар', 'товара', 'товаров'])}
            </p>
            {issues.length > 0 && (
              <div role="alert" className="mt-5 flex gap-3 border border-danger/30 bg-danger/5 p-4 text-sm">
                <AlertTriangle className="size-5 shrink-0 text-danger" />
                <p>Наличие некоторых товаров изменилось. Удалите недоступные позиции или уменьшите количество, чтобы продолжить.</p>
              </div>
            )}
            <div className="divide-y divide-line">
              {items.map((line) => (
                <CartLine key={line.id} line={line} />
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="bg-paper p-6 md:p-8">
              <h2 className="label">Ваш заказ</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-graphite">Товары</dt>
                  <dd className="tabular-nums">{money(cart!.totals.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-graphite">Доставка</dt>
                  <dd className="text-stone">при оформлении</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-4 text-base font-medium">
                  <dt>Итого</dt>
                  <dd className="tabular-nums">{money(cart!.totals.total)}</dd>
                </div>
                <p className="text-xs text-stone">Включая НДС {money(cart!.totals.taxTotal)}</p>
              </dl>
              <div className="mt-6">
                <FreeShippingProgress remaining={cart!.totals.freeShippingRemaining} threshold={settings?.freeShippingFrom} />
              </div>
              {belowMin && (
                <p role="alert" className="mt-5 text-xs text-danger">
                  Минимальная сумма заказа — {money(cart!.minOrderAmount)}
                </p>
              )}
              <Button asChild={canCheckout} block size="lg" className="mt-6" disabled={!canCheckout}>
                {canCheckout ? <Link to="/checkout">Оформить заказ</Link> : <span>Оформить заказ</span>}
              </Button>
            </div>
            <Link to="/catalog" className="mt-5 block text-center text-sm text-stone underline underline-offset-4 hover:text-ink">
              Продолжить покупки
            </Link>
          </aside>
        </div>
      )}

      {!!recs.data?.length && (
        <section className="mt-24">
          <h2 className="display mb-8 text-2xl">Дополните образ</h2>
          <ProductRail products={recs.data} />
        </section>
      )}
    </div>
  );
}
