import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lesson } from '@/lib/types';
import type { PublishCheck } from '@/lib/lessonRules';

/**
 * Status choice + the publication checklist. Says plainly why a lesson
 * cannot be published yet.
 */
export function PublishPanel({
  status,
  checks,
  onStatus,
  className,
}: {
  status: Lesson['status'];
  checks: PublishCheck[];
  onStatus: (s: Lesson['status']) => void;
  className?: string;
}) {
  const { t } = useTranslation('lessons');
  const name = useId();
  const blockers = checks.filter((c) => c.required && !c.ok);
  const blocked = blockers.length > 0;

  const option = (value: Lesson['status'], disabled: boolean) => (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors',
        status === value ? 'border-brand/60 bg-brand/10' : 'border-border hover:border-input',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={status === value}
        disabled={disabled}
        onChange={() => onStatus(value)}
        className="mt-1 size-4 shrink-0 accent-[rgb(var(--c-brand))]"
      />
      <span className="flex flex-col">
        <span className="text-base font-medium">{t(`editor.statusOptions.${value}.label`)}</span>
        <span className="text-sm text-muted">{t(`editor.statusOptions.${value}.help`)}</span>
      </span>
    </label>
  );

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('editor.status')}</legend>
        {option('draft', false)}
        {option('published', blocked && status !== 'published')}
        {blocked && status !== 'published' ? <p className="text-sm text-muted">{t('editor.cannotPublish')}</p> : null}
      </fieldset>

      <div>
        <h3 className="mb-2 text-sm font-medium">{t('editor.checklist')}</h3>
        <ul className="flex flex-col gap-1.5">
          {checks.map((c) => {
            const Icon = c.ok ? CheckCircle2 : c.required ? XCircle : Circle;
            return (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <Icon
                  aria-hidden
                  className={cn('mt-0.5 size-4 shrink-0', c.ok ? 'text-success' : c.required ? 'text-danger' : 'text-muted')}
                />
                <span className={cn(c.ok && 'text-muted')}>
                  {t(`checks.${c.id}`)}
                  <span className="sr-only">
                    {' '}
                    ({c.ok ? t('checks.done') : c.required ? t('checks.missingRequired') : t('checks.missingOptional')})
                  </span>
                  {!c.ok && !c.required ? <span className="text-muted"> {t('checks.optional')}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
