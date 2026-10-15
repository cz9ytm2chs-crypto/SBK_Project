import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay =
  'fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_.2s_ease-out] data-[state=closed]:animate-[fade-out_.15s_ease-in]';

export function DialogContent({
  className,
  children,
  title,
  description,
  hideTitle,
  ...props
}: ComponentProps<typeof D.Content> & { title: string; description?: string; hideTitle?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xs bg-paper p-6 shadow-2xl focus:outline-none sm:p-8 data-[state=open]:animate-[dialog-in_.25s_cubic-bezier(.22,1,.36,1)]',
          className,
        )}
        {...props}
      >
        <D.Title className={cn('display pr-8 text-xl', hideTitle && 'sr-only')}>{title}</D.Title>
        {description ? (
          <D.Description className="mt-2 text-sm text-stone">{description}</D.Description>
        ) : (
          <D.Description className="sr-only">{title}</D.Description>
        )}
        <div className={cn(!hideTitle && 'mt-5')}>{children}</div>
        <D.Close className="absolute top-4 right-4 rounded-xs p-1.5 text-stone transition-colors hover:bg-mist hover:text-ink" aria-label="Закрыть">
          <X className="size-5" />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/** Side panel (cart, filters, mobile menu). */
export function SheetContent({
  side = 'right',
  className,
  children,
  title,
  hideTitle,
  footer,
  ...props
}: ComponentProps<typeof D.Content> & { side?: 'left' | 'right'; title: string; hideTitle?: boolean; footer?: ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed top-0 bottom-0 z-50 flex w-full max-w-md flex-col bg-paper shadow-2xl focus:outline-none',
          side === 'right'
            ? 'right-0 data-[state=open]:animate-[sheet-in-right_.35s_cubic-bezier(.22,1,.36,1)] data-[state=closed]:animate-[sheet-out-right_.25s_ease-in]'
            : 'left-0 data-[state=open]:animate-[sheet-in-left_.35s_cubic-bezier(.22,1,.36,1)] data-[state=closed]:animate-[sheet-out-left_.25s_ease-in]',
          className,
        )}
        {...props}
      >
        <div className={cn('flex h-16 shrink-0 items-center justify-between border-b border-line px-5', hideTitle && 'border-none')}>
          <D.Title className={cn('label', hideTitle && 'sr-only')}>{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          <D.Close className="-mr-2 rounded-xs p-2 text-ink transition-colors hover:bg-mist" aria-label="Закрыть">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="shrink-0 border-t border-line p-5">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

// ── Confirm dialog for dangerous actions: const confirm = useConfirm(); if (await confirm({...})) … ──
interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);
  const close = (value: boolean) => {
    resolver.current?.(value);
    setOptions(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onOpenChange={(open) => !open && close(false)}>
        {options && (
          <DialogContent title={options.title} description={options.description} className="max-w-md">
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => close(false)}>
                Отмена
              </Button>
              <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {options.confirmLabel ?? 'Подтвердить'}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
