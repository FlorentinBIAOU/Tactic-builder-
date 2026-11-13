import { locale } from '@/i18n';

/** Shown for a value that cannot be computed. Never a misleading 0. */
export const NONE = '—';

export function eur(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return NONE;
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function int(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NONE;
  return new Intl.NumberFormat(locale()).format(Math.round(n));
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return NONE;
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: digits }).format(n);
}

/** Signed percentage (+12 %, −8 %) for returns. */
export function signedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return NONE;
  return new Intl.NumberFormat(locale(), {
    style: 'percent',
    maximumFractionDigits: 0,
    signDisplay: 'exceptZero',
  }).format(n);
}

/** Compact euro amount for chart axes (1,2 k€). */
export function eurCompact(n: number): string {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function day(iso: string | null | undefined): string {
  if (!iso) return NONE;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
}
