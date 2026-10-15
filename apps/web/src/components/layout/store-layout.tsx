import { WifiOff } from 'lucide-react';
import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { PageSpinner } from '@/components/ui/misc';
import { useOnline } from '@/hooks/common';
import { CartDrawer } from './cart-drawer';
import { Footer } from './footer';
import { Header } from './header';
import { MobileMenu } from './mobile-menu';
import { SearchOverlay } from './search-overlay';

function NetworkBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 py-2.5 text-sm text-white">
      <WifiOff className="size-4" /> Нет подключения к интернету. Изменения сохранятся, когда связь восстановится.
    </div>
  );
}

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-[70] bg-ink px-4 py-2 text-milk focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Перейти к содержимому
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <CartDrawer />
      <SearchOverlay />
      <MobileMenu />
      <NetworkBanner />
      <ScrollRestoration />
    </div>
  );
}
