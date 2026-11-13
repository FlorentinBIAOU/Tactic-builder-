import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorpus } from '@/store/corpus';
import { useAnalytics } from '@/store/analytics';
import { aiRunAgent } from '@/lib/ai';
import { fetchMarketingKpis } from '@/lib/marketing';
import { fetchDemoStatus, fetchLessonTime, fetchRetention, type LessonTime, type Retention } from '@/lib/events';
import { deleteReport, fetchReports, saveReport, setReportStatus } from '@/lib/reports';
import {
  buildAgentPayload,
  latestReports,
  toAgentDef,
  type AgentContextInputs,
  type AgentId,
  type AgentSpec,
  type PerformanceInput,
} from '@/lib/agents';
import type { AgentReportRecord, AgentReportStatus, MarketingKpis } from '@/lib/types';
import { toast } from '@/components/Toast';

export type RunState = { busy: boolean; error: string | null };
export type ReportsState = 'loading' | 'ready' | 'error';

const LOCAL_PREFIX = 'local-';
export const isLocalReport = (id: string) => id.startsWith(LOCAL_PREFIX);

/** Everything the Agents page needs: corpus, analytics, reports, runs. */
export function useAgentsData() {
  const { t } = useTranslation('agents');
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const corpusLoaded = useCorpus((s) => s.loaded);
  const corpusLoading = useCorpus((s) => s.loading);
  const corpusError = useCorpus((s) => s.loadError);
  const loadCorpus = useCorpus((s) => s.load);
  const analytics = useAnalytics();
  const loadAnalytics = analytics.load;

  const [marketing, setMarketing] = useState<MarketingKpis | null | 'unavailable'>(null);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [lessonTime, setLessonTime] = useState<LessonTime[] | null>(null);
  const [demoData, setDemoData] = useState(false);

  const [reports, setReports] = useState<AgentReportRecord[]>([]);
  const [reportsState, setReportsState] = useState<ReportsState>('loading');
  const [runs, setRuns] = useState<Partial<Record<AgentId, RunState>>>({});

  useEffect(() => {
    if (!corpusLoaded && !corpusLoading && !corpusError) void loadCorpus();
  }, [corpusLoaded, corpusLoading, corpusError, loadCorpus]);

  const refreshReports = useCallback(async () => {
    setReportsState('loading');
    try {
      const rows = await fetchReports();
      // Keep reports produced in this session that could not be saved.
      setReports((cur) => [...cur.filter((r) => isLocalReport(r.id)), ...rows]);
      setReportsState('ready');
    } catch {
      setReportsState('error');
    }
  }, []);

  useEffect(() => {
    if (!useAnalytics.getState().loaded && !useAnalytics.getState().loading) void loadAnalytics();
    fetchMarketingKpis()
      .then((k) => setMarketing(k))
      .catch(() => setMarketing('unavailable'));
    fetchRetention().then(setRetention).catch(() => setRetention(null));
    fetchLessonTime(10).then(setLessonTime).catch(() => setLessonTime(null));
    fetchDemoStatus()
      .then((d) => setDemoData(!!d && d.demoRows > 0))
      .catch(() => setDemoData(false));
    void refreshReports();
  }, [loadAnalytics, refreshReports]);

  const latest = useMemo(() => latestReports(reports), [reports]);

  const performance = useMemo<PerformanceInput>(
    () =>
      analytics.unavailable
        ? { unavailable: true }
        : {
            demoData: demoData || undefined,
            totalUsers: analytics.counts?.total_users ?? 0,
            completions: analytics.counts?.total_completions ?? 0,
            activeStreakers: analytics.counts?.active_streakers ?? 0,
            topCompleted: analytics.topCompleted.slice(0, 10),
            hardest: analytics.hardest.slice(0, 10),
            retention,
            lessonTime,
          },
    [analytics.unavailable, analytics.counts, analytics.topCompleted, analytics.hardest, demoData, retention, lessonTime]
  );

  const contextInputs = useMemo<AgentContextInputs>(
    () => ({ lessons, tracks, domains, performance, marketing, latest }),
    [lessons, tracks, domains, performance, marketing, latest]
  );

  const runAgent = useCallback(
    async (spec: AgentSpec) => {
      const name = t(`agent.${spec.id}.name`);
      setRuns((s) => ({ ...s, [spec.id]: { busy: true, error: null } }));
      const { payload } = buildAgentPayload(spec, contextInputs);
      const res = await aiRunAgent({ agent: toAgentDef(spec), ...payload });
      if (!res.ok) {
        setRuns((s) => ({ ...s, [spec.id]: { busy: false, error: res.error } }));
        toast(t('run.failed', { name }), 'error');
        return;
      }
      setRuns((s) => ({ ...s, [spec.id]: { busy: false, error: null } }));
      try {
        const saved = await saveReport({ agentId: spec.id, agentLabel: spec.label, report: res.data });
        setReports((r) => [saved, ...r]);
        toast(t('run.done', { name }), 'success');
      } catch {
        const local: AgentReportRecord = {
          id: `${LOCAL_PREFIX}${Date.now()}`,
          agentId: spec.id,
          agentLabel: spec.label,
          status: 'new',
          report: res.data,
          createdAt: new Date().toISOString(),
        };
        setReports((r) => [local, ...r]);
        toast(t('run.notSaved', { name }), 'info');
      }
    },
    [contextInputs, t]
  );

  /** Throws on failure so the caller can show the message. */
  const changeStatus = useCallback(async (id: string, status: AgentReportStatus) => {
    if (!isLocalReport(id)) await setReportStatus(id, status);
    setReports((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  }, []);

  const removeReport = useCallback(async (id: string) => {
    if (!isLocalReport(id)) await deleteReport(id);
    setReports((r) => r.filter((x) => x.id !== id));
  }, []);

  return {
    lessons,
    tracks,
    domains,
    corpusReady: corpusLoaded,
    corpusLoading: corpusLoading || (!corpusLoaded && !corpusError),
    corpusError,
    reloadCorpus: loadCorpus,
    analyticsUnavailable: analytics.unavailable,
    demoData,
    contextInputs,
    latest,
    reports,
    reportsState,
    refreshReports,
    runs,
    runAgent,
    changeStatus,
    removeReport,
  };
}

export type AgentsData = ReturnType<typeof useAgentsData>;
