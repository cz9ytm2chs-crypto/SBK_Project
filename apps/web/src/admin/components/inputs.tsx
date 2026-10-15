import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Input, NativeSelect } from '@/components/ui/form';
import { useDebounce } from '@/hooks/common';
import { cn } from '@/lib/utils';
import { kopecksToRubles, rublesToKopecks } from '../lib';

/** Search box that reports its value after a short pause (URL-synced lists). */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск',
  label = 'Поиск',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, 300);
  const emitted = useRef(value);

  useEffect(() => {
    if (debounced.trim() !== emitted.current) {
      emitted.current = debounced.trim();
      onChange(debounced.trim());
    }
  }, [debounced, onChange]);

  // External changes (back button, "reset filters") update the box.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(value);
    }
  }, [value]);

  return (
    <div className={cn('relative min-w-56 flex-1', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone" aria-hidden />
      <Input
        type="search"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 pr-9 pl-9"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText('')}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-xs p-1 text-stone hover:text-ink"
          aria-label="Очистить поиск"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Compact select for toolbars, with an accessible label. */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className,
  allLabel = 'Все',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  allLabel?: string | null;
}) {
  return (
    <div className={cn('min-w-40 flex-1 sm:flex-none', className)}>
      <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 text-sm">
        {allLabel !== null && <option value="">{`${label}: ${allLabel.toLowerCase()}`}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/**
 * Money field: staff type rubles ("1290" or "1290,50"), the form keeps integer kopecks.
 * `nullable` fields report null when empty; others report 0.
 */
export function MoneyInput({
  value,
  onChange,
  nullable,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  nullable?: boolean;
}) {
  const [text, setText] = useState(() => kopecksToRubles(value));
  useEffect(() => {
    // Sync only when the outside value really differs (e.g. form reset).
    if (rublesToKopecks(text) !== (value ?? null) && !(value === 0 && text === '' && !nullable)) setText(kopecksToRubles(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cn('relative', className)}>
      <Input
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const minor = rublesToKopecks(e.target.value);
          onChange(nullable ? minor : (minor ?? 0));
        }}
        className="pr-8 tabular-nums"
        {...props}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-stone">₽</span>
    </div>
  );
}

/** "42 / 70" counter for SEO fields. */
export function CharCount({ value, max }: { value: string | null | undefined; max: number }) {
  const n = value?.length ?? 0;
  return <span className={cn('text-2xs tabular-nums', n > max ? 'text-danger' : 'text-stone')}>{`${n} / ${max}`}</span>;
}
