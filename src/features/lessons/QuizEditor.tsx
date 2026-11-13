import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { removeQuizOption } from '@/lib/lessonRules';
import { cn } from '@/lib/utils';
import type { Quiz } from '@/lib/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MAX_OPTIONS = 5;

type Props = {
  quiz: Quiz;
  index: number;
  onChange: (patch: Partial<Quiz>) => void;
  onDelete: () => void;
};

/**
 * One quiz question. The correct answer is a real radio group, so it is
 * reachable with the keyboard and announced by screen readers.
 */
export function QuizEditor({ quiz, index, onChange, onDelete }: Props) {
  const { t } = useTranslation('lessons');
  const name = useId();
  const n = index + 1;

  const setOpt = (i: number, value: string) => {
    const opts = [...quiz.opts];
    opts[i] = value;
    onChange({ opts });
  };

  return (
    <fieldset className="rounded-md border border-border bg-background/40 p-4">
      <legend className="sr-only">{t('quiz.legend', { n })}</legend>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-md font-semibold">{t('quiz.legend', { n })}</h3>
        <IconButton size="icon-sm" className="size-10 text-danger sm:size-8" label={t('quiz.delete', { n })} icon={<Trash2 />} onClick={onDelete} />
      </div>

      <div className="flex flex-col gap-4">
        <Field label={t('quiz.question')}>
          <Input value={quiz.q} placeholder={t('quiz.questionPlaceholder')} onChange={(e) => onChange({ q: e.target.value })} />
        </Field>

        <div role="radiogroup" aria-label={t('quiz.answers')} className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {t('quiz.answers')} <span className="font-normal text-muted">{t('quiz.answersHint')}</span>
          </p>
          {quiz.opts.map((opt, i) => {
            const correct = quiz.correct === i;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 rounded border px-2 py-1.5 transition-colors',
                  correct ? 'border-success/60 bg-success/10' : 'border-transparent'
                )}
              >
                <input
                  type="radio"
                  name={name}
                  checked={correct}
                  onChange={() => onChange({ correct: i })}
                  aria-label={t('quiz.markCorrect', { letter: LETTERS[i] })}
                  className="size-4 shrink-0 cursor-pointer accent-[rgb(var(--c-success))]"
                />
                <span aria-hidden className="w-4 shrink-0 text-center text-sm font-semibold text-muted">
                  {LETTERS[i]}
                </span>
                <Input
                  value={opt}
                  aria-label={t('quiz.option', { letter: LETTERS[i] })}
                  placeholder={t('quiz.option', { letter: LETTERS[i] })}
                  onChange={(e) => setOpt(i, e.target.value)}
                  className="min-w-0 flex-1"
                />
                {correct ? (
                  <Badge tone="success" className="hidden sm:inline-flex">
                    {t('quiz.correct')}
                  </Badge>
                ) : null}
                <IconButton
                  size="icon-sm"
                  className="size-10 sm:size-8"
                  label={t('quiz.removeOption', { letter: LETTERS[i] })}
                  icon={<X />}
                  disabled={quiz.opts.length <= 2}
                  onClick={() => onChange(removeQuizOption(quiz, i))}
                />
              </div>
            );
          })}
          {quiz.opts.length < MAX_OPTIONS ? (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange({ opts: [...quiz.opts, ''] })}>
              <Plus aria-hidden />
              {t('quiz.addOption')}
            </Button>
          ) : null}
        </div>

        <Field label={t('quiz.explanation')} hint={t('quiz.explanationHint')}>
          <Textarea value={quiz.expl} rows={2} className="min-h-16" onChange={(e) => onChange({ expl: e.target.value })} />
        </Field>
      </div>
    </fieldset>
  );
}
