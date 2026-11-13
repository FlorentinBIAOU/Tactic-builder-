import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FilePlus2, FileText, FolderPlus, Lightbulb, Folder } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { aiLessonIdeas, aiModuleIdeas, type LessonIdea, type ModuleIdea } from '@/lib/ai';
import { slugify } from '@/lib/slug';
import type { Track } from '@/lib/types';
import { toast } from '@/components/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { PageHeader, Panel } from '@/components/ui/page';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IdeaList, IdeaListSkeleton } from './IdeaList';

type Mode = 'lesson' | 'module';

/** What a batch of ideas was generated for: the actions reuse it. */
type Context = { domainId: string; trackId: string; theme: string };
type Batch<T> = { ideas: T[]; ctx: Context; done: Set<number> };
type Run = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: string };

/** Level sent to the AI. There is no level picker: a chosen module gives its
 *  own level, otherwise the previous default is kept. */
const DEFAULT_LEVEL = 'Intermédiaire';

/** First free module id derived from its name. */
function freeTrackId(name: string, tracks: Track[]): string {
  const base = slugify(name) || 'module';
  const taken = new Set(tracks.map((t) => t.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export default function IdeasView() {
  const { t } = useTranslation('ideas');
  const { t: tc } = useTranslation();
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const openEditor = useCorpus((s) => s.openEditor);
  const saveTrack = useCorpus((s) => s.saveTrack);

  const [mode, setMode] = useState<Mode>('lesson');
  const [domainId, setDomainId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState('');
  const [theme, setTheme] = useState('');
  const [run, setRun] = useState<Record<Mode, Run>>({ lesson: { status: 'idle' }, module: { status: 'idle' } });
  const [lessonBatch, setLessonBatch] = useState<Batch<LessonIdea> | null>(null);
  const [moduleBatch, setModuleBatch] = useState<Batch<ModuleIdea> | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);

  // Default to the first domain once domains are known; '' means all / none.
  const domain = domainId ?? domains[0]?.id ?? '';

  const domainTracks = useMemo(
    () => (domain ? tracks.filter((x) => x.domainId === domain) : tracks),
    [tracks, domain]
  );
  // Forget a module choice that no longer belongs to the chosen domain.
  const track = domainTracks.find((x) => x.id === trackId);

  const existingLessons = useMemo(() => {
    if (!domain) return lessons.map((l) => l.name);
    const ids = new Set(domainTracks.map((x) => x.id));
    return lessons.filter((l) => ids.has(l.trackId ?? '')).map((l) => l.name);
  }, [lessons, domainTracks, domain]);
  const existingModules = useMemo(() => tracks.map((x) => x.nameFr), [tracks]);

  const domainLabel = (id: string) => domains.find((d) => d.id === id)?.name;
  const current = run[mode];
  const setModeRun = (m: Mode, r: Run) => setRun((s) => ({ ...s, [m]: r }));

  const generate = async (e?: FormEvent) => {
    e?.preventDefault();
    const m = mode;
    const ctx: Context = { domainId: domain, trackId: track?.id ?? '', theme: theme.trim() };
    setModeRun(m, { status: 'loading' });
    if (m === 'lesson') {
      // The AI prompt takes one theme: the domain name is folded into it.
      const themeForAi = [domainLabel(ctx.domainId), track?.nameFr, ctx.theme].filter(Boolean).join(' — ');
      const res = await aiLessonIdeas({
        level: track?.level ?? DEFAULT_LEVEL,
        theme: themeForAi || undefined,
        existing: existingLessons,
      });
      if (!res.ok) return setModeRun(m, { status: 'error', error: res.error });
      setLessonBatch({ ideas: res.data.ideas ?? [], ctx, done: new Set() });
    } else {
      const res = await aiModuleIdeas({ level: DEFAULT_LEVEL, existing: existingModules });
      if (!res.ok) return setModeRun(m, { status: 'error', error: res.error });
      setModuleBatch({ ideas: res.data.ideas ?? [], ctx, done: new Set() });
    }
    setModeRun(m, { status: 'idle' });
  };

  const createDraft = (i: number) => {
    if (!lessonBatch) return;
    const idea = lessonBatch.ideas[i];
    const target = tracks.find((x) => x.id === lessonBatch.ctx.trackId);
    openEditor({
      id: '',
      trackId: target?.id ?? null,
      // Kept for the mobile app, not shown in this list.
      emoji: idea.emoji || '📖',
      name: idea.name,
      summary: idea.summary || undefined,
      duration: '1 min',
      coins: 80,
      xp: 60,
      tag: idea.tag || 'Core',
      level: target?.level ?? 'Débutant',
      blocks: [],
      quizzes: [{ q: '', opts: ['', '', '', ''], correct: 0, expl: '' }],
      translations: {},
      status: 'draft',
    });
    setLessonBatch((b) => (b ? { ...b, done: new Set(b.done).add(i) } : b));
    toast(t('results.draftToast'), 'info');
  };

  const createModule = async (i: number) => {
    if (!moduleBatch || moduleBatch.done.has(i)) return;
    const idea = moduleBatch.ideas[i];
    const domainOf = moduleBatch.ctx.domainId || null;
    const siblings = tracks.filter((x) => (x.domainId ?? null) === domainOf);
    setCreating(`m${i}`);
    const saved = await saveTrack({
      id: freeTrackId(idea.name, tracks),
      emoji: idea.emoji || '📚',
      nameFr: idea.name,
      level: 'Débutant',
      sortOrder: siblings.length ? Math.max(...siblings.map((x) => x.sortOrder)) + 1 : tracks.length,
      domainId: domainOf,
    });
    setCreating(null);
    if (!saved) return; // the store already showed the error
    setModuleBatch((b) => (b ? { ...b, done: new Set(b.done).add(i) } : b));
    toast(t('results.moduleToast', { name: saved.nameFr || idea.name }));
  };

  const header = <PageHeader title={t('title')} description={t('description')} />;

  if (loadError && !loaded) {
    return (
      <>
        {header}
        <Notice
          tone="danger"
          title={t('loadError.title')}
          action={
            <Button size="sm" loading={loading} onClick={() => void load()}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {t('loadError.body')}
        </Notice>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-6" aria-busy>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </>
    );
  }

  const batch = mode === 'lesson' ? lessonBatch : moduleBatch;
  const scope = batch
    ? [
        batch.ctx.domainId
          ? t('results.scope', { domain: domainLabel(batch.ctx.domainId) ?? '' })
          : mode === 'lesson'
            ? t('form.allDomains')
            : t('form.noDomain'),
        mode === 'lesson' && batch.ctx.trackId
          ? t('results.scopeModule', { module: tracks.find((x) => x.id === batch.ctx.trackId)?.nameFr ?? '' })
          : null,
        mode === 'lesson' && batch.ctx.theme ? t('results.theme', { theme: batch.ctx.theme }) : null,
      ].filter(Boolean)
    : [];

  const results = (() => {
    if (current.status === 'loading') return <IdeaListSkeleton label={t('results.loading')} />;
    if (current.status === 'error')
      return (
        <div className="p-5">
          <Notice
            tone="danger"
            title={t('error.title')}
            action={
              <Button size="sm" onClick={() => void generate()}>
                {tc('actions.retry')}
              </Button>
            }
          >
            <p>{t('error.body')}</p>
            <p className="mt-1 text-sm text-muted">{t('error.detail', { error: current.error })}</p>
          </Notice>
        </div>
      );
    if (!batch)
      return (
        <div className="p-5">
          <EmptyState
            icon={<Lightbulb />}
            title={t('empty.title')}
            description={mode === 'lesson' ? t('empty.lessons') : t('empty.modules')}
          />
        </div>
      );
    if (batch.ideas.length === 0) return <p className="p-5 text-base text-muted">{t('results.none')}</p>;
    return mode === 'lesson' ? (
      <IdeaList
        rows={lessonBatch!.ideas.map((x, i) => ({ key: `l${i}`, name: x.name, why: x.why, tag: x.tag, done: lessonBatch!.done.has(i) }))}
        icon={<FileText />}
        actionLabel={t('results.createDraft')}
        actionIcon={<FilePlus2 aria-hidden />}
        doneLabel={t('results.draftOpened')}
        onAction={(key) => createDraft(Number(key.slice(1)))}
      />
    ) : (
      <IdeaList
        rows={moduleBatch!.ideas.map((x, i) => ({ key: `m${i}`, name: x.name, why: x.why, done: moduleBatch!.done.has(i) }))}
        icon={<Folder />}
        actionLabel={t('results.createModule')}
        actionIcon={<FolderPlus aria-hidden />}
        doneLabel={t('results.moduleCreated')}
        busyKey={creating}
        lockDone
        onAction={(key) => void createModule(Number(key.slice(1)))}
      />
    );
  })();

  const count = batch?.ideas.length ?? 0;

  return (
    <>
      {header}

      <div className="flex flex-col gap-6">
        <Panel bodyClassName="p-0">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="px-3">
              <TabsTrigger value="lesson">{t('mode.lessons')}</TabsTrigger>
              <TabsTrigger value="module">{t('mode.modules')}</TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={(e) => void generate(e)} className="flex flex-col gap-4 p-5">
            {domains.length === 0 ? (
              <Notice
                tone="info"
                action={
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/import-export">{t('form.noDomainsAction')}</Link>
                  </Button>
                }
              >
                {t('form.noDomains')}
              </Notice>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              {domains.length > 0 ? (
                <Field label={mode === 'lesson' ? t('form.domain') : t('form.domainModule')}>
                  <NativeSelect
                    className="h-10"
                    value={domain}
                    onChange={(e) => {
                      setDomainId(e.target.value);
                      setTrackId('');
                    }}
                  >
                    <option value="">{mode === 'lesson' ? t('form.allDomains') : t('form.noDomain')}</option>
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}

              {mode === 'lesson' ? (
                <>
                  <Field label={t('form.theme')}>
                    <Input
                      className="h-10"
                      value={theme}
                      maxLength={200}
                      placeholder={t('form.themePlaceholder')}
                      onChange={(e) => setTheme(e.target.value)}
                    />
                  </Field>
                  <Field label={t('form.module')}>
                    <NativeSelect className="h-10" value={track?.id ?? ''} onChange={(e) => setTrackId(e.target.value)}>
                      <option value="">{t('form.moduleNone')}</option>
                      {domainTracks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.nameFr}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                {mode === 'lesson'
                  ? t('form.avoidLessons', { count: existingLessons.length })
                  : t('form.avoidModules', { count: existingModules.length })}
              </p>
              <Button type="submit" variant="primary" className="h-10" loading={current.status === 'loading'}>
                {current.status === 'loading' ? null : <Lightbulb aria-hidden />}
                {batch ? t('form.again') : t('form.generate')}
              </Button>
            </div>
          </form>
        </Panel>

        <section aria-labelledby="ideas-results" className="rounded-lg border border-border bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
            <h2 id="ideas-results" className="text-md font-semibold">
              {batch && current.status === 'idle'
                ? t(mode === 'lesson' ? 'results.lessons' : 'results.modules', { count })
                : mode === 'lesson'
                  ? t('mode.lessons')
                  : t('mode.modules')}
            </h2>
            {batch && current.status === 'idle' ? (
              <div className="flex flex-wrap gap-1.5">
                {scope.map((s) => (
                  <Badge key={s as string}>{s}</Badge>
                ))}
              </div>
            ) : null}
          </header>
          <div aria-live="polite">{results}</div>
        </section>
      </div>
    </>
  );
}
