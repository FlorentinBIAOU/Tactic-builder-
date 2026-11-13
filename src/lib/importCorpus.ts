/**
 * Normalisation of an imported corpus file (JSON) into admin Track[] /
 * Lesson[]. Accepts this app's export (mobile shape) and admin-shaped
 * lessons. Pure — unit-tested in importCorpus.test.ts.
 */

import { LEVELS, type Block, type Lesson, type Level, type Quiz, type Track } from './types';

function asLevel(v: unknown): Level {
  return LEVELS.includes(v as Level) ? (v as Level) : 'Débutant';
}

/** Normalize an arbitrary imported payload into admin Track[]/Lesson[].
 *  Accepts both this app's export (mobile shape) and admin-shaped lessons. */
const BLOCK_TYPES: Block['type'][] = ['hook', 'content', 'tip', 'trap', 'real', 'info'];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

export function normalizeImport(
  raw: unknown,
  knownDomains: Set<string>
): { tracks: Track[]; lessons: Lesson[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rawTracks = Array.isArray(obj.tracks) ? obj.tracks : [];
  const rawLessons = Array.isArray(obj.lessons)
    ? obj.lessons
    : Array.isArray(raw)
    ? (raw as unknown[])
    : [];

  const tracks: Track[] = rawTracks.map((t, i) => {
    const r = t as Record<string, unknown>;
    return {
      id: String(r.id ?? `track-${i}`),
      emoji: String(r.emoji ?? '📚'),
      nameFr: String(r.nameFr ?? r.name ?? `Module ${i + 1}`),
      nameEn: r.nameEn ? String(r.nameEn) : undefined,
      level: asLevel(r.level),
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
      theme: r.theme ? String(r.theme) : undefined,
      // Unknown domains are dropped (the foreign key would reject the batch).
      domainId: r.domainId && knownDomains.has(String(r.domainId)) ? String(r.domainId) : null,
      coreQuestion: r.coreQuestion ? String(r.coreQuestion) : undefined,
    };
  });

  const lessons: Lesson[] = rawLessons.map((l, i) => {
    const r = l as Record<string, unknown>;
    const rawBlocks = Array.isArray(r.blocks) ? r.blocks : [];
    const blocks: Block[] = rawBlocks.slice(0, 40).map((b) => {
      const bb = b as Record<string, unknown>;
      const type = BLOCK_TYPES.includes(bb.type as Block['type']) ? (bb.type as Block['type']) : 'content';
      return {
        type,
        text: String(bb.text ?? bb.body ?? '').slice(0, 4000),
        emo: bb.emo ? String(bb.emo).slice(0, 8) : undefined,
        title: bb.title ? String(bb.title).slice(0, 200) : undefined,
      };
    });
    const rawQuizzes: unknown[] = Array.isArray(r.quizzes) ? r.quizzes : r.quiz ? [r.quiz] : [];
    const quizzes: Quiz[] = rawQuizzes.flatMap((q) => {
      const qq = (q ?? {}) as Record<string, unknown>;
      const opts = Array.isArray(qq.opts) ? qq.opts.slice(0, 6).map((o) => String(o ?? '')) : [];
      const correct = Number(qq.correct);
      if (!String(qq.q ?? '').trim() || opts.length < 2) return [];
      return [
        {
          q: String(qq.q).slice(0, 500),
          opts,
          correct: Number.isInteger(correct) && correct >= 0 && correct < opts.length ? correct : 0,
          expl: String(qq.expl ?? '').slice(0, 800),
        },
      ];
    });
    return {
      id: String(r.id ?? `imported-${i}`),
      trackId: (r.trackId as string) ?? null,
      emoji: String(r.emoji ?? r.e ?? '📖'),
      name: String(r.name ?? r.n ?? `Lesson ${i + 1}`),
      duration: String(r.duration ?? r.t ?? '1 min'),
      coins: clampInt(r.coins, 0, 10000, 80),
      xp: clampInt(r.xp, 0, 10000, 60),
      tag: String(r.tag ?? 'Core'),
      level: asLevel(r.level),
      summary: r.summary ? String(r.summary) : undefined,
      blocks,
      quizzes,
      translations: (r.translations as Lesson['translations']) ?? {},
      // Imported lessons always arrive as drafts: someone reviews them in
      // the editor before they reach the mobile app.
      status: 'draft',
    };
  });

  return { tracks, lessons };
}


export type ImportPlan = {
  /** Every track/lesson to send to the database (duplicates removed,
   *  unknown modules detached). Rows that already exist are skipped by the
   *  database, never overwritten. */
  tracks: Track[];
  lessons: Lesson[];
  newTracks: number;
  existingTracks: number;
  newLessons: number;
  existingLessons: number;
  /** Lessons pointing at a module found neither in the file nor in the
   *  corpus: imported without a module instead of failing the whole file. */
  detachedLessons: number;
  /** Rows that appeared twice in the file; only the first one is kept. */
  duplicateRows: number;
};

function firstById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/**
 * What an import will do, computed before anything is written: how many
 * lessons and modules are new, how many already exist (and will be left
 * untouched). Pure — unit-tested.
 */
export function planImport(
  parsed: { tracks: Track[]; lessons: Lesson[] },
  existing: { trackIds: Iterable<string>; lessonIds: Iterable<string> }
): ImportPlan {
  const trackIds = new Set(existing.trackIds);
  const lessonIds = new Set(existing.lessonIds);
  const tracks = firstById(parsed.tracks);
  const uniqueLessons = firstById(parsed.lessons);
  const known = new Set([...trackIds, ...tracks.map((t) => t.id)]);

  const lessons = uniqueLessons.map((l) => (l.trackId && !known.has(l.trackId) ? { ...l, trackId: null } : l));

  const existingTracks = tracks.filter((t) => trackIds.has(t.id)).length;
  const existingLessons = lessons.filter((l) => lessonIds.has(l.id)).length;
  return {
    tracks,
    lessons,
    newTracks: tracks.length - existingTracks,
    existingTracks,
    newLessons: lessons.length - existingLessons,
    existingLessons,
    // Only new lessons matter: existing ones are skipped anyway.
    detachedLessons: lessons.filter((l, i) => uniqueLessons[i].trackId !== l.trackId && !lessonIds.has(l.id)).length,
    duplicateRows: parsed.tracks.length - tracks.length + parsed.lessons.length - uniqueLessons.length,
  };
}
