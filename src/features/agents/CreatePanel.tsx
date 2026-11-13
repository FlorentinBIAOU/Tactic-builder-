import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Square, Wand2 } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { useCreateJob } from './createJob';

/** Create agent: pick a module, generate drafts for its empty lessons. */
export function CreatePanel() {
  const { t } = useTranslation('agents');
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const lessons = useCorpus((s) => s.lessons);
  const { progress, stopping, start, stop } = useCreateJob();

  const [domainFilter, setDomainFilter] = useState('');
  const [trackId, setTrackId] = useState('');

  const sortedDomains = useMemo(() => [...domains].sort((a, b) => a.sortOrder - b.sortOrder), [domains]);
  const domainTracks = useMemo(
    () =>
      tracks
        .filter((tr) => !domainFilter || tr.domainId === domainFilter)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tracks, domainFilter]
  );
  const emptyCount = useMemo(
    () => lessons.filter((l) => l.trackId === trackId && l.blocks.length === 0).length,
    [lessons, trackId]
  );
  const busy = progress !== null;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-2/40 p-4" aria-labelledby="create-gen-title">
      <div className="flex flex-col gap-1">
        <h3 id="create-gen-title" className="text-md font-semibold">
          {t('create.title')}
        </h3>
        <p className="text-sm text-muted">{t('create.description')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('create.domain')}>
          <NativeSelect
            value={domainFilter}
            disabled={busy}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setTrackId('');
            }}
          >
            <option value="">{t('create.allDomains')}</option>
            {sortedDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code ? `${d.code}. ${d.name}` : d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label={t('create.module')}
          hint={
            domainTracks.length === 0
              ? t('create.noModules')
              : trackId
                ? t('create.emptyCount', { count: emptyCount })
                : undefined
          }
        >
          <NativeSelect
            value={trackId}
            disabled={busy || domainTracks.length === 0}
            onChange={(e) => setTrackId(e.target.value)}
          >
            <option value="">{t('create.chooseModule')}</option>
            {domainTracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.nameFr}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {progress ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-medium">
                {t('create.progress', { done: progress.done + 1, total: progress.total })}
              </span>
              <span className="min-w-0 max-w-full truncate text-muted">{t('create.current', { name: progress.current })}</span>
            </div>
            <div
              role="progressbar"
              aria-label={t('create.progressLabel')}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div className="h-full rounded-full bg-brand transition-[width] duration-base" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {busy ? (
          <Button variant="danger" className="h-10" onClick={stop} loading={stopping}>
            {!stopping ? <Square aria-hidden /> : null}
            {stopping ? t('create.stopping') : t('create.stop')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="h-10"
            disabled={!trackId || emptyCount === 0}
            onClick={() => void start(trackId)}
          >
            <Wand2 aria-hidden />
            {t('create.generate', { count: trackId ? emptyCount : 0 })}
          </Button>
        )}
        <p className="text-sm text-muted">{t('create.skipHint')}</p>
      </div>
    </section>
  );
}
