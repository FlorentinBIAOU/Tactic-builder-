import { describe, expect, it } from 'vitest';
import type { Domain, Lesson, Track } from '@/lib/types';
import { buildTree, domainMark, matches, newId, nextOrder, reorder } from './model';

const dom = (id: string, sortOrder: number): Domain => ({ id, name: id, emoji: '📚', sortOrder });
const trk = (id: string, domainId: string | null, sortOrder: number): Track => ({
  id,
  emoji: '📚',
  nameFr: id,
  level: 'Débutant',
  sortOrder,
  domainId,
});
const les = (id: string, trackId: string | null, published = false): Lesson => ({
  id,
  trackId,
  emoji: '📖',
  name: id,
  duration: '1 min',
  coins: 80,
  xp: 60,
  tag: 'Core',
  level: 'Débutant',
  blocks: [],
  quizzes: [],
  translations: {},
  status: published ? 'published' : 'draft',
});

describe('buildTree', () => {
  it('groups modules by domain and keeps loose items visible', () => {
    const tree = buildTree(
      [dom('b', 1), dom('a', 0)],
      [trk('m2', 'a', 5), trk('m1', 'a', 1), trk('m3', null, 0), trk('m4', 'gone', 0)],
      [
        les('l1', 'm1', true),
        les('l2', 'm1'),
        les('l3', null),
        les('l4', 'missing', true),
        les('l5', 'm3'),
      ]
    );
    expect(tree.domains.map((d) => d.domain.id)).toEqual(['a', 'b']);
    expect(tree.domains[0].modules.map((m) => m.track.id)).toEqual(['m1', 'm2']);
    expect(tree.domains[0].count).toEqual({ total: 2, published: 1 });
    expect(tree.looseModules.map((m) => m.track.id).sort()).toEqual(['m3', 'm4']);
    expect(tree.looseLessons).toBe(2);
    expect(tree.totals).toEqual({ domains: 2, modules: 4, lessons: 5, published: 2 });
  });
});

describe('reorder', () => {
  it('swaps two distinct orders', () => {
    const g = [
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 10 },
      { id: 'c', sortOrder: 20 },
    ];
    expect(reorder(g, 1, -1)).toEqual([
      { id: 'b', sortOrder: 0 },
      { id: 'a', sortOrder: 10 },
    ]);
  });
  it('renumbers equal orders', () => {
    const g = [
      { id: 'a', sortOrder: 3 },
      { id: 'b', sortOrder: 3 },
      { id: 'c', sortOrder: 3 },
    ];
    // b already holds 3, so only a and c are saved.
    expect(reorder(g, 0, 1)).toEqual([
      { id: 'a', sortOrder: 4 },
      { id: 'c', sortOrder: 5 },
    ]);
  });
  it('ignores moves past the edges', () => {
    expect(reorder([{ id: 'a', sortOrder: 0 }], 0, -1)).toEqual([]);
  });
});

describe('helpers', () => {
  it('nextOrder and newId', () => {
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([{ sortOrder: 4 }, { sortOrder: 9 }])).toBe(10);
    expect(newId('Épargne', new Set(), 'dom-')).toBe('dom-epargne');
    expect(newId('Épargne', new Set(['epargne', 'epargne-2']))).toBe('epargne-3');
    expect(newId('💶', new Set())).toBe('item');
  });
  it('domainMark prefers the code, then the imported name', () => {
    expect(domainMark({ code: 'b', name: 'x' })).toBe('B');
    expect(domainMark({ name: 'Domain C - Trading' })).toBe('C');
    expect(domainMark({ name: 'Épargne' })).toBe('E');
  });
  it('matches ignores accents and case', () => {
    expect(matches('epargne', 'Budget & Épargne')).toBe(true);
    expect(matches('', 'x')).toBe(true);
    expect(matches('zzz', 'x', undefined)).toBe(false);
  });
});
