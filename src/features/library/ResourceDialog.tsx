import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorpus } from '@/store/corpus';
import { isSafeUrl } from '@/lib/corpus';
import { RESOURCE_KINDS, type Resource, type ResourceKind } from '@/lib/types';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { FormDialog } from '@/features/structure/FormDialog';
import { guessKind } from './kinds';

export type ResourceInput = Omit<Resource, 'id' | 'createdAt'> & { id?: string };

type Draft = { kind: ResourceKind; title: string; url: string; trackId: string; lessonId: string };

const toDraft = (r: Partial<Resource> | null): Draft => ({
  kind: r?.kind && r.kind !== 'syllabus' ? r.kind : 'link',
  title: r?.title ?? '',
  url: r?.url ?? '',
  trackId: r?.trackId ?? '',
  lessonId: r?.lessonId ?? '',
});

/** Add a link, or edit any resource (title, type, module, lesson). */
export function ResourceDialog({
  open,
  resource,
  onClose,
  onSave,
}: {
  open: boolean;
  /** Existing resource to edit, or null to add a new link. */
  resource: Resource | null;
  onClose: () => void;
  onSave: (r: ResourceInput) => Promise<boolean>;
}) {
  const { t } = useTranslation('library');
  const tracks = useCorpus((s) => s.tracks);
  const lessons = useCorpus((s) => s.lessons);
  const initial = toDraft(resource);
  const [draft, setDraft] = useState(initial);
  const [kindTouched, setKindTouched] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(toDraft(resource));
      setKindTouched(Boolean(resource));
      setErrors({});
    }
  }, [open, resource]);

  const dirty = (Object.keys(initial) as (keyof Draft)[]).some((k) => draft[k] !== initial[k]);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const lessonOptions = useMemo(
    () =>
      lessons
        .filter((l) => !draft.trackId || l.trackId === draft.trackId || l.id === draft.lessonId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [lessons, draft.trackId, draft.lessonId]
  );

  const submit = async () => {
    const title = draft.title.trim();
    const url = draft.url.trim();
    const next: typeof errors = {};
    if (!title) next.title = t('form.titleRequired');
    if (!url) next.url = t('form.urlRequired');
    else if (!isSafeUrl(url)) next.url = t('form.urlInvalid');
    setErrors(next);
    if (next.title || next.url) return;
    setBusy(true);
    const ok = await onSave({
      ...(resource ? { id: resource.id } : {}),
      kind: draft.kind,
      title,
      url,
      trackId: draft.trackId || null,
      lessonId: draft.lessonId || null,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      dirty={dirty}
      busy={busy}
      className="max-w-xl"
      title={resource ? t('form.titleEdit') : t('form.titleNew')}
      description={resource ? undefined : t('form.description')}
      submitLabel={resource ? t('form.save') : t('form.create')}
      onSubmit={() => void submit()}
    >
      <Field label={t('form.url')} hint={t('form.urlHint')} error={errors.url}>
        <Input
          type="url"
          inputMode="url"
          autoFocus={!resource}
          placeholder="https://"
          value={draft.url}
          onChange={(e) => {
            const url = e.target.value;
            const guess = kindTouched ? null : guessKind(url);
            setErrors((x) => ({ ...x, url: undefined }));
            set(guess ? { url, kind: guess } : { url });
          }}
        />
      </Field>
      <Field label={t('form.title')} error={errors.title}>
        <Input
          value={draft.title}
          autoFocus={Boolean(resource)}
          placeholder={t('form.titlePlaceholder')}
          onChange={(e) => {
            setErrors((x) => ({ ...x, title: undefined }));
            set({ title: e.target.value });
          }}
        />
      </Field>
      <Field label={t('form.kind')}>
        <NativeSelect
          value={draft.kind}
          onChange={(e) => {
            setKindTouched(true);
            set({ kind: e.target.value as ResourceKind });
          }}
        >
          {RESOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`kinds.${k}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.module')} hint={t('form.moduleHint')}>
          <NativeSelect
            value={draft.trackId}
            onChange={(e) => {
              const trackId = e.target.value;
              const keepLesson = lessons.find((l) => l.id === draft.lessonId)?.trackId === trackId;
              set({ trackId, lessonId: keepLesson || !trackId ? draft.lessonId : '' });
            }}
          >
            <option value="">{t('form.noModule')}</option>
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.nameFr}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('form.lesson')} hint={t('form.lessonHint')}>
          <NativeSelect value={draft.lessonId} onChange={(e) => set({ lessonId: e.target.value })}>
            <option value="">{t('form.noLesson')}</option>
            {lessonOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </FormDialog>
  );
}
