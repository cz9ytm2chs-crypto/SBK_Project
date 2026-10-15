import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import { CartLine, FreeShippingProgress } from '@/components/cart/cart-line';
import { Button } from '@/components/ui/button';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useCart } from '@/hooks/cart';
import { useSettings } from '@/hooks/common';
import { money, plural } from '@/lib/utils';
import { useUi } from '@/stores';

export function CartDrawer() {
  const { cartOpen, setCartOpen } = useUi();
  const { data: cart, isLoading } = useCart();
  const { data: settings } = useSettings();
  const close = () => setCartOpen(false);
  const hasIssues = cart?.items.some((i) => i.issue);
  const count = cart?.itemCount ?? 0;

  return (
    <Dialog open={cartOpen} onOpenChange={setCartOpen}>
      <SheetContent
        title={count ? `Корзина · ${count} ${plural(count, ['товар', 'товара', 'товаров'])}` : 'Корзина'}
        footer={
          cart && cart.items.length > 0 ? (
            <div className="space-y-4">
              <FreeShippingProgress remaining={cart.totals.freeShippingRemaining} threshold={settings?.freeShippingFrom} />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-graphite">Сумма</span>
                <span className="text-lg font-medium tabular-nums">{money(cart.totals.subtotal)}</span>
              </div>
              <p className="text-xs text-stone">Доставка рассчитывается при оформлении</p>
              <div className="grid gap-2">
                <Button asChild block size="lg" disabled={hasIssues}>
                  <Link to={hasIssues ? '/cart' : '/checkout'} onClick={close}>
                    {hasIssues ? 'Проверить корзину' : 'Оформить заказ'}
                  </Link>
                </Button>
                <Button asChild block variant="outline">
                  <Link to="/cart" onClick={close}>
                    Перейти в корзину
                  </Link>
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="space-y-4 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="aspect-[4/5] w-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !cart?.items.length ? (
          <EmptyState
            icon={<ShoppingBag />}
            title="Корзина пуста"
            description="Добавьте товары из каталога — они сохранятся, даже если вы закроете вкладку."
            action={
              <Button asChild onClick={close}>
                <Link to="/catalog">В каталог</Link>
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-line px-5">
            {cart.items.map((line) => (
              <CartLine key={line.id} line={line} compact onNavigate={close} />
            ))}
          </div>
        )}
      </SheetContent>
    </Dialog>
  );
}
