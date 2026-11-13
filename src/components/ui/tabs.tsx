import * as T from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <T.List className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>{children}</T.List>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className={cn(
        'relative -mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-base font-medium text-muted',
        'transition-colors hover:text-foreground data-[state=active]:border-brand data-[state=active]:text-foreground'
      )}
    >
      {children}
    </T.Trigger>
  );
}
