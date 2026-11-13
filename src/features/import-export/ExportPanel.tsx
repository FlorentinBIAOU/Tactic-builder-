import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Copy, Download, PackageOpen } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { locale } from '@/i18n';
import { toast } from '@/components/Toast';
import { Button } from '@/components/ui/button';
import { Panel, Stat } from '@/components/ui/page';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/feedback';
import { fmtInt } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { buildExport, copyText, downloadText } from './exportCorpus';

const PREVIEW_CHARS = 4000;

function fmtSize(bytes: number) {
  const kb = bytes / 1024;
  return kb < 1024
    ? `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(Math.max(1, kb))} ${locale().startsWith('fr') ? 'Ko' : 'KB'}`
    : `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(kb / 1024)} ${locale().startsWith('fr') ? 'Mo' : 'MB'}`;
}

/** Export the corpus in the mobile app format: download, copy, preview. */
export function ExportPanel({ onImportHint }: { onImportHint: () => void }) {
  const { t } = useTranslation('io');
  const tracks = useCorpus((s) => s.tracks);
  const lessons = useCorpus((s) => s.lessons);
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const switchId = useId();
  const previewId = useId();

  const published = useMemo(() => lessons.filter((l) => l.status === 'published').length, [lessons]);
  const payload = useMemo(() => buildExport(tracks, lessons, includeDrafts), [tracks, lessons, includeDrafts]);
  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const bytes = useMemo(() => new Blob([json]).size, [json]);
  const empty = payload.lessons.length === 0;

  const onDownload = () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadText(json, `tactic-corpus-${day}.json`);
    toast(t('export.downloaded'));
  };

  const onCopy = async () => {
    const ok = await copyText(json);
    toast(ok ? t('export.copied') : t('export.copyFailed'), ok ? 'success' : 'error');
  };

  return (
    <Panel title={t('export.heading')} description={t('export.body')}>
      {lessons.length === 0 ? (
        <EmptyState
          icon={<PackageOpen />}
          title={t('export.emptyTitle')}
          description={t('export.emptyBody')}
          action={
            <Button className="h-10" onClick={onImportHint}>
              {t('import.syllabus.action')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [t('export.lessons'), payload.lessons.length],
              [t('export.modules'), payload.tracks.length],
              [t('export.published'), published],
              [t('export.drafts'), lessons.length - published],
            ].map(([label, value]) => (
              <Stat key={label as string} label={label} value={fmtInt(value as number)} />
            ))}
          </div>

          <div className="flex items-start gap-3">
            <Switch
              id={switchId}
              checked={includeDrafts}
              onCheckedChange={setIncludeDrafts}
              aria-describedby={`${switchId}-hint`}
              className="mt-0.5"
            />
            <div className="flex flex-col">
              <label htmlFor={switchId} className="cursor-pointer text-base font-medium">
                {t('export.includeDrafts')}
              </label>
              <span id={`${switchId}-hint`} className="text-sm text-muted">
                {t('export.includeDraftsHint')}
              </span>
            </div>
          </div>

          {empty ? (
            <p className="text-base text-muted" role="status">
              {t('export.emptyPublished')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="primary" className="h-10" disabled={empty} onClick={onDownload}>
              <Download aria-hidden />
              {t('export.download')}
            </Button>
            <Button className="h-10" disabled={empty} onClick={() => void onCopy()}>
              <Copy aria-hidden />
              {t('export.copy')}
            </Button>
          </div>

          {!empty ? (
            <div className="border-t border-border pt-4">
              <Button
                variant="ghost"
                className="-ml-3 h-10"
                aria-expanded={showPreview}
                aria-controls={previewId}
                onClick={() => setShowPreview((v) => !v)}
              >
                <ChevronDown aria-hidden className={cn('transition-transform', showPreview && 'rotate-180')} />
                {showPreview ? t('export.hidePreview') : t('export.showPreview')}
              </Button>
              {showPreview ? (
                <div id={previewId} className="mt-2 flex flex-col gap-2">
                  <pre className="max-h-96 overflow-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground/90">
                    {json.length > PREVIEW_CHARS ? `${json.slice(0, PREVIEW_CHARS)}\n…` : json}
                  </pre>
                  {json.length > PREVIEW_CHARS ? (
                    <p className="text-sm text-muted">
                      {t('export.previewTruncated', { count: PREVIEW_CHARS, size: fmtSize(bytes) })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
