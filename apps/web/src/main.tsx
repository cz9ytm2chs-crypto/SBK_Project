import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster, toast } from 'sonner';
import { router } from '@/app/router';
import { ConfirmProvider } from '@/components/ui/dialog';
import { onUnauthorized } from '@/lib/api';
import { qk, queryClient } from '@/lib/query';
import '@/styles/index.css';

/** A 401 while we thought we were logged in means the session expired or was revoked. */
function SessionWatcher() {
  useEffect(
    () =>
      onUnauthorized(() => {
        if (queryClient.getQueryData(qk.me)) {
          queryClient.setQueryData(qk.me, null);
          toast.error('Сессия истекла. Войдите снова');
        }
      }),
    [],
  );
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <SessionWatcher />
        <RouterProvider router={router} />
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: '!rounded-xs !border-line !bg-paper !text-ink !font-sans !shadow-xl',
              description: '!text-stone',
              actionButton: '!bg-ink !text-milk !rounded-xs',
            },
          }}
        />
      </ConfirmProvider>
    </QueryClientProvider>
  </StrictMode>,
);
