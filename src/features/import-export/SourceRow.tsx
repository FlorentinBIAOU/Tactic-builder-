import type { ReactNode } from 'react';

/** One import source: icon, what it is, what it contains, and its action. */
export function SourceRow({
  icon,
  title,
  body,
  meta,
  action,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
  meta?: ReactNode;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-4">
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand [&_svg]:size-5"
        >
          {icon}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-md font-semibold">{title}</h3>
          <p className="max-w-2xl text-base text-muted">{body}</p>
          {meta ? <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">{meta}</div> : null}
          {children}
        </div>
      </div>
      <div className="flex shrink-0 sm:pt-0.5 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>
    </div>
  );
}
