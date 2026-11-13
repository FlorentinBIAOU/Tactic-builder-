import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookMarked,
  Check,
  ExternalLink,
  FileUp,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  WandSparkles,
} from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { corpusErrorMessage, isSafeUrl, uploadResourceFile } from '@/lib/corpus';
import { aiSyllabusLessons, type LessonIdea } from '@/lib/ai';
import { SYLLABUS_TOTALS } from '@/lib/syllabus';
import { LEVELS, type Level, type Resource } from '@/lib/types';
import { toast } from '@/components/Toast';
import { Button, buttonVariants, IconButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Panel } from '@/components/ui/page';
import { fmtDate, fmtInt } from '@/components/ui/chart';
import { FormDialog } from '@/features/structure/FormDialog';
import { checkFile, hostOf } from './kinds';

/** Same key as the former Content screen, so pasted notes are kept. */
const NOTES_KEY = 'tactic.syllabus.notes';

const readNotes = () => {
  try {
    return localStorage.getItem(NOTES_KEY) ?? '';
  } catch {
    return '';
  }
};

// ─── Set / replace the syllabus document ───────────────────────────────────

function SyllabusDialog({
  open,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  current: Resource | null;
  onClose: () => void;
  onSave: (title: string, url: string) => Promise<boolean>;
}) {
  const { t } = useTranslation('library');
  const initialTitle = current?.title ?? t('syllabus.defaultTitle');
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(current?.title ?? t('syllabus.defaultTitle'));
      setUrl('');
      setError(null);
    }
  }, [open, current, t]);

  const upload = async (file: File) => {
    const check = checkFile(file);
    if (check !== 'ok') return setError(t(`upload.${check}`, { name: file.name }));
    setUploading(true);
    try {
      setUrl(await uploadResourceFile(file));
      setError(null);
    } catch (e) {
      setError(`${t('upload.failed')} ${corpusErrorMessage(e)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    const u = url.trim();
    if (!u) return setError(t('form.urlRequired'));
    if (!isSafeUrl(u)) return setError(t('form.urlInvalid'));
    setBusy(true);
    const ok = await onSave(title.trim() || t('syllabus.defaultTitle'), u);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      dirty={url.trim() !== '' || title !== initialTitle}
      busy={busy || uploading}
      title={current ? t('syllabus.formTitleEdit') : t('syllabus.formTitleNew')}
      description={current ? t('syllabus.formDescription') : undefined}
      submitLabel={t('syllabus.save')}
      onSubmit={() => void submit()}
    >
      <Field label={t('syllabus.formTitle')}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field
        label={t('syllabus.formUrl')}
        hint={t('syllabus.formUrlHint')}
        error={error ?? undefined}
      >
        <Input
          type="url"
          inputMode="url"
          autoFocus
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setError(null);
            setUrl(e.target.value);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.md"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        <Button
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp aria-hidden />
          {t('syllabus.uploadPdf')}
        </Button>
        <span className="text-sm text-muted">{t('upload.hint')}</span>
      </div>
    </FormDialog>
  );
}

// ─── Lesson ideas from pasted syllabus text ────────────────────────────────

function GenerateSheet({
  open,
  onOpenChange,
  ideas,
  setIdeas,
  opened,
  onOpenIdea,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  ideas: LessonIdea[] | null;
  setIdeas: (ideas: LessonIdea[]) => void;
  opened: Set<string>;
  onOpenIdea: (idea: LessonIdea, level: Level) => void;
}) {
  const { t } = useTranslation(['library', 'common']);
  const lessons = useCorpus((s) => s.lessons);
  const [notes, setNotes] = useState(readNotes);
  const [level, setLevel] = useState<Level>('Intermédiaire');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveNotes = (v: string) => {
    setNotes(v);
    try {
      localStorage.setItem(NOTES_KEY, v);
    } catch {
      /* kept in memory only */
    }
  };

  const generate = async () => {
    const text = notes.trim();
    if (!text) return setError(t('generate.textRequired'));
    setError(null);
    setBusy(true);
    const res = await aiSyllabusLessons({
      level,
      syllabus: text,
      existing: lessons.map((l) => l.name),
    });
    setBusy(false);
    if (!res.ok) return setError(t('generate.failed', { error: res.error }));
    setIdeas(res.data.ideas ?? []);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={t('generate.title')}
        description={t('generate.description')}
        width="sm:max-w-2xl"
        closeLabel={t('common:actions.close')}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void generate();
          }}
        >
          <Field label={t('generate.text')} hint={t('generate.textHint')}>
            <Textarea
              rows={8}
              className="min-h-40"
              placeholder={t('generate.textPlaceholder')}
              value={notes}
              onChange={(e) => {
                setError(null);
                saveNotes(e.target.value);
              }}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('generate.level')} className="w-48">
              <NativeSelect value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {t(`levels.${l}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              <WandSparkles aria-hidden />
              {t('generate.submit')}
            </Button>
          </div>
        </form>

        {error ? (
          <Notice tone="danger" className="mt-4">
            {error}
          </Notice>
        ) : null}

        <div className="mt-6" aria-live="polite" aria-busy={busy}>
          {busy ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t('generate.running')}</p>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : ideas && ideas.length === 0 ? (
            <EmptyState title={t('generate.none')} />
          ) : ideas ? (
            <>
              <div className="mb-3 flex flex-col gap-0.5">
                <h3 className="text-md font-semibold">
                  {t('generate.results', { count: ideas.length })}
                </h3>
                <p className="text-sm text-muted">{t('generate.resultsHint')}</p>
              </div>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {ideas.map((idea, i) => {
                  const done = opened.has(idea.name);
                  return (
                    <li
                      key={`${idea.name}-${i}`}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{idea.name}</span>
                          {idea.tag ? <Badge>{idea.tag}</Badge> : null}
                          {done ? (
                            <Badge tone="success">
                              <Check aria-hidden className="size-3" />
                              {t('generate.opened')}
                            </Badge>
                          ) : null}
                        </div>
                        {idea.summary ? (
                          <p className="text-sm text-foreground/90">{idea.summary}</p>
                        ) : null}
                        {idea.why ? (
                          <p className="text-sm text-muted">
                            <span className="font-medium">{t('generate.why')} : </span>
                            {idea.why}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={done ? 'ghost' : 'outline'}
                        className="max-sm:h-10 sm:shrink-0"
                        onClick={() => onOpenIdea(idea, level)}
                      >
                        {t('generate.openInEditor')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Dialog>
  );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

/** The reference syllabus document and lesson generation from it. */
export function SyllabusPanel({
  loading,
  syllabus,
  onSave,
  onRemove,
}: {
  loading: boolean;
  syllabus: Resource | null;
  onSave: (title: string, url: string) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useTranslation(['library', 'common']);
  const openEditor = useCorpus((s) => s.openEditor);
  const [dialog, setDialog] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [ideas, setIdeas] = useState<LessonIdea[] | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());

  const openIdea = (idea: LessonIdea, level: Level) => {
    setSheet(false);
    setOpened((s) => new Set(s).add(idea.name));
    // Same draft as the former Content screen; the editor gives it an id on save.
    openEditor({
      id: '',
      trackId: null,
      emoji: idea.emoji || '📖',
      name: idea.name,
      duration: '1 min',
      coins: 80,
      xp: 60,
      tag: idea.tag || 'Core',
      level,
      summary: idea.summary,
      blocks: [],
      quizzes: [{ q: '', opts: ['', '', '', ''], correct: 0, expl: '' }],
      translations: {},
      status: 'draft',
    });
    toast(t('generate.editorOpened'), 'info');
  };

  const safe = syllabus ? isSafeUrl(syllabus.url) : false;

  return (
    <Panel
      title={t('syllabus.title')}
      description={t('syllabus.description')}
      className="mb-8"
      actions={
        <Button variant="outline" size="sm" className="max-sm:h-10" onClick={() => setSheet(true)}>
          <WandSparkles aria-hidden />
          {t('syllabus.generate')}
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ) : syllabus ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand"
            >
              <BookMarked className="size-5" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{syllabus.title}</span>
              <span className="truncate text-sm text-muted">
                {hostOf(syllabus.url)}
                {syllabus.createdAt ? `, ${fmtDate(syllabus.createdAt)}` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {safe ? (
              <a
                href={syllabus.url}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(buttonVariants({ size: 'sm' }), 'max-sm:h-10')}
              >
                <ExternalLink aria-hidden />
                {t('syllabus.open')}
              </a>
            ) : (
              <Badge tone="danger">{t('table.invalidLink')}</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="max-sm:h-10"
              onClick={() => setDialog(true)}
            >
              <RefreshCw aria-hidden />
              {t('syllabus.replace')}
            </Button>
            <Menu>
              <MenuTrigger asChild>
                <IconButton
                  size="icon-sm"
                  className="max-sm:size-10"
                  label={t('common:actions.more')}
                  icon={<MoreHorizontal />}
                />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Trash2 />} destructive onSelect={() => setConfirmRemove(true)}>
                  {t('syllabus.remove')}
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{t('syllabus.none')}</span>
            <span className="text-sm text-muted">{t('syllabus.noneHint')}</span>
          </div>
          <Button size="sm" className="max-sm:h-10" onClick={() => setDialog(true)}>
            <BookMarked aria-hidden />
            {t('syllabus.define')}
          </Button>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
        {t('syllabus.importFull', {
          domains: fmtInt(SYLLABUS_TOTALS.domains),
          modules: fmtInt(SYLLABUS_TOTALS.modules),
          lessons: fmtInt(SYLLABUS_TOTALS.lessons),
        })}{' '}
        <Link to="/import-export" className="text-brand underline-offset-4 hover:underline">
          {t('syllabus.importLink')}
        </Link>
        .
      </p>

      <SyllabusDialog
        open={dialog}
        current={syllabus}
        onClose={() => setDialog(false)}
        onSave={onSave}
      />
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t('syllabus.removeTitle')}
        description={t('syllabus.removeBody', { title: syllabus?.title ?? '' })}
        confirmLabel={t('syllabus.removeConfirm')}
        cancelLabel={t('common:actions.cancel')}
        destructive
        onConfirm={() => void onRemove()}
      />
      <GenerateSheet
        open={sheet}
        onOpenChange={setSheet}
        ideas={ideas}
        setIdeas={setIdeas}
        opened={opened}
        onOpenIdea={openIdea}
      />
    </Panel>
  );
}
