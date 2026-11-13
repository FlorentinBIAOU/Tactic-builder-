import * as A from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants } from './button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
};

/** The one confirmation pattern for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  destructive,
}: Props) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-overlay bg-black/55 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <A.Content className="fixed left-1/2 top-1/2 z-overlay w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-overlay data-[state=open]:animate-in data-[state=open]:zoom-in-95">
          <A.Title className="text-lg font-semibold">{title}</A.Title>
          {description ? <A.Description className="mt-2 text-base text-muted">{description}</A.Description> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <A.Cancel className={buttonVariants({ variant: 'ghost' })}>{cancelLabel}</A.Cancel>
            <A.Action
              className={cn(buttonVariants({ variant: destructive ? 'danger' : 'primary' }))}
              onClick={onConfirm}
            >
              {confirmLabel}
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
