/**
 * The supervised agent pipeline: the 11 agent definitions, their
 * dependencies, their state, and the context each one sends to the model.
 *
 * Pure functions only (no React, no Supabase) so the context construction
 * can be unit-tested. The view in `src/features/agents/` renders it.
 *
 *   Analysis      Corpus, Syllabus, Performance
 *   Planning      User model, Recommendations
 *   Production    Create, News, Mission
 *   Distribution  Marketing, Notification
 *   Supervision   TACT (advisory: it validates nothing by itself)
 *
 * News, Mission and Notification produce plans (text). No news feed, mission
 * table or notification runtime is wired yet.
 *
 * Size limits mirror the `admin-ai` edge function (run_agent): corpus stats
 * ≤ 4 000 characters, lesson list ≤ 80 items / 12 000 characters, context
 * ≤ 9 000 characters. The edge function cuts anything longer in the middle
 * of the JSON, so every block is reduced here, step by step, until it fits.
 */

import type { AgentDef, AgentReport } from '@/lib/ai';
import { SYLLABUS, SYLLABUS_TOTALS, domainId, moduleId } from '@/lib/syllabus';
import type { AgentReportRecord, Domain, Lesson, MarketingKpis, Track } from '@/lib/types';

// ─── Definitions ───────────────────────────────────────────────────────────

export type AgentId =
  | 'corpus'
  | 'syllabus'
  | 'performance'
  | 'user_model'
  | 'recommendations'
  | 'create'
  | 'news'
  | 'mission'
  | 'marketing'
  | 'notification'
  | 'tact';

export type StageId = 'analysis' | 'planning' | 'production' | 'distribution' | 'supervision';

export const STAGES: StageId[] = ['analysis', 'planning', 'production', 'distribution', 'supervision'];

/** Which blocks of data an agent receives. */
export type AgentInputs = {
  /** Corpus totals, per-domain aggregates and a representative lesson list. */
  corpus?: boolean;
  /** Per-module aggregates. */
  modules?: boolean;
  /** Coverage against the official syllabus. */
  syllabus?: boolean;
  /** Learning analytics. */
  performance?: boolean;
  /** Marketing KPIs. */
  marketing?: boolean;
};

export type AgentSpec = Omit<AgentDef, 'id' | 'dependsOn'> & {
  id: AgentId;
  stage: StageId;
  dependsOn: AgentId[];
  /** analysis = report on data; plan = text plan only; verdict = advisory review. */
  output: 'analysis' | 'plan' | 'verdict';
  /** Can run with only some upstream reports; missing ones become blind spots. */
  partialUpstream?: boolean;
  inputs: AgentInputs;
};

export const AGENTS: AgentSpec[] = [
  {
    id: 'corpus',
    stage: 'analysis',
    label: 'Corpus',
    output: 'analysis',
    inputs: { corpus: true, modules: true },
    mission:
      'Audit the existing corpus (lessons + modules + domains) for coherence, balance, duplicates, and coverage gaps. The factual baseline every other agent builds on.',
    tasks:
      '• Flag thin/oversized modules and empty domains\n• Find duplicate or mis-tagged lessons\n• Summarize what exists vs. what is still a draft/empty',
    constraints:
      'Use only CORPUS and the module aggregates in CONTEXT. Totals cover the whole corpus; the lesson list is a representative sample. Cite lesson/module ids.',
    reportFormat: 'findings = 5-8 observations. sections = optional "Cleanup plan".',
    tone: 'professional',
    dependsOn: [],
  },
  {
    id: 'syllabus',
    stage: 'analysis',
    label: 'Syllabus',
    output: 'analysis',
    inputs: { corpus: true, modules: true, syllabus: true },
    mission:
      'Compare the corpus against the official TACTIC syllabus (Domain → Module → Lesson). Report coverage per domain/module and exactly what is missing or content-less.',
    tasks:
      '• Per domain: expected vs actual modules/lessons, % with real content\n• List modules that are only titles (need content)\n• Recommend the build order to reach full coverage',
    constraints: 'Use the SYLLABUS coverage block in CONTEXT. Be precise with numbers.',
    reportFormat: 'findings = coverage insights. sections = "Build order". lessons = modules to fill.',
    tone: 'professional',
    dependsOn: ['corpus'],
  },
  {
    id: 'performance',
    stage: 'analysis',
    label: 'Performance',
    output: 'analysis',
    inputs: { performance: true },
    mission:
      'Analyze learning analytics — completions, hardest lessons, retention, time-on-lesson, drop-off — to find the least-performing courses and modules that need improvement.',
    tasks:
      '• Rank lowest-performing lessons/modules\n• Surface retention + drop-off signals\n• Recommend which content to fix first',
    constraints:
      'Use the PERFORMANCE block in CONTEXT. If event data is sparse, unavailable or demo data, say so and work with what exists.',
    reportFormat: 'findings = performance insights with numbers. sections = "Needs improvement".',
    tone: 'technical',
    dependsOn: [],
  },
  {
    id: 'user_model',
    stage: 'planning',
    label: 'User model',
    output: 'analysis',
    inputs: { performance: true },
    mission:
      'Build learner segments/personas and their needs from performance signals (and feedback when available) — who is learning, where they struggle, what they need next.',
    tasks:
      '• Define 3-5 learner segments\n• For each: strengths, struggles, recommended next content\n• Note any missing data needed to model users better',
    constraints: 'Base segments on the PERFORMANCE data and the performance upstream report in CONTEXT. Be explicit about assumptions.',
    reportFormat: 'sections = one per segment. findings = cross-cutting needs.',
    tone: 'narrative',
    dependsOn: ['performance'],
  },
  {
    id: 'recommendations',
    stage: 'planning',
    label: 'Recommendations',
    output: 'analysis',
    inputs: { performance: true, syllabus: true },
    mission:
      'Combine the User Model and Syllabus coverage into a prioritized weekly action plan: what to create, fix, and improve to move the corpus forward.',
    tasks:
      '• Prioritized recommendations (highest leverage first)\n• Content gaps to close\n• A concrete weekly action plan',
    constraints: 'Ground every item in the UPSTREAM reports (user_model + syllabus) in CONTEXT.',
    reportFormat:
      'findings = prioritized recommendations. sections = "Content gaps", "Weekly action plan".',
    tone: 'professional',
    dependsOn: ['user_model', 'syllabus'],
  },
  {
    id: 'create',
    stage: 'production',
    label: 'Create',
    output: 'analysis',
    inputs: { corpus: true, modules: true, syllabus: true },
    mission:
      'Turn recommendations + the syllabus into actual course content. Plan what to generate, then produce draft lessons (blocks + quiz) for the team to refine.',
    tasks:
      '• Propose which modules/lessons to generate next and why\n• Outline the structure each lesson should follow',
    constraints: 'Use CORPUS + the recommendations UPSTREAM report. Generation produces DRAFTS only.',
    reportFormat: 'findings = creation plan. lessons = lessons to generate next.',
    tone: 'professional',
    dependsOn: ['corpus', 'recommendations'],
  },
  {
    id: 'news',
    stage: 'production',
    label: 'News',
    output: 'plan',
    inputs: { corpus: true, performance: true },
    mission:
      'Monitor economic & financial news and turn the events that matter into educational content the corpus can absorb. The bridge between real markets and the syllabus.',
    tasks:
      '• Select the events relevant to TACTIC learners and say why each matters\n• Draft a short, level-appropriate explainer for each\n• Map every event to the domain/module it enriches and flag the ones that need a user alert',
    constraints:
      'No live news feed is wired yet. Reason from well-known recurring event types (rate decisions, inflation prints, earnings season) and state that the input is generic. Never invent specific figures or dates. Content must be approved by the team before publication.',
    reportFormat:
      'findings = 5-8 events, each with a one-line educational angle. sections = "Alerts to forward to Notification". lessons = corpus entries to create or enrich.',
    tone: 'professional',
    dependsOn: ['corpus', 'user_model'],
  },
  {
    id: 'mission',
    stage: 'production',
    label: 'Mission',
    output: 'plan',
    inputs: { performance: true, syllabus: true },
    mission:
      'Turn theoretical concepts into practical learning — exercises, quests, simulations, challenges. Gamifies the syllabus and adapts difficulty to real learner performance.',
    tasks:
      '• Propose missions for the priority modules (goal, format, difficulty, success criteria)\n• Tie difficulty and friction points to the PERFORMANCE signals\n• Specify exactly what to hand to the Create agent to generate (quizzes, scenarios, mission content)',
    constraints:
      'Ground every mission in the SYLLABUS coverage and the recommendations UPSTREAM report. Do NOT generate final content here — describe the structure Create should build. Mission structures must be approved by the team.',
    reportFormat:
      'findings = mission concepts, highest learning-leverage first. sections = "Difficulty ladder", "Hand-off to Create".',
    tone: 'professional',
    dependsOn: ['syllabus', 'recommendations', 'performance'],
  },
  {
    id: 'marketing',
    stage: 'distribution',
    label: 'Marketing',
    output: 'analysis',
    inputs: { performance: true, marketing: true },
    mission:
      'Analyze marketing performance (ROI, CAC, channels, budget) and correlate it with corpus/learning performance to guide spend and what to promote.',
    tasks:
      '• Rank channels by ROI/conversion\n• Recommend budget re-allocation\n• Tie momentum to corpus strengths',
    constraints: 'Use the MARKETING + PERFORMANCE blocks in CONTEXT.',
    reportFormat: 'findings = insights with numbers. sections = "Budget", "Marketing and corpus".',
    tone: 'professional',
    dependsOn: ['performance'],
  },
  {
    id: 'notification',
    stage: 'distribution',
    label: 'Notification',
    output: 'plan',
    inputs: { performance: true, marketing: true },
    mission:
      'Plan how educational content and alerts reach users at the right moment — distribution & retention strategy, not the delivery runtime itself.',
    tasks:
      '• Turn News alerts + Marketing retention goals into a notification plan (audience, trigger, timing, channel)\n• Personalize the message angle per learner segment from the User Model\n• State the GDPR / frequency-cap rules each message set must respect',
    constraints:
      'Actual sending, scheduling and frequency capping live in the mobile app — output a plan, not a send. Use the NEWS, MARKETING and USER MODEL upstream reports. Every communication must be approved by the team and follow GDPR + platform limits.',
    reportFormat:
      'findings = notification plays (trigger → audience → message angle). sections = "Timing & channels", "Compliance guardrails".',
    tone: 'professional',
    dependsOn: ['news', 'marketing', 'user_model'],
  },
  {
    id: 'tact',
    stage: 'supervision',
    label: 'TACT supervisor',
    output: 'verdict',
    partialUpstream: true,
    inputs: { corpus: true, syllabus: true, performance: true, marketing: true },
    mission:
      "Review and synthesize every other agent's latest output: detect inconsistencies and errors, say what looks ready for the team to publish, and give an advisory supervision verdict.",
    tasks:
      '• Cross-check the upstream reports for contradictions or gaps\n• Flag anything not safe to publish yet\n• Produce a single prioritized supervision verdict',
    constraints:
      'Use the UPSTREAM reports of all agents in CONTEXT. If an agent has not run, note it as a blind spot. Your verdict is advisory: the team decides what is published.',
    reportFormat:
      'findings = supervision verdict. sections = "Ready to publish", "Blocked / needs review", "Blind spots".',
    tone: 'professional',
    dependsOn: [
      'corpus',
      'syllabus',
      'performance',
      'user_model',
      'recommendations',
      'create',
      'news',
      'mission',
      'marketing',
      'notification',
    ],
  },
];

export const AGENT_BY_ID = new Map<AgentId, AgentSpec>(AGENTS.map((a) => [a.id, a]));

export function isAgentId(id: string): id is AgentId {
  return AGENT_BY_ID.has(id as AgentId);
}

/** Agents that read this agent's output. */
export function dependentsOf(id: AgentId): AgentId[] {
  return AGENTS.filter((a) => a.dependsOn.includes(id)).map((a) => a.id);
}

/** The model-facing definition sent to the edge function. */
export function toAgentDef(spec: AgentSpec): AgentDef {
  const { id, label, mission, tasks, constraints, reportFormat, tone, dependsOn } = spec;
  return { id, label, mission, tasks, constraints, reportFormat, tone, dependsOn };
}

// ─── Latest reports and state ──────────────────────────────────────────────

/** The latest report of one agent, with its date. */
export type LatestReport = { id: string; createdAt: string; report: AgentReport | AgentReportRecord['report'] };

/** Latest report per agent (records may come in any order). */
export function latestReports(records: AgentReportRecord[]): Partial<Record<AgentId, LatestReport>> {
  const out: Partial<Record<AgentId, LatestReport>> = {};
  for (const r of records) {
    if (!isAgentId(r.agentId)) continue;
    const cur = out[r.agentId];
    if (!cur || Date.parse(r.createdAt) > Date.parse(cur.createdAt)) {
      out[r.agentId] = { id: r.id, createdAt: r.createdAt, report: r.report };
    }
  }
  return out;
}

/** A report older than this is "too old" to feed other agents without a re-run. */
export const STALE_AFTER_DAYS = 14;
const DAY = 86_400_000;

export type AgentStatus = 'never' | 'fresh' | 'outdated' | 'blocked';

export type AgentState = {
  status: AgentStatus;
  canRun: boolean;
  lastRunAt?: string;
  /** Dependencies that have never produced a report. */
  missing: AgentId[];
  /** Dependencies re-run after this agent's last report. */
  newerDeps: AgentId[];
  /** Dependencies whose report is older than STALE_AFTER_DAYS. */
  oldDeps: AgentId[];
  /** This agent's own report is older than STALE_AFTER_DAYS. */
  selfOld: boolean;
};

export function agentState(
  spec: AgentSpec,
  latest: Partial<Record<AgentId, { createdAt: string }>>,
  now: number = Date.now()
): AgentState {
  const own = latest[spec.id];
  const ownAt = own ? Date.parse(own.createdAt) : null;
  const missing = spec.dependsOn.filter((d) => !latest[d]);
  const present = spec.dependsOn.filter((d) => latest[d]);
  const newerDeps =
    ownAt === null ? [] : present.filter((d) => Date.parse(latest[d]!.createdAt) > ownAt);
  const oldDeps = present.filter((d) => now - Date.parse(latest[d]!.createdAt) > STALE_AFTER_DAYS * DAY);
  const selfOld = ownAt !== null && now - ownAt > STALE_AFTER_DAYS * DAY;
  const canRun = spec.partialUpstream
    ? spec.dependsOn.length === 0 || present.length > 0
    : missing.length === 0;

  let status: AgentStatus;
  if (!canRun) status = 'blocked';
  else if (!own) status = 'never';
  else if (newerDeps.length || oldDeps.length || selfOld) status = 'outdated';
  else status = 'fresh';

  return { status, canRun, lastRunAt: own?.createdAt, missing, newerDeps, oldDeps, selfOld };
}

// ─── Corpus aggregates ─────────────────────────────────────────────────────

export function clip(s: string | undefined | null, max: number): string {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > max ? `${v.slice(0, Math.max(0, max - 1)).trimEnd()}…` : v;
}

function isEmpty(l: Lesson): boolean {
  return l.blocks.length === 0;
}

function hasNoQuiz(l: Lesson): boolean {
  if (l.quizzes.length === 0) return true;
  const q = l.quizzes[0];
  return !q.q?.trim() || q.opts.every((o) => !o?.trim());
}

export type ModuleAggregate = {
  id: string;
  name: string;
  domain: string;
  lessons: number;
  published: number;
  empty: number;
  noQuiz: number;
  /** Lessons the syllabus expects for this module, when it maps to one. */
  expected?: number;
};

export type DomainAggregate = {
  domain: string;
  modules: number;
  lessons: number;
  published: number;
  empty: number;
  noQuiz: number;
};

export type CorpusAggregates = {
  totals: {
    domains: number;
    modules: number;
    emptyModules: number;
    lessons: number;
    published: number;
    drafts: number;
    empty: number;
    noQuiz: number;
    withoutModule: number;
  };
  byLevel: Record<string, number>;
  byDomain: DomainAggregate[];
  byModule: ModuleAggregate[];
};

/** Expected lesson count per syllabus module id (`a-m1` → 12). */
const SYLLABUS_MODULE_SIZE = new Map<string, number>(
  SYLLABUS.flatMap((d) => d.modules.map((m, i) => [moduleId(d.code, i), m.lessons.length] as const))
);

function domainLabel(d: Domain | undefined): string {
  if (!d) return 'No domain';
  return d.code ? `${d.code} ${d.name}` : d.name;
}

export function corpusAggregates(lessons: Lesson[], tracks: Track[], domains: Domain[]): CorpusAggregates {
  const domainById = new Map(domains.map((d) => [d.id, d]));
  const byTrack = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (!l.trackId) continue;
    const arr = byTrack.get(l.trackId) ?? [];
    arr.push(l);
    byTrack.set(l.trackId, arr);
  }

  const sortedTracks = [...tracks].sort((a, b) => a.sortOrder - b.sortOrder);
  const byModule: ModuleAggregate[] = sortedTracks.map((t) => {
    const ls = byTrack.get(t.id) ?? [];
    const agg: ModuleAggregate = {
      id: t.id,
      name: clip(t.nameFr, 60),
      domain: domainById.get(t.domainId ?? '')?.code ?? domainLabel(domainById.get(t.domainId ?? '')),
      lessons: ls.length,
      published: ls.filter((l) => l.status === 'published').length,
      empty: ls.filter(isEmpty).length,
      noQuiz: ls.filter(hasNoQuiz).length,
    };
    const expected = SYLLABUS_MODULE_SIZE.get(t.id);
    if (expected !== undefined) agg.expected = expected;
    return agg;
  });

  const domainKeys = [...domains].sort((a, b) => a.sortOrder - b.sortOrder).map((d) => d.id);
  if (tracks.some((t) => !t.domainId || !domainById.has(t.domainId))) domainKeys.push('');
  const byDomain: DomainAggregate[] = domainKeys.map((did) => {
    const dTracks = tracks.filter((t) => (did ? t.domainId === did : !t.domainId || !domainById.has(t.domainId)));
    const ls = dTracks.flatMap((t) => byTrack.get(t.id) ?? []);
    return {
      domain: domainLabel(domainById.get(did)),
      modules: dTracks.length,
      lessons: ls.length,
      published: ls.filter((l) => l.status === 'published').length,
      empty: ls.filter(isEmpty).length,
      noQuiz: ls.filter(hasNoQuiz).length,
    };
  });

  const byLevel: Record<string, number> = {};
  for (const l of lessons) byLevel[l.level] = (byLevel[l.level] ?? 0) + 1;

  const published = lessons.filter((l) => l.status === 'published').length;
  const trackIds = new Set(tracks.map((t) => t.id));
  return {
    totals: {
      domains: domains.length,
      modules: tracks.length,
      emptyModules: byModule.filter((m) => m.lessons === 0).length,
      lessons: lessons.length,
      published,
      drafts: lessons.length - published,
      empty: lessons.filter(isEmpty).length,
      noQuiz: lessons.filter(hasNoQuiz).length,
      withoutModule: lessons.filter((l) => !l.trackId || !trackIds.has(l.trackId)).length,
    },
    byLevel,
    byDomain,
    byModule,
  };
}

export type LessonSample = { id: string; name: string; level: string; track?: string; tag?: string };

/**
 * A representative lesson list: lessons that need work first (no content,
 * no quiz, draft), taken in turn from every module so no module is left out.
 */
export function sampleLessons(lessons: Lesson[], tracks: Track[], max = 80): LessonSample[] {
  const trackName = new Map(tracks.map((t) => [t.id, t.nameFr]));
  const score = (l: Lesson) => (isEmpty(l) ? 4 : 0) + (hasNoQuiz(l) ? 2 : 0) + (l.status === 'draft' ? 1 : 0);
  const groups = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const k = l.trackId ?? '';
    const arr = groups.get(k) ?? [];
    arr.push(l);
    groups.set(k, arr);
  }
  const queues = [...groups.values()].map((g) =>
    [...g].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
  );
  const out: LessonSample[] = [];
  for (let round = 0; out.length < max; round++) {
    let took = false;
    for (const q of queues) {
      const l = q[round];
      if (!l) continue;
      took = true;
      out.push({
        id: l.id,
        name: clip(l.name, 70),
        level: l.level,
        track: l.trackId ? clip(trackName.get(l.trackId) ?? l.trackId, 40) : 'No module',
        tag: clip(l.tag, 24),
      });
      if (out.length >= max) break;
    }
    if (!took) break;
  }
  return out;
}

// ─── Syllabus coverage ─────────────────────────────────────────────────────

export type SyllabusCoverage = {
  totals: typeof SYLLABUS_TOTALS;
  byDomain: {
    domain: string;
    expectedModules: number;
    actualModules: number;
    expectedLessons: number;
    actualLessons: number;
    withContent: number;
    drafts: number;
  }[];
  /** Syllabus modules missing from the corpus or below their expected size. */
  incompleteModules: { id: string; title: string; expected: number; actual: number; withContent: number }[];
};

export function syllabusCoverage(lessons: Lesson[], tracks: Track[]): SyllabusCoverage {
  const trackIds = new Set(tracks.map((t) => t.id));
  const lessonsByTrack = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (!l.trackId) continue;
    const arr = lessonsByTrack.get(l.trackId) ?? [];
    arr.push(l);
    lessonsByTrack.set(l.trackId, arr);
  }
  const byDomain = SYLLABUS.map((d) => {
    const did = domainId(d.code);
    const dTracks = tracks.filter((t) => t.domainId === did);
    const dLessons = dTracks.flatMap((t) => lessonsByTrack.get(t.id) ?? []);
    return {
      domain: `${d.code} ${d.name}`,
      expectedModules: d.modules.length,
      actualModules: dTracks.length,
      expectedLessons: d.modules.reduce((n, m) => n + m.lessons.length, 0),
      actualLessons: dLessons.length,
      withContent: dLessons.filter((l) => !isEmpty(l)).length,
      drafts: dLessons.filter((l) => l.status === 'draft').length,
    };
  });
  const incompleteModules: SyllabusCoverage['incompleteModules'] = [];
  for (const d of SYLLABUS) {
    d.modules.forEach((m, i) => {
      const id = moduleId(d.code, i);
      const ls = trackIds.has(id) ? (lessonsByTrack.get(id) ?? []) : [];
      const withContent = ls.filter((l) => !isEmpty(l)).length;
      if (withContent < m.lessons.length) {
        incompleteModules.push({ id, title: clip(m.title, 60), expected: m.lessons.length, actual: ls.length, withContent });
      }
    });
  }
  return { totals: SYLLABUS_TOTALS, byDomain, incompleteModules };
}

// ─── Performance and marketing inputs ──────────────────────────────────────

export type PerformanceInput = {
  /** True when the analytics functions are not available at all. */
  unavailable?: boolean;
  /** Part of the analytics rows are demo (seed) data. */
  demoData?: boolean;
  totalUsers?: number;
  completions?: number;
  activeStreakers?: number;
  topCompleted?: { lesson_id: string; completions: number; perfect_rate: number }[];
  hardest?: { lesson_id: string; completions: number; correct_rate: number }[];
  retention?: { d7: number; d30: number; cohort: number } | null;
  lessonTime?: { lessonId: string; avgSeconds: number; learners: number }[] | null;
};

// ─── Upstream summaries ────────────────────────────────────────────────────

export type UpstreamSummary = { date: string; findings: string[] } | { notRun: true };

/** Each dependency's latest report: date + at most `maxFindings` findings. */
export function summarizeUpstream(
  deps: AgentId[],
  latest: Partial<Record<AgentId, LatestReport>>,
  maxFindings = 3,
  maxChars = 280
): Partial<Record<AgentId, UpstreamSummary>> {
  const out: Partial<Record<AgentId, UpstreamSummary>> = {};
  for (const id of deps) {
    const r = latest[id];
    if (!r) {
      out[id] = { notRun: true };
      continue;
    }
    const findings = (r.report.findings ?? []).filter(Boolean).slice(0, maxFindings).map((f) => clip(f, maxChars));
    // A report with no findings still carries its first section as a summary.
    if (!findings.length && r.report.sections?.length) {
      const s = r.report.sections[0];
      findings.push(clip(`${s.title}: ${s.content}`, maxChars));
    }
    out[id] = { date: r.createdAt.slice(0, 10), findings };
  }
  return out;
}

// ─── Size control ──────────────────────────────────────────────────────────

/** Budgets kept a little under the edge function's limits. */
export const BUDGETS = { stats: 3800, lessons: 11500, lessonItems: 80, context: 8600 } as const;

export function jsonSize(v: unknown): number {
  return v === undefined ? 0 : JSON.stringify(v).length;
}

/**
 * Apply reduction steps one after the other (each on the result of the
 * previous one) until the JSON fits. Never cuts a string in the middle of the
 * JSON: the result is always a complete value. When every step has run and it
 * still does not fit, the last value is returned with `fits: false`.
 */
export function fitToBudget<T>(
  value: T,
  budget: number,
  steps: ((v: T) => T)[]
): { value: T; size: number; reduced: boolean; fits: boolean } {
  let v = value;
  let size = jsonSize(v);
  let reduced = false;
  for (const step of steps) {
    if (size <= budget) break;
    v = step(v);
    size = jsonSize(v);
    reduced = true;
  }
  return { value: v, size, reduced, fits: size <= budget };
}

/** Keep the first `n` items and say how many were left out. */
function capList<T>(list: T[] | undefined, n: number): T[] | undefined {
  return list ? list.slice(0, n) : list;
}

// ─── Payload ───────────────────────────────────────────────────────────────

export type AgentContextInputs = {
  lessons: Lesson[];
  tracks: Track[];
  domains: Domain[];
  performance: PerformanceInput | null;
  marketing: MarketingKpis | null | 'unavailable';
  latest: Partial<Record<AgentId, LatestReport>>;
};

export type AgentPayload = {
  corpus?: { stats: Record<string, unknown>; lessons: LessonSample[] };
  context?: Record<string, unknown>;
};

export type PayloadSize = {
  stats: number;
  lessons: number;
  context: number;
  total: number;
  /** Something was shortened to fit the limits. */
  reduced: boolean;
};

type Ctx = {
  modules?: { list: ModuleAggregate[]; omitted?: number; note?: string };
  syllabus?: SyllabusCoverage & { incompleteOmitted?: number };
  performance?: PerformanceInput | string;
  marketing?: MarketingKpis | string;
  upstream?: Partial<Record<AgentId, UpstreamSummary>>;
};

function needsWork(m: ModuleAggregate): boolean {
  return m.lessons === 0 || m.empty > 0 || m.noQuiz > 0 || (m.expected !== undefined && m.lessons < m.expected);
}

function capModules(n: number) {
  return (c: Ctx): Ctx => {
    if (!c.modules) return c;
    const total = c.modules.list.length + (c.modules.omitted ?? 0);
    const list = c.modules.list.slice(0, n);
    return { ...c, modules: { ...c.modules, list, omitted: total - list.length || undefined } };
  };
}

function trimUpstream(maxFindings: number, maxChars: number) {
  return (c: Ctx): Ctx => {
    if (!c.upstream) return c;
    const upstream: Ctx['upstream'] = {};
    for (const [id, s] of Object.entries(c.upstream) as [AgentId, UpstreamSummary][]) {
      upstream[id] = 'notRun' in s ? s : { date: s.date, findings: s.findings.slice(0, maxFindings).map((f) => clip(f, maxChars)) };
    }
    return { ...c, upstream };
  };
}

function capIncomplete(n: number) {
  return (c: Ctx): Ctx => {
    if (!c.syllabus) return c;
    const all = c.syllabus.incompleteModules;
    const total = all.length + (c.syllabus.incompleteOmitted ?? 0);
    const list = all.slice(0, n);
    return { ...c, syllabus: { ...c.syllabus, incompleteModules: list, incompleteOmitted: total - list.length || undefined } };
  };
}

function capPerformance(n: number) {
  return (c: Ctx): Ctx => {
    if (!c.performance || typeof c.performance === 'string') return c;
    const p = c.performance;
    return {
      ...c,
      performance: {
        ...p,
        topCompleted: capList(p.topCompleted, n),
        hardest: capList(p.hardest, n),
        lessonTime: p.lessonTime ? p.lessonTime.slice(0, n) : p.lessonTime,
      },
    };
  };
}

const CONTEXT_STEPS: ((c: Ctx) => Ctx)[] = [
  // 1. Only the modules that need work.
  (c) => {
    if (!c.modules) return c;
    const all = c.modules.list;
    const list = all.filter(needsWork);
    return {
      ...c,
      modules: { list, omitted: (c.modules.omitted ?? 0) + (all.length - list.length) || undefined, note: 'Only modules that need work are listed.' },
    };
  },
  capIncomplete(20),
  trimUpstream(3, 180),
  capModules(25),
  capPerformance(5),
  capIncomplete(10),
  trimUpstream(2, 140),
  capModules(12),
  trimUpstream(1, 140),
  capIncomplete(5),
  capModules(5),
  (c) => (c.modules ? { ...c, modules: { list: [], omitted: c.modules.list.length + (c.modules.omitted ?? 0), note: 'Module list left out for size; see byDomain in CORPUS STATS.' } } : c),
  (c) => (c.syllabus ? { ...c, syllabus: { ...c.syllabus, incompleteModules: [], incompleteOmitted: c.syllabus.incompleteModules.length + (c.syllabus.incompleteOmitted ?? 0) } } : c),
];

/** Build exactly what is sent to the model for one agent, within the limits. */
export function buildAgentPayload(
  spec: AgentSpec,
  input: AgentContextInputs
): { payload: AgentPayload; size: PayloadSize } {
  const { inputs } = spec;
  const needAggregates = inputs.corpus || inputs.modules;
  const agg = needAggregates ? corpusAggregates(input.lessons, input.tracks, input.domains) : null;

  // Corpus: whole-corpus totals and per-domain aggregates + representative lessons.
  let corpus: AgentPayload['corpus'];
  let statsSize = 0;
  let lessonsSize = 0;
  let reduced = false;
  if (inputs.corpus && agg) {
    const statsFit = fitToBudget<Record<string, unknown>>(
      { totals: agg.totals, byLevel: agg.byLevel, byDomain: agg.byDomain },
      BUDGETS.stats,
      [
        (s) => ({ ...s, byDomain: (s.byDomain as DomainAggregate[]).map((d) => ({ ...d, domain: clip(d.domain, 24) })) }),
        (s) => ({ ...s, byDomain: (s.byDomain as DomainAggregate[]).slice(0, 12) }),
        (s) => ({ totals: s.totals, byLevel: s.byLevel }),
      ]
    );
    let sample = sampleLessons(input.lessons, input.tracks, BUDGETS.lessonItems);
    const lessonsFit = fitToBudget(sample, BUDGETS.lessons, [
      (l) => l.map((x) => ({ ...x, name: clip(x.name, 48), track: clip(x.track, 24) })),
      (l) => l.slice(0, 60),
      (l) => l.slice(0, 40),
      (l) => l.slice(0, 20),
    ]);
    sample = lessonsFit.value;
    corpus = { stats: statsFit.value, lessons: sample };
    statsSize = statsFit.size;
    lessonsSize = lessonsFit.size;
    reduced ||= statsFit.reduced || lessonsFit.reduced;
  }

  // Context: module aggregates, syllabus, performance, marketing, upstream.
  const ctx: Ctx = {};
  if (inputs.modules && agg) ctx.modules = { list: agg.byModule };
  if (inputs.syllabus) ctx.syllabus = syllabusCoverage(input.lessons, input.tracks);
  if (inputs.performance) {
    ctx.performance = !input.performance || input.performance.unavailable
      ? 'Learning analytics are not available. Say so and do not invent numbers.'
      : input.performance;
  }
  if (inputs.marketing) {
    ctx.marketing =
      input.marketing === 'unavailable' || !input.marketing
        ? 'No marketing data available.'
        : input.marketing;
  }
  if (spec.dependsOn.length) ctx.upstream = summarizeUpstream(spec.dependsOn, input.latest);

  let context: Record<string, unknown> | undefined;
  let contextSize = 0;
  if (Object.keys(ctx).length) {
    const fit = fitToBudget(ctx, BUDGETS.context, CONTEXT_STEPS);
    context = stripUndefined(fit.value) as Record<string, unknown>;
    contextSize = jsonSize(context);
    reduced ||= fit.reduced;
  }

  const payload: AgentPayload = {};
  if (corpus) payload.corpus = corpus;
  if (context) payload.context = context;
  return {
    payload,
    size: { stats: statsSize, lessons: lessonsSize, context: contextSize, total: statsSize + lessonsSize + contextSize, reduced },
  };
}

function stripUndefined(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v));
}

// ─── Dates ─────────────────────────────────────────────────────────────────

/** yyyy-mm-dd of an ISO timestamp in the viewer's local time zone. */
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
