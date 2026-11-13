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

