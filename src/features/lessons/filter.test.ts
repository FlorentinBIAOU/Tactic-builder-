import { describe, expect, it } from 'vitest';
import type { Lesson, Track } from '@/lib/types';
import { filterScope, groupByModule, matchesStatus, NO_MODULE, sortLessons } from './filter';

const track = (id: string, domainId: string, sortOrder: number): Track => ({
  id,
  emoji: '📘',
  nameFr: id,
  level: 'Débutant',
  sortOrder,
  domainId,
});

const lesson = (id: string, trackId: string | null, over: Partial<Lesson> = {}): Lesson => ({
  id,
  trackId,
  emoji: '📖',
  name: id,
  duration: '1 min',
  coins: 80,
  xp: 60,
  tag: 'Core',
  level: 'Débutant',
  blocks: [{ type: 'content', text: 'x' }],
  quizzes: [],
  translations: {},
  status: 'draft',
  ...over,
});

const tracks = [track('b', 'd2', 1), track('a', 'd1', 0)];
const lessons = [
  lesson('l1', 'a', { name: 'Intérêts composés' }),
  lesson('l2', 'b'),
  lesson('l3', null),
  lesson('l4', 'deleted-module'),
];

describe('filterScope', () => {
  it('filters by domain through the module', () => {
    expect(filterScope(lessons, tracks, { q: '', domain: 'd2', module: '' }).map((l) => l.id)).toEqual(['l2']);
  });
  it('finds lessons without a module, including a module that no longer exists', () => {
    expect(filterScope(lessons, tracks, { q: '', domain: '', module: NO_MODULE }).map((l) => l.id)).toEqual(['l3', 'l4']);
  });
  it('searches without accents', () => {
    expect(filterScope(lessons, tracks, { q: 'interets', domain: '', module: '' }).map((l) => l.id)).toEqual(['l1']);
  });
});

describe('matchesStatus', () => {
  it('reads the content flags', () => {
    expect(matchesStatus(lesson('x', null, { blocks: [] }), 'empty')).toBe(true);
    expect(matchesStatus(lesson('x', null), 'noquiz')).toBe(true);
    expect(matchesStatus(lesson('x', null), 'untranslated')).toBe(true);
    expect(matchesStatus(lesson('x', null), 'published')).toBe(false);
    expect(matchesStatus(lesson('x', null), 'unassigned')).toBe(true);
    expect(matchesStatus(lesson('x', 'gone'), 'unassigned', new Set(['a']))).toBe(true);
    expect(matchesStatus(lesson('x', 'a'), 'unassigned', new Set(['a']))).toBe(false);
    const titleOnly = lesson('x', null, { translations: { en: { title: 'Hello' } } });
    expect(matchesStatus(titleOnly, 'untranslated')).toBe(true);
  });
});

describe('sort and group', () => {
  it('orders by module and groups consecutive lessons', () => {
    const sorted = sortLessons(lessons, tracks, 'module');
    expect(sorted.map((l) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4']);
    const groups = groupByModule(sorted, tracks);
    expect(groups.map((g) => g.key)).toEqual(['a', 'b', NO_MODULE]);
    expect(groups[2].lessons).toHaveLength(2);
  });
});
