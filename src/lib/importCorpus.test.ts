import { describe, expect, it } from 'vitest';
import { normalizeImport, planImport } from './importCorpus';

describe('normalizeImport', () => {
  it('reads the mobile export shape and imports lessons as drafts', () => {
    const { lessons, tracks } = normalizeImport(
      {
        tracks: [{ id: 't1', emoji: '📚', name: 'Budget', domainId: 'dom-a' }],
        lessons: [
          {
            id: 'd1',
            trackId: 't1',
            e: '💶',
            n: 'La règle 50/30/20',
            t: '2 min',
            blocks: [{ type: 'hook', body: 'Hello' }],
            quiz: { q: 'Q?', opts: ['a', 'b'], correct: 1, expl: '' },
            status: 'published',
          },
        ],
      },
      new Set(['dom-a'])
    );
    expect(tracks[0]).toMatchObject({ id: 't1', nameFr: 'Budget', domainId: 'dom-a' });
    expect(lessons[0]).toMatchObject({ id: 'd1', name: 'La règle 50/30/20', emoji: '💶', status: 'draft' });
    expect(lessons[0].blocks[0]).toEqual({ type: 'hook', text: 'Hello', emo: undefined, title: undefined });
    expect(lessons[0].quizzes).toHaveLength(1);
  });

  it('drops unknown domains, bad block types and broken quizzes', () => {
    const { lessons, tracks } = normalizeImport(
      {
        tracks: [{ id: 't1', name: 'X', domainId: 'nope' }],
        lessons: [
          {
            id: 'x',
            name: 'X',
            blocks: [{ type: 'script', text: 'hi' }],
            quizzes: [{ q: '', opts: ['a'] }, { q: 'ok', opts: ['a', 'b'], correct: 9 }],
            coins: 1e9,
          },
        ],
      },
      new Set()
    );
    expect(tracks[0].domainId).toBeNull();
    expect(lessons[0].blocks[0].type).toBe('content');
    expect(lessons[0].quizzes).toEqual([{ q: 'ok', opts: ['a', 'b'], correct: 0, expl: '' }]);
    expect(lessons[0].coins).toBe(10000);
  });

  it('accepts a bare array of lessons', () => {
    expect(normalizeImport([{ id: 'a', name: 'A' }], new Set()).lessons).toHaveLength(1);
  });
});

describe('planImport', () => {
  const parsed = normalizeImport(
    {
      tracks: [{ id: 't1', name: 'Budget' }, { id: 't-old', name: 'Old' }, { id: 't1', name: 'Again' }],
      lessons: [
        { id: 'a', trackId: 't1', name: 'A' },
        { id: 'b', trackId: 'ghost', name: 'B' },
        { id: 'old', trackId: 'ghost', name: 'Old one' },
        { id: 'a', name: 'A twice' },
        { id: 'c', trackId: 't-db', name: 'C' },
      ],
    },
    new Set()
  );
  const plan = planImport(parsed, { trackIds: ['t-old', 't-db'], lessonIds: ['old'] });

  it('counts new and existing rows', () => {
    expect(plan).toMatchObject({ newTracks: 1, existingTracks: 1, newLessons: 3, existingLessons: 1, duplicateRows: 2 });
    expect(plan.lessons.map((l) => l.id)).toEqual(['a', 'b', 'old', 'c']);
  });

  it('detaches lessons whose module exists nowhere, keeps known ones', () => {
    const byId = Object.fromEntries(plan.lessons.map((l) => [l.id, l.trackId]));
    expect(byId).toEqual({ a: 't1', b: null, old: null, c: 't-db' });
    expect(plan.detachedLessons).toBe(1);
  });
});
