import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react';
import { AGENTS, STAGES, agentState, dependentsOf, type AgentId } from '@/lib/agents';
import { cn } from '@/lib/utils';
import { AgentStatusBadge, type DisplayStatus } from './StatusBadge';
import { fmtDateTime, fmtRelative } from './format';
import type { AgentsData } from './useAgentsData';

export function displayStatus(data: AgentsData, id: AgentId): DisplayStatus {
  const run = data.runs[id];
  if (run?.busy) return 'running';
  if (run?.error) return 'failed';
  return agentState(AGENTS.find((a) => a.id === id)!, data.latest).status;
}

/** The five stages, top to bottom, each with its agent cards. */
export function PipelineBoard({ data, onOpen }: { data: AgentsData; onOpen: (id: AgentId) => void }) {
  const { t } = useTranslation('agents');
  const [hover, setHover] = useState<AgentId | null>(null);

  const related = useMemo(() => {
    if (!hover) return { up: new Set<AgentId>(), down: new Set<AgentId>() };
    const spec = AGENTS.find((a) => a.id === hover)!;
    return { up: new Set(spec.dependsOn), down: new Set(dependentsOf(hover)) };
  }, [hover]);

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted md:flex" aria-hidden>
        <span>{t('legend.hint')}</span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm border-2 border-brand" />
          {t('legend.upstream')}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-sm border-2 border-dashed border-info" />
          {t('legend.downstream')}
        </span>
      </div>

      <ol className="flex flex-col">
        {STAGES.map((stage, i) => {
          const agents = AGENTS.filter((a) => a.stage === stage);
          const last = i === STAGES.length - 1;
          return (
            <li key={stage} className="relative pb-8 pl-8 last:pb-0">
              {/* Rail: a marker per stage, joined by a line */}
              <span
                aria-hidden
                className="absolute left-0 top-1 flex size-5 items-center justify-center rounded-full border-2 border-brand bg-background"
              >
                <span className="size-1.5 rounded-full bg-brand" />
              </span>
              {!last ? <span aria-hidden className="absolute bottom-0 left-[9px] top-7 w-0.5 bg-border" /> : null}

              <div className="grid gap-3 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-md font-semibold">{t(`stages.${stage}.name`)}</h2>
                  <p className="text-sm text-muted">{t(`stages.${stage}.hint`)}</p>
                </div>
                <ul className={cn('grid gap-3 sm:grid-cols-2', agents.length > 1 && 'xl:grid-cols-3')}>
                  {agents.map((a) => {
                    const status = displayStatus(data, a.id);
                    const rep = data.latest[a.id];
                    const name = t(`agent.${a.id}.name`);
                    const isUp = related.up.has(a.id);
                    const isDown = related.down.has(a.id);
                    return (
                      <li key={a.id} className={cn(a.stage === 'supervision' && 'sm:col-span-2')}>
                        <button
                          type="button"
                          onClick={() => onOpen(a.id)}
                          onMouseEnter={() => setHover(a.id)}
                          onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(a.id)}
                          onBlur={() => setHover(null)}
                          aria-label={t('card.open', { name })}
                          className={cn(
                            'flex h-full w-full flex-col gap-2 rounded-lg border-2 border-border bg-surface p-4 text-left transition-colors duration-fast',
                            'hover:border-input',
                            hover === a.id && 'border-input bg-surface-2/40',
                            isUp && 'border-brand',
                            isDown && 'border-dashed border-info'
                          )}
                        >
                          <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                            <span className="min-w-0 font-semibold">{name}</span>
                            <AgentStatusBadge status={status} />
                          </span>
                          <span className="text-sm text-muted">{t(`agent.${a.id}.mission`)}</span>
                          <span className="mt-auto flex flex-col gap-1 pt-1 text-sm text-muted">
                            {a.dependsOn.length && a.stage !== 'supervision' ? (
                              <span>
                                {t('card.uses', { list: a.dependsOn.map((d) => t(`agent.${d}.name`)).join(', ') })}
                              </span>
                            ) : null}
                            <span className="flex items-center gap-1.5" title={rep ? fmtDateTime(rep.createdAt) : undefined}>
                              <Clock aria-hidden className="size-3.5 shrink-0" />
                              {rep ? t('card.lastReport', { when: fmtRelative(rep.createdAt) }) : t('card.noReport')}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
