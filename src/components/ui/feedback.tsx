import type { ReactNode } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-surface-2', className)} />;
}

/** Empty or first-use state: what is missing and what to do about it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center', className)}>
      {icon ? <div className="text-muted [&_svg]:size-8">{icon}</div> : null}
      <div className="flex max-w-md flex-col gap-1">
        <p className="text-md font-semibold">{title}</p>
        {description ? <p className="text-base text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Inline notice: info, warning or error, with an optional action. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'danger';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-base',
        tone === 'info' && 'border-info/30 bg-info/10',
        tone === 'warning' && 'border-warning/35 bg-warning/10',
        tone === 'danger' && 'border-danger/35 bg-danger/10',
        className
      )}
    >
      <Icon
        aria-hidden
        className={cn('mt-0.5 size-4 shrink-0', tone === 'info' ? 'text-info' : tone === 'warning' ? 'text-warning' : 'text-danger')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-foreground/90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-sans text-xs text-muted">
      {children}
    </kbd>
  );
}
