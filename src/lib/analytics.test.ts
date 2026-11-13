import { describe, expect, it } from 'vitest';
import {
  computeCorpusHealth,
  computeCoverage,
  computeDomainCoverage,
  computeQualityRows,
  isTranslated,
  qualityRowsToCsv,
} from './analytics';
import type { Domain, Lesson, Track } from './types';

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: 'l1',
  trackId: 't1',
  emoji: '📘',
  name: 'Leçon',
  duration: '1 min',
  coins: 80,
  xp: 60,
  tag: 'Core',
  level: 'Débutant',
  blocks: [{ type: 'content', text: 'Bonjour' }],
  quizzes: [{ q: 'Q ?', opts: ['a', 'b'], correct: 0, expl: '' }],
  translations: {},
  status: 'published',
  ...over,
});

const tracks: Track[] = [
  { id: 't1', emoji: '💶', nameFr: 'Budget', level: 'Débutant', sortOrder: 0, domainId: 'd1' },
  { id: 't2', emoji: '📈', nameFr: 'Actions', level: 'Débutant', sortOrder: 1, domainId: 'd2' },
  { id: 't3', emoji: '📦', nameFr: 'Vide', level: 'Débutant', sortOrder: 2, domainId: 'd2' },
];
const domains: Domain[] = [
  { id: 'd1', name: 'Survie', emoji: '🛟', sortOrder: 0 },
  { id: 'd2', name: 'Marchés', emoji: '📈', sortOrder: 1 },
];

describe('isTranslated: one criterion everywhere', () => {
  it('needs at least one translated block with text; a title alone does not count', () => {
    expect(isTranslated(lesson({ translations: { en: { title: 'Hello' } } }), 'en')).toBe(false);
    expect(isTranslated(lesson({ translations: { en: { title: 'Hi', blocks: [{ type: 'content', text: ' ' }] } } }), 'en')).toBe(false);
    expect(isTranslated(lesson({ translations: { en: { blocks: [{ type: 'content', text: 'Hi' }] } } }), 'en')).toBe(true);
    expect(isTranslated(lesson({ translations: { en: { blocks: [{ type: 'content', text: 'Hi' }] } } }), 'es')).toBe(false);
  });

  it('coverage and the quality table agree', () => {
    const lessons = [
      lesson({ id: 'a', translations: { en: { title: 'Only title' } } }),
      lesson({ id: 'b', translations: { en: { blocks: [{ type: 'content', text: 'Hi' }] } } }),
    ];
    const cov = computeCoverage(computeCorpusHealth(lessons, tracks));
    const rows = computeQualityRows(lessons, tracks);
    expect(cov.withTranslationEn).toBe(rows.filter((r) => r.hasTranslationEn).length);
    expect(cov.withTranslationEn).toBe(1);
  });
});

describe('computeCorpusHealth', () => {
  it('counts gaps', () => {
    const h = computeCorpusHealth(
      [
        lesson({ id: 'a' }),
        lesson({ id: 'b', blocks: [], status: 'draft' }),
        lesson({ id: 'c', quizzes: [] }),
        lesson({ id: 'd', trackId: null }),
      ],
      tracks
    );
    expect(h.total).toBe(4);
    expect(h.published).toBe(3);
    expect(h.drafts).toBe(1);
    expect(h.gaps.noContent.map((l) => l.id)).toEqual(['b']);
    expect(h.gaps.noQuiz.map((l) => l.id)).toEqual(['c']);
    expect(h.gaps.noTrack.map((l) => l.id)).toEqual(['d']);
    expect(h.emptyTracks).toBe(2);
  });
});

describe('computeDomainCoverage', () => {
  it('splits lessons into exclusive buckets per domain, unassigned last', () => {
    const rows = computeDomainCoverage(
      [
        lesson({ id: 'a', trackId: 't1' }),
        lesson({ id: 'b', trackId: 't1', status: 'draft' }),
        lesson({ id: 'c', trackId: 't1', blocks: [], status: 'published' }),
        lesson({ id: 'd', trackId: 't2', quizzes: [] }),
        lesson({ id: 'e', trackId: null }),
      ],
      tracks,
      domains
    );
    expect(rows.map((r) => r.id)).toEqual(['d1', 'd2', null]);
    expect(rows[0]).toMatchObject({ total: 3, published: 1, draft: 1, empty: 1, withQuiz: 3 });
    expect(rows[1]).toMatchObject({ total: 1, published: 1, withQuiz: 0 });
    expect(rows[2]).toMatchObject({ total: 1 });
  });

  it('lists domains with no lessons at zero', () => {
    const rows = computeDomainCoverage([], tracks, domains);
    expect(rows.map((r) => r.total)).toEqual([0, 0]);
  });
});

describe('quality rows / CSV', () => {
  it('has no readability score for a lesson with no text', () => {
    const [row] = computeQualityRows([lesson({ blocks: [] })], tracks);
    expect(row.readability).toBeNull();
    const csv = qualityRowsToCsv([row]);
    expect(csv.split('\n')[0]).toContain('readabilityFr');
    expect(csv.split('\n')[1]).toContain(',,Remember,');
  });

  it('escapes commas and quotes', () => {
    const [row] = computeQualityRows([lesson({ name: 'Prix, "vrai" coût' })], tracks);
    expect(qualityRowsToCsv([row])).toContain('"Prix, ""vrai"" coût"');
  });
});
