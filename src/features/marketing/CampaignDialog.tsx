import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { CAMPAIGN_CHANNELS, type CampaignStatus, type MarketingCampaign } from '@/lib/types';
import { validateCampaign, type CampaignErrors, type CampaignInput } from '@/lib/marketing';
import { CAMPAIGN_STATUSES, useChannelName } from './shared';

type NumKey = 'spend' | 'revenue' | 'impressions' | 'clicks' | 'conversions';

/** Form values: numbers are kept as typed text so a field can be emptied. */
type FormState = {
  name: string;
  channel: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
} & Record<NumKey, string>;

function toForm(c: CampaignInput | null): FormState {
  return {
    name: c?.name ?? '',
    channel: c?.channel ?? 'Meta',
    status: c?.status ?? 'active',
    startDate: c?.startDate?.slice(0, 10) ?? '',
    endDate: c?.endDate?.slice(0, 10) ?? '',
    spend: c ? String(c.spend) : '',
    revenue: c ? String(c.revenue) : '',
    impressions: c ? String(c.impressions) : '',
    clicks: c ? String(c.clicks) : '',
    conversions: c ? String(c.conversions) : '',
  };
}

const parseNum = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));

function fromForm(f: FormState, id?: string): CampaignInput {
  return {
    ...(id ? { id } : {}),
    name: f.name.trim(),
    channel: f.channel,
    status: f.status,
    startDate: f.startDate || null,
    endDate: f.endDate || null,
    spend: parseNum(f.spend),
    revenue: parseNum(f.revenue),
    impressions: parseNum(f.impressions),
    clicks: parseNum(f.clicks),
    conversions: parseNum(f.conversions),
  };
}

type Props = {
  open: boolean;
  /** Campaign to edit; `null` to create. A copy without id pre-fills a new one. */
  campaign: CampaignInput | MarketingCampaign | null;
  onClose: () => void;
  onSave: (c: CampaignInput) => Promise<boolean>;
};

/** Create or edit a campaign. Asks before discarding unsaved changes. */
export function CampaignDialog({ open, campaign, onClose, onSave }: Props) {
  const { t } = useTranslation('marketing');
  const { t: tc } = useTranslation('common');
  const channelName = useChannelName();
  const initial = useMemo(() => toForm(campaign), [campaign]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<CampaignErrors>({});
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
    }
  }, [open, initial]);

  const editing = Boolean(campaign && 'id' in campaign && campaign.id);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as keyof CampaignErrors]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = fromForm(form, editing ? (campaign as MarketingCampaign).id : undefined);
    const errs = validateCampaign(value);
    setErrors(errs);
    if (Object.keys(errs).length) {
      if (errs.name) nameRef.current?.focus();
      return;
    }
    setBusy(true);
    const ok = await onSave(value);
    setBusy(false);
    if (ok) onClose();
  };

  const err = (k: keyof CampaignErrors) => (errors[k] ? t(`form.errors.${errors[k]}`) : undefined);

  const numField = (k: NumKey, hint?: string) => (
    <Field label={t(`form.${k}`)} error={err(k)} hint={hint}>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        className="tabular"
        value={form[k]}
        placeholder="0"
        onChange={(e) => set(k, e.target.value)}
      />
    </Field>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? undefined : requestClose())}>
        <DialogContent
          title={editing ? t('form.editTitle') : t('form.createTitle')}
          description={t('form.description')}
          closeLabel={tc('actions.close')}
          className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-y-auto"
        >
          <form id="campaign-form" onSubmit={submit} noValidate className="flex flex-col gap-6">
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold text-muted">{t('form.sectionMain')}</legend>
              <Field label={t('form.name')} error={err('name')} className="sm:col-span-2">
                <Input
                  ref={nameRef}
                  value={form.name}
                  maxLength={120}
                  placeholder={t('form.namePlaceholder')}
                  onChange={(e) => set('name', e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t('form.channel')}>
                <NativeSelect value={form.channel} onChange={(e) => set('channel', e.target.value)}>
                  {[...CAMPAIGN_CHANNELS, ...(CAMPAIGN_CHANNELS.includes(form.channel as never) ? [] : [form.channel])].map((c) => (
                    <option key={c} value={c}>
                      {channelName(c)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t('form.status')}>
                <NativeSelect value={form.status} onChange={(e) => set('status', e.target.value as CampaignStatus)}>
                  {CAMPAIGN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold text-muted">{t('form.sectionDates')}</legend>
              <Field label={t('form.start')}>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </Field>
              <Field label={t('form.end')} error={err('endDate')} hint={t('form.endHint')}>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => set('endDate', e.target.value)}
                />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-3 text-sm font-semibold text-muted">{t('form.sectionFigures')}</legend>
              {numField('spend')}
              {numField('revenue')}
              {numField('impressions')}
              {numField('clicks')}
              {numField('conversions', t('form.conversionsHint'))}
            </fieldset>
          </form>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={requestClose} disabled={busy}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="campaign-form" variant="primary" loading={busy}>
              {editing ? t('form.submitEdit') : t('form.submitCreate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title={t('form.discardTitle')}
        description={t('form.discardBody')}
        confirmLabel={t('form.discard')}
        cancelLabel={t('form.keepEditing')}
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
