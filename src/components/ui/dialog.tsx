import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay =
  'fixed inset-0 z-overlay bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 ' +
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0';

type ContentProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  closeLabel?: string;
};

/** Centred modal. Focus is trapped and restored by Radix. */
export function DialogContent({ title, description, children, footer, className, closeLabel = 'Close' }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-overlay w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-lg border border-border bg-surface p-6 shadow-overlay focus:outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="text-base text-muted">{description}</D.Description> : null}
          </div>
          <D.Close asChild>
            <IconButton label={closeLabel} icon={<X />} size="icon-sm" className="-mr-2 -mt-1" />
          </D.Close>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}

type SheetProps = ContentProps & { side?: 'right' | 'left'; width?: string };

/** Side panel (drawer). Full-screen on phones. */
export function SheetContent({
  title,
  description,
  children,
  footer,
  className,
  side = 'right',
  width = 'sm:max-w-xl',
  closeLabel = 'Close',
}: SheetProps) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed inset-y-0 z-overlay flex w-full flex-col border-border bg-surface shadow-overlay focus:outline-none',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          width,
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-base',
          side === 'right'
            ? 'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right'
            : 'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <D.Title className="truncate text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="text-sm text-muted">{description}</D.Description> : null}
          </div>
          <D.Close asChild>
            <IconButton label={closeLabel} icon={<X />} size="icon-sm" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">{footer}</div> : null}
      </D.Content>
    </D.Portal>
  );
}
