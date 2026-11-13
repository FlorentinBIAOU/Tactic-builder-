/**
 * Pure rules about lesson content, shared by the editor, the lesson list,
 * the Create agent and tests.
 */

import type { Lesson, Quiz } from './types';

/** Drop quiz rows left empty in the editor so they never reach the app. */
export function cleanQuizzes(quizzes: Quiz[]): Quiz[] {
  return quizzes.filter((q) => q.q.trim() || q.opts.some((o) => o.trim()));
}

/** At least one block carries text. */
export function hasContent(l: Pick<Lesson, 'blocks'>): boolean {
  return l.blocks.some((b) => b.text.trim());
}

/** At least one quiz with a question. */
export function hasQuiz(l: Pick<Lesson, 'quizzes'>): boolean {
  return l.quizzes.some((q) => q.q.trim());
}

/** A language counts as translated when at least one block is translated (a title alone does not count). */
export function isTranslated(l: Pick<Lesson, 'translations'>, lang: 'en' | 'es'): boolean {
  return !!l.translations?.[lang]?.blocks?.some((b) => b.text?.trim());
}

/** Translated in every app language (EN and ES). */
export function isFullyTranslated(l: Pick<Lesson, 'translations'>): boolean {
  return isTranslated(l, 'en') && isTranslated(l, 'es');
}

/**
 * Publication checklist. `required` checks block publication; the others
 * are recommendations shown to the author.
 */
export type PublishCheckId =
  | 'title'
  | 'content'
  | 'quizQuestion'
  | 'quizCorrect'
  | 'quiz'
  | 'summary'
  | 'translations';

export type PublishCheck = { id: PublishCheckId; ok: boolean; required: boolean };

export function publishChecks(l: Lesson): PublishCheck[] {
  const quizzes = cleanQuizzes(l.quizzes);
  const questionsOk = quizzes.every((q) => q.q.trim() && q.opts.filter((o) => o.trim()).length >= 2);
  const correctOk = quizzes.every((q) => !!q.opts[q.correct]?.trim());
  return [
    { id: 'title', ok: !!l.name.trim(), required: true },
    { id: 'content', ok: hasContent(l), required: true },
    { id: 'quizQuestion', ok: questionsOk, required: true },
    { id: 'quizCorrect', ok: correctOk, required: true },
    { id: 'quiz', ok: quizzes.length > 0, required: false },
    { id: 'summary', ok: !!l.summary?.trim(), required: false },
    { id: 'translations', ok: isFullyTranslated(l), required: false },
  ];
}

/** Required checks that fail: the reasons the lesson cannot be published. */
export function publishBlockers(l: Lesson): PublishCheckId[] {
  return publishChecks(l)
    .filter((c) => c.required && !c.ok)
    .map((c) => c.id);
}

/** Returns a reason the lesson cannot be published, or null if it can. */
export function publishBlocker(l: Lesson): string | null {
  if (!hasContent(l)) return 'A published lesson needs at least one block with text.';
  for (const q of l.quizzes) {
    const filled = q.opts.filter((o) => o.trim());
    if (!q.q.trim() || filled.length < 2) return 'Each quiz needs a question and at least two options.';
    if (!q.opts[q.correct]?.trim()) return 'Each quiz needs a correct answer that is filled in.';
  }
  return null;
}

/**
 * Remove option `i` from a quiz and keep the same option marked correct:
 * shift the index when an earlier option is removed, fall back to the first
 * option if the correct one is removed. Quizzes keep at least 2 options.
 */
export function removeQuizOption(quiz: Quiz, i: number): Quiz {
  if (quiz.opts.length <= 2 || i < 0 || i >= quiz.opts.length) return quiz;
  const opts = quiz.opts.filter((_, k) => k !== i);
  const correct = i < quiz.correct ? quiz.correct - 1 : i === quiz.correct ? 0 : quiz.correct;
  return { ...quiz, opts, correct };
}

/** Move an item of a list by `dir` places; returns the same list when out of range. */
export function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Duration strings look like "3 min": the number of minutes, 0 when unknown. */
export function durationMinutes(d: string): number {
  const m = d.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(',', '.')) : 0;
}
