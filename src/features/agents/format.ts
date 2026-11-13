import { locale } from '@/i18n';

/** Date and time in the viewer's time zone, e.g. "13 nov. 2026, 15:42". */
export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

/** "il y a 3 jours" / "3 days ago". */
export function fmtRelative(iso: string, now = Date.now()): string {
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86_400 * 30) return rtf.format(Math.round(diff / 86_400), 'day');
  if (abs < 86_400 * 365) return rtf.format(Math.round(diff / (86_400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86_400 * 365)), 'year');
}

/** Characters of JSON shown as kilobytes ("7,4 ko" / "7.4 kB"). */
export function fmtKb(chars: number): string {
  return new Intl.NumberFormat(locale(), {
    style: 'unit',
    unit: 'kilobyte',
    maximumFractionDigits: 1,
  }).format(chars / 1000);
}

/** "A, B et C" / "A, B and C". */
export function fmtList(items: string[]): string {
  if (items.length < 2) return items.join('');
  const and = locale().startsWith('fr') ? ' et ' : ' and ';
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
}
