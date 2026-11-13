import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCorpus } from '@/store/corpus';
import type { Domain, Track } from '@/lib/types';
import { toast } from '@/components/Toast';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { FormDialog } from './FormDialog';
import { newId, nextOrder } from './model';

const DEFAULT_EMOJI = '📚';
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The emoji stays in the data for the mobile app; in the admin it is only a
 * secondary field of the edit dialogs.
 */
function EmojiField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-t border-border pt-4">
      <Field label={label} hint={hint}>
        <Input
          value={value}
          maxLength={8}
          className="w-24 text-center"
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    </div>
  );
}

// ─── Domain ────────────────────────────────────────────────────────────────

type DomainDraft = { emoji: string; name: string; objective: string };

/** Create (domain = null) or edit a domain. */
export function DomainDialog({
  open,
  domain,
  onClose,
}: {
  open: boolean;
  domain: Domain | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('structure');
  const domains = useCorpus((s) => s.domains);
  const saveDomain = useCorpus((s) => s.saveDomain);
  const initial: DomainDraft = {
    emoji: domain?.emoji ?? DEFAULT_EMOJI,
    name: domain?.name ?? '',
    objective: domain?.objective ?? '',
  };
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDraft({
        emoji: domain?.emoji ?? DEFAULT_EMOJI,
        name: domain?.name ?? '',
        objective: domain?.objective ?? '',
      });
      setError(null);
    }
  }, [open, domain]);

  const dirty =
    draft.emoji !== initial.emoji ||
    draft.name !== initial.name ||
    draft.objective !== initial.objective;

  const submit = async () => {
    const name = draft.name.trim();
    if (!name) return setError(t('domainForm.nameRequired'));
    if (domains.some((d) => d.id !== domain?.id && same(d.name, name)))
      return setError(t('domainForm.exists'));
    setBusy(true);
    const saved = await saveDomain({
      ...(domain ?? {
        id: newId(name, new Set(domains.map((d) => d.id)), 'dom-'),
        sortOrder: nextOrder(domains),
      }),
      name,
      emoji: draft.emoji.trim() || domain?.emoji || DEFAULT_EMOJI,
      objective: draft.objective.trim() || undefined,
    });
    setBusy(false);
    if (saved) {
      toast(domain ? t('domainForm.saved') : t('domainForm.created'), 'success');
      onClose();
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      dirty={dirty}
      busy={busy}
      title={domain ? t('domainForm.titleEdit') : t('domainForm.titleNew')}
      description={t('domainForm.description')}
      submitLabel={domain ? t('domainForm.save') : t('domainForm.create')}
      onSubmit={() => void submit()}
    >
      <Field label={t('domainForm.name')} error={error ?? undefined}>
        <Input
          value={draft.name}
          autoFocus
          onChange={(e) => {
            setError(null);
            setDraft((d) => ({ ...d, name: e.target.value }));
          }}
        />
      </Field>
      <Field label={t('domainForm.objective')} hint={t('domainForm.objectiveHint')}>
        <Textarea
          rows={3}
          className="min-h-20"
          value={draft.objective}
          onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))}
        />
      </Field>
      <EmojiField
        label={t('domainForm.emoji')}
        hint={t('domainForm.emojiHint')}
        value={draft.emoji}
        onChange={(emoji) => setDraft((d) => ({ ...d, emoji }))}
      />
    </FormDialog>
  );
}

// ─── Module ────────────────────────────────────────────────────────────────

type ModuleDraft = {
  emoji: string;
  nameFr: string;
  nameEn: string;
  domainId: string;
  coreQuestion: string;
  theme: string;
};

const moduleDraft = (track: Track | null, domainId: string | null): ModuleDraft => ({
  emoji: track?.emoji ?? DEFAULT_EMOJI,
  nameFr: track?.nameFr ?? '',
  nameEn: track?.nameEn ?? '',
  domainId: track ? (track.domainId ?? '') : (domainId ?? ''),
  coreQuestion: track?.coreQuestion ?? '',
  theme: track?.theme ?? '',
});

/** Create (track = null) or edit a module, including its domain and theme. */
export function ModuleDialog({
  open,
  track,
  defaultDomainId,
  onClose,
}: {
  open: boolean;
  track: Track | null;
  /** Domain preselected when creating from a domain's menu. */
  defaultDomainId?: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('structure');
  const domains = useCorpus((s) => s.domains);
  const tracks = useCorpus((s) => s.tracks);
  const saveTrack = useCorpus((s) => s.saveTrack);
  const initial = moduleDraft(track, defaultDomainId ?? null);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(moduleDraft(track, defaultDomainId ?? null));
      setError(null);
    }
  }, [open, track, defaultDomainId]);

  const dirty = (Object.keys(initial) as (keyof ModuleDraft)[]).some(
    (k) => draft[k] !== initial[k]
  );
  const set = (p: Partial<ModuleDraft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async () => {
    const name = draft.nameFr.trim();
    if (!name) return setError(t('moduleForm.nameRequired'));
    if (tracks.some((x) => x.id !== track?.id && same(x.nameFr, name)))
      return setError(t('moduleForm.exists'));
    const domainId = draft.domainId || null;
    const siblings = tracks.filter((x) => x.id !== track?.id && (x.domainId ?? null) === domainId);
    // A module that changes domain goes to the end of its new domain.
    const sortOrder =
      track && (track.domainId ?? null) === domainId ? track.sortOrder : nextOrder(siblings);
    setBusy(true);
    const saved = await saveTrack({
      ...(track ?? {
        id: newId(name, new Set(tracks.map((x) => x.id))),
        level: 'Débutant' as const,
      }),
      sortOrder,
      emoji: draft.emoji.trim() || track?.emoji || DEFAULT_EMOJI,
      nameFr: name,
      nameEn: draft.nameEn.trim() || undefined,
      domainId,
      coreQuestion: draft.coreQuestion.trim() || undefined,
      theme: draft.theme.trim() || undefined,
    });
    setBusy(false);
    if (saved) {
      toast(track ? t('moduleForm.saved') : t('moduleForm.created'), 'success');
      onClose();
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      dirty={dirty}
      busy={busy}
      className="max-w-xl"
      title={track ? t('moduleForm.titleEdit') : t('moduleForm.titleNew')}
      description={t('moduleForm.description')}
      submitLabel={track ? t('moduleForm.save') : t('moduleForm.create')}
      onSubmit={() => void submit()}
    >
      <Field label={t('moduleForm.name')} error={error ?? undefined}>
        <Input
          value={draft.nameFr}
          autoFocus
          onChange={(e) => {
            setError(null);
            set({ nameFr: e.target.value });
          }}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('moduleForm.domain')}>
          <NativeSelect value={draft.domainId} onChange={(e) => set({ domainId: e.target.value })}>
            <option value="">{t('moduleForm.noDomain')}</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('moduleForm.nameEn')} hint={t('moduleForm.nameEnHint')}>
          <Input value={draft.nameEn} lang="en" onChange={(e) => set({ nameEn: e.target.value })} />
        </Field>
      </div>
      <Field label={t('moduleForm.coreQuestion')} hint={t('moduleForm.coreQuestionHint')}>
        <Textarea
          rows={2}
          className="min-h-16"
          value={draft.coreQuestion}
          onChange={(e) => set({ coreQuestion: e.target.value })}
        />
      </Field>
      <Field label={t('moduleForm.theme')} hint={t('moduleForm.themeHint')}>
        <Input value={draft.theme} onChange={(e) => set({ theme: e.target.value })} />
      </Field>
      <EmojiField
        label={t('moduleForm.emoji')}
        hint={t('moduleForm.emojiHint')}
        value={draft.emoji}
        onChange={(emoji) => set({ emoji })}
      />
    </FormDialog>
  );
}

// ─── Change a module's domain ──────────────────────────────────────────────

export function MoveDialog({
  open,
  track,
  onClose,
}: {
  open: boolean;
  track: Track | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('structure');
  const domains = useCorpus((s) => s.domains);
  const tracks = useCorpus((s) => s.tracks);
  const saveTrack = useCorpus((s) => s.saveTrack);
  const [domainId, setDomainId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDomainId(track?.domainId ?? '');
  }, [open, track]);

  const submit = async () => {
    if (!track) return;
    const target = domainId || null;
    if ((track.domainId ?? null) === target) return onClose();
    setBusy(true);
    const saved = await saveTrack({
      ...track,
      domainId: target,
      sortOrder: nextOrder(
        tracks.filter((x) => x.id !== track.id && (x.domainId ?? null) === target)
      ),
    });
    setBusy(false);
    if (saved) {
      toast(t('move.done'), 'success');
      onClose();
    }
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      dirty={false}
      busy={busy}
      title={t('move.title')}
      description={t('move.description', { name: track?.nameFr ?? '' })}
      submitLabel={t('move.submit')}
      onSubmit={() => void submit()}
    >
      <Field label={t('moduleForm.domain')}>
        <NativeSelect value={domainId} onChange={(e) => setDomainId(e.target.value)}>
          <option value="">{t('moduleForm.noDomain')}</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}
