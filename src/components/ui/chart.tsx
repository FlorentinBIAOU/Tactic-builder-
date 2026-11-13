import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { locale } from '@/i18n';

/**
 * Shared chart helpers (Recharts). Colours come from the theme tokens so
 * charts read in both themes. Series order: brand gold first, then teal,
 * info blue, success, warning.
 */
export const SERIES = ['rgb(var(--c-brand))', 'rgb(var(--c-info))', 'rgb(var(--c-success))', 'rgb(var(--c-warning))', 'rgb(var(--c-danger))'];

export const axis = {
  stroke: 'rgb(var(--c-muted))',
  tick: { fill: 'rgb(var(--c-muted))', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'rgb(var(--c-border))' },
} as const;

export const grid = { stroke: 'rgb(var(--c-border))', strokeDasharray: '3 3', vertical: false } as const;

export const tooltipStyle = {
  contentStyle: {
    background: 'rgb(var(--c-surface))',
    border: '1px solid rgb(var(--c-border))',
    borderRadius: 8,
    color: 'rgb(var(--c-foreground))',
    fontSize: 13,
  },
  labelStyle: { color: 'rgb(var(--c-muted))' },
  cursor: { fill: 'rgb(var(--c-surface-2))' },
} as const;

export function ChartBox({ height = 260, children, label }: { height?: number; children: ReactNode; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const fmtInt = (n: number) => new Intl.NumberFormat(locale()).format(Math.round(n));
export const fmtPct = (n: number, digits = 0) =>
  new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: digits }).format(n);
export const fmtEur = (n: number) =>
  new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
export const fmtDate = (iso: string | undefined) =>
  iso ? new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(iso)) : '—';
