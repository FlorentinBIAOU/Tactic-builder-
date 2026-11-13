import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, PenLine } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { aiMarketing, type MarketingCopy } from '@/lib/ai';
import { marketingCorpusStats } from '@/lib/marketing';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Panel } from '@/components/ui/page';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';

const AUDIENCES = ['youngInvestors', 'students', 'adults'] as const;
const GOALS = ['signups', 'reengage', 'module', 'app'] as const;

/** AI copy generator: audience + goal → headlines, posts, selling points, call to action. */
export function CopyTab() {
  const { t } = useTranslation('marketing');
  const { t: tc } = useTranslation('common');

  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);

  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]>('youngInvestors');
  const [goal, setGoal] = useState<(typeof GOALS)[number]>('signups');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<MarketingCopy | null>(null);

  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);

  // Only published lessons are counted: drafts must not inflate the claims.
  const stats = useMemo(() => marketingCorpusStats(lessons, tracks), [lessons, tracks]);

  const run = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const goalText = t(`writer.goals.${goal}`) + (details.trim() ? `. ${details.trim()}` : '');
    const res = await aiMarketing({ corpusStats: stats, audience: t(`writer.audiencePrompts.${audience}`), goal: goalText });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCopy(res.data);
  };

  const corpusReady = loaded && !loading;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Panel title={t('writer.title')} description={t('writer.description')} className="lg:sticky lg:top-20">
        <form onSubmit={run} className="flex flex-col gap-4">
          <Field label={t('writer.audience')}>
            <NativeSelect value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(`writer.audiences.${a}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('writer.goal')}>
            <NativeSelect value={goal} onChange={(e) => setGoal(e.target.value as typeof goal)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {t(`writer.goals.${g}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('writer.details')} hint={t('writer.detailsHint')}>
            <Textarea value={details} maxLength={280} rows={3} className="min-h-20" onChange={(e) => setDetails(e.target.value)} />
          </Field>

          {loadError ? (
            <Notice
              tone="danger"
              action={
                <Button size="sm" onClick={() => void load()}>
                  {tc('actions.retry')}
                </Button>
              }
            >
              {t('writer.corpusError')}
            </Notice>
          ) : !corpusReady ? (
            <Skeleton className="h-10 w-full" />
          ) : stats.lessonCount === 0 ? (
            <Notice tone="warning">{t('writer.noPublished')}</Notice>
          ) : (
            <p className="text-sm text-muted">
              {t('writer.basis', {
                lessons: t('writer.lessons', { count: stats.lessonCount }),
                tracks: t('writer.modules', { count: stats.trackCount }),
              })}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            loading={busy}
            disabled={!corpusReady || stats.lessonCount === 0}
          >
            {busy ? t('writer.generating') : copy ? t('writer.regenerate') : t('writer.generate')}
          </Button>
        </form>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4" aria-live="polite" aria-busy={busy}>
        {error ? (
          <Notice
            tone="danger"
            title={t('writer.error')}
            action={
              <Button size="sm" onClick={() => void run()} disabled={busy}>
                {tc('actions.retry')}
              </Button>
            }
          >
            <span className="text-sm text-muted">{error}</span>
          </Notice>
        ) : null}

        {busy ? (
          <ResultsSkeleton />
        ) : copy ? (
          <>
            <Notice tone="info">{t('writer.reviewNote')}</Notice>
            <CopySection title={t('writer.headlines')} items={copy.headlines} />
            <CopySection title={t('writer.posts')} items={copy.social_posts} long />
            <CopySection title={t('writer.arguments')} items={copy.value_props} />
            <CopySection title={t('writer.cta')} items={copy.cta ? [copy.cta] : []} />
          </>
        ) : !error ? (
          <EmptyState icon={<PenLine />} title={t('writer.emptyTitle')} description={t('writer.emptyBody')} />
        ) : null}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[5, 3, 4].map((n, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: n }, (_, j) => (
              <Skeleton key={j} className={cn('h-5', j % 2 ? 'w-3/4' : 'w-full')} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CopySection({ title, items, long }: { title: string; items: string[]; long?: boolean }) {
  if (!items.length) return null;
  return (
    <Panel title={title} bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {items.map((text, i) => (
          <CopyRow key={`${i}-${text.slice(0, 16)}`} text={text} long={long} />
        ))}
      </ul>
    </Panel>
  );
}

/** One generated text with its copy button. Falls back to selecting the text. */
function CopyRow({ text, long }: { text: string; long?: boolean }) {
  const { t } = useTranslation('marketing');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  const timer = useRef<number>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const selectText = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const onCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      selectText();
      toast(t('writer.copyFailed'), 'error');
    }
  };

  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p ref={ref} className={cn('text-base', long && 'whitespace-pre-line leading-relaxed')}>
          {text}
        </p>
        {long ? <p className="mt-1 text-xs text-muted tabular">{t('writer.chars', { count: text.length })}</p> : null}
      </div>
      <IconButton
        label={copied ? t('writer.copied') : t('writer.copy')}
        icon={copied ? <Check className="text-success" /> : <Copy />}
        className="size-10 shrink-0"
        onClick={() => void onCopy()}
      />
      <span className="sr-only" aria-live="polite">
        {copied ? t('writer.copied') : ''}
      </span>
    </li>
  );
}
