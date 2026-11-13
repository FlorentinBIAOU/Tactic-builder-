/**
 * Pure rules about lesson content, shared by the editor, the Create agent
 * and tests.
 */

import type { Lesson, Quiz } from './types';

/** Drop quiz rows left empty in the editor so they never reach the app. */
export function cleanQuizzes(quizzes: Quiz[]): Quiz[] {
  return quizzes.filter((q) => q.q.trim() || q.opts.some((o) => o.trim()));
}

/** Returns a reason the lesson cannot be published, or null if it can. */
export function publishBlocker(l: Lesson): string | null {
  if (!l.blocks.some((b) => b.text.trim())) return 'A published lesson needs at least one block with text.';
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
