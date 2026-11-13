import { FileQuestion } from 'lucide-react';
import type { Domain } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Letter for a domain: its syllabus code (A, B, C…), else its first letter. */
export function domainLetter(d: Domain | null | undefined): string {
  if (!d) return '';
  const code = d.code?.trim();
  if (code) return code.slice(0, 2).toUpperCase();
  const name = d.name.replace(/^domain\s+[a-z0-9]+\s*-\s*/i, '').trim();
  return (name[0] ?? '?').toUpperCase();
}

/**
 * Sober marker that replaces lesson / module emojis in admin lists:
 * a tile with the domain letter, or a neutral icon when there is no domain.
 * Decorative: the domain name is always written next to it or in a title.
 */
export function DomainMark({ domain, className, size = 'md' }: { domain: Domain | null | undefined; className?: string; size?: 'sm' | 'md' }) {
  const letter = domainLetter(domain);
  return (
    <span
      aria-hidden
      title={domain?.name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
        size === 'md' ? 'size-8 text-sm' : 'size-6 text-xs',
        letter ? 'bg-brand/15 text-brand' : 'bg-surface-2 text-muted',
        className
      )}
    >
      {letter || <FileQuestion className={size === 'md' ? 'size-4' : 'size-3.5'} />}
    </span>
  );
}
