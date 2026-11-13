import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Notice } from '@/components/ui/feedback';
import { toast } from '@/components/Toast';
import { inviteMember } from '@/lib/admin';
import type { AdminRole } from '@/lib/types';
import { AccessLine, INVITE_ROLES } from './roles';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = {
  open: boolean;
  initialEmail?: string;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
  /** E-mail sent but the role could not be saved. */
  onRoleNotSet: (email: string, role: AdminRole) => void;
  /** The address already has an account: look it up instead. */
  onFindAccount: (email: string) => void;
};

export function InviteDialog({ open, initialEmail = '', onOpenChange, onInvited, onRoleNotSet, onFindAccount }: Props) {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState<AdminRole>('ped');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ msg: string; detail?: string; exists: boolean } | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setRole('ped');
    setTouched(false);
    setFailure(null);
  }, [open, initialEmail]);

  const clean = email.trim().toLowerCase();
  const invalid = !EMAIL_RE.test(clean);
  const dirty = clean.length > 0 && clean !== initialEmail.trim().toLowerCase();

  const requestClose = () => {
    if (busy) return;
    if (dirty) setDiscardOpen(true);
    else onOpenChange(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (invalid) return;
    setBusy(true);
    const res = await inviteMember(clean, role);
    setBusy(false);
    if (res.ok) {
      toast(t('invite.sent', { email: clean }), 'success');
      onOpenChange(false);
      onInvited();
      return;
    }
    if (res.roleNotSet) {
      onOpenChange(false);
      onRoleNotSet(clean, role);
      onInvited();
      return;
    }
    setFailure(
      res.alreadyExists
        ? { msg: t('invite.alreadyExists'), exists: true }
        : { msg: t('invite.failed'), detail: res.error, exists: false }
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <DialogContent
          title={t('invite.title')}
          description={t('invite.description')}
          closeLabel={tc('actions.close')}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label={t('invite.email')} error={touched && invalid ? t('invite.invalidEmail') : undefined}>
              <Input
                type="email"
                autoComplete="off"
                autoFocus
                placeholder={t('invite.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => clean && setTouched(true)}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <Field label={t('invite.role')} hint={t(`roleInfo.${role}`)}>
                <NativeSelect value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`roles.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <AccessLine role={role} />
            </div>
            <p className="text-sm text-muted">{t('invite.adminHint')}</p>

            {failure ? (
              <Notice
                tone="danger"
                action={
                  failure.exists ? (
                    <Button size="sm" variant="outline" onClick={() => onFindAccount(clean)}>
                      {t('invite.findAccount')}
                    </Button>
                  ) : undefined
                }
              >
                {failure.msg}
                {failure.detail ? <span className="mt-1 block text-sm text-muted">{t('invite.failedDetail', { error: failure.detail })}</span> : null}
              </Notice>
            ) : null}

            <div className="mt-2 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={requestClose} disabled={busy}>
                {tc('actions.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                {t('invite.submit')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('invite.discardTitle')}
        description={t('invite.discardBody')}
        confirmLabel={t('invite.discard')}
        cancelLabel={t('invite.keepEditing')}
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}
