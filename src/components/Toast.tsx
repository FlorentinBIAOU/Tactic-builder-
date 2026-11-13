import { Toaster, toast as sonner } from 'sonner';
import { useTheme } from '@/lib/theme';

export type ToastType = 'success' | 'error' | 'info';

/**
 * Imperative helper so non-component code can show a message.
 * Errors stay until dismissed; success and info close on their own.
 */
export function toast(msg: string, type: ToastType = 'success') {
  if (type === 'error') sonner.error(msg, { duration: Infinity, closeButton: true });
  else if (type === 'info') sonner.info(msg);
  else sonner.success(msg);
}

/** Mount once near the app root. Announced to screen readers by sonner. */
export function ToastHost() {
  const theme = useTheme((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      offset={20}
      toastOptions={{
        classNames: {
          toast: '!bg-surface !border-border !text-foreground !font-sans !text-base !shadow-overlay',
          description: '!text-muted',
          closeButton: '!bg-surface-2 !border-border !text-foreground',
        },
      }}
    />
  );
}
