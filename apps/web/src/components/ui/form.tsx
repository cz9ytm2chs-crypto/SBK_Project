import { Checkbox as CheckboxPrimitive, Label as LabelPrimitive, RadioGroup as RadioPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const fieldBase =
  'w-full rounded-xs border border-line bg-paper px-3.5 text-sm text-ink transition-colors placeholder:text-stone/70 hover:border-stone focus:border-ink focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldBase, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-24 py-3 leading-relaxed', className)} {...props} />;
}

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, 'h-11 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone" />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('mb-1.5 block text-xs font-medium text-graphite', className)} {...props} />;
}

/** Label + control + hint/error with correct aria wiring. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
  required,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-rust"> *</span>}
        </Label>
      )}
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-stone">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer flex size-[18px] shrink-0 items-center justify-center rounded-xs border border-stone bg-paper transition-colors data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-milk aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function CheckboxField({ label, className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Checkbox id={id} className="mt-0.5" {...props} />
      <label htmlFor={id} className="text-sm leading-snug text-graphite select-none">
        {label}
      </label>
    </div>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-line transition-colors data-[state=checked]:bg-ink',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

export const RadioGroup = ({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) => (
  <RadioPrimitive.Root className={cn('grid gap-3', className)} {...props} />
);

/** Large selectable card used for delivery / payment options. */
export function RadioCard({ value, children, className, disabled }: { value: string; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <RadioPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        'group flex w-full items-start gap-4 rounded-xs border border-line bg-paper p-4 text-left transition-colors hover:border-stone data-[state=checked]:border-ink disabled:opacity-50',
        className,
      )}
    >
      <span className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border border-stone group-data-[state=checked]:border-ink">
        <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-ink" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </RadioPrimitive.Item>
  );
}
