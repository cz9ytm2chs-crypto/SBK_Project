import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError, errorMessage } from '@/lib/api';

const FRIENDLY: Record<string, string> = {
  EMAIL_TAKEN: 'Аккаунт с этим email уже существует. Войдите или восстановите пароль.',
  INVALID_CREDENTIALS: 'Неверный email или пароль. Проверьте раскладку и Caps Lock.',
  ACCOUNT_BLOCKED: 'Аккаунт заблокирован. Напишите в поддержку — мы поможем разобраться.',
  TOKEN_INVALID: 'Ссылка недействительна или срок её действия истёк.',
  RATE_LIMITED: 'Слишком много попыток. Подождите несколько минут и попробуйте снова.',
  INVALID_PASSWORD: 'Текущий пароль указан неверно.',
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
  UNAUTHORIZED: 'Сеанс истёк. Войдите снова.',
};

/** Human-friendly text for an API error (falls back to the server message). */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError && FRIENDLY[err.code]) return FRIENDLY[err.code];
  return errorMessage(err);
}

export const errorCode = (err: unknown) => (err instanceof ApiError ? err.code : undefined);

/**
 * Copies server-side field errors onto the form. `codeFields` maps an error code to
 * the field it belongs to (e.g. EMAIL_TAKEN → email). Returns a message for the
 * form-level alert, or null when every problem was attached to a field.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  codeFields: Partial<Record<string, Path<T>>> = {},
): string | null {
  if (!(err instanceof ApiError)) return friendlyError(err);
  const field = codeFields[err.code];
  if (field) {
    setError(field, { type: 'server', message: FRIENDLY[err.code] ?? err.message }, { shouldFocus: true });
    return null;
  }
  const fieldErrors = Object.entries(err.fieldErrors);
  if (fieldErrors.length) {
    for (const [path, message] of fieldErrors) setError(path as Path<T>, { type: 'server', message });
    return null;
  }
  return friendlyError(err);
}

/** Only allow same-origin relative redirects ("/x", never "//evil.com"). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return next;
}
