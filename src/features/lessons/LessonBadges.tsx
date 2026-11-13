import { useTranslation } from 'react-i18next';
import { Check, CircleDashed, CircleCheck, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Lesson } from '@/lib/types';
import { isTranslated } from '@/lib/lessonRules';

export function StatusBadge({ status }: { status: Lesson['status'] }) {
  const { t } = useTranslation();
  return status === 'published' ? (
    <Badge tone="success">
      <CircleCheck aria-hidden className="size-3" />
      {t('status.published')}
    </Badge>
  ) : (
    <Badge tone="neutral">
      <CircleDashed aria-hidden className="size-3" />
      {t('status.draft')}
    </Badge>
  );
}

/** EN / ES markers: present (tick) or missing (dash), never colour only. */
export function TranslationMarks({ lesson, className }: { lesson: Lesson; className?: string }) {
  const { t } = useTranslation('lessons');
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {(['en', 'es'] as const).map((lang) => {
        const ok = isTranslated(lesson, lang);
        const label = t(ok ? 'list.translated' : 'list.notTranslated', { lang: t(`langs.${lang}`) });
        return (
          <span
            key={lang}
            title={label}
            className={cn('inline-flex items-center gap-0.5 text-xs font-medium', ok ? 'text-success' : 'text-muted')}
          >
            {ok ? <Check aria-hidden className="size-3" /> : <Minus aria-hidden className="size-3" />}
            <span aria-hidden>{lang.toUpperCase()}</span>
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </span>
  );
}
