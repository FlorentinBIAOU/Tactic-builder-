import * as M from '@radix-ui/react-dropdown-menu';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

export function MenuContent({ children, align = 'end', className }: { children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string }) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={6}
        className={cn(
          'z-overlay min-w-48 rounded-md border border-border bg-surface p-1 shadow-overlay',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  destructive,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
  icon?: ReactNode;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-2 text-base outline-none',
        'data-[highlighted]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted',
        destructive && 'text-danger [&_svg]:text-danger'
      )}
    >
      {icon}
      {children}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-border" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => (
  <M.Label className="px-2.5 py-1.5 text-sm text-muted">{children}</M.Label>
);
export const MenuRadioGroup = M.RadioGroup;
export function MenuRadioItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <M.RadioItem
      value={value}
      className="flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-2 text-base outline-none data-[highlighted]:bg-surface-2"
    >
      {children}
      <M.ItemIndicator className="size-1.5 rounded-full bg-brand" />
    </M.RadioItem>
  );
}
