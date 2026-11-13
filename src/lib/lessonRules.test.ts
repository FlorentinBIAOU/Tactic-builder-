import { describe, expect, it } from 'vitest';
import { cleanQuizzes, publishBlocker, removeQuizOption } from './lessonRules';
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
