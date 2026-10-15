import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/button';

/** Last-resort boundary: failed chunk loads (after a deploy) and unexpected render errors. */
export function RouteError() {
  const error = useRouteError();
  const chunkFailed = error instanceof Error && /dynamically imported module|Loading chunk/i.test(error.message);
  const status = isRouteErrorResponse(error) ? error.status : null;
  if (import.meta.env.DEV) console.error(error);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-milk px-6 text-center">
      <p className="label text-stone">{status ?? 'Ошибка'}</p>
      <h1 className="display mt-4 text-3xl">{chunkFailed ? 'Сайт обновился' : 'Что-то пошло не так'}</h1>
      <p className="mt-3 max-w-md text-sm text-stone">
        {chunkFailed ? 'Обновите страницу, чтобы загрузить новую версию.' : 'Попробуйте обновить страницу. Если ошибка повторится — напишите нам.'}
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={() => window.location.reload()}>Обновить</Button>
        <Button asChild variant="outline">
          <Link to="/">На главную</Link>
        </Button>
      </div>
    </div>
  );
}
