import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderInput,
  FolderTree,
  FolderX,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import type { Domain, Track } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button, buttonVariants, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel, Stat } from '@/components/ui/page';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fmtInt, fmtPct } from '@/components/ui/chart';
import { DomainDialog, ModuleDialog, MoveDialog } from './dialogs';
import {
  buildTree,
  domainMark,
  matches,
  reorder,
  type LessonCount,
  type ModuleNode,
} from './model';

const COLLAPSED_KEY = 'tactic.structure.collapsed';
/** Placeholder id for the "No domain" group (collapse state only). */
const LOOSE = '__loose__';

function readCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

type DialogState =
  | { kind: 'domain'; domain: Domain | null }
  | { kind: 'module'; track: Track | null; domainId?: string | null }
  | { kind: 'move'; track: Track }
  | { kind: 'deleteDomain'; domain: Domain; modules: number }
  | { kind: 'deleteModule'; track: Track; lessons: number };

/** Lessons count plus a small published bar. Status is spelled out, not only coloured. */
function Progress({ count, className }: { count: LessonCount; className?: string }) {
  const { t } = useTranslation('structure');
  const pct = count.total ? count.published / count.total : 0;
  return (
    <div className={cn('flex items-center gap-3 text-sm text-muted', className)}>
      <span className="tabular whitespace-nowrap text-foreground">
        {t('count.lessons', { count: count.total })}
      </span>
      {count.total > 0 ? (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="hidden h-1.5 w-14 overflow-hidden min-[420px]:block rounded-full bg-surface-2"
          >
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${pct * 100}%` }}
            />
          </span>
          <span className="tabular whitespace-nowrap">
            {t('count.published', { count: count.published, total: count.total })}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function OrderButtons({
  name,
  index,
  size,
  onMove,
}: {
  name: string;
  index: number;
  size: number;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation('structure');
  return (
    <div className="hidden items-center sm:flex">
      <IconButton
        size="icon-sm"
        label={t('actions.moveUpNamed', { name })}
        icon={<ArrowUp />}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <IconButton
        size="icon-sm"
        label={t('actions.moveDownNamed', { name })}
        icon={<ArrowDown />}
        disabled={index === size - 1}
        onClick={() => onMove(1)}
      />
    </div>
  );
}

function ModuleRow({
  node,
  mark,
  index,
  size,
  onMove,
  onEdit,
  onChangeDomain,
  onDelete,
}: {
  node: ModuleNode;
  /** Sober position marker, e.g. "A3" (domain letter + rank). */
  mark: string;
  index: number;
  size: number;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onChangeDomain: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('structure');
  const { track, count } = node;
  return (
    <li className="group flex flex-col gap-2 py-3 pl-4 pr-3 hover:bg-surface-2/40 sm:flex-row sm:items-center sm:gap-4 sm:pl-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden
          className="tabular mt-0.5 flex h-6 min-w-8 shrink-0 items-center justify-center rounded border border-border px-1.5 text-xs font-semibold text-muted"
        >
          {mark}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="text-left font-medium text-foreground hover:text-brand hover:underline hover:underline-offset-4"
            >
              {track.nameFr}
            </button>
            {track.theme ? (
              <Badge tone="info" title={t('tree.themeLabel')}>
                <Tag aria-hidden className="size-3" />
                <span className="sr-only">{t('tree.themeLabel')} : </span>
                {track.theme}
              </Badge>
            ) : null}
          </div>
          <p className={cn('text-sm', track.coreQuestion ? 'text-muted' : 'italic text-muted')}>
            {track.coreQuestion || t('tree.noQuestion')}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pl-11 sm:justify-end sm:pl-0">
        <Progress count={count} className="sm:w-60" />
        <div className="flex items-center gap-1">
          <Link
            to={`/lessons?module=${encodeURIComponent(track.id)}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'max-sm:h-10')}
          >
            <BookOpenText aria-hidden />
            <span className="hidden md:inline">{t('actions.viewLessons')}</span>
            <span className="sr-only md:hidden">{t('actions.viewLessons')}</span>
          </Link>
          <OrderButtons name={track.nameFr} index={index} size={size} onMove={onMove} />
          <Menu>
            <MenuTrigger asChild>
              <IconButton
                size="icon-sm"
                className="max-sm:size-10"
                label={t('actions.moduleActions', { name: track.nameFr })}
                icon={<MoreHorizontal />}
              />
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={onEdit}>
                {t('actions.editModule')}
              </MenuItem>
              <MenuItem icon={<FolderInput />} onSelect={onChangeDomain}>
                {t('actions.changeDomain')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<ArrowUp />} onSelect={index > 0 ? () => onMove(-1) : undefined}>
                {t('actions.moveUp')}
              </MenuItem>
              <MenuItem
                icon={<ArrowDown />}
                onSelect={index < size - 1 ? () => onMove(1) : undefined}
              >
                {t('actions.moveDown')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} destructive onSelect={onDelete}>
                {t('actions.deleteModule')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    </li>
  );
}

/** One collapsible group of the tree (a domain, or "No domain"). */
function Group({
  id,
  open,
  onToggle,
  icon,
  iconLabel,
  title,
  subtitle,
  meta,
  actions,
  dashed,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  /** Spoken name of the icon when it carries meaning (domain letter). */
  iconLabel?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta: ReactNode;
  actions?: ReactNode;
  dashed?: boolean;
  children: ReactNode;
}) {
  const bodyId = `group-${id}`;
  return (
    <section
      className={cn(
        'rounded-lg border bg-surface',
        dashed ? 'border-dashed border-input/60' : 'border-border'
      )}
      aria-labelledby={`${bodyId}-title`}
    >
      <div className="flex items-start gap-2 px-3 py-3 sm:items-center sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-10 min-w-0 flex-1 items-start gap-3 rounded text-left sm:items-center"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'mt-2 size-4 shrink-0 text-muted transition-transform duration-fast sm:mt-0',
              open && 'rotate-90'
            )}
          />
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-base text-brand [&_svg]:size-4"
          >
            {icon}
          </span>
          {iconLabel ? <span className="sr-only">{iconLabel}</span> : null}
          <span className="flex min-w-0 flex-col">
            <span id={`${bodyId}-title`} className="text-md font-semibold text-foreground">
              {title}
            </span>
            {subtitle ? <span className="text-sm text-muted">{subtitle}</span> : null}
            <span className="mt-1 sm:hidden">{meta}</span>
          </span>
        </button>
        <div className="hidden shrink-0 sm:block">{meta}</div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {open ? (
        <div id={bodyId} className="border-t border-border">
          {children}
        </div>
      ) : null}
    </section>
  );
}

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>
          {i === 0 ? (
            <div className="mt-4 flex flex-col gap-3 pl-12">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Domain → Module → Lesson tree: add, edit, move, reorder, delete. */
export default function StructureView() {
  const { t } = useTranslation(['structure', 'common']);
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const domains = useCorpus((s) => s.domains);
  const tracks = useCorpus((s) => s.tracks);
  const lessons = useCorpus((s) => s.lessons);
  const saveDomain = useCorpus((s) => s.saveDomain);
  const saveTrack = useCorpus((s) => s.saveTrack);
  const deleteDomain = useCorpus((s) => s.deleteDomain);
  const deleteTrack = useCorpus((s) => s.deleteTrack);

  const [q, setQ] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {
      /* per-viewer convenience only */
    }
  }, [collapsed]);

  const tree = useMemo(() => buildTree(domains, tracks, lessons), [domains, tracks, lessons]);

  const filtering = q.trim().length > 0;
  const keep = (m: ModuleNode) =>
    matches(q, m.track.nameFr, m.track.nameEn, m.track.coreQuestion, m.track.theme);
  const visibleDomains = filtering
    ? tree.domains
        .map((d) => (matches(q, d.domain.name) ? d : { ...d, modules: d.modules.filter(keep) }))
        .filter((d) => d.modules.length > 0 || matches(q, d.domain.name))
    : tree.domains;
  const visibleLoose = filtering ? tree.looseModules.filter(keep) : tree.looseModules;
  const isOpen = (id: string) => filtering || !collapsed.has(id);
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allIds = [...tree.domains.map((d) => d.domain.id), LOOSE];
  const allCollapsed = allIds.every((id) => collapsed.has(id));

  const openDialog = (d: DialogState) => {
    setDialog(d);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const moveDomain = async (index: number, dir: -1 | 1) => {
    const group = tree.domains.map((d) => d.domain);
    const changes = reorder(group, index, dir);
    for (const c of changes) {
      const d = group.find((x) => x.id === c.id);
      if (d && !(await saveDomain({ ...d, sortOrder: c.sortOrder }))) return;
    }
    if (changes.length)
      setAnnounce(t('tree.position', { name: group[index].name, pos: index + dir + 1 }));
  };

  const moveModule = async (group: ModuleNode[], index: number, dir: -1 | 1) => {
    const list = group.map((m) => m.track);
    const changes = reorder(list, index, dir);
    for (const c of changes) {
      const tr = list.find((x) => x.id === c.id);
      if (tr && !(await saveTrack({ ...tr, sortOrder: c.sortOrder }))) return;
    }
    if (changes.length)
      setAnnounce(t('tree.position', { name: list[index].nameFr, pos: index + dir + 1 }));
  };

  const moduleRows = (group: ModuleNode[], fullGroup: ModuleNode[], prefix: string) => (
    <ul className="divide-y divide-border">
      {group.map((m) => {
        const index = fullGroup.findIndex((x) => x.track.id === m.track.id);
        return (
          <ModuleRow
            key={m.track.id}
            node={m}
            mark={`${prefix}${index + 1}`}
            index={index}
            size={fullGroup.length}
            onMove={(dir) => void moveModule(fullGroup, index, dir)}
            onEdit={() => openDialog({ kind: 'module', track: m.track })}
            onChangeDomain={() => openDialog({ kind: 'move', track: m.track })}
            onDelete={() =>
              openDialog({ kind: 'deleteModule', track: m.track, lessons: m.count.total })
            }
          />
        );
      })}
    </ul>
  );

  const header = (
    <PageHeader
      title={t('title')}
      description={t('description')}
      actions={
        <>
          <Button onClick={() => openDialog({ kind: 'module', track: null })} disabled={!loaded}>
            <Plus aria-hidden />
            {t('actions.addModule')}
          </Button>
          <Button
            variant="primary"
            onClick={() => openDialog({ kind: 'domain', domain: null })}
            disabled={!loaded}
          >
            <Plus aria-hidden />
            {t('actions.addDomain')}
          </Button>
        </>
      }
    />
  );

  const dialogs = (
    <>
      <DomainDialog
        open={dialogOpen && dialog?.kind === 'domain'}
        domain={dialog?.kind === 'domain' ? dialog.domain : null}
        onClose={closeDialog}
      />
      <ModuleDialog
        open={dialogOpen && dialog?.kind === 'module'}
        track={dialog?.kind === 'module' ? dialog.track : null}
        defaultDomainId={dialog?.kind === 'module' ? dialog.domainId : null}
        onClose={closeDialog}
      />
      <MoveDialog
        open={dialogOpen && dialog?.kind === 'move'}
        track={dialog?.kind === 'move' ? dialog.track : null}
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialogOpen && dialog?.kind === 'deleteDomain'}
        onOpenChange={(o) => !o && closeDialog()}
        title={
          dialog?.kind === 'deleteDomain'
            ? t('deleteDomain.title', { name: dialog.domain.name })
            : ''
        }
        description={
          dialog?.kind === 'deleteDomain'
            ? dialog.modules
              ? t('deleteDomain.body', { count: dialog.modules })
              : t('deleteDomain.bodyEmpty')
            : ''
        }
        confirmLabel={t('deleteDomain.confirm')}
        cancelLabel={t('common:actions.cancel')}
        destructive
        onConfirm={() => {
          if (dialog?.kind === 'deleteDomain') void deleteDomain(dialog.domain.id);
          closeDialog();
        }}
      />
      <ConfirmDialog
        open={dialogOpen && dialog?.kind === 'deleteModule'}
        onOpenChange={(o) => !o && closeDialog()}
        title={
          dialog?.kind === 'deleteModule'
            ? t('deleteModule.title', { name: dialog.track.nameFr })
            : ''
        }
        description={
          dialog?.kind === 'deleteModule' ? (
            <>
              {dialog.lessons
                ? t('deleteModule.body', { count: dialog.lessons })
                : t('deleteModule.bodyEmpty')}{' '}
              {t('deleteModule.resources')}
            </>
          ) : (
            ''
          )
        }
        confirmLabel={t('deleteModule.confirm')}
        cancelLabel={t('common:actions.cancel')}
        destructive
        onConfirm={() => {
          if (dialog?.kind === 'deleteModule') void deleteTrack(dialog.track.id);
          closeDialog();
        }}
      />
    </>
  );

  if (!loaded) {
    return (
      <>
        {header}
        {loadError && !loading ? (
          <Notice
            tone="danger"
            title={t('error.title')}
            action={
              <Button size="sm" onClick={() => void load()}>
                {t('common:actions.retry')}
              </Button>
            }
          >
            {t('error.body')} <span className="text-muted">({loadError})</span>
          </Notice>
        ) : (
          <TreeSkeleton />
        )}
      </>
    );
  }

  if (tree.domains.length === 0 && tree.looseModules.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<FolderTree />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <>
              <Button
                variant="primary"
                onClick={() => openDialog({ kind: 'domain', domain: null })}
              >
                <Plus aria-hidden />
                {t('actions.addDomain')}
              </Button>
              <Link to="/import-export" className={buttonVariants()}>
                {t('empty.import')}
              </Link>
            </>
          }
        />
        {tree.looseLessons > 0 ? <LooseLessons count={tree.looseLessons} className="mt-4" /> : null}
        {dialogs}
      </>
    );
  }

  const pubRate = tree.totals.lessons ? tree.totals.published / tree.totals.lessons : 0;
  const noMatch = filtering && visibleDomains.length === 0 && visibleLoose.length === 0;

  return (
    <>
      {header}

      <Panel className="mb-6" bodyClassName="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label={t('stats.domains')} value={fmtInt(tree.totals.domains)} />
        <Stat label={t('stats.modules')} value={fmtInt(tree.totals.modules)} />
        <Stat label={t('stats.lessons')} value={fmtInt(tree.totals.lessons)} />
        <Stat
          label={t('stats.published')}
          value={fmtPct(pubRate)}
          hint={t('stats.publishedHint', {
            published: fmtInt(tree.totals.published),
            total: fmtInt(tree.totals.lessons),
          })}
        />
      </Panel>

      {tree.looseModules.length > 0 || tree.looseLessons > 0 ? (
        <Notice tone="warning" title={t('orphans.notice')} className="mb-6">
          <ul className="flex flex-col">
            {tree.looseModules.length > 0 ? (
              <li>{t('orphans.modules', { count: tree.looseModules.length })}</li>
            ) : null}
            {tree.looseLessons > 0 ? (
              <li>{t('orphans.lessons', { count: tree.looseLessons })}</li>
            ) : null}
          </ul>
        </Notice>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            aria-label={t('filter.label')}
            placeholder={t('filter.placeholder')}
            className="pl-9 max-sm:h-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          className="max-sm:h-10"
          disabled={filtering}
          onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allIds))}
        >
          {allCollapsed ? <ChevronsUpDown aria-hidden /> : <ChevronsDownUp aria-hidden />}
          {allCollapsed ? t('actions.expandAll') : t('actions.collapseAll')}
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {noMatch ? (
        <EmptyState
          icon={<Search />}
          title={t('filter.noMatch', { q: q.trim() })}
          action={
            <Button onClick={() => setQ('')}>
              <X aria-hidden />
              {t('filter.clear')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleDomains.map((node) => {
            const d = node.domain;
            const index = tree.domains.findIndex((x) => x.domain.id === d.id);
            const full = tree.domains[index];
            return (
              <Group
                key={d.id}
                id={d.id}
                open={isOpen(d.id)}
                onToggle={() => toggle(d.id)}
                icon={<span className="font-semibold">{domainMark(d)}</span>}
                iconLabel={t('tree.domainMark', { code: domainMark(d) })}
                title={d.name}
                subtitle={d.objective}
                meta={
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="tabular whitespace-nowrap text-sm text-muted">
                      {t('count.modules', { count: full.modules.length })}
                    </span>
                    <Progress count={full.count} />
                  </div>
                }
                actions={
                  <>
                    <OrderButtons
                      name={d.name}
                      index={index}
                      size={tree.domains.length}
                      onMove={(dir) => void moveDomain(index, dir)}
                    />
                    <Menu>
                      <MenuTrigger asChild>
                        <IconButton
                          size="icon-sm"
                          className="max-sm:size-10"
                          label={t('actions.domainActions', { name: d.name })}
                          icon={<MoreHorizontal />}
                        />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          icon={<Pencil />}
                          onSelect={() => openDialog({ kind: 'domain', domain: d })}
                        >
                          {t('actions.editDomain')}
                        </MenuItem>
                        <MenuItem
                          icon={<Plus />}
                          onSelect={() =>
                            openDialog({ kind: 'module', track: null, domainId: d.id })
                          }
                        >
                          {t('actions.addModuleHere')}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                          icon={<ArrowUp />}
                          onSelect={index > 0 ? () => void moveDomain(index, -1) : undefined}
                        >
                          {t('actions.moveUp')}
                        </MenuItem>
                        <MenuItem
                          icon={<ArrowDown />}
                          onSelect={
                            index < tree.domains.length - 1
                              ? () => void moveDomain(index, 1)
                              : undefined
                          }
                        >
                          {t('actions.moveDown')}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem
                          icon={<Trash2 />}
                          destructive
                          onSelect={() =>
                            openDialog({
                              kind: 'deleteDomain',
                              domain: d,
                              modules: full.modules.length,
                            })
                          }
                        >
                          {t('actions.deleteDomain')}
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </>
                }
              >
                {node.modules.length ? (
                  moduleRows(node.modules, full.modules, domainMark(d))
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:pl-6">
                    <p className="text-sm text-muted">{t('tree.emptyDomain')}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-sm:h-10"
                      onClick={() => openDialog({ kind: 'module', track: null, domainId: d.id })}
                    >
                      <Plus aria-hidden />
                      {t('actions.addModule')}
                    </Button>
                  </div>
                )}
              </Group>
            );
          })}

          {visibleLoose.length > 0 ? (
            <Group
              id={LOOSE}
              dashed
              open={isOpen(LOOSE)}
              onToggle={() => toggle(LOOSE)}
              icon={<FolderX />}
              title={t('orphans.noDomain')}
              subtitle={t('orphans.noDomainHint')}
              meta={
                <span className="tabular whitespace-nowrap text-sm text-muted">
                  {t('count.modules', { count: tree.looseModules.length })}
                </span>
              }
            >
              {moduleRows(visibleLoose, tree.looseModules, '')}
            </Group>
          ) : null}

          {tree.looseLessons > 0 && !filtering ? <LooseLessons count={tree.looseLessons} /> : null}
        </div>
      )}

      {dialogs}
    </>
  );
}

function LooseLessons({ count, className }: { count: number; className?: string }) {
  const { t } = useTranslation('structure');
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-dashed border-input/60 bg-surface px-4 py-3 sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning/10 text-warning [&_svg]:size-4"
        >
          <Unlink />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-md font-semibold">{t('orphans.lessonsTitle')}</h2>
          <p className="text-sm text-muted">
            {t('orphans.lessons', { count })} {t('orphans.lessonsHint')}
          </p>
        </div>
      </div>
      <Link
        to="/lessons?module=none"
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'max-sm:h-10 sm:shrink-0'
        )}
      >
        <BookOpenText aria-hidden />
        {t('orphans.seeLessons')}
      </Link>
    </section>
  );
}
