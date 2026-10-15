import type { ApiErrorBody } from '@silt/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field errors from zod validation, keyed by dotted path. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION_ERROR' || !Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
}

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

export function toQueryString(params?: Query) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Listeners for "session expired" — the auth layer shows a toast and refreshes. */
const unauthorizedListeners = new Set<() => void>();
export const onUnauthorized = (fn: () => void) => {
  unauthorizedListeners.add(fn);
  return () => {
    unauthorizedListeners.delete(fn);
  };
};

async function request<T>(method: string, path: string, body?: unknown, query?: Query, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json';
  if (method !== 'GET') {
    const csrf = readCookie('silt_csrf');
    if (csrf) headers['x-csrf-token'] = csrf;
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${toQueryString(query)}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет соединения с сервером. Проверьте интернет и попробуйте снова');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as ApiErrorBody | null)?.error;
    if (res.status === 401) unauthorizedListeners.forEach((fn) => fn());
    // A missing CSRF cookie (first visit / cleared cookies): retry once after it is issued.
    if (err?.code === 'CSRF_INVALID' && !retried) {
      await fetch('/api/v1/auth/me', { credentials: 'include' });
      return request<T>(method, path, body, query, true);
    }
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? 'Что-то пошло не так', err?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>('POST', path, body ?? {}, query),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Что-то пошло не так');
