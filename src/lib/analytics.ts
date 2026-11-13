/**
 * Pure analytics functions that compute corpus-health and
 * content-quality numbers from the in-memory corpus state.
 *
 * Used by the Dashboard and Stats pages, the assistant and the agents;
 * everything here is synchronous and side-effect free so it can also feed
 * CSV exports.
 */

import { bloomLevel, pct, readability, wordCount, type BloomLevel } from '@/lib/format';
import { LEVELS, type Domain, type Lesson, type Level, type Track } from '@/lib/types';

// ─── Shared criteria ───────────────────────────────────────────────────────

/**
 * The one definition of « translated » used everywhere: the translation has
 * at least one block with text. A translated title alone does not count.
 */
export function isTranslated(l: Lesson, lang: 'en' | 'es'): boolean {
  return !!l.translations?.[lang]?.blocks?.some((b) => !!b?.text?.trim());
}

export function hasContent(l: Lesson): boolean {
  return l.blocks.length > 0;
}

/** No quiz, or the first quiz has no question / no option text. */
export function isQuizEmpty(l: Lesson): boolean {
  if (l.quizzes.length === 0) return true;
  const q = l.quizzes[0];
  return !q.q?.trim() || q.opts.every((o) => !o?.trim());
}

// ─── Corpus health ─────────────────────────────────────────────────────────

export type CountByKey = { key: string; label: string; count: number };

export type CorpusHealth = {
  total: number;
  published: number;
  drafts: number;
  byLevel: CountByKey[];
  byTrack: CountByKey[];
  byTag: CountByKey[];
  trackCount: number;
  emptyTracks: number; // tracks with zero lessons
  gaps: {
    noContent: Lesson[]; // 0 blocks
    noQuiz: Lesson[]; // 0 quizzes or first quiz empty
    noTrack: Lesson[]; // trackId === null or unknown
    untranslated: { en: Lesson[]; es: Lesson[] };
  };
};

export function computeCorpusHealth(lessons: Lesson[], tracks: Track[]): CorpusHealth {
  const total = lessons.length;
  const published = lessons.filter((l) => l.status === 'published').length;
  const drafts = total - published;

  const levelMap = new Map<Level, number>();
  for (const lv of LEVELS) levelMap.set(lv, 0);
  for (const l of lessons) levelMap.set(l.level, (levelMap.get(l.level) ?? 0) + 1);
  const byLevel: CountByKey[] = LEVELS.map((lv) => ({ key: lv, label: lv, count: levelMap.get(lv) ?? 0 }));

  const trackById = new Map(tracks.map((t) => [t.id, t]));
  const trackMap = new Map<string, number>();
  for (const t of tracks) trackMap.set(t.id, 0);
  for (const l of lessons) {
    if (l.trackId && trackMap.has(l.trackId)) trackMap.set(l.trackId, (trackMap.get(l.trackId) ?? 0) + 1);
  }
  const byTrack: CountByKey[] = tracks
    .map((t) => ({ key: t.id, label: t.nameFr, count: trackMap.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const emptyTracks = byTrack.filter((t) => t.count === 0).length;

  const tagMap = new Map<string, number>();
  for (const l of lessons) tagMap.set(l.tag, (tagMap.get(l.tag) ?? 0) + 1);
  const byTag: CountByKey[] = [...tagMap.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    published,
    drafts,
    byLevel,
    byTrack,
    byTag,
    trackCount: tracks.length,
    emptyTracks,
    gaps: {
      noContent: lessons.filter((l) => !hasContent(l)),
      noQuiz: lessons.filter(isQuizEmpty),
      noTrack: lessons.filter((l) => !l.trackId || !trackById.has(l.trackId)),
      untranslated: {
        en: lessons.filter((l) => !isTranslated(l, 'en')),
        es: lessons.filter((l) => !isTranslated(l, 'es')),
      },
    },
  };
}

// ─── Per-domain coverage ───────────────────────────────────────────────────

export type DomainCoverage = {
  id: string | null; // null = lessons without a domain
  /** Domain name only (no emoji). Empty for the « no domain » row. */
  label: string;
  /** Domain letter (A, B…) for a small tag, when known. */
  code: string;
  total: number;
  /** Mutually exclusive buckets: empty first, then published / draft. */
  empty: number;
  published: number;
  draft: number;
  withQuiz: number;
  translatedEn: number;
};

/** Lessons per domain, split into « no content », « published », « draft ». */
export function computeDomainCoverage(lessons: Lesson[], tracks: Track[], domains: Domain[]): DomainCoverage[] {
  const trackDomain = new Map(tracks.map((t) => [t.id, t.domainId ?? null]));
  const rows = new Map<string | null, DomainCoverage>();
  const row = (id: string | null, label: string, code = ''): DomainCoverage => {
    let r = rows.get(id);
    if (!r) {
      r = { id, label, code, total: 0, empty: 0, published: 0, draft: 0, withQuiz: 0, translatedEn: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const d of domains) row(d.id, d.name, d.code ?? '');
  const known = new Set(domains.map((d) => d.id));
  for (const l of lessons) {
    const did = trackDomain.get(l.trackId ?? '') ?? null;
    const r = did && known.has(did) ? rows.get(did)! : row(null, '');
    r.total++;
    if (!hasContent(l)) r.empty++;
    else if (l.status === 'published') r.published++;
    else r.draft++;
    if (!isQuizEmpty(l)) r.withQuiz++;
    if (isTranslated(l, 'en')) r.translatedEn++;
  }
  const order = new Map(domains.map((d, i) => [d.id, d.sortOrder ?? i]));
  return [...rows.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
}

// ─── Content quality (per-lesson) ──────────────────────────────────────────

export type LessonQuality = {
  id: string;
  name: string;
  level: Level;
  status: Lesson['status'];
  track: string;
  wordCount: number;
  blockCount: number;
  quizCount: number;
  /** Kandel & Moles reading ease (French), `null` when the text is too short. */
  readability: number | null;
  bloom: BloomLevel;
  hasEmoji: boolean;
  hasTranslationEn: boolean;
  hasTranslationEs: boolean;
};

function lessonText(l: Lesson): string {
  return l.blocks.map((b) => b.text || '').join(' \n');
}

export function computeLessonQuality(l: Lesson, tracks: Track[]): LessonQuality {
  const text = lessonText(l);
  const track = tracks.find((t) => t.id === l.trackId);
  return {
    id: l.id,
    name: l.name,
    level: l.level,
    status: l.status,
    track: track ? track.nameFr : '—',
    wordCount: wordCount(text),
    blockCount: l.blocks.length,
    quizCount: l.quizzes.length,
    readability: readability(text),
    bloom: bloomLevel(text),
    hasEmoji: !!l.emoji?.trim() && l.emoji !== '📖',
    hasTranslationEn: isTranslated(l, 'en'),
    hasTranslationEs: isTranslated(l, 'es'),
  };
}

export function computeQualityRows(lessons: Lesson[], tracks: Track[]): LessonQuality[] {
  return lessons.map((l) => computeLessonQuality(l, tracks));
}

// ─── Coverage summaries ────────────────────────────────────────────────────

export type CoverageSummary = {
  withContent: number;
  withQuiz: number;
  withTrack: number;
  withTranslationEn: number;
  withTranslationEs: number;
  /** Each is the percentage of all lessons. */
  pctContent: number;
  pctQuiz: number;
  pctTrack: number;
  pctEn: number;
  pctEs: number;
};

export function computeCoverage(health: CorpusHealth): CoverageSummary {
  const total = health.total;
  const withContent = total - health.gaps.noContent.length;
  const withQuiz = total - health.gaps.noQuiz.length;
  const withTrack = total - health.gaps.noTrack.length;
  const withTranslationEn = total - health.gaps.untranslated.en.length;
  const withTranslationEs = total - health.gaps.untranslated.es.length;
  return {
    withContent,
    withQuiz,
    withTrack,
    withTranslationEn,
    withTranslationEs,
    pctContent: pct(withContent, total),
    pctQuiz: pct(withQuiz, total),
    pctTrack: pct(withTrack, total),
    pctEn: pct(withTranslationEn, total),
    pctEs: pct(withTranslationEs, total),
  };
}

// ─── CSV export ────────────────────────────────────────────────────────────

export function qualityRowsToCsv(rows: LessonQuality[]): string {
  const headers = [
    'id',
    'name',
    'level',
    'status',
    'track',
    'wordCount',
    'blockCount',
    'quizCount',
    'readabilityFr',
    'bloom',
    'hasEmoji',
    'translatedEn',
    'translatedEs',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.id,
        r.name,
        r.level,
        r.status,
        r.track,
        r.wordCount,
        r.blockCount,
        r.quizCount,
        r.readability ?? '',
        r.bloom,
        r.hasEmoji,
        r.hasTranslationEn,
        r.hasTranslationEs,
      ]
        .map(esc)
        .join(',')
    ),
  ];
  return lines.join('\n');
}
