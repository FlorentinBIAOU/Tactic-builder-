/**
 * Text-quality heuristics used by the Stats view.
 *
 * Pure functions — no React, no Supabase. Lessons are written in French, so
 * the readability score uses the French adaptation of Flesch (Kandel & Moles)
 * and the Bloom detector matches whole French or English words.
 * This is decision support for the pedagogy team, not academic NLP.
 */

// ─── Word / sentence / syllable counters ───────────────────────────────────

/** Strip HTML tags + `**bold**` markers used in legacy block bodies. */
export function stripMarkup(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words made of letters (accents included). Numbers and symbols are dropped. */
export function words(s: string): string[] {
  return stripMarkup(s).toLowerCase().match(/[\p{L}]+(?:['’-][\p{L}]+)*/gu) ?? [];
}

export function wordCount(s: string): number {
  const clean = stripMarkup(s);
  if (!clean) return 0;
  return clean.split(/\s+/).length;
}

export function sentenceCount(s: string): number {
  const clean = stripMarkup(s);
  if (!clean) return 0;
  const matches = clean.match(/[.!?…]+(?=\s|$)/g);
  return Math.max(1, matches?.length ?? 1);
}

/**
 * Syllable estimate for French (also fine for English). Each vowel group is
 * one syllable; a silent final « e » / « es » is not counted (« tableau »
 * = 2, « marché » = 2, « actions » = 2, « banque » = 1… close enough).
 */
export function syllableCount(word: string): number {
  const w = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿœæç]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouyàâäéèêëîïôöùûüÿœæ]+/g);
  let n = groups?.length ?? 0;
  if (n > 1 && /[^aeiouyàâäéèêëîïôöùûüÿœæ]es?$/.test(w)) n -= 1;
  return Math.max(1, n);
}

// ─── Readability (Kandel & Moles, French) ──────────────────────────────────

/** Below this many words the score is too noisy to show. */
export const MIN_WORDS_FOR_READABILITY = 30;

/**
 * Kandel & Moles (1958) reading ease, the French adaptation of Flesch.
 * Higher = easier, clamped to 0–100.
 *   207 − 1.015 × (words / sentences) − 73.6 × (syllables / words)
 * Returns `null` when the text is too short to judge.
 */
export function readability(text: string): number | null {
  const list = words(text);
  if (list.length < MIN_WORDS_FOR_READABILITY) return null;
  const sentences = sentenceCount(text);
  const syllables = list.reduce((acc, w) => acc + syllableCount(w), 0);
  const score = 207 - 1.015 * (list.length / sentences) - 73.6 * (syllables / list.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export type ReadabilityBand = 'easy' | 'medium' | 'hard' | 'na';

/** Easy ≥ 60 (plain French for a general audience), medium 40–59, hard < 40. */
export function readabilityBand(score: number | null): ReadabilityBand {
  if (score === null) return 'na';
  if (score >= 60) return 'easy';
  if (score >= 40) return 'medium';
  return 'hard';
}

// ─── Bloom's taxonomy (whole-word keywords) ────────────────────────────────

export const BLOOM_ORDER = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'] as const;
export type BloomLevel = (typeof BLOOM_ORDER)[number];

/** Verbs and phrases that signal each level. Matched on whole words only. */
const BLOOM_KEYWORDS: Record<BloomLevel, string[]> = {
  Remember: ['définition', 'définir', 'définis', 'rappelle', 'rappeler', 'retiens', 'retenir', 'definition', 'define', 'recall', 'list', 'identify'],
  Understand: ['explique', 'expliquer', 'expliquez', 'pourquoi', 'signifie', 'reformule', 'résume', 'explain', 'why', 'meaning', 'summarize', 'describe'],
  Apply: ['utilise', 'utiliser', 'utilisez', 'applique', 'appliquer', 'appliquez', 'calcule', 'calculer', 'calculez', 'use', 'apply', 'calculate', 'compute'],
  Analyze: ['analyse', 'analyser', 'analysez', 'distingue', 'distinguer', 'compare', 'comparer', 'comparez', 'analyze', 'differentiate', 'break down'],
  Evaluate: ['évalue', 'évaluer', 'évaluez', 'juge', 'juger', 'justifie', 'justifier', 'critique', 'critiquer', 'evaluate', 'judge', 'justify', 'argue'],
  Create: ['conçois', 'concevoir', 'concevez', 'construis', 'construire', 'construisez', 'élabore', 'élaborer', 'design', 'create', 'compose', 'construct'],
};

/** Highest Bloom level whose keyword appears as a whole word (or phrase). */
export function bloomLevel(text: string): BloomLevel {
  const list = words(text);
  const tokens = new Set(list);
  const joined = ` ${list.join(' ')} `;
  let best: BloomLevel = 'Remember';
  for (const level of BLOOM_ORDER) {
    const hit = BLOOM_KEYWORDS[level].some((k) => (k.includes(' ') ? joined.includes(` ${k} `) : tokens.has(k)));
    if (hit) best = level;
  }
  return best;
}

// ─── Misc formatting helpers ────────────────────────────────────────────────

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** « 2 min 05 s » / « 45 s ». Seconds are rounded. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, '0')} s`;
}
