import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as P from '@radix-ui/react-popover';
import { Info, RotateCcw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/feedback';
import { ChartBox, SERIES, axis, fmtInt, fmtPct, grid, tooltipStyle } from '@/components/ui/chart';
import { useCorpus } from '@/store/corpus';
import { useAnalytics, type BlockKey } from '@/store/analytics';
import type { DomainCoverage } from '@/lib/analytics';
import { cn } from '@/lib/utils';

// ─── Data hooks ────────────────────────────────────────────────────────────

/** Loads the corpus once (shared store). */
export function useEnsureCorpus() {
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);
  return { loaded, loading: loading || (!loaded && !loadError), loadError, reload: load };
}

/** Loads learner analytics once (shared store). */
export function useEnsureAnalytics() {
  const loaded = useAnalytics((s) => s.loaded);
  const loading = useAnalytics((s) => s.loading);
  const load = useAnalytics((s) => s.load);
  useEffect(() => {
    if (!loaded && !loading) void load();
  }, [loaded, loading, load]);
}

/** Lesson id → name (no emoji), for chart labels. */
export function useLessonNames() {
  const lessons = useCorpus((s) => s.lessons);
  return useMemo(() => {
    const m = new Map(lessons.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [lessons]);
}

// ─── Small building blocks ─────────────────────────────────────────────────

/** « i » button that explains an indicator in plain words (tap or click). */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <P.Root>
      <P.Trigger
        aria-label={label}
        className="relative inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-foreground after:absolute after:-inset-2.5 after:content-['']"
      >
        <Info aria-hidden className="size-4" />
      </P.Trigger>
      <P.Portal>
        <P.Content
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="z-toast max-w-72 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {children}
          <P.Arrow className="fill-surface" />
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/** Title row of a block: title, optional explanation, actions on the right. */
export function BlockHeader({ title, info, actions, sub }: { title: ReactNode; info?: ReactNode; actions?: ReactNode; sub?: ReactNode }) {
  const { t } = useTranslation('stats');
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-md font-semibold">{title}</h3>
          {info ? <InfoTip label={t('common.about', { what: typeof title === 'string' ? title : '' })}>{info}</InfoTip> : null}
        </div>
        {sub ? <p className="text-sm text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A chart or list region with a light frame. */
export function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 rounded-lg border border-border bg-surface p-5', className)}>{children}</section>;
}

/** « Unavailable » state for one block, with a retry button and the technical detail. */
export function BlockError({ detail, onRetry, retrying }: { detail?: string | null; onRetry: () => void; retrying?: boolean }) {
  const { t } = useTranslation('stats');
  return (
    <Notice
      tone="danger"
      title={t('common.unavailable')}
      action={
        <Button size="sm" variant="secondary" onClick={onRetry} loading={retrying}>
          {!retrying ? <RotateCcw aria-hidden /> : null}
          {t('common.retry')}
        </Button>
      }
    >
      <p>{t('common.unavailableHelp')}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{t('common.detail', { detail })}</p> : null}
    </Notice>
  );
}

/** Retry bound to an analytics block. */
export function AnalyticsError({ block }: { block: BlockKey }) {
  const state = useAnalytics((s) => s.blocks[block]);
  const reload = useAnalytics((s) => s.reload);
  return <BlockError detail={state.error} onRetry={() => void reload(block)} retrying={state.status === 'loading'} />;
}

/** Proxy / estimate badge-and-note shown when the real measure is not available. */
export function ProxyNote({ children }: { children: ReactNode }) {
  const { t } = useTranslation('stats');
  return (
    <p className="mb-3 flex flex-wrap items-baseline gap-2 text-sm text-muted">
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">{t('common.proxy')}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

/** Banner when part of the analytics rows come from the demo seed. */
export function DemoBanner() {
  const { t } = useTranslation('stats');
  const demo = useAnalytics((s) => s.demo);
  if (!demo || demo.demoRows <= 0) return null;
  const total = demo.demoRows + demo.realRows;
  return (
    <Notice tone="warning" title={t('demo.title')} className="mb-6">
      {t('demo.body', { demo: fmtInt(demo.demoRows), total: fmtInt(total) })}
    </Notice>
  );
}

/** Percentage bar with count, coloured by threshold (text always shows the value). */
export function CoverageMeter({ label, count, total, info }: { label: string; count: number; total: number; info?: ReactNode }) {
  const { t } = useTranslation('stats');
  const ratio = total ? count / total : 0;
  const tone = ratio >= 0.8 ? 'bg-success' : ratio >= 0.5 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-base">
          {label}
          {info ? <InfoTip label={t('common.about', { what: label })}>{info}</InfoTip> : null}
        </span>
        <span className="tabular text-base font-semibold">{fmtPct(ratio)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <span className="tabular text-sm text-muted">{t('common.ofLessons', { count: total, n: fmtInt(count), total: fmtInt(total) })}</span>
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Y-axis tick that truncates long names and keeps the full one as a tooltip. */
function NameTick(props: {
  x?: number;
  y?: number;
  payload?: { value: string };
  max: number;
  tag?: (v: string) => string | undefined;
  tagLeft?: number;
}) {
  const { x = 0, y = 0, payload, max, tag, tagLeft } = props;
  const value = payload?.value ?? '';
  const code = tag?.(value);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{value}</title>
      <text x={-8} y={0} dy={4} textAnchor="end" fill="rgb(var(--c-foreground))" fontSize={12}>
        {truncate(value, max)}
      </text>
      {code ? (
        <g transform={`translate(${-(tagLeft ?? 160)},-9)`}>
          <rect width={18} height={18} rx={4} fill="rgb(var(--c-surface-2))" stroke="rgb(var(--c-border))" />
          <text x={9} y={13} textAnchor="middle" fontSize={11} fontWeight={600} fill="rgb(var(--c-muted))">
            {code}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export type BarDatum = { name: string; value: number };

/** Horizontal bars for ranked lists (lessons, modules, missions). */
export function HBars({
  data,
  label,
  color = SERIES[0],
  format = fmtInt,
  seriesName,
  domain,
}: {
  data: BarDatum[];
  label: string;
  color?: string;
  format?: (n: number) => string;
  seriesName: string;
  domain?: [number, number];
}) {
  const height = Math.max(120, data.length * 34 + 40);
  return (
    <ChartBox label={label} height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...grid} horizontal={false} vertical />
        <XAxis
          type="number"
          {...axis}
          tickFormatter={format}
          domain={domain}
          ticks={domain ? [0, 0.25, 0.5, 0.75, 1].map((f) => domain[0] + f * (domain[1] - domain[0])) : undefined}
          allowDecimals={!!domain}
        />
        <YAxis type="category" dataKey="name" {...axis} width={150} interval={0} tick={<NameTick max={22} />} />
        <RTooltip {...tooltipStyle} formatter={(v: number) => [format(v), seriesName]} />
        <Bar dataKey="value" name={seriesName} fill={color} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false} />
      </BarChart>
    </ChartBox>
  );
}

/** Stacked bars per domain: lessons without content, drafts, published. */
export function DomainCoverageChart({ rows, label }: { rows: DomainCoverage[]; label: string }) {
  const { t } = useTranslation('stats');
  const data = rows.map((r) => ({
    name: r.label || t('common.noDomain'),
    code: r.code,
    published: r.published,
    draft: r.draft,
    empty: r.empty,
  }));
  const codes = new Map(data.map((d) => [d.name, d.code]));
  const height = Math.max(140, data.length * 40 + 64);
  return (
    <ChartBox label={label} height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...grid} horizontal={false} vertical />
        <XAxis type="number" {...axis} allowDecimals={false} tickFormatter={fmtInt} />
        <YAxis type="category" dataKey="name" {...axis} width={170} interval={0} tick={<NameTick max={17} tagLeft={166} tag={(v) => codes.get(v) || undefined} />} />
        <RTooltip {...tooltipStyle} formatter={(v: number, n: string) => [fmtInt(v), n]} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, color: 'rgb(var(--c-muted))', paddingTop: 8 }} />
        <Bar dataKey="published" stackId="s" name={t('common.published')} fill={SERIES[2]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="draft" stackId="s" name={t('common.draft')} fill={SERIES[1]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="empty" stackId="s" name={t('common.empty')} fill={SERIES[4]} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ChartBox>
  );
}

/** Domain letter tag (A, B…), used instead of emojis. */
export function DomainTag({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-2 text-xs font-semibold text-muted">
      {code}
    </span>
  );
}
