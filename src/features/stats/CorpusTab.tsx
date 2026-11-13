import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { computeCorpusHealth, computeCoverage, computeDomainCoverage } from '@/lib/analytics';
import { Button, buttonVariants } from '@/components/ui/button';
import { Stat } from '@/components/ui/page';
import { EmptyState } from '@/components/ui/feedback';
import { SERIES, fmtInt } from '@/components/ui/chart';
import type { Lesson } from '@/lib/types';
import { Block, BlockHeader, CoverageMeter, DomainCoverageChart, HBars } from './parts';

const TRACKS_PREVIEW = 10;

export default function CorpusTab() {
  const { t } = useTranslation('stats');
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const [allTracks, setAllTracks] = useState(false);

  const health = useMemo(() => computeCorpusHealth(lessons, tracks), [lessons, tracks]);
  const coverage = useMemo(() => computeCoverage(health), [health]);
  const byDomain = useMemo(() => computeDomainCoverage(lessons, tracks, domains), [lessons, tracks, domains]);

  if (health.total === 0) {
    return (
      <EmptyState
        title={t('corpus.emptyTitle')}
        description={t('corpus.emptyBody')}
        action={
          <Link to="/import-export" className={buttonVariants({ variant: 'primary' })}>
                {t('corpus.emptyAction')}
              </Link>
        }
      />
    );
  }

  const trackRows = (allTracks ? health.byTrack : health.byTrack.slice(0, TRACKS_PREVIEW)).map((r) => ({ name: r.label, value: r.count }));

  return (
    <div className="flex flex-col gap-6">
      <Block>
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={t('corpus.total')} value={fmtInt(health.total)} />
          <Stat label={t('common.published')} value={fmtInt(health.published)} />
          <Stat label={t('common.draft')} value={fmtInt(health.drafts)} />
          <Stat label={t('corpus.modules')} value={fmtInt(health.trackCount)} />
          <Stat
            label={t('corpus.emptyModules')}
            value={fmtInt(health.emptyTracks)}
            tone={health.emptyTracks > 0 ? 'warning' : undefined}
            hint={t('corpus.emptyModulesHint')}
          />
        </div>
      </Block>

      <Block>
        <BlockHeader title={t('corpus.coverage')} info={t('corpus.coverageInfo')} sub={t('corpus.coverageSub')} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <CoverageMeter label={t('corpus.cov.content')} count={coverage.withContent} total={health.total} info={t('corpus.cov.contentInfo')} />
          <CoverageMeter label={t('corpus.cov.quiz')} count={coverage.withQuiz} total={health.total} info={t('corpus.cov.quizInfo')} />
          <CoverageMeter label={t('corpus.cov.track')} count={coverage.withTrack} total={health.total} />
          <CoverageMeter label={t('corpus.cov.en')} count={coverage.withTranslationEn} total={health.total} info={t('corpus.cov.translatedInfo')} />
          <CoverageMeter label={t('corpus.cov.es')} count={coverage.withTranslationEs} total={health.total} info={t('corpus.cov.translatedInfo')} />
        </div>
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block>
          <BlockHeader title={t('corpus.byDomain')} info={t('corpus.byDomainInfo')} />
          <DomainCoverageChart rows={byDomain} label={t('corpus.byDomain')} />
        </Block>
        <Block>
          <BlockHeader title={t('corpus.byTag')} info={t('corpus.byTagInfo')} />
          <HBars
            data={health.byTag.slice(0, 8).map((r) => ({ name: r.label || '—', value: r.count }))}
            label={t('corpus.byTag')}
            seriesName={t('common.lessons')}
            color={SERIES[1]}
          />
        </Block>
      </div>

      <Block>
        <BlockHeader
          title={t('corpus.byTrack')}
          sub={t('corpus.byTrackSub', { count: health.trackCount })}
          actions={
            health.byTrack.length > TRACKS_PREVIEW ? (
              <Button size="sm" variant="ghost" onClick={() => setAllTracks((v) => !v)} aria-expanded={allTracks}>
                {allTracks ? t('corpus.showLess') : t('corpus.showAll', { count: health.byTrack.length })}
              </Button>
            ) : null
          }
        />
        <HBars data={trackRows} label={t('corpus.byTrack')} seriesName={t('common.lessons')} />
      </Block>

      <Block>
        <BlockHeader title={t('corpus.gaps')} sub={t('corpus.gapsSub')} />
        {health.gaps.noContent.length + health.gaps.noQuiz.length + health.gaps.noTrack.length === 0 ? (
          <p className="text-base text-muted">{t('corpus.noGaps')}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <GapList title={t('corpus.gap.noContent')} items={health.gaps.noContent} to="/lessons?status=empty" />
            <GapList title={t('corpus.gap.noQuiz')} items={health.gaps.noQuiz} to="/lessons?status=noquiz" />
            <GapList title={t('corpus.gap.noTrack')} items={health.gaps.noTrack} to="/lessons?status=unassigned" />
          </div>
        )}
      </Block>
    </div>
  );
}

function GapList({ title, items, to }: { title: string; items: Lesson[]; to: string }) {
  const { t } = useTranslation('stats');
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="flex items-baseline justify-between gap-2 text-base font-medium">
        {title}
        <span className="tabular text-sm text-muted">{fmtInt(items.length)}</span>
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{t('corpus.gap.none')}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-border text-base">
            {items.slice(0, 5).map((l) => (
              <li key={l.id} className="truncate py-1.5" title={l.name}>
                {l.name}
              </li>
            ))}
          </ul>
          <Link to={to} className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium text-brand hover:underline">
            {t('corpus.gap.open', { count: items.length })}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </>
      )}
    </div>
  );
}
