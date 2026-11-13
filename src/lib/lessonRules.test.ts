import { describe, expect, it } from 'vitest';
import {
  cleanQuizzes,
  durationMinutes,
  hasContent,
  hasQuiz,
  isFullyTranslated,
  isTranslated,
  moveItem,
  publishBlocker,
  publishBlockers,
  publishChecks,
  removeQuizOption,
} from './lessonRules';
import type { Lesson, Quiz } from './types';

const quiz = (over: Partial<Quiz> = {}): Quiz => ({
  q: 'Q?',
  opts: ['a', 'b', 'c', 'd'],
  correct: 2,
  expl: '',
  ...over,
});

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'x1',
  trackId: null,
  emoji: '📖',
  name: 'L',
  duration: '1 min',
  coins: 80,
  xp: 60,
  tag: 'Core',
  level: 'Débutant',
  blocks: [{ type: 'content', text: 'Hello' }],
  quizzes: [quiz()],
  translations: {},
  status: 'published',
  ...over,
});

describe('removeQuizOption', () => {
  it('keeps the same correct answer when an earlier option is removed', () => {
    const r = removeQuizOption(quiz({ correct: 2 }), 0);
    expect(r.opts).toEqual(['b', 'c', 'd']);
    expect(r.opts[r.correct]).toBe('c');
  });
  it('keeps the index when a later option is removed', () => {
    const r = removeQuizOption(quiz({ correct: 1 }), 3);
    expect(r.opts[r.correct]).toBe('b');
  });
  it('falls back to the first option when the correct one is removed', () => {
    expect(removeQuizOption(quiz({ correct: 2 }), 2).correct).toBe(0);
  });
  it('never goes below two options', () => {
    const q = quiz({ opts: ['a', 'b'], correct: 1 });
    expect(removeQuizOption(q, 0)).toBe(q);
  });
});

describe('cleanQuizzes', () => {
  it('drops quizzes left completely empty', () => {
    const empty = quiz({ q: '', opts: ['', '', '', ''] });
    expect(cleanQuizzes([empty, quiz()])).toHaveLength(1);
  });
});

describe('publishBlocker', () => {
  it('accepts a complete lesson', () => {
    expect(publishBlocker(lesson())).toBeNull();
  });
  it('refuses a lesson without text', () => {
    expect(publishBlocker(lesson({ blocks: [{ type: 'content', text: '  ' }] }))).not.toBeNull();
  });
  it('refuses a quiz whose correct answer is empty', () => {
    expect(publishBlocker(lesson({ quizzes: [quiz({ opts: ['a', 'b', ''], correct: 2 })] }))).not.toBeNull();
  });
  it('accepts a lesson without quiz', () => {
    expect(publishBlocker(lesson({ quizzes: [] }))).toBeNull();
  });
});

describe('publishBlockers', () => {
  it('is empty for a complete lesson', () => {
    expect(publishBlockers(lesson())).toEqual([]);
  });
  it('lists every failing required rule', () => {
    const l = lesson({ name: ' ', blocks: [], quizzes: [quiz({ q: '', opts: ['a', ''], correct: 1 })] });
    expect(publishBlockers(l)).toEqual(['title', 'content', 'quizQuestion', 'quizCorrect']);
  });
  it('ignores quizzes left completely empty', () => {
    expect(publishBlockers(lesson({ quizzes: [quiz({ q: '', opts: ['', ''] })] }))).toEqual([]);
  });
  it('keeps recommendations out of the blockers', () => {
    const checks = publishChecks(lesson({ quizzes: [], summary: '' }));
    expect(checks.find((c) => c.id === 'quiz')).toMatchObject({ ok: false, required: false });
    expect(publishBlockers(lesson({ quizzes: [] }))).toEqual([]);
  });
});

describe('content flags', () => {
  it('detects content, quiz and translations', () => {
    expect(hasContent(lesson({ blocks: [{ type: 'tip', text: ' ' }] }))).toBe(false);
    expect(hasQuiz(lesson({ quizzes: [] }))).toBe(false);
    const l = lesson({ translations: { en: { blocks: [{ type: 'content', text: 'Hi' }] }, es: { title: 'Hola', blocks: [] } } });
    expect(isTranslated(l, 'en')).toBe(true);
    // A title alone does not make a translation.
    expect(isTranslated(l, 'es')).toBe(false);
    expect(isFullyTranslated(l)).toBe(false);
  });
});

describe('moveItem', () => {
  it('swaps neighbours and ignores moves out of range', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(list);
  });
});

describe('durationMinutes', () => {
  it('reads the number of minutes', () => {
    expect(durationMinutes('3 min')).toBe(3);
    expect(durationMinutes('')).toBe(0);
  });
});
