import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownUp,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  FileX2,
  FolderX,
  Languages,
  Lightbulb,
  PencilLine,
  Plus,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { useAnalytics } from '@/store/analytics';
import { computeCorpusHealth, computeDomainCoverage } from '@/lib/analytics';
import { fetchReports } from '@/lib/reports';
import type { AgentReportRecord, AgentReportStatus } from '@/lib/types';
import { PageHeader } from '@/components/ui/page';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { SERIES, fmtDate, fmtInt, fmtPct } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import {
  AnalyticsError,
  Block,
  BlockError,
  BlockHeader,
  DemoBanner,
  DomainCoverageChart,
  HBars,
  useEnsureAnalytics,
  useEnsureCorpus,
  useLessonNames,
} from '@/features/stats/parts';

type Attention = { key: string; icon: LucideIcon; count: number; to: string; tone: 'danger' | 'warning' | 'neutral' };

/** Home page: what needs attention now, then the context. */
export default function DashboardView() {
  const { t } = useTranslation('dashboard');
  const corpus = useEnsureCorpus();
  useEnsureAnalytics();
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const openEditor = useCorpus((s) => s.openEditor);

  const health = useMemo(() => computeCorpusHealth(lessons, tracks), [lessons, tracks]);
  const byDomain = useMemo(() => computeDomainCoverage(lessons, tracks, domains), [lessons, tracks, domains]);

  const attention: Attention[] = [
    { key: 'empty', icon: FileX2, count: health.gaps.noContent.length, to: '/lessons?status=empty', tone: 'danger' as const },
    { key: 'noquiz', icon: FileQuestion, count: health.gaps.noQuiz.length, to: '/lessons?status=noquiz', tone: 'warning' as const },
    { key: 'unassigned', icon: Unlink, count: health.gaps.noTrack.length, to: '/lessons?status=unassigned', tone: 'warning' as const },
    { key: 'untranslated', icon: Languages, count: health.gaps.untranslated.en.length, to: '/lessons?status=untranslated', tone: 'neutral' as const },
    { key: 'drafts', icon: PencilLine, count: health.drafts, to: '/lessons?status=draft', tone: 'neutral' as const },
    { key: 'emptyModules', icon: FolderX, count: health.emptyTracks, to: '/structure', tone: 'neutral' as const },
  ].filter((a) => a.count > 0);
  const urgent = attention.filter((a) => a.tone !== 'neutral').reduce((n, a) => n + a.count, 0);

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button variant="primary" onClick={() => openEditor()}>
            <Plus aria-hidden />
            {t('newLesson')}
          </Button>
        }
      />

      <DemoBanner />

      {corpus.loadError ? (
        <Notice
          tone="danger"
          title={t('corpusError')}
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={() => void corpus.reload()}>
              {t('retry')}
            </Button>
          }
        >
          {corpus.loadError}
        </Notice>
      ) : null}

      {corpus.loading && !corpus.loaded ? (
        <DashboardSkeleton />
      ) : corpus.loaded && health.total === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.body')}
          action={
            <>
              <Button variant="primary" onClick={() => openEditor()}>
                {t('newLesson')}
              </Button>
              <Link to="/import-export" className={buttonVariants({ variant: 'secondary' })}>
                {t('empty.import')}
              </Link>
            </>
          }
        />
      ) : corpus.loaded ? (
        <div className="flex flex-col gap-6">
          {/* 1. Summary + attention */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <Block className="p-0">
              <div className="flex flex-col gap-4 border-b border-border p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-md font-semibold">{t('corpus.title')}</h2>
                  <Link to="/stats" className="text-sm font-medium text-brand hover:underline">
                    {t('corpus.details')}
                  </Link>
                </div>
                <p className="text-lg">
                  <span className="tabular font-semibold">{fmtInt(health.published)}</span>{' '}
                  {t('corpus.publishedOf', { count: health.published, total: fmtInt(health.total) })}
                  <span className="text-muted">
                    {' '}
                    {urgent > 0 ? t('corpus.urgent', { count: urgent, n: fmtInt(urgent) }) : t('corpus.allGood')}
                  </span>
                </p>
                <PublishBar published={health.published} total={health.total} />
              </div>
              <div className="p-2">
                {attention.length === 0 ? (
                  <p className="flex items-center gap-2 px-3 py-3 text-base text-muted">
                    <CheckCircle2 aria-hidden className="size-4 text-success" />
                    {t('attention.none')}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {attention.map((a) => (
                      <AttentionRow key={a.key} item={a} />
                    ))}
                  </ul>
                )}
              </div>
            </Block>

            <div className="flex flex-col gap-6">
              <LearnersSummary />
              <Shortcuts />
            </div>
          </div>

          {/* 2. Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Block>
              <BlockHeader title={t('charts.domains')} info={t('charts.domainsInfo')} />
              <DomainCoverageChart rows={byDomain} label={t('charts.domains')} />
            </Block>
            <TopLessons />
          </div>

          {/* 3. Latest agent reports */}
          <RecentReports />
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function PublishBar({ published, total }: { published: number; total: number }) {
  const { t } = useTranslation('dashboard');
  const p = total ? published / total : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full bg-success" style={{ width: `${p * 100}%` }} />
      </div>
      <div className="flex justify-between text-sm text-muted">
        <span>{t('corpus.publishedPct', { pct: fmtPct(p) })}</span>
        <span>{t('corpus.drafts', { count: total - published, n: fmtInt(total - published) })}</span>
      </div>
    </div>
  );
}

function AttentionRow({ item }: { item: Attention }) {
  const { t } = useTranslation('dashboard');
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        className="group flex min-h-12 items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-2/60"
      >
        <Icon
          aria-hidden
          className={cn(
            'size-4 shrink-0',
            item.tone === 'danger' ? 'text-danger' : item.tone === 'warning' ? 'text-warning' : 'text-muted'
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-medium">{t(`attention.${item.key}.label`, { count: item.count })}</span>
          <span className="text-sm text-muted">{t(`attention.${item.key}.help`)}</span>
        </span>
        <Badge tone={item.tone} className="tabular">
          {fmtInt(item.count)}
        </Badge>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

function LearnersSummary() {
  const { t } = useTranslation('dashboard');
  const counts = useAnalytics((s) => s.counts);
  const block = useAnalytics((s) => s.blocks.counts);
  const total = counts?.total_users ?? null;
  const active = counts?.active_streakers ?? null;
  const done = counts?.total_completions ?? null;
  const n = (v: number | null) => (v === null ? '—' : fmtInt(v));

  return (
    <Block>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-md font-semibold">{t('learners.title')}</h2>
        <Link to="/stats?tab=learners" className="text-sm font-medium text-brand hover:underline">
          {t('learners.details')}
        </Link>
      </div>
      {block.status === 'idle' || block.status === 'loading' ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : block.status === 'error' ? (
        <AnalyticsError block="counts" />
      ) : block.status === 'missing' ? (
        <p className="text-base text-muted">{t('learners.missing')}</p>
      ) : (
        <dl className="flex flex-col divide-y divide-border">
          <Figure label={t('learners.users')} value={n(total)} />
          <Figure
            label={t('learners.active')}
            value={n(active)}
            hint={total && active !== null ? t('learners.activeShare', { pct: fmtPct(active / total) }) : undefined}
          />
          <Figure label={t('learners.completions')} value={n(done)} />
        </dl>
      )}
    </Block>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="flex flex-col">
        <span className="text-base">{label}</span>
        {hint ? <span className="text-sm text-muted">{hint}</span> : null}
      </dt>
      <dd className="tabular text-xl font-semibold">{value}</dd>
    </div>
  );
}

function TopLessons() {
  const { t } = useTranslation('dashboard');
  const top = useAnalytics((s) => s.topCompleted);
  const block = useAnalytics((s) => s.blocks.top);
  const name = useLessonNames();
  return (
    <Block>
      <BlockHeader title={t('charts.top')} info={t('charts.topInfo')} />
      {block.status === 'idle' || block.status === 'loading' ? (
        <Skeleton className="h-56 w-full" />
      ) : block.status === 'error' ? (
        <AnalyticsError block="top" />
      ) : top.length === 0 ? (
        <p className="text-base text-muted">{block.status === 'missing' ? t('learners.missing') : t('charts.topEmpty')}</p>
      ) : (
        <HBars
          data={top.slice(0, 6).map((r) => ({ name: name(r.lesson_id), value: r.completions }))}
          label={t('charts.top')}
          seriesName={t('charts.completions')}
          color={SERIES[2]}
        />
      )}
    </Block>
  );
}

const STATUS_TONE: Record<AgentReportStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  new: 'info',
  in_progress: 'warning',
  done: 'success',
  archived: 'neutral',
};

/** Agent labels are stored as « 1 · Corpus »: keep the name only. */
const agentName = (label: string) => label.replace(/^\s*\d+\s*[·.-]\s*/, '');

function RecentReports() {
  const { t } = useTranslation('dashboard');
  const [reports, setReports] = useState<AgentReportRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports((await fetchReports()).filter((r) => r.status !== 'archived').slice(0, 4));
    } catch (err) {
      setError((err as { message?: string })?.message ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Block>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-md font-semibold">{t('reports.title')}</h2>
        <Link to="/agents" className="text-sm font-medium text-brand hover:underline">
          {t('reports.all')}
        </Link>
      </div>
      {loading && !reports ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error !== null || (!reports && !loading) ? (
        <BlockError detail={error} onRetry={() => void load()} retrying={loading} />
      ) : reports && reports.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<Bot />}
          title={t('reports.emptyTitle')}
          description={t('reports.emptyBody')}
          action={
            <Link to="/agents" className={buttonVariants({ variant: 'secondary' })}>
                {t('reports.run')}
              </Link>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {reports?.map((r) => {
            const finding = r.report.findings?.[0] ?? r.report.sections?.[0]?.title;
            const more = (r.report.findings?.length ?? 0) - 1;
            return (
              <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{agentName(r.agentLabel)}</span>
                  <Badge tone={STATUS_TONE[r.status]}>{t(`reports.status.${r.status}`)}</Badge>
                  <span className="ml-auto text-sm text-muted">{fmtDate(r.createdAt)}</span>
                </div>
                {finding ? (
                  <p className="line-clamp-2 text-base text-muted">
                    {finding}
                    {more > 0 ? <span> {t('reports.more', { count: more })}</span> : null}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Block>
  );
}

function Shortcuts() {
  const { t } = useTranslation('dashboard');
  const items: { to: string; icon: LucideIcon; key: string }[] = [
    { to: '/lessons?status=draft', icon: PencilLine, key: 'drafts' },
    { to: '/ideas', icon: Lightbulb, key: 'ideas' },
    { to: '/agents', icon: Bot, key: 'agents' },
    { to: '/import-export', icon: ArrowDownUp, key: 'import' },
    { to: '/stats?tab=quality', icon: BarChart3, key: 'quality' },
  ];
  return (
    <Block>
      <h2 className="mb-3 text-md font-semibold">{t('shortcuts.title')}</h2>
      <ul className="-mx-2 flex flex-col">
        {items.map(({ to, icon: Icon, key }) => (
          <li key={key}>
            <Link to={to} className="group flex min-h-11 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-2/60">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted group-hover:text-brand">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium">{t(`shortcuts.${key}.label`)}</span>
                <span className="truncate text-sm text-muted">{t(`shortcuts.${key}.help`)}</span>
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Block>
  );
}
