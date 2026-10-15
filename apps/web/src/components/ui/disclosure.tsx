import { Accordion as A, DropdownMenu as DM, Tabs as T } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// ── Accordion ──
export const Accordion = A.Root;

export function AccordionItem({ value, title, children, className }: { value: string; title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <A.Item value={value} className={cn('border-b border-line', className)}>
      <A.Header>
        <A.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium transition-colors hover:text-graphite">
          {title}
          <ChevronDown className="size-4 shrink-0 text-stone transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </A.Trigger>
      </A.Header>
      <A.Content className="overflow-hidden text-sm text-graphite data-[state=closed]:animate-[accordion-up_.25s_ease-out] data-[state=open]:animate-[accordion-down_.3s_cubic-bezier(.22,1,.36,1)]">
        <div className="pb-5 leading-relaxed">{children}</div>
      </A.Content>
    </A.Item>
  );
}

// ── Tabs ──
export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn('flex gap-6 overflow-x-auto border-b border-line no-scrollbar', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'label -mb-px shrink-0 border-b-2 border-transparent pb-3 text-stone transition-colors hover:text-ink data-[state=active]:border-ink data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  );
}

// ── Dropdown menu ──
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({ className, align = 'end', ...props }: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={8}
        className={cn('z-50 min-w-48 rounded-xs border border-line bg-paper p-1.5 shadow-xl data-[state=open]:animate-[fade-in_.15s_ease-out]', className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DM.Item>) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-xs px-3 py-2 text-sm outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-mist [&_svg]:size-4 [&_svg]:text-stone',
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = () => <DM.Separator className="my-1.5 h-px bg-line" />;
export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => (
  <DM.Label className="px-3 py-2 text-xs text-stone">{children}</DM.Label>
);
