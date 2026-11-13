import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronLeft, Clock, Coins, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { richText } from '@/lib/richtext';
import { isTranslated } from '@/lib/lessonRules';
import { cn } from '@/lib/utils';
import type { Block, Lesson, Quiz, Track } from '@/lib/types';
import { blockStyle } from './blockTypes';

type Lang = 'fr' | 'en' | 'es';
const LANGS: Lang[] = ['fr', 'en', 'es'];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

/**
 * The lesson as a learner sees it in the mobile app, with a language
 * switch. Mount it with `key={lesson.id}` so the language and the quiz
 * answers start over for every lesson.
 */
export function LessonPreview({ lesson, track, framed = true }: { lesson: Lesson; track?: Track | null; framed?: boolean }) {
  const { t } = useTranslation('lessons');
  const [lang, setLang] = useState<Lang>('fr');
  const available = (l: Lang) => l === 'fr' || isTranslated(lesson, l);

  const tr = lang === 'fr' ? null : lesson.translations?.[lang];
  const title = tr?.title || lesson.name;
  const blocks: Block[] = tr?.blocks?.length ? tr.blocks : lesson.blocks;
  const quizzes: Quiz[] = (tr?.quizzes?.length ? tr.quizzes : lesson.quizzes).filter((q) => q.q.trim() || q.opts.some((o) => o.trim()));
  const fallback = lang !== 'fr' && !tr?.blocks?.length && lesson.blocks.length > 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="group" aria-label={t('preview.language')} className="inline-flex rounded-full border border-border bg-surface-2/60 p-1">
        {LANGS.map((l) => {
          const ok = available(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              disabled={!ok}
              onClick={() => setLang(l)}
              title={ok ? undefined : t('preview.notTranslated')}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                lang === l ? 'bg-surface text-foreground shadow-raised' : 'text-muted hover:text-foreground',
                !ok && 'line-through opacity-70'
              )}
            >
              {t(`langs.${l}`)}
              {!ok ? <span className="sr-only"> ({t('preview.notTranslated')})</span> : null}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'w-full overflow-hidden bg-background',
          framed && 'max-w-[380px] rounded-[2rem] border-[6px] border-surface-2 shadow-overlay'
        )}
      >
        <div className={cn('flex flex-col', framed && 'max-h-[min(720px,calc(100vh-15rem))] overflow-y-auto')}>
          {/* App header */}
          <div className="flex items-center gap-2 px-4 pt-4 text-sm text-muted">
            <ChevronLeft aria-hidden className="size-5" />
            <span className="truncate">{track?.nameFr ?? ''}</span>
          </div>
          <div className="mx-4 mt-3 h-1.5 rounded-full bg-surface-2" aria-hidden>
            <div className="h-full w-1/4 rounded-full bg-brand" />
          </div>

          <div className="flex flex-col gap-3 px-4 pb-2 pt-5">
            <span aria-hidden className="text-4xl leading-none">{lesson.emoji}</span>
            <h3 className="text-xl font-semibold leading-tight">{title || t('list.untitled')}</h3>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Chip icon={<Clock aria-hidden className="size-3.5" />}>{lesson.duration}</Chip>
              <Chip icon={<Coins aria-hidden className="size-3.5 text-brand" />}>{t('preview.coins', { count: lesson.coins })}</Chip>
              <Chip icon={<Sparkles aria-hidden className="size-3.5 text-info" />}>{t('preview.xp', { count: lesson.xp })}</Chip>
            </div>
            {lesson.summary && lang === 'fr' ? <p className="text-base text-muted">{lesson.summary}</p> : null}
            {fallback ? <p className="rounded bg-warning/10 px-3 py-2 text-sm text-warning">{t('preview.fallback')}</p> : null}
          </div>

          <div className="flex flex-col gap-3 px-4 py-3">
            {blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-base text-muted">{t('preview.noBlocks')}</p>
            ) : (
              blocks.map((b, i) => {
                const st = blockStyle(b.type);
                const Icon = st.icon;
                return (
                  <article key={i} className={cn('rounded-xl border border-border/70 p-4', st.soft)}>
                    <p className={cn('mb-1.5 flex items-center gap-1.5 text-xs font-semibold', st.text)}>
                      {b.emo ? <span aria-hidden>{b.emo}</span> : <Icon aria-hidden className="size-3.5" />}
                      {t(`blocks.types.${b.type}`, { defaultValue: b.type })}
                    </p>
                    <div className="text-md leading-relaxed text-foreground">{richText(b.text)}</div>
                  </article>
                );
              })
            )}
          </div>

          {quizzes.length ? (
            <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
              {quizzes.map((q, i) => (
                <QuizPreview key={`${lang}-${i}`} quiz={q} index={i} total={quizzes.length} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1">
      {icon}
      {children}
    </span>
  );
}

function QuizPreview({ quiz, index, total }: { quiz: Quiz; index: number; total: number }) {
  const { t } = useTranslation('lessons');
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = picked === quiz.correct;

  return (
    <section className="rounded-xl border border-border bg-surface p-4" aria-label={t('preview.quizN', { n: index + 1, total })}>
      <p className="text-xs font-semibold text-brand">{t('preview.quizN', { n: index + 1, total })}</p>
      <p className="mt-1 text-md font-semibold">{quiz.q || t('preview.noQuestion')}</p>
      <div className="mt-3 flex flex-col gap-2">
        {quiz.opts.map((opt, i) => {
          const isCorrect = i === quiz.correct;
          const isPicked = i === picked;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-base transition-colors',
                !answered && 'border-border hover:border-brand/60 hover:bg-surface-2',
                answered && isCorrect && 'border-success/70 bg-success/10',
                answered && isPicked && !isCorrect && 'border-danger/70 bg-danger/10',
                answered && !isCorrect && !isPicked && 'border-border opacity-70'
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold">{LETTERS[i]}</span>
              <span className="flex-1">{opt || '—'}</span>
              {answered && isCorrect ? <CheckCircle2 aria-label={t('quiz.correct')} className="size-4 text-success" /> : null}
              {answered && isPicked && !isCorrect ? <XCircle aria-label={t('preview.wrong')} className="size-4 text-danger" /> : null}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="mt-3 flex flex-col gap-2" aria-live="polite">
          <p className={cn('text-base font-semibold', right ? 'text-success' : 'text-danger')}>
            {right ? t('preview.right') : t('preview.wrongAnswer')}
          </p>
          {quiz.expl ? <div className="text-base text-muted">{richText(quiz.expl)}</div> : null}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setPicked(null)}>
            <RotateCcw aria-hidden />
            {t('preview.retry')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
