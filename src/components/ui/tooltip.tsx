import * as T from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-toast max-w-64 rounded bg-foreground px-2.5 py-1.5 text-sm text-background shadow-raised data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
