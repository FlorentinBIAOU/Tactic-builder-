import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as D from '@radix-ui/react-dialog';
import { AlertTriangle, CheckCircle2, Eye, Languages, Plus, Trash2, Wand2 } from 'lucide-react';
import { useCorpus, newLessonId } from '@/store/corpus';
import { aiGenerateContent, aiTranslate } from '@/lib/ai';
import { cleanQuizzes, hasContent, isTranslated, moveItem, publishChecks } from '@/lib/lessonRules';
import { slugify } from '@/lib/slug';
import { toast } from '@/components/Toast';
import { LEVELS, TAGS, type Block, type BlockType, type Lesson, type Quiz, type Translation } from '@/lib/types';
import { Button, IconButton } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Notice } from '@/components/ui/feedback';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DialogContent, SheetContent } from '@/components/ui/dialog';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BLOCK_TYPES, blockStyle } from './blockTypes';
import { BlockEditor } from './BlockEditor';
import { QuizEditor } from './QuizEditor';
import { EmojiPicker } from './EmojiPicker';
import { PublishPanel } from './PublishPanel';
import { LessonPreview } from './LessonPreview';

const DURATIONS = ['1 min', '2 min', '3 min', '5 min'];
const COIN_OPTIONS = [80, 100, 120, 150, 200];
const NEW_MODULE = '__new__';

const emptyQuiz = (): Quiz => ({ q: '', opts: ['', '', '', ''], correct: 0, expl: '' });

function blankLesson(): Lesson {
  return {
    id: '',
    trackId: null,
    emoji: '📖',
    name: '',
    duration: '1 min',
    coins: 80,
    xp: 60,
    tag: 'Core',
    level: 'Débutant',
    summary: '',
    blocks: [],
    quizzes: [],
    translations: {},
    // New lessons stay drafts until someone publishes them on purpose.
    status: 'draft',
  };
}

function seed(l: Lesson | null): Lesson {
  if (!l) return blankLesson();
  return {
    ...l,
    summary: l.summary ?? '',
    blocks: l.blocks.map((b) => ({ ...b })),
    quizzes: l.quizzes.map((q) => ({ ...q, opts: [...q.opts] })),
    translations: JSON.parse(JSON.stringify(l.translations ?? {})),
  };
}

type AiTask = 'generate' | 'translate';
type Tab = 'info' | 'blocks' | 'quiz' | 'translations' | 'preview';

/** Lesson editor: a wide side panel (full screen on phones). */
export function LessonEditor() {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  const open = useCorpus((s) => s.editorOpen);
  const editing = useCorpus((s) => s.editingLesson);
  const tracks = useCorpus((s) => s.tracks);
  const lessons = useCorpus((s) => s.lessons);
  const close = useCorpus((s) => s.closeEditor);
  const openEditor = useCorpus((s) => s.openEditor);
  const persistLesson = useCorpus((s) => s.persistLesson);

  const [form, setForm] = useState<Lesson>(blankLesson);
  const [baseline, setBaseline] = useState('');
  const [tab, setTab] = useState<Tab>('info');
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [newModuleOpen, setNewModuleOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<AiTask | null>(null);
  const [aiError, setAiError] = useState<{ task: AiTask; msg: string } | null>(null);
  const [confirmAi, setConfirmAi] = useState<AiTask | null>(null);
  const [showBlockPreview, setShowBlockPreview] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Seed the form whenever the panel opens or the edited lesson changes
  // (after a save the store hands back the saved version).
  useEffect(() => {
    if (!open) return;
    const next = seed(editing);
    setForm(next);
    setBaseline(JSON.stringify(next));
    setTitleError(false);
    setAiError(null);
  }, [open, editing]);

  useEffect(() => {
    if (open) setTab('info');
  }, [open]);

  const dirty = open && baseline !== '' && JSON.stringify(form) !== baseline;

  // Warn before leaving the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const checks = useMemo(() => publishChecks(form), [form]);
  const blocked = form.status === 'published' && checks.some((c) => c.required && !c.ok);
  const isEdit = !!editing && lessons.some((l) => l.id === editing.id);

  const patch = (p: Partial<Lesson>) => setForm((f) => ({ ...f, ...p }));
  const patchBlock = (i: number, p: Partial<Block>) =>
    setForm((f) => ({ ...f, blocks: f.blocks.map((b, k) => (k === i ? { ...b, ...p } : b)) }));
  const patchQuiz = (i: number, p: Partial<Quiz>) =>
    setForm((f) => ({ ...f, quizzes: f.quizzes.map((q, k) => (k === i ? { ...q, ...p } : q)) }));
  const addBlock = (type: BlockType) => setForm((f) => ({ ...f, blocks: [...f.blocks, { type, emo: '', text: '' }] }));
  const patchTranslation = (lang: 'en' | 'es', p: Partial<Translation> | null) =>
    setForm((f) => {
      const translations = { ...f.translations };
      if (p === null) delete translations[lang];
      else translations[lang] = { ...translations[lang], ...p };
      return { ...f, translations };
    });

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else close();
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      setTitleError(true);
      setTab('info');
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    if (blocked) {
      setTab('info');
      return;
    }
    const id = form.id || newLessonId(form.level, lessons);
    const next: Lesson = { ...form, id, name: form.name.trim(), quizzes: cleanQuizzes(form.quizzes) };
    setBusy(true);
    const saved = await persistLesson(next);
    setBusy(false);
    if (saved) openEditor(saved);
  };

  // ── AI ──────────────────────────────────────────────────────────────────
  const runGenerate = async () => {
    setAiError(null);
    setAiBusy('generate');
    const track = tracks.find((tr) => tr.id === form.trackId);
    const res = await aiGenerateContent({
      name: form.name,
      level: form.level,
      tag: form.tag,
      track: track?.nameFr,
      duration: form.duration,
    });
    setAiBusy(null);
    if (!res.ok) return setAiError({ task: 'generate', msg: res.error });
    const { blocks, quiz } = res.data;
    setForm((f) => ({
      ...f,
      blocks: Array.isArray(blocks) ? blocks : f.blocks,
      quizzes: quiz ? [quiz, ...f.quizzes.slice(1)] : f.quizzes,
    }));
    toast(t('ai.generated'), 'success');
  };

  const runTranslate = async () => {
    setAiError(null);
    setAiBusy('translate');
    const res = await aiTranslate({
      langs: ['en', 'es'],
      lesson: { title: form.name, blocks: form.blocks, quizzes: cleanQuizzes(form.quizzes) },
    });
    setAiBusy(null);
    if (!res.ok) return setAiError({ task: 'translate', msg: res.error });
    const { en, es } = res.data;
    setForm((f) => ({ ...f, translations: { ...f.translations, ...(en ? { en } : {}), ...(es ? { es } : {}) } }));
    toast(t('ai.translated'), 'success');
  };

  const askGenerate = () => {
    if (!form.name.trim()) {
      setAiError({ task: 'generate', msg: t('ai.needTitle') });
      return;
    }
    if (form.blocks.length || form.quizzes[0]?.q.trim()) setConfirmAi('generate');
    else void runGenerate();
  };
  const askTranslate = () => {
    if (isTranslated(form, 'en') || isTranslated(form, 'es')) setConfirmAi('translate');
    else void runTranslate();
  };

  const blockCount = form.blocks.length;
  const quizCount = cleanQuizzes(form.quizzes).length;
  const trCount = (['en', 'es'] as const).filter((l) => isTranslated(form, l)).length;

  const title = isEdit ? form.name.trim() || t('list.untitled') : t('editor.newTitle');

  return (
    <>
      <D.Root open={open} onOpenChange={(o) => (o ? undefined : requestClose())}>
        <SheetContent
          title={title}
          description={isEdit ? t('editor.editDescription', { id: form.id }) : t('editor.newDescription')}
          width="sm:max-w-5xl"
          closeLabel={tc('actions.close')}
          footer={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <SaveState dirty={dirty} blocked={blocked} isEdit={isEdit} />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={requestClose} disabled={busy}>
                  {tc('actions.close')}
                </Button>
                <Button variant="primary" onClick={() => void onSave()} loading={busy} disabled={(isEdit && !dirty) || blocked}>
                  {busy ? tc('states.saving') : t('editor.save')}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="min-w-0">
              <TabsList className="-mx-5 px-5 lg:mx-0 lg:px-0">
                <TabsTrigger value="info">{t('editor.tabs.info')}</TabsTrigger>
                <TabsTrigger value="blocks">
                  {t('editor.tabs.blocks')} <Count n={blockCount} />
                </TabsTrigger>
                <TabsTrigger value="quiz">
                  {t('editor.tabs.quiz')} <Count n={quizCount} />
                </TabsTrigger>
                <TabsTrigger value="translations">
                  {t('editor.tabs.translations')} <Count n={trCount} of={2} />
                </TabsTrigger>
                <TabsTrigger value="preview">{t('editor.tabs.preview')}</TabsTrigger>
              </TabsList>

              {/* Info */}
              <TabsContent value="info" className="flex flex-col gap-5 pt-5 focus:outline-none data-[state=inactive]:hidden">
                <Field label={t('editor.title')} error={titleError && !form.name.trim() ? t('editor.titleRequired') : undefined}>
                  <Input
                    ref={titleRef}
                    value={form.name}
                    placeholder={t('editor.titlePlaceholder')}
                    onChange={(e) => patch({ name: e.target.value })}
                    className="h-10 text-md"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t('editor.module')} hint={form.trackId ? undefined : t('editor.noModuleHint')}>
                    <NativeSelect
                      value={form.trackId ?? ''}
                      onChange={(e) => {
                        if (e.target.value === NEW_MODULE) setNewModuleOpen(true);
                        else patch({ trackId: e.target.value || null });
                      }}
                    >
                      <option value="">{t('editor.noModule')}</option>
                      {[...tracks]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.nameFr}
                          </option>
                        ))}
                      <option value={NEW_MODULE}>{t('editor.createModule')}</option>
                    </NativeSelect>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('editor.level')}>
                      <NativeSelect value={form.level} onChange={(e) => patch({ level: e.target.value as Lesson['level'] })}>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>
                            {t(`levels.${l}`, { defaultValue: l })}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label={t('editor.tag')}>
                      <NativeSelect value={form.tag} onChange={(e) => patch({ tag: e.target.value })}>
                        {[...new Set([form.tag, ...TAGS])].filter(Boolean).map((tag) => (
                          <option key={tag} value={tag}>
                            {tag}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                </div>

                <Field label={t('editor.summary')} hint={t('editor.summaryHint')}>
                  <Textarea value={form.summary ?? ''} rows={2} className="min-h-16" onChange={(e) => patch({ summary: e.target.value })} />
                </Field>

                <div className="grid grid-cols-3 gap-4">
                  <Field label={t('editor.duration')}>
                    <NativeSelect value={form.duration} onChange={(e) => patch({ duration: e.target.value })}>
                      {[...new Set([...DURATIONS, form.duration])].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label={t('editor.coins')}>
                    <NativeSelect value={form.coins} onChange={(e) => patch({ coins: Number(e.target.value) })}>
                      {[...new Set([...COIN_OPTIONS, form.coins])].sort((a, b) => a - b).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label={t('editor.xp')}>
                    <Input type="number" min={0} inputMode="numeric" value={form.xp} onChange={(e) => patch({ xp: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                </div>

                <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
                  <EmojiPicker value={form.emoji} onChange={(emoji) => patch({ emoji })} label={t('editor.emoji')} />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">{t('editor.emoji')}</span>
                    <span className="text-sm text-muted">{t('editor.emojiHint')}</span>
                  </div>
                </div>

                {blocked ? (
                  <Notice tone="danger" title={t('editor.blockedTitle')}>
                    {t('editor.blockedBody')}
                  </Notice>
                ) : null}

                <PublishPanel className="border-t border-border pt-5 lg:hidden" status={form.status} checks={checks} onStatus={(status) => patch({ status })} />
              </TabsContent>

              {/* Blocks */}
              <TabsContent value="blocks" className="flex flex-col gap-4 pt-5 focus:outline-none data-[state=inactive]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={showBlockPreview} onCheckedChange={setShowBlockPreview} />
                    {t('blocks.showPreview')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={askGenerate} loading={aiBusy === 'generate'} disabled={aiBusy !== null}>
                      {aiBusy === 'generate' ? null : <Wand2 aria-hidden />}
                      {aiBusy === 'generate' ? t('ai.generating') : t('ai.generate')}
                    </Button>
                    <AddBlockMenu onAdd={addBlock} />
                  </div>
                </div>
                <AiStatus task="generate" busy={aiBusy} error={aiError} onRetry={() => void runGenerate()} />

                {form.blocks.length === 0 ? (
                  <EmptyState title={t('blocks.emptyTitle')} description={t('blocks.emptyHelp')} action={<AddBlockMenu onAdd={addBlock} primary />} />
                ) : (
                  <>
                    <p className="text-sm text-muted">{t('blocks.markupHint')}</p>
                    {form.blocks.map((b, i) => (
                      <BlockEditor
                        key={i}
                        block={b}
                        index={i}
                        total={form.blocks.length}
                        showPreview={showBlockPreview}
                        onChange={(p) => patchBlock(i, p)}
                        onMove={(dir) => setForm((f) => ({ ...f, blocks: moveItem(f.blocks, i, dir) }))}
                        onDelete={() => setForm((f) => ({ ...f, blocks: f.blocks.filter((_, k) => k !== i) }))}
                      />
                    ))}
                    <div>
                      <AddBlockMenu onAdd={addBlock} />
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Quiz */}
              <TabsContent value="quiz" className="flex flex-col gap-4 pt-5 focus:outline-none data-[state=inactive]:hidden">
                {form.quizzes.length === 0 ? (
                  <EmptyState
                    title={t('quiz.emptyTitle')}
                    description={t('quiz.emptyHelp')}
                    action={
                      <Button variant="primary" onClick={() => patch({ quizzes: [emptyQuiz()] })}>
                        <Plus aria-hidden />
                        {t('quiz.add')}
                      </Button>
                    }
                  />
                ) : (
                  <>
                    {form.quizzes.map((q, i) => (
                      <QuizEditor
                        key={i}
                        quiz={q}
                        index={i}
                        onChange={(p) => patchQuiz(i, p)}
                        onDelete={() => setForm((f) => ({ ...f, quizzes: f.quizzes.filter((_, k) => k !== i) }))}
                      />
                    ))}
                    <Button className="self-start" onClick={() => setForm((f) => ({ ...f, quizzes: [...f.quizzes, emptyQuiz()] }))}>
                      <Plus aria-hidden />
                      {t('quiz.add')}
                    </Button>
                  </>
                )}
              </TabsContent>

              {/* Translations */}
              <TabsContent value="translations" className="flex flex-col gap-5 pt-5 focus:outline-none data-[state=inactive]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-lg text-sm text-muted">{t('translations.intro')}</p>
                  <Button onClick={askTranslate} loading={aiBusy === 'translate'} disabled={aiBusy !== null || !hasContent(form)}>
                    {aiBusy === 'translate' ? null : <Languages aria-hidden />}
                    {aiBusy === 'translate' ? t('ai.translating') : t('ai.translate')}
                  </Button>
                </div>
                {!hasContent(form) ? <Notice tone="info">{t('ai.needContent')}</Notice> : null}
                <AiStatus task="translate" busy={aiBusy} error={aiError} onRetry={() => void runTranslate()} />
                {(['en', 'es'] as const).map((lang) => (
                  <TranslationSection
                    key={lang}
                    lang={lang}
                    lesson={form}
                    onPatch={(p) => patchTranslation(lang, p)}
                  />
                ))}
              </TabsContent>

              {/* Preview */}
              <TabsContent value="preview" className="pt-5 focus:outline-none data-[state=inactive]:hidden">
                <p className="mb-4 flex items-center gap-2 text-sm text-muted">
                  <Eye aria-hidden className="size-4" />
                  {t('editor.previewHint')}
                </p>
                {tab === 'preview' ? (
                  <LessonPreview lesson={form} track={tracks.find((tr) => tr.id === form.trackId) ?? null} />
                ) : null}
              </TabsContent>
            </Tabs>

            <aside className="hidden lg:block">
              <div className="sticky top-0">
                <PublishPanel status={form.status} checks={checks} onStatus={(status) => patch({ status })} />
              </div>
            </aside>
          </div>
        </SheetContent>
      </D.Root>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title={t('editor.unsavedTitle')}
        description={t('editor.unsavedBody')}
        confirmLabel={t('editor.discard')}
        cancelLabel={t('editor.keepEditing')}
        destructive
        onConfirm={() => {
          setConfirmClose(false);
          close();
        }}
      />

      <ConfirmDialog
        open={confirmAi !== null}
        onOpenChange={(o) => !o && setConfirmAi(null)}
        title={confirmAi === 'translate' ? t('ai.replaceTranslationsTitle') : t('ai.replaceContentTitle')}
        description={confirmAi === 'translate' ? t('ai.replaceTranslationsBody') : t('ai.replaceContentBody')}
        confirmLabel={t('ai.replace')}
        cancelLabel={tc('actions.cancel')}
        onConfirm={() => {
          const task = confirmAi;
          setConfirmAi(null);
          if (task === 'generate') void runGenerate();
          if (task === 'translate') void runTranslate();
        }}
      />

      <NewModuleDialog
        open={newModuleOpen}
        onOpenChange={setNewModuleOpen}
        level={form.level}
        onCreated={(id) => patch({ trackId: id })}
      />
    </>
  );
}

function Count({ n, of }: { n: number; of?: number }) {
  return (
    <span className="tabular ml-1 rounded-full bg-surface-2 px-1.5 text-xs text-muted">
      {of ? `${n}/${of}` : n}
    </span>
  );
}

function SaveState({ dirty, blocked, isEdit }: { dirty: boolean; blocked: boolean; isEdit: boolean }) {
  const { t } = useTranslation('lessons');
  if (blocked)
    return (
      <p className="flex items-center gap-2 text-sm text-danger">
        <AlertTriangle aria-hidden className="size-4 shrink-0" />
        {t('editor.saveBlocked')}
      </p>
    );
  if (dirty)
    return (
      <p className="flex items-center gap-2 text-sm text-warning">
        <span aria-hidden className="size-2 rounded-full bg-warning" />
        {t('editor.unsaved')}
      </p>
    );
  if (isEdit)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <CheckCircle2 aria-hidden className="size-4 text-success" />
        {t('editor.allSaved')}
      </p>
    );
  return <span />;
}

function AddBlockMenu({ onAdd, primary }: { onAdd: (type: BlockType) => void; primary?: boolean }) {
  const { t } = useTranslation('lessons');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant={primary ? 'primary' : 'secondary'}>
          <Plus aria-hidden />
          {t('blocks.add')}
        </Button>
      </MenuTrigger>
      <MenuContent align="end" className="w-72">
        {BLOCK_TYPES.map((bt) => {
          const Icon = blockStyle(bt).icon;
          return (
            <MenuItem key={bt} icon={<Icon className={blockStyle(bt).text} />} onSelect={() => onAdd(bt)}>
              <span className="flex flex-col">
                <span>{t(`blocks.types.${bt}`)}</span>
                <span className="text-sm text-muted">{t(`blocks.help.${bt}`)}</span>
              </span>
            </MenuItem>
          );
        })}
      </MenuContent>
    </Menu>
  );
}

function AiStatus({
  task,
  busy,
  error,
  onRetry,
}: {
  task: AiTask;
  busy: AiTask | null;
  error: { task: AiTask; msg: string } | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  if (busy === task) return <Notice tone="info">{t(task === 'generate' ? 'ai.generatingHelp' : 'ai.translatingHelp')}</Notice>;
  if (error?.task === task)
    return (
      <Notice
        tone="danger"
        title={t(task === 'generate' ? 'ai.generateFailed' : 'ai.translateFailed')}
        action={
          error.msg !== t('ai.needTitle') ? (
            <Button size="sm" onClick={onRetry}>
              {tc('actions.retry')}
            </Button>
          ) : undefined
        }
      >
        {error.msg}
      </Notice>
    );
  return null;
}

function TranslationSection({
  lang,
  lesson,
  onPatch,
}: {
  lang: 'en' | 'es';
  lesson: Lesson;
  onPatch: (p: Partial<Translation> | null) => void;
}) {
  const { t } = useTranslation('lessons');
  const tr = lesson.translations?.[lang];
  const present = isTranslated(lesson, lang);
  // A translation with only a title: kept editable, but it does not count as translated.
  const exists = !!tr && (!!tr.title?.trim() || !!tr.blocks?.length || !!tr.quizzes?.length);
  const name = t(`langs.${lang}`);
  const blocks = tr?.blocks ?? [];
  const outOfSync = present && blocks.length > 0 && blocks.length !== lesson.blocks.length;
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <section className="rounded-md border border-border" aria-label={name}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-md font-semibold">{name}</h3>
          {present ? (
            <Badge tone="success">{t('translations.present')}</Badge>
          ) : exists ? (
            <Badge tone="warning">{t('translations.partial')}</Badge>
          ) : (
            <Badge>{t('translations.missing')}</Badge>
          )}
        </div>
        {exists ? (
          <IconButton
            size="icon-sm"
            className="size-10 text-danger sm:size-8"
            label={t('translations.remove', { lang: name })}
            icon={<Trash2 />}
            onClick={() => setConfirmRemove(true)}
          />
        ) : null}
      </header>
      <div className="flex flex-col gap-4 p-4">
        {!exists ? (
          <p className="text-sm text-muted">{t('translations.none', { lang: name })}</p>
        ) : (
          <>
            {!present ? <Notice tone="warning">{t('translations.partialHelp')}</Notice> : null}
            {outOfSync ? (
              <Notice tone="warning">{t('translations.outOfSync', { fr: lesson.blocks.length, n: blocks.length })}</Notice>
            ) : null}
            <Field label={t('translations.title')}>
              <Input value={tr?.title ?? ''} onChange={(e) => onPatch({ title: e.target.value })} />
            </Field>
            {blocks.map((b, i) => (
              <Field key={i} label={t('translations.block', { n: i + 1, type: t(`blocks.types.${b.type}`, { defaultValue: b.type }) })}>
                <Textarea
                  rows={3}
                  className={cn('min-h-20 border-l-4', blockStyle(b.type).accent)}
                  value={b.text}
                  onChange={(e) => onPatch({ blocks: blocks.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })}
                />
              </Field>
            ))}
            <p className="text-sm text-muted">{t('translations.quizCount', { count: tr?.quizzes?.length ?? 0 })}</p>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t('translations.removeTitle', { lang: name })}
        description={t('translations.removeBody')}
        confirmLabel={t('translations.removeConfirm')}
        cancelLabel={t('editor.keepEditing')}
        destructive
        onConfirm={() => {
          setConfirmRemove(false);
          onPatch(null);
        }}
      />
    </section>
  );
}

function NewModuleDialog({
  open,
  onOpenChange,
  level,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  level: Lesson['level'];
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const saveTrack = useCorpus((s) => s.saveTrack);
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDomainId('');
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    const n = name.trim();
    const id = slugify(n);
    if (!n || !id) return setError(t('newModule.nameRequired'));
    if (tracks.some((tr) => tr.id === id)) return setError(t('newModule.exists'));
    setBusy(true);
    const saved = await saveTrack({ id, emoji: '📚', nameFr: n, level, sortOrder: tracks.length, domainId: domainId || null });
    setBusy(false);
    if (saved) {
      toast(t('newModule.created', { name: saved.nameFr }), 'success');
      onCreated(saved.id);
      onOpenChange(false);
    }
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('newModule.title')}
        description={t('newModule.description')}
        closeLabel={tc('actions.close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('actions.cancel')}
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void submit()}>
              {t('newModule.submit')}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label={t('newModule.name')} error={error ?? undefined}>
            <Input value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('newModule.domain')}>
            <NativeSelect value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              <option value="">{t('newModule.noDomain')}</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </form>
      </DialogContent>
    </D.Root>
  );
}
