import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  /** Called once the dialog may close (after the discard check). */
  onClose: () => void;
  /** True when the form holds changes that are not saved yet. */
  dirty: boolean;
  title: ReactNode;
  description?: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  busy?: boolean;
  /** Extra controls on the left of the footer. */
  footerStart?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Modal form: Enter submits, closing with unsaved changes asks first.
 * Shared by the Structure and Library screens.
 */
export function FormDialog({
  open,
  onClose,
  dirty,
  title,
  description,
  submitLabel,
  onSubmit,
  busy,
  footerStart,
  children,
  className,
}: Props) {
  const { t } = useTranslation(['structure', 'common']);
  const [confirm, setConfirm] = useState(false);

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirm(true);
    else onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? undefined : requestClose())}>
        <DialogContent
          title={title}
          description={description}
          className={className}
          closeLabel={t('common:actions.close')}
        >
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            {children}
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {footerStart ? <div className="mr-auto">{footerStart}</div> : null}
              <Button variant="ghost" onClick={requestClose} disabled={busy}>
                {t('common:actions.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={busy}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('structure:discard.title')}
        description={t('structure:discard.body')}
        confirmLabel={t('structure:discard.confirm')}
        cancelLabel={t('structure:discard.keep')}
        destructive
        onConfirm={() => {
          setConfirm(false);
          onClose();
        }}
      />
    </>
  );
}
