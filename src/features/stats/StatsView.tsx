import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalytics } from '@/store/analytics';
import { DemoBanner, useEnsureAnalytics, useEnsureCorpus } from './parts';
import CorpusTab from './CorpusTab';
import LearnersTab from './LearnersTab';
import QualityTab from './QualityTab';

const TABS = ['corpus', 'learners', 'quality'] as const;
type Tab = (typeof TABS)[number];

/** Statistics: corpus health, learner activity and content quality, one tab each. */
export default function StatsView() {
  const { t } = useTranslation('stats');
  const corpus = useEnsureCorpus();
  useEnsureAnalytics();
  const loadAnalytics = useAnalytics((s) => s.load);
  const analyticsLoading = useAnalytics((s) => s.loading);

  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'corpus';
  const setTab = (v: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (v === 'corpus') next.delete('tab');
        else next.set('tab', v);
        return next;
      },
      { replace: true }
    );

  const refresh = () => {
    void corpus.reload();
    void loadAnalytics();
  };

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button variant="secondary" onClick={refresh} loading={analyticsLoading || (corpus.loading && corpus.loaded)}>
            {!analyticsLoading ? <RotateCcw aria-hidden /> : null}
            {t('refresh')}
          </Button>
        }
      />

      <DemoBanner />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`tabs.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {corpus.loadError && tab !== 'learners' ? (
          <Notice
            tone="danger"
            title={t('corpusError')}
            action={
              <Button size="sm" variant="secondary" onClick={() => void corpus.reload()}>
                {t('common.retry')}
              </Button>
            }
          >
            {corpus.loadError}
          </Notice>
        ) : corpus.loading && !corpus.loaded && tab !== 'learners' ? (
          <div className="flex flex-col gap-6" aria-busy>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        ) : (
          <>
            <TabsContent value="corpus" className="focus:outline-none">
              <CorpusTab />
            </TabsContent>
            <TabsContent value="learners" className="focus:outline-none">
              <LearnersTab />
            </TabsContent>
            <TabsContent value="quality" className="focus:outline-none">
              <QualityTab />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
