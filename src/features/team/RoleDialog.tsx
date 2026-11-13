import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Notice } from '@/components/ui/feedback';
import { toast } from '@/components/Toast';
import { adminErrorKind, setMemberRole, type AdminErrorKind } from '@/lib/admin';
import type { AdminRole, Member } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AccessLine, displayName, ROLE_ORDER } from './roles';

export function errorText(kind: AdminErrorKind, t: TFunction<'team'>, fallback: string): string {
  switch (kind) {
    case 'lastAdmin':
      return t('errors.lastAdmin');
    case 'forbidden':
      return t('errors.forbidden');
    case 'unknownMember':
      return t('errors.unknownMember');
    case 'missingMigration':
      return t('errors.missingMigration');
    default:
      return fallback;
  }
}

/** What the change does, in one or two plain sentences. */
function consequence(t: TFunction<'team'>, from: AdminRole, to: AdminRole): string {
  const role = t(`roles.${to}`);
  if (to === 'admin') return t('roleDialog.toAdmin');
  if (to === 'learner') return from === 'admin' ? t('roleDialog.toLearnerFromAdmin') : t('roleDialog.toLearner');
  if (from === 'admin') return t('roleDialog.fromAdmin', { role });
  if (from === 'learner') return t('roleDialog.fromLearner', { role });
  return t('roleDialog.labelOnly');
}

export type RoleTarget = {
  member: Member;
  /** Skip the chooser and ask to confirm this role directly (e.g. "Remove from team"). */
  preset?: AdminRole;
};

type Props = {
  target: RoleTarget | null;
  onClose: () => void;
  onChanged: (member: Member, role: AdminRole) => void;
};

/**
 * Choose a role, then confirm. Explains what each role gives and says
 * plainly that only administrators can open the tool today.
 */
export function RoleDialog({ target, onClose, onChanged }: Props) {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation();
  const member = target?.member ?? null;
  const [choice, setChoice] = useState<AdminRole>('ped');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read synchronously when the confirm dialog closes right after its action.
  const busyRef = useRef(false);

  useEffect(() => {
    if (!target) return;
    setChoice(target.preset ?? target.member.role);
    setConfirming(Boolean(target.preset));
    setError(null);
    setBusy(false);
  }, [target]);

  if (!member) return null;
  const name = displayName(member, t('members.noName'));
  const presetOnly = Boolean(target?.preset);
  const removing = choice === 'learner';

  const apply = async () => {
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await setMemberRole(member.id, choice);
      toast(removing ? t('roleDialog.removed', { name }) : t('roleDialog.done', { name, role: t(`roles.${choice}`) }), 'success');
      onChanged(member, choice);
      onClose();
    } catch (e) {
      const msg = errorText(adminErrorKind(e), t, t('errors.roleFailed'));
      if (presetOnly) {
        toast(msg, 'error');
        onClose();
      } else {
        setError(msg);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const confirm = (
    <ConfirmDialog
      open={confirming}
      onOpenChange={(o) => {
        setConfirming(o);
        if (!o && presetOnly && !busyRef.current) onClose();
      }}
      title={removing ? t('roleDialog.confirmRemoveTitle', { name }) : t('roleDialog.confirmTitle', { name, role: t(`roles.${choice}`) })}
      description={consequence(t, member.role, choice)}
      confirmLabel={removing ? t('roleDialog.confirmRemove') : t('roleDialog.confirm', { role: t(`roles.${choice}`) })}
      cancelLabel={tc('actions.cancel')}
      destructive={removing || member.role === 'admin'}
      onConfirm={() => void apply()}
    />
  );

  if (presetOnly) return confirm;

  return (
    <>
      <Dialog open onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
        <DialogContent
          title={t('roleDialog.title')}
          description={t('roleDialog.description', { name })}
          closeLabel={tc('actions.close')}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          footer={
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                {tc('actions.cancel')}
              </Button>
              <Button variant="primary" disabled={choice === member.role} loading={busy} onClick={() => setConfirming(true)}>
                {t('roleDialog.continue')}
              </Button>
            </>
          }
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t('roleDialog.legend')}</legend>
            {ROLE_ORDER.map((r) => {
              const checked = choice === r;
              return (
                <label
                  key={r}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
                    checked ? 'border-brand/60 bg-brand/5' : 'border-border hover:border-input',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40'
                  )}
                >
                  <input
                    type="radio"
                    name="team-role"
                    value={r}
                    checked={checked}
                    onChange={() => setChoice(r)}
                    className="mt-1 size-4 shrink-0 accent-[rgb(var(--c-brand))] focus-visible:outline-none"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{t(`roles.${r}`)}</span>
                      {member.role === r ? <span className="text-sm text-muted">({t('roleDialog.current')})</span> : null}
                      <AccessLine role={r} className="sm:ml-auto" />
                    </span>
                    <span className="text-sm text-muted">{t(`roleInfo.${r}`)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <Notice tone="info" title={t('honesty.title')} className="mt-4">
            {t('honesty.body')}
          </Notice>

          {error ? (
            <Notice tone="danger" className="mt-3">
              {error}
            </Notice>
          ) : null}
        </DialogContent>
      </Dialog>
      {confirm}
    </>
  );
}
