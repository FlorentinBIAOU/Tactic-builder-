import type { Lesson, Track } from '@/lib/types';
import { durationMinutes, hasContent, hasQuiz, isTranslated } from '@/lib/lessonRules';

/**
 * URL contract (other screens link here): ?status=published|draft|empty|noquiz|unassigned|untranslated,
 * ?module=<trackId>|none, ?domain=<domainId>, ?q=<search>.
 */
export const STATUS_FILTERS = ['all', 'draft', 'published', 'empty', 'noquiz', 'unassigned', 'untranslated'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const SORT_KEYS = ['module', 'name', 'recent', 'duration'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** Module filter value for lessons attached to no module. */
export const NO_MODULE = 'none';

export type LessonFilters = {
  q: string;
  domain: string;
  module: string;
  status: StatusFilter;
  sort: SortKey;
};

export const DEFAULT_FILTERS: LessonFilters = { q: '', domain: '', module: '', status: 'all', sort: 'module' };

/** `knownTracks`: ids of existing modules, so a lesson pointing at a deleted module counts as unassigned. */
export function matchesStatus(l: Lesson, status: StatusFilter, knownTracks?: Set<string>): boolean {
  switch (status) {
    case 'unassigned':
      return !l.trackId || (!!knownTracks && !knownTracks.has(l.trackId));
    case 'draft':
      return l.status === 'draft';
    case 'published':
      return l.status === 'published';
    case 'empty':
      return !hasContent(l);
    case 'noquiz':
      return !hasQuiz(l);
    case 'untranslated':
      // No block translated into English.
      return !isTranslated(l, 'en');
    default:
      return true;
  }
}

/** Lowercase, accents removed, so "interets" finds "intérêts". */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Filters except status: the base the status counts are computed on. */
export function filterScope(lessons: Lesson[], tracks: Track[], f: Pick<LessonFilters, 'q' | 'domain' | 'module'>): Lesson[] {
  const trackDomain = new Map(tracks.map((t) => [t.id, t.domainId ?? null]));
  const q = normalize(f.q.trim());
  return lessons.filter((l) => {
    if (f.module === NO_MODULE) {
      if (l.trackId && trackDomain.has(l.trackId)) return false;
    } else if (f.module && l.trackId !== f.module) return false;
    if (f.domain && f.module !== NO_MODULE && trackDomain.get(l.trackId ?? '') !== f.domain) return false;
    if (q && !normalize(`${l.name} ${l.id} ${l.tag} ${l.summary ?? ''}`).includes(q)) return false;
    return true;
  });
}

export function sortLessons(rows: Lesson[], tracks: Track[], sort: SortKey): Lesson[] {
  const order = new Map(tracks.map((t) => [t.id, t.sortOrder]));
  const byModule = (l: Lesson) => order.get(l.trackId ?? '') ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => {
    switch (sort) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'recent':
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.name.localeCompare(b.name);
      case 'duration':
        return durationMinutes(a.duration) - durationMinutes(b.duration) || a.name.localeCompare(b.name);
      default:
        return byModule(a) - byModule(b) || a.id.localeCompare(b.id, undefined, { numeric: true });
    }
  });
}

export type LessonGroup = { key: string; track: Track | null; lessons: Lesson[] };

/** Consecutive lessons of the same module, in the given order. */
export function groupByModule(rows: Lesson[], tracks: Track[]): LessonGroup[] {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const groups: LessonGroup[] = [];
  for (const l of rows) {
    const track = (l.trackId && byId.get(l.trackId)) || null;
    const key = track?.id ?? NO_MODULE;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.lessons.push(l);
    else groups.push({ key, track, lessons: [l] });
  }
  return groups;
}
