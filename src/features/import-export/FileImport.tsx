import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileJson, FileUp } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { normalizeImport, planImport, type ImportPlan } from '@/lib/importCorpus';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/feedback';
import { fmtInt } from '@/components/ui/chart';
import { SourceRow } from './SourceRow';

const MAX_MB = 10;

type Pending = { name: string; plan: ImportPlan };

function Figure({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background/40 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={muted ? 'tabular text-xl font-semibold text-muted' : 'tabular text-xl font-semibold'}>{fmtInt(value)}</dd>
    </div>
  );
}

/** Import from a JSON file: read, preview what will change, then confirm. */
export function FileImport({ disabled, busy, onBusy }: { disabled: boolean; busy: boolean; onBusy: (b: boolean) => void }) {
  const { t } = useTranslation('io');
  const { t: tc } = useTranslation();
  const importSeed = useCorpus((s) => s.importSeed);
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const onPicked = async (file: File) => {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(t('import.file.errorSize', { max: MAX_MB }));
      return;
    }
    setReading(true);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(await file.text());
      } catch (e) {
        setError(e instanceof SyntaxError ? t('import.file.errorJson') : t('import.file.errorRead'));
        return;
      }
      const { domains, tracks, lessons } = useCorpus.getState();
      const parsed = normalizeImport(raw, new Set(domains.map((d) => d.id)));
      if (parsed.lessons.length === 0 && parsed.tracks.length === 0) {
        setError(t('import.file.errorEmpty'));
        return;
      }
      const plan = planImport(parsed, { trackIds: tracks.map((x) => x.id), lessonIds: lessons.map((x) => x.id) });
      setPending({ name: file.name, plan });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onConfirm = async () => {
    if (!pending) return;
    onBusy(true);
    const ok = await importSeed(pending.plan.tracks, pending.plan.lessons);
    onBusy(false);
    if (ok) setPending(null);
  };

  const plan = pending?.plan;
  const nothingNew = plan ? plan.newLessons + plan.newTracks === 0 : false;

  return (
    <>
      <SourceRow
        icon={<FileJson />}
        title={t('import.file.title')}
        body={t('import.file.body')}
        action={
          <Button className="h-10" disabled={disabled} loading={reading} onClick={() => inputRef.current?.click()}>
            {reading ? null : <FileUp aria-hidden />}
            {reading ? t('import.file.reading') : t('import.file.action')}
          </Button>
        }
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPicked(f);
          }}
        />
        {error ? (
          <Notice tone="danger" title={t('import.file.errorTitle')} className="mt-3">
            {error}
          </Notice>
        ) : null}
      </SourceRow>

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        {pending && plan ? (
          <DialogContent
            title={t('preview.title')}
            description={t('preview.description', { name: pending.name })}
            closeLabel={tc('actions.close')}
            footer={
              <>
                <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
                  {tc('actions.cancel')}
                </Button>
                <Button variant="primary" loading={busy} disabled={nothingNew} onClick={() => void onConfirm()}>
                  {busy
                    ? t('import.busy')
                    : plan.newLessons > 0
                      ? t('preview.confirm', { count: plan.newLessons })
                      : t('preview.confirmModules')}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-3">
                <Figure label={t('preview.newLessons')} value={plan.newLessons} />
                <Figure label={t('preview.existingLessons')} value={plan.existingLessons} muted />
                <Figure label={t('preview.newModules')} value={plan.newTracks} />
                <Figure label={t('preview.existingModules')} value={plan.existingTracks} muted />
              </dl>
              {nothingNew ? (
                <Notice tone="info">{t('preview.nothing')}</Notice>
              ) : (
                <ul className="flex flex-col gap-2 text-base text-muted">
                  {plan.newLessons > 0 ? <li>{t('preview.drafts')}</li> : null}
                  {plan.detachedLessons > 0 ? <li>{t('preview.detached', { count: plan.detachedLessons })}</li> : null}
                  {plan.duplicateRows > 0 ? <li>{t('preview.duplicates', { count: plan.duplicateRows })}</li> : null}
                </ul>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
