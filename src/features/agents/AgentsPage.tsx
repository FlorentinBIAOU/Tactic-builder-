import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AgentId } from '@/lib/agents';
import { useAgentsData } from './useAgentsData';
import { PipelineBoard } from './PipelineBoard';
import { AgentSheet } from './AgentSheet';
import { NO_FILTERS, ReportsTab, type ReportFilters } from './ReportsTab';

type Tab = 'pipeline' | 'reports';

function PipelineSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      {[3, 2, 3].map((n, i) => (
        <div key={i} className="grid gap-3 pl-8 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: n }, (_, j) => (
              <Skeleton key={j} className="h-36 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** /agents — the supervised agent pipeline and the report history. */
export default function AgentsPage() {
  const { t } = useTranslation(['agents', 'common']);
  const data = useAgentsData();
  const [tab, setTab] = useState<Tab>('pipeline');
  const [openAgent, setOpenAgent] = useState<AgentId | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(NO_FILTERS);

  const showReports = (id: AgentId) => {
    setOpenAgent(null);
    setFilters({ ...NO_FILTERS, agent: id });
    setTab('reports');
  };

  return (
    <div>
      <PageHeader title={t('title')} description={t('description')} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="pipeline">{t('tabs.pipeline')}</TabsTrigger>
          <TabsTrigger value="reports">
            {data.reports.length ? t('tabs.reportsCount', { count: data.reports.length }) : t('tabs.reports')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="flex flex-col gap-6 focus:outline-none">
          {data.corpusError ? (
            <Notice
              tone="danger"
              title={t('loadError.title')}
              action={
                <Button size="sm" onClick={() => void data.reloadCorpus()}>
                  {t('common:actions.retry')}
                </Button>
              }
            >
              {t('loadError.body')}
            </Notice>
          ) : null}
          {data.reportsState === 'error' ? (
            <Notice
              tone="warning"
              action={
                <Button size="sm" onClick={() => void data.refreshReports()}>
                  {t('common:actions.retry')}
                </Button>
              }
            >
              {t('reports.historyWarning')}
            </Notice>
          ) : null}
          {data.demoData && !data.analyticsUnavailable ? <Notice tone="warning">{t('detail.demoData')}</Notice> : null}

          {data.corpusError ? null : !data.corpusReady || (data.reportsState === 'loading' && !data.reports.length) ? (
            <PipelineSkeleton />
          ) : (
            <PipelineBoard data={data} onOpen={setOpenAgent} />
          )}
        </TabsContent>

        <TabsContent value="reports" className="focus:outline-none">
          <ReportsTab data={data} filters={filters} onFiltersChange={setFilters} onGoPipeline={() => setTab('pipeline')} />
        </TabsContent>
      </Tabs>

      <AgentSheet
        data={data}
        agentId={openAgent}
        onClose={() => setOpenAgent(null)}
        onSelect={setOpenAgent}
        onShowReports={showReports}
      />
    </div>
  );
}
