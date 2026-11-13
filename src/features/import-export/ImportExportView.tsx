import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, History } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import type { Lesson, Track } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel } from '@/components/ui/page';
import { fmtInt } from '@/components/ui/chart';
import { SourceRow } from './SourceRow';
import { FileImport } from './FileImport';
import { ExportPanel } from './ExportPanel';

type Busy = 'syllabus' | 'seed' | 'file' | null;
type SyllabusInfo = { domains: number; modules: number; lessons: number; lessonIds: string[] };
type SeedInfo = { tracks: Track[]; lessons: Lesson[] };

/** Large data files are loaded only when this page opens, never in the main bundle. */
function useLazySources() {
  const [syllabus, setSyllabus] = useState<SyllabusInfo | null>(null);
  const [seed, setSeed] = useState<SeedInfo | null>(null);
  useEffect(() => {
    let alive = true;
    import('@/lib/syllabus')
      .then(({ SYLLABUS, SYLLABUS_TOTALS, lessonId }) => {
        if (!alive) return;
        const lessonIds = SYLLABUS.flatMap((d) => d.modules.flatMap((m, mi) => m.lessons.map((_, li) => lessonId(d.code, mi, li))));
        setSyllabus({ ...SYLLABUS_TOTALS, lessonIds });
      })
      .catch(() => undefined);
    import('@/lib/seed')
      .then(({ SEED_TRACKS, SEED_LESSONS }) => {
        if (alive) setSeed({ tracks: SEED_TRACKS, lessons: SEED_LESSONS });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return { syllabus, seed };
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export default function ImportExportView() {
  const { t } = useTranslation('io');
  const { t: tc } = useTranslation();
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const lessons = useCorpus((s) => s.lessons);
  const importSeed = useCorpus((s) => s.importSeed);
  const importSyllabus = useCorpus((s) => s.importSyllabus);

  const { syllabus, seed } = useLazySources();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<'syllabus' | 'seed' | null>(null);
  const importRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);

  const ids = useMemo(() => new Set(lessons.map((l) => l.id)), [lessons]);
  const syllabusPresent = syllabus ? syllabus.lessonIds.filter((id) => ids.has(id)).length : 0;
  const seedPresent = seed ? seed.lessons.filter((l) => ids.has(l.id)).length : 0;

  const run = async (kind: 'syllabus' | 'seed') => {
    setBusy(kind);
    if (kind === 'syllabus') await importSyllabus();
    else if (seed) await importSeed(seed.tracks, seed.lessons);
    setBusy(null);
  };

  const counting = <Skeleton className="h-4 w-40" />;

  const header = <PageHeader title={t('title')} description={t('description')} />;

  if (loadError && !loaded) {
    return (
      <>
        {header}
        <Notice
          tone="danger"
          title={t('loadError.title')}
          action={
            <Button size="sm" onClick={() => void load()} loading={loading}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {t('loadError.body')}
        </Notice>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const syllabusLabels = syllabus
    ? { domains: fmtInt(syllabus.domains), modules: fmtInt(syllabus.modules), lessons: fmtInt(syllabus.lessons) }
    : null;
  const seedLabels = seed ? { lessons: fmtInt(seed.lessons.length), modules: fmtInt(seed.tracks.length) } : null;

  return (
    <>
      {header}

      <div className="flex flex-col gap-6">
        <Notice tone="info" title={t('safe.title')}>
          {t('safe.body')}
        </Notice>

        <div ref={importRef} tabIndex={-1} className="scroll-mt-20 focus:outline-none">
          <Panel title={t('import.heading')} bodyClassName="p-0">
            <div className="divide-y divide-border">
              <SourceRow
                icon={<GraduationCap />}
                title={t('import.syllabus.title')}
                body={t('import.syllabus.body')}
                meta={
                  syllabusLabels ? (
                    <>
                      <span className="tabular">{t('import.syllabus.meta', syllabusLabels)}</span>
                      {syllabusPresent > 0 ? (
                        <span className="tabular">{t('import.syllabus.present', { count: syllabusPresent })}</span>
                      ) : null}
                    </>
                  ) : (
                    counting
                  )
                }
                action={
                  <Button className="h-10" disabled={busy !== null} loading={busy === 'syllabus'} onClick={() => setConfirm('syllabus')}>
                    {busy === 'syllabus' ? t('import.busy') : t('import.syllabus.action')}
                  </Button>
                }
              />
              <SourceRow
                icon={<History />}
                title={t('import.seed.title')}
                body={t('import.seed.body')}
                meta={
                  seedLabels ? (
                    <>
                      <span className="tabular">{t('import.seed.meta', seedLabels)}</span>
                      {seedPresent > 0 ? <span className="tabular">{t('import.seed.present', { count: seedPresent })}</span> : null}
                    </>
                  ) : (
                    counting
                  )
                }
                action={
                  <Button
                    className="h-10"
                    disabled={busy !== null || !seed}
                    loading={busy === 'seed'}
                    onClick={() => setConfirm('seed')}
                  >
                    {busy === 'seed' ? t('import.busy') : t('import.seed.action')}
                  </Button>
                }
              />
              <FileImport
                disabled={busy !== null}
                busy={busy === 'file'}
                onBusy={(b) => setBusy(b ? 'file' : null)}
              />
            </div>
          </Panel>
        </div>

        <ExportPanel
          onImportHint={() => {
            importRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            importRef.current?.focus({ preventScroll: true });
          }}
        />
      </div>

      <ConfirmDialog
        open={confirm === 'syllabus'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('import.syllabus.confirmTitle')}
        description={syllabusLabels ? t('import.syllabus.confirmBody', syllabusLabels) : undefined}
        confirmLabel={t('import.syllabus.confirm')}
        cancelLabel={tc('actions.cancel')}
        onConfirm={() => void run('syllabus')}
      />
      <ConfirmDialog
        open={confirm === 'seed'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('import.seed.confirmTitle')}
        description={seedLabels ? t('import.seed.confirmBody', seedLabels) : undefined}
        confirmLabel={t('import.seed.confirm')}
        cancelLabel={tc('actions.cancel')}
        onConfirm={() => void run('seed')}
      />
    </>
  );
}
