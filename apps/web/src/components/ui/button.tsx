import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './misc';

export const buttonVariants = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xs text-xs font-medium tracking-[0.12em] uppercase transition-[background-color,color,border-color,transform] duration-200 ease-out-soft active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-milk hover:bg-graphite',
        accent: 'bg-rust text-white hover:bg-rust-dark',
        outline: 'border border-ink text-ink hover:bg-ink hover:text-milk',
        ghost: 'text-ink hover:bg-mist',
        light: 'bg-paper text-ink hover:bg-white',
        link: 'h-auto px-0 normal-case tracking-normal text-sm underline underline-offset-4 decoration-line hover:decoration-ink active:scale-100',
        danger: 'bg-danger text-white hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 px-4',
        md: 'h-11 px-6',
        lg: 'h-14 px-8 text-[0.8125rem]',
        icon: 'size-10 tracking-normal',
        'icon-sm': 'size-8 tracking-normal',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, block, asChild, loading, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-4" />
            </span>
          )}
          <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
        </>
      )}
    </Comp>
  );
}
