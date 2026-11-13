import { describe, expect, it } from 'vitest';
import {
  AGENTS,
  AGENT_BY_ID,
  BUDGETS,
  STAGES,
  agentState,
  buildAgentPayload,
  corpusAggregates,
  fitToBudget,
  jsonSize,
  latestReports,
  localDateKey,
  sampleLessons,
  summarizeUpstream,
  type AgentContextInputs,
  type AgentId,
  type LatestReport,
} from './agents';
import type { AgentReportRecord, Domain, Lesson, Track } from './types';

const domains: Domain[] = [
  { id: 'dom-a', code: 'A', name: 'Survie', emoji: 'x', sortOrder: 0 },
  { id: 'dom-b', code: 'B', name: 'Marchés', emoji: 'x', sortOrder: 1 },
];

function makeTracks(n: number): Track[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i < 2 ? `a-m${i + 1}` : `t${i}`,
    emoji: 'x',
    nameFr: `Module ${i}`,
    level: 'Débutant',
    sortOrder: i,
    domainId: i % 2 ? 'dom-b' : 'dom-a',
  }));
}

function makeLessons(n: number, tracks: Track[]): Lesson[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `l${String(i).padStart(4, '0')}`,
    trackId: tracks[i % tracks.length].id,
    emoji: 'x',
    name: `Leçon numéro ${i} avec un titre assez long pour peser dans le contexte`,
    duration: '2 min',
    coins: 80,
    xp: 60,
    tag: 'Core',
    level: 'Débutant',
    blocks: i % 3 === 0 ? [] : [{ type: 'content', text: 'x' }],
    quizzes: i % 5 === 0 ? [] : [{ q: 'Q', opts: ['a', 'b'], correct: 0, expl: '' }],
    translations: {},
    status: i % 4 === 0 ? 'draft' : 'published',
  }));
}

const iso = (daysAgo: number, now = Date.parse('2026-11-13T12:00:00Z')) =>
  new Date(now - daysAgo * 86_400_000).toISOString();
const NOW = Date.parse('2026-11-13T12:00:00Z');

const report = (findings: string[], daysAgo = 1): LatestReport => ({
  id: 'r',
  createdAt: iso(daysAgo),
  report: { findings },
});

describe('agent definitions', () => {
  it('has 11 agents with unique ids, no numbers in labels', () => {
    expect(AGENTS).toHaveLength(11);
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(11);
    for (const a of AGENTS) expect(a.label).not.toMatch(/\d|·|★/);
  });

  it('only depends on known agents from the same or an earlier stage', () => {
    for (const a of AGENTS) {
      for (const d of a.dependsOn) {
        const dep = AGENT_BY_ID.get(d);
        expect(dep, `${a.id} → ${d}`).toBeDefined();
        expect(STAGES.indexOf(dep!.stage)).toBeLessThanOrEqual(STAGES.indexOf(a.stage));
        expect(d).not.toBe(a.id);
      }
    }
  });

  it('marks News, Mission and Notification as plans and TACT as a verdict', () => {
    expect(AGENT_BY_ID.get('news')!.output).toBe('plan');
    expect(AGENT_BY_ID.get('mission')!.output).toBe('plan');
    expect(AGENT_BY_ID.get('notification')!.output).toBe('plan');
    expect(AGENT_BY_ID.get('tact')!.output).toBe('verdict');
  });
});

describe('latestReports', () => {
  it('keeps the newest report per agent and ignores unknown agents', () => {
    const rec = (id: string, agentId: string, createdAt: string): AgentReportRecord => ({
      id,
      agentId,
      agentLabel: agentId,
      status: 'new',
      report: { findings: [id] },
      createdAt,
    });
    const out = latestReports([
      rec('old', 'corpus', iso(5)),
      rec('new', 'corpus', iso(1)),
      rec('x', 'legacy_agent', iso(0)),
    ]);
    expect(out.corpus?.id).toBe('new');
    expect(Object.keys(out)).toEqual(['corpus']);
  });
});

describe('agentState', () => {
  const rec = (daysAgo: number) => ({ createdAt: iso(daysAgo) });
  const syllabus = AGENT_BY_ID.get('syllabus')!;

  it('is blocked when a dependency never ran', () => {
    const s = agentState(syllabus, {}, NOW);
    expect(s.status).toBe('blocked');
    expect(s.canRun).toBe(false);
    expect(s.missing).toEqual(['corpus']);
  });

  it('is never-run when dependencies are there', () => {
    expect(agentState(syllabus, { corpus: rec(1) }, NOW).status).toBe('never');
  });

  it('is fresh, then outdated when a dependency is re-run after it', () => {
    expect(agentState(syllabus, { corpus: rec(3), syllabus: rec(2) }, NOW).status).toBe('fresh');
    const s = agentState(syllabus, { corpus: rec(1), syllabus: rec(2) }, NOW);
    expect(s.status).toBe('outdated');
    expect(s.newerDeps).toEqual(['corpus']);
  });

  it('is outdated when a dependency report is too old', () => {
    const s = agentState(syllabus, { corpus: rec(30), syllabus: rec(29) }, NOW);
    expect(s.status).toBe('outdated');
    expect(s.oldDeps).toEqual(['corpus']);
    expect(s.canRun).toBe(true);
  });

  it('lets TACT run with partial upstream, not with none', () => {
    const tact = AGENT_BY_ID.get('tact')!;
    expect(agentState(tact, {}, NOW).canRun).toBe(false);
    const s = agentState(tact, { corpus: rec(1) }, NOW);
    expect(s.canRun).toBe(true);
    expect(s.missing).toHaveLength(9);
  });

  it('agents without dependencies can always run', () => {
    expect(agentState(AGENT_BY_ID.get('corpus')!, {}, NOW)).toMatchObject({ status: 'never', canRun: true });
  });
});

describe('corpusAggregates', () => {
  it('counts per domain and module, including syllabus expectations', () => {
    const tracks = makeTracks(4);
    const lessons = makeLessons(12, tracks);
    const agg = corpusAggregates(lessons, tracks, domains);
    expect(agg.totals.lessons).toBe(12);
    expect(agg.totals.empty).toBe(4);
    expect(agg.totals.drafts).toBe(3);
    expect(agg.byDomain.map((d) => d.lessons)).toEqual([6, 6]);
    expect(agg.byModule).toHaveLength(4);
    expect(agg.byModule[0].expected).toBe(12); // a-m1 in the syllabus
    expect(agg.byModule[2].expected).toBeUndefined();
  });
});

describe('sampleLessons', () => {
  it('takes lessons from every module and empty lessons first', () => {
    const tracks = makeTracks(10);
    const lessons = makeLessons(300, tracks);
    const s = sampleLessons(lessons, tracks, 20);
    expect(s).toHaveLength(20);
    expect(new Set(s.map((x) => x.track)).size).toBe(10);
    const first = lessons.find((l) => l.id === s[0].id)!;
    expect(first.blocks).toHaveLength(0);
    // Not simply the first 20 lessons of the corpus.
    expect(s.map((x) => x.id)).not.toEqual(lessons.slice(0, 20).map((l) => l.id));
  });
});

describe('summarizeUpstream', () => {
  it('keeps at most 3 findings with the report date, and flags agents not run', () => {
    const latest: Partial<Record<AgentId, LatestReport>> = {
      corpus: report(['a', 'b', 'c', 'd', 'e'], 2),
    };
    const out = summarizeUpstream(['corpus', 'syllabus'], latest);
    expect(out.corpus).toEqual({ date: iso(2).slice(0, 10), findings: ['a', 'b', 'c'] });
    expect(out.syllabus).toEqual({ notRun: true });
  });
});

describe('fitToBudget', () => {
  it('applies steps until the value fits and always returns valid JSON', () => {
    const big = { items: Array.from({ length: 500 }, (_, i) => `item ${i}`) };
    const r = fitToBudget(big, 400, [
      (v) => ({ items: v.items.slice(0, 200) }),
      (v) => ({ items: v.items.slice(0, 30) }),
      (v) => ({ items: v.items.slice(0, 5) }),
    ]);
    expect(r.fits).toBe(true);
    expect(r.reduced).toBe(true);
    expect(r.size).toBeLessThanOrEqual(400);
    expect(() => JSON.parse(JSON.stringify(r.value))).not.toThrow();
    expect(r.value.items.length).toBe(30);
  });

  it('leaves small values untouched', () => {
    const r = fitToBudget({ a: 1 }, 100, [() => ({ a: 2 })]);
    expect(r).toMatchObject({ value: { a: 1 }, reduced: false, fits: true });
  });
});

describe('buildAgentPayload', () => {
  const tracks = makeTracks(60);
  const lessons = makeLessons(1200, tracks);
  const latest: Partial<Record<AgentId, LatestReport>> = Object.fromEntries(
    AGENTS.map((a) => [a.id, report(Array.from({ length: 8 }, (_, i) => `${a.id} finding ${i} `.repeat(30)))])
  );
  const input: AgentContextInputs = {
    lessons,
    tracks,
    domains,
    performance: {
      totalUsers: 100,
      topCompleted: Array.from({ length: 10 }, (_, i) => ({ lesson_id: `l${i}`, completions: 10, perfect_rate: 0.5 })),
      hardest: [],
      lessonTime: null,
      retention: null,
    },
    marketing: 'unavailable',
    latest,
  };

  it('stays within every limit for every agent, even with a large corpus', () => {
    for (const a of AGENTS) {
      const { payload, size } = buildAgentPayload(a, input);
      if (payload.corpus) {
        expect(jsonSize(payload.corpus.stats)).toBeLessThanOrEqual(BUDGETS.stats);
        expect(payload.corpus.lessons.length).toBeLessThanOrEqual(BUDGETS.lessonItems);
        expect(jsonSize(payload.corpus.lessons)).toBeLessThanOrEqual(BUDGETS.lessons);
      }
      if (payload.context) expect(jsonSize(payload.context)).toBeLessThanOrEqual(BUDGETS.context);
      expect(size.total).toBe(size.stats + size.lessons + size.context);
    }
  });

  it('sends whole-corpus aggregates, not only a sample', () => {
    const { payload } = buildAgentPayload(AGENT_BY_ID.get('corpus')!, input);
    const stats = payload.corpus!.stats as { totals: { lessons: number }; byDomain: unknown[] };
    expect(stats.totals.lessons).toBe(1200);
    expect(stats.byDomain).toHaveLength(2);
    expect(payload.context!.modules).toBeDefined();
  });

  it('summarises upstream reports with their date and at most 3 findings', () => {
    const { payload } = buildAgentPayload(AGENT_BY_ID.get('recommendations')!, input);
    const up = payload.context!.upstream as Record<string, { date: string; findings: string[] }>;
    expect(Object.keys(up).sort()).toEqual(['syllabus', 'user_model']);
    for (const s of Object.values(up)) {
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.findings.length).toBeLessThanOrEqual(3);
    }
  });

  it('reduces the TACT context to fit, keeping a date for every upstream agent', () => {
    const { payload, size } = buildAgentPayload(AGENT_BY_ID.get('tact')!, input);
    expect(size.reduced).toBe(true);
    const up = payload.context!.upstream as Record<string, { date: string }>;
    expect(Object.keys(up)).toHaveLength(10);
    for (const s of Object.values(up)) expect(s.date).toBeTruthy();
  });

  it('says plainly when analytics or marketing data are missing', () => {
    const { payload } = buildAgentPayload(AGENT_BY_ID.get('marketing')!, {
      ...input,
      performance: { unavailable: true },
    });
    expect(typeof payload.context!.performance).toBe('string');
    expect(payload.context!.marketing).toBe('No marketing data available.');
    expect(payload.corpus).toBeUndefined();
  });
});

describe('localDateKey', () => {
  it('uses the local calendar day', () => {
    expect(localDateKey(new Date(2026, 10, 13, 23, 30).toISOString())).toBe('2026-11-13');
    expect(localDateKey(new Date(2026, 0, 2, 0, 15).toISOString())).toBe('2026-01-02');
  });
});
