import {
  BookMarked,
  FileText,
  Headphones,
  Image,
  Lightbulb,
  Link2,
  Newspaper,
  SquarePlay,
  type LucideIcon,
} from 'lucide-react';
import { RESOURCE_FILE_ACCEPT, RESOURCE_FILE_MAX_BYTES } from '@/lib/corpus';
import type { ResourceKind } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Sober Lucide marker per resource type (no emojis in the admin). */
export const KIND_ICON: Record<ResourceKind, LucideIcon> = {
  pdf: FileText,
  youtube: SquarePlay,
  link: Link2,
  image: Image,
  audio: Headphones,
  article: Newspaper,
  idea: Lightbulb,
  syllabus: BookMarked,
};

export function KindIcon({ kind, className }: { kind: ResourceKind; className?: string }) {
  const Icon = KIND_ICON[kind] ?? Link2;
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted [&_svg]:size-4',
        className
      )}
    >
      <Icon />
    </span>
  );
}

/** Resource type for an uploaded file. */
export function kindFromFile(file: File): ResourceKind {
  const t = file.type;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (t === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'ogg'].includes(ext)) return 'audio';
  return 'link';
}

/** Best guess of a link's type from its address, or null when unsure. */
export function guessKind(url: string): ResourceKind | null {
  const u = url.trim().toLowerCase();
  if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//.test(u)) return 'youtube';
  if (/\.pdf($|[?#])/.test(u)) return 'pdf';
  if (/\.(png|jpe?g|webp|gif|svg)($|[?#])/.test(u)) return 'image';
  if (/\.(mp3|m4a|wav|ogg)($|[?#])/.test(u)) return 'audio';
  return null;
}

/** Same rules as the storage bucket: accepted extension and 25 MB. */
export function checkFile(file: File): 'ok' | 'tooLarge' | 'badType' {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!RESOURCE_FILE_ACCEPT.split(',').includes(ext)) return 'badType';
  if (file.size > RESOURCE_FILE_MAX_BYTES) return 'tooLarge';
  return 'ok';
}

/** Host name shown under a resource title. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
