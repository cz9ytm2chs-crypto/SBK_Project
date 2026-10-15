import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Input } from '@/components/ui/form';
import { cn } from '@/lib/utils';

/** Narrow, centred column used by every auth screen. */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-x py-14 md:py-24">
      <div className="mx-auto w-full max-w-[420px]">
        {eyebrow && <p className="label text-stone">{eyebrow}</p>}
        <h1 className="display mt-3 text-3xl md:text-4xl">{title}</h1>
        {description && <div className="mt-3 text-sm leading-relaxed text-stone">{description}</div>}
        <div className="mt-10">{children}</div>
        {footer && <div className="mt-10 border-t border-line pt-6 text-sm text-stone">{footer}</div>}
      </div>
    </div>
  );
}

/** Form-level error message (server errors that do not belong to a single field). */
export function FormAlert({ children, tone = 'danger' }: { children: ReactNode; tone?: 'danger' | 'info' }) {
  if (!children) return null;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'border-l-2 px-4 py-3 text-sm leading-relaxed',
        tone === 'danger' ? 'border-danger bg-danger/5 text-danger' : 'border-ink bg-mist/60 text-graphite',
      )}
    >
      {children}
    </div>
  );
}

/** Password input with a show/hide toggle. Accepts `register()` props including ref. */
export function PasswordInput({ className, ...props }: ComponentProps<'input'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-11', className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center text-stone transition-colors hover:text-ink"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={1.5} /> : <Eye className="size-4" strokeWidth={1.5} />}
      </button>
    </div>
  );
}

const STRENGTH = [
  { label: 'Слабый', tone: 'bg-danger' },
  { label: 'Слабый', tone: 'bg-danger' },
  { label: 'Средний', tone: 'bg-warning' },
  { label: 'Хороший', tone: 'bg-graphite' },
  { label: 'Надёжный', tone: 'bg-success' },
];

export function passwordScore(pw: string) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Za-zА-Яа-я]/.test(pw) && /\d/.test(pw)) score++;
  if (/[a-zа-я]/.test(pw) && /[A-ZА-Я]/.test(pw)) score++;
  if (pw.length >= 12 || /[^A-Za-zА-Яа-я0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

/** 4-segment strength meter shown under new-password fields. */
export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  const s = STRENGTH[score];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn('h-0.5 flex-1 transition-colors', password && i <= score ? s.tone : 'bg-line')} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-stone">
        {password ? <>Надёжность: {s.label}. </> : null}
        Минимум 8 символов, буквы и цифры.
      </p>
    </div>
  );
}
