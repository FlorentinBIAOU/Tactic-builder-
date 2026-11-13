import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileText, Play, RotateCcw } from 'lucide-react';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import {
  AGENT_BY_ID,
  BUDGETS,
  STALE_AFTER_DAYS,
  agentState,
  buildAgentPayload,
  dependentsOf,
  type AgentId,
} from '@/lib/agents';
import { AgentStatusBadge } from './StatusBadge';
import { ReportBody } from './ReportBody';
import { CreatePanel } from './CreatePanel';
import { displayStatus } from './PipelineBoard';
import { fmtDateTime, fmtKb, fmtList, fmtRelative } from './format';
import type { AgentsData } from './useAgentsData';

type Props = {
  data: AgentsData;
  agentId: AgentId | null;
  onClose: () => void;
  onSelect: (id: AgentId) => void;
  onShowReports: (id: AgentId) => void;
};

export function AgentSheet({ data, agentId, onClose, onSelect, onShowReports }: Props) {
  const { t } = useTranslation(['agents', 'common']);
  return (
    <Dialog open={agentId !== null} onOpenChange={(o) => !o && onClose()}>
      {agentId ? (
        <SheetContent
          title={t(`agent.${agentId}.name`)}
          description={t(`agent.${agentId}.mission`)}
          width="sm:max-w-2xl"
          closeLabel={t('common:actions.close')}
        >
          <AgentDetail data={data} agentId={agentId} onSelect={onSelect} onShowReports={onShowReports} />
        </SheetContent>
      ) : null}
    </Dialog>
  );
}

function AgentDetail({ data, agentId, onSelect, onShowReports }: Omit<Props, 'onClose' | 'agentId'> & { agentId: AgentId }) {
  const { t } = useTranslation(['agents', 'common']);
  const reasonId = useId();
  const spec = AGENT_BY_ID.get(agentId)!;
  const state = agentState(spec, data.latest);
  const shown = displayStatus(data, agentId);
  const run = data.runs[agentId];
  const latest = data.latest[agentId];
  const name = (id: AgentId) => t(`agent.${id}.name`);
  const names = (ids: AgentId[]) => fmtList(ids.map(name));

  const { payload, size } = useMemo(() => buildAgentPayload(spec, data.contextInputs), [spec, data.contextInputs]);
  const limit = (spec.inputs.corpus ? BUDGETS.stats + BUDGETS.lessons : 0) + BUDGETS.context;

  // Why the agent is in its state, in plain words.
  const reasons: string[] = [];
  if (!state.canRun) {
    reasons.push(
      spec.partialUpstream ? t('detail.tactBlocked') : t('detail.blockedReason', { count: state.missing.length, list: names(state.missing) })
    );
  } else {
    if (state.newerDeps.length) reasons.push(t('detail.newerDeps', { list: names(state.newerDeps) }));
    if (state.oldDeps.length) reasons.push(t('detail.oldDeps', { days: STALE_AFTER_DAYS, list: names(state.oldDeps) }));
    if (state.selfOld) reasons.push(t('detail.selfOld', { days: STALE_AFTER_DAYS }));
    if (spec.partialUpstream && state.missing.length) reasons.push(t('detail.blindSpots', { list: names(state.missing) }));
    if (state.status === 'never') reasons.push(t('detail.neverHint'));
    if (state.status === 'fresh' && !reasons.length && !run?.error) reasons.push(t('detail.freshHint'));
  }

  const runLabel =
    spec.id === 'tact' ? t('detail.runSupervision') : latest ? t('detail.rerun') : t('detail.run');

  const planNote =
    spec.id === 'news' ? t('detail.planNews') : spec.id === 'notification' ? t('detail.planNotification') : spec.id === 'mission' ? t('detail.planMission') : null;

  const inputs: string[] = [];
  if (spec.inputs.corpus) inputs.push(t('detail.inputs.corpus', { count: payload.corpus?.lessons.length ?? 0 }));
  if (spec.inputs.modules) inputs.push(t('detail.inputs.modules'));
  if (spec.inputs.syllabus) inputs.push(t('detail.inputs.syllabus'));
  if (spec.inputs.performance) inputs.push(t('detail.inputs.performance'));
  if (spec.inputs.marketing) inputs.push(t('detail.inputs.marketing'));
  if (spec.dependsOn.length) inputs.push(t('detail.inputs.upstream'));

  const dependents = dependentsOf(agentId);

  return (
    <div className="flex flex-col gap-8">
      {/* Status and run */}
      <section className="flex flex-col gap-3" aria-labelledby={`${reasonId}-status`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 id={`${reasonId}-status`} className="text-sm font-semibold text-muted">
              {t('detail.statusTitle')}
            </h3>
            <AgentStatusBadge status={shown} />
          </div>
          <Button
            variant="primary"
            className="h-10"
            loading={run?.busy}
            disabled={!state.canRun}
            aria-describedby={reasons.length ? reasonId : undefined}
            onClick={() => void data.runAgent(spec)}
          >
            {!run?.busy ? latest ? <RotateCcw aria-hidden /> : <Play aria-hidden /> : null}
            {runLabel}
          </Button>
        </div>
        {reasons.length ? (
          <ul id={reasonId} className="flex flex-col gap-1 text-base text-muted">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}

        {spec.output === 'plan' ? (
          <Notice tone="info">
            {t('detail.plan')} {planNote}
          </Notice>
        ) : null}
        {spec.output === 'verdict' ? <Notice tone="info">{t('detail.verdict')}</Notice> : null}
        {spec.inputs.performance && data.analyticsUnavailable ? (
          <Notice tone="warning">{t('detail.analyticsUnavailable')}</Notice>
        ) : spec.inputs.performance && data.demoData ? (
          <Notice tone="warning">{t('detail.demoData')}</Notice>
        ) : null}
      </section>

      {spec.id === 'create' ? <CreatePanel /> : null}

      {/* Latest report, or running / error / empty */}
      <section className="flex flex-col gap-3" aria-labelledby={`${reasonId}-report`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id={`${reasonId}-report`} className="text-md font-semibold">
            {run?.error && latest ? t('detail.previousReport') : t('detail.lastReport')}
          </h3>
          {latest ? (
            <span className="text-sm text-muted" title={fmtDateTime(latest.createdAt)}>
              {t('detail.lastReportOn', { date: fmtDateTime(latest.createdAt) })}
            </span>
          ) : null}
        </div>

        <div aria-live="polite">
          {run?.busy ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <p className="font-medium">{t('detail.running')}</p>
              <p className="text-sm text-muted">{t('detail.runningHint')}</p>
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}
        </div>

        {run?.error && !run.busy ? (
          <Notice
            tone="danger"
            title={t('detail.errorTitle')}
            action={
              state.canRun ? (
                <Button size="sm" onClick={() => void data.runAgent(spec)}>
                  {t('common:actions.retry')}
                </Button>
              ) : undefined
            }
          >
            <p>{t('detail.errorBody')}</p>
            <p className="mt-1 break-words text-sm text-muted">{t('detail.errorDetail', { error: run.error })}</p>
          </Notice>
        ) : null}

        {latest ? (
          <div className="rounded-lg border border-border p-4 sm:p-5">
            <ReportBody report={latest.report} />
          </div>
        ) : !run?.busy && !run?.error ? (
          <EmptyState icon={<FileText />} title={t('detail.emptyTitle')} description={t('detail.emptyBody')} />
        ) : null}

        {latest ? (
          <Button variant="link" className="h-10 self-start" onClick={() => onShowReports(agentId)}>
            {t('detail.allReports')}
            <ArrowRight aria-hidden />
          </Button>
        ) : null}
      </section>

      {/* Dependencies */}
      <section className="flex flex-col gap-3">
        <h3 className="text-md font-semibold">{t('detail.dependencies')}</h3>
        {spec.dependsOn.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {spec.dependsOn.map((d) => {
              const rep = data.latest[d];
              return (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => onSelect(d)}
                    className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-surface-2/50"
                  >
                    <span className="font-medium">{name(d)}</span>
                    <span className="flex items-center gap-2 text-sm text-muted">
                      {rep ? <span title={fmtDateTime(rep.createdAt)}>{fmtRelative(rep.createdAt)}</span> : null}
                      <AgentStatusBadge status={displayStatus(data, d)} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-base text-muted">{t('detail.noDependencies')}</p>
        )}
        {dependents.length ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{t('detail.dependents')}</span>
            {dependents.map((d) => (
              <Button key={d} variant="outline" size="sm" className="h-10 sm:h-8" onClick={() => onSelect(d)}>
                {name(d)}
              </Button>
            ))}
          </div>
        ) : null}
      </section>

      {/* What is sent to the model */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-md font-semibold">{t('detail.dataSent')}</h3>
          {spec.inputs.corpus || spec.inputs.modules ? <p className="text-sm text-muted">{t('detail.dataSentHint')}</p> : null}
        </div>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-base">
          {inputs.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          {t('detail.size', { size: fmtKb(size.total), limit: fmtKb(limit) })}
          {size.reduced ? ` ${t('detail.reduced')}` : ''}
        </p>
        <details className="group rounded-md border border-border">
          <summary className="flex min-h-10 cursor-pointer items-center px-3 text-sm font-medium">
            {t('detail.showPayload')}
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-border bg-background p-3 text-xs leading-relaxed text-muted">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}
