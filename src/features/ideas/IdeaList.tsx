import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';

export type IdeaRow = {
  key: string;
  name: string;
  why: string;
  tag?: string;
  done: boolean;
};

/** Ideas as a plain list: title, rationale, and one action per idea. The
 *  emoji suggested by the AI is kept for the draft but not shown here. */
export function IdeaList({
  rows,
  icon,
  actionLabel,
  actionIcon,
  doneLabel,
  busyKey,
  lockDone,
  onAction,
}: {
  rows: IdeaRow[];
  icon: ReactNode;
  actionLabel: string;
  actionIcon: ReactNode;
  doneLabel: string;
  busyKey?: string | null;
  /** Done ideas cannot be acted on again (a module exists once). */
  lockDone?: boolean;
  onAction: (key: string) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            <span
              aria-hidden
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted [&_svg]:size-4"
            >
              {icon}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-md font-semibold leading-snug">{r.name}</h3>
                {r.tag ? <Badge>{r.tag}</Badge> : null}
                {r.done ? (
                  <Badge tone="success">
                    <Check aria-hidden className="size-3" />
                    {doneLabel}
                  </Badge>
                ) : null}
              </div>
              {r.why ? <p className="text-base text-muted">{r.why}</p> : null}
            </div>
          </div>
          <Button
            className="h-10 w-full shrink-0 sm:w-auto"
            variant={r.done ? 'ghost' : 'secondary'}
            loading={busyKey === r.key}
            disabled={(!!busyKey && busyKey !== r.key) || (lockDone && r.done)}
            onClick={() => onAction(r.key)}
          >
            {busyKey === r.key ? null : actionIcon}
            {actionLabel}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function IdeaListSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy className="divide-y divide-border">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3 px-5 py-4">
          <Skeleton className="size-8 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-11/12" />
          </div>
        </div>
      ))}
    </div>
  );
}
