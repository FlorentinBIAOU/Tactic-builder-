import { lessonToMobile, type MobileLesson } from '@/lib/mappers';
import type { Lesson, Track } from '@/lib/types';

export type ExportTrack = {
  id: string;
  emoji: string;
  name: string;
  level: Track['level'];
  /** Extra fields: ignored by the mobile app, read back by the file import
   *  so a round trip keeps modules in their domain and order. */
  domainId?: string | null;
  sortOrder: number;
};

export type ExportPayload = { tracks: ExportTrack[]; lessons: MobileLesson[] };

/** Corpus in the mobile app shape. Without drafts, modules that end up with
 *  no lesson are left out too. */
export function buildExport(tracks: Track[], lessons: Lesson[], includeDrafts: boolean): ExportPayload {
  const kept = includeDrafts ? lessons : lessons.filter((l) => l.status === 'published');
  const used = new Set(kept.map((l) => l.trackId));
  const keptTracks = includeDrafts ? tracks : tracks.filter((t) => used.has(t.id));
  return {
    tracks: keptTracks.map((t) => ({
      id: t.id,
      emoji: t.emoji,
      name: t.nameFr,
      level: t.level,
      domainId: t.domainId ?? null,
      sortOrder: t.sortOrder,
    })),
    lessons: kept.map(lessonToMobile),
  };
}

/** Starts a browser download. The object URL is released a moment later:
 *  revoking it synchronously can cancel the download in some browsers. */
export function downloadText(text: string, filename: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Clipboard write that reports failure instead of throwing (no permission,
 *  insecure context, old browser). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
