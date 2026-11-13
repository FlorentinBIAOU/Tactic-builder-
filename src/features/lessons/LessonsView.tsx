import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpenText,
  Copy,
  Eye,
  FolderTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import type { Domain, Lesson, Track } from '@/lib/types';
import { hasContent, hasQuiz } from '@/lib/lessonRules';
import { Button, IconButton, buttonVariants } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { fmtDate, fmtInt } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import {
  DEFAULT_FILTERS,
  filterScope,
  groupByModule,
  matchesStatus,
  NO_MODULE,
  SORT_KEYS,
  sortLessons,
  STATUS_FILTERS,
  type LessonFilters,
  type SortKey,
  type StatusFilter,
} from './filter';
import { StatusBadge, TranslationMarks } from './LessonBadges';
import { useMediaQuery } from './useMediaQuery';
import { DomainMark } from './DomainMark';

const PAGE = 150;

function readFilters(p: URLSearchParams): LessonFilters {
  const status = p.get('status') as StatusFilter | null;
  const sort = p.get('sort') as SortKey | null;
  return {
    q: p.get('q') ?? '',
    domain: p.get('domain') ?? '',
    module: p.get('module') ?? '',
    status: status && STATUS_FILTERS.includes(status) ? status : 'all',
    sort: sort && SORT_KEYS.includes(sort) ? sort : 'module',
  };
}

/** The corpus: every lesson, filterable, with its editing actions. */
export default function LessonsView() {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const openEditor = useCorpus((s) => s.openEditor);
  const openPreview = useCorpus((s) => s.openPreview);
  const deleteLesson = useCorpus((s) => s.deleteLesson);
  const duplicateLesson = useCorpus((s) => s.duplicateLesson);

  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const compact = useMediaQuery('(max-width: 639px)');
  const md = useMediaQuery('(min-width: 768px)');
  const lg = useMediaQuery('(min-width: 1024px)');
  const xl = useMediaQuery('(min-width: 1280px)');

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const update = (patch: Partial<LessonFilters>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (!v || v === DEFAULT_FILTERS[k as keyof LessonFilters]) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true }
    );
    setLimit(PAGE);
  };

  const q = useDeferredValue(filters.q);
  const scope = useMemo(
    () => filterScope(lessons, tracks, { q, domain: filters.domain, module: filters.module }),
    [lessons, tracks, q, filters.domain, filters.module]
  );
  const knownTracks = useMemo(() => new Set(tracks.map((tr) => tr.id)), [tracks]);
  const statusCounts = useMemo(
    () =>
      Object.fromEntries(STATUS_FILTERS.map((s) => [s, scope.filter((l) => matchesStatus(l, s, knownTracks)).length])) as Record<
        StatusFilter,
        number
      >,
    [scope, knownTracks]
  );
  const rows = useMemo(
    () => sortLessons(scope.filter((l) => matchesStatus(l, filters.status, knownTracks)), tracks, filters.sort),
    [scope, tracks, knownTracks, filters.status, filters.sort]
  );
  const visible = rows.slice(0, limit);
  const domainOf = useMemo(() => {
    const byId = new Map(domains.map((d) => [d.id, d]));
    const byTrack = new Map(tracks.map((tr) => [tr.id, tr.domainId ? (byId.get(tr.domainId) ?? null) : null]));
    return (trackId: string | null) => (trackId ? (byTrack.get(trackId) ?? null) : null);
  }, [domains, tracks]);
  const groups = filters.sort === 'module' ? groupByModule(visible, tracks) : null;
  // Columns actually shown at this width (hidden cells do not count in colSpan).
  const columnCount = 2 + (compact ? 0 : 1) + (md ? 2 : 0) + (lg ? 1 : 0) + (xl ? 1 : 0);

  // Lesson counts for the domain and module pickers.
  const { perTrack, perDomain, orphans } = useMemo(() => {
    const trackDomain = new Map(tracks.map((tr) => [tr.id, tr.domainId ?? null]));
    const perTrack = new Map<string, number>();
    const perDomain = new Map<string, number>();
    let orphans = 0;
    for (const l of lessons) {
      if (!l.trackId || !trackDomain.has(l.trackId)) {
        orphans++;
        continue;
      }
      perTrack.set(l.trackId, (perTrack.get(l.trackId) ?? 0) + 1);
      const d = trackDomain.get(l.trackId);
      if (d) perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
    }
    return { perTrack, perDomain, orphans };
  }, [lessons, tracks]);

  const moduleOptions = useMemo(
    () =>
      [...tracks]
        // Keep the active module listed even if it belongs to another domain.
        .filter((tr) => !filters.domain || tr.domainId === filters.domain || tr.id === filters.module)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [tracks, filters.domain, filters.module]
  );

  const filtered = filters.q || filters.domain || filters.module || filters.status !== 'all';

  const header = (
    <PageHeader
      title={t('title')}
      description={t('description')}
      actions={
        <>
          <Link to="/structure" className={buttonVariants({ variant: 'ghost' })}>
            <FolderTree aria-hidden />
            {t('manageStructure')}
          </Link>
          <Button variant="primary" onClick={() => openEditor()}>
            <Plus aria-hidden />
            {t('new')}
          </Button>
        </>
      }
    />
  );

  if (!loaded && loadError) {
    return (
      <>
        {header}
        <Notice
          tone="danger"
          title={t('loadError')}
          action={
            <Button size="sm" onClick={() => void load()} loading={loading}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {loadError}
        </Notice>
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        {header}
        <div className="flex flex-col gap-3" aria-busy aria-label={tc('states.loading')}>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <div className="mt-2 flex flex-col divide-y divide-border rounded-lg border border-border">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (lessons.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<BookOpenText />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <>
              <Button variant="primary" onClick={() => openEditor()}>
                <Plus aria-hidden />
                {t('new')}
              </Button>
              <Link to="/structure" className={buttonVariants()}>
                {t('empty.importSyllabus')}
              </Link>
            </>
          }
        />
      </>
    );
  }

  const rowActions = (l: Lesson) => ({
    preview: () => openPreview(l),
    edit: () => openEditor(l),
    duplicate: () => void duplicateLesson(l.id),
    remove: () => setPendingDelete(l),
  });

  return (
    <>
      {header}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,13rem))]">
          <div className="relative col-span-2 md:col-span-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={t('filters.searchPlaceholder')}
              aria-label={t('filters.search')}
              className="h-10 pl-9"
            />
          </div>
          <NativeSelect
            aria-label={t('filters.domain')}
            className="col-span-2 h-10 md:col-span-1"
            value={filters.domain}
            onChange={(e) => {
              const domain = e.target.value;
              const keep =
                filters.module === NO_MODULE ||
                !filters.module ||
                tracks.find((tr) => tr.id === filters.module)?.domainId === domain;
              update({ domain, module: keep || !domain ? filters.module : '' });
            }}
          >
            <option value="">{t('filters.allDomains')}</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({perDomain.get(d.id) ?? 0})
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={t('filters.module')}
            className="h-10"
            value={filters.module}
            onChange={(e) => update({ module: e.target.value })}
          >
            <option value="">{t('filters.allModules')}</option>
            {moduleOptions.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.nameFr} ({perTrack.get(tr.id) ?? 0})
              </option>
            ))}
            <option value={NO_MODULE}>{t('filters.noModule', { count: orphans })}</option>
          </NativeSelect>
          <NativeSelect
            aria-label={t('filters.sort')}
            className="h-10"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
          >
            {SORT_KEYS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div role="group" aria-label={t('filters.status')} className="flex w-max gap-1.5">
            {STATUS_FILTERS.map((s) => {
              const active = filters.status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ status: s })}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors',
                    active
                      ? 'border-brand/60 bg-brand/15 font-medium text-foreground'
                      : 'border-border text-muted hover:border-input hover:text-foreground'
                  )}
                >
                  {t(`status.${s}`)}
                  <span className={cn('tabular text-xs', active ? 'text-brand' : 'text-muted')}>{fmtInt(statusCounts[s])}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {filtered
              ? t('list.countFiltered', { count: rows.length, total: fmtInt(lessons.length), shown: fmtInt(rows.length) })
              : t('list.count', { count: lessons.length, shown: fmtInt(lessons.length) })}
          </p>
          {filtered ? (
            <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(filters.sort !== 'module' ? { sort: filters.sort } : {}), { replace: true })}>
              <X aria-hidden />
              {t('filters.clear')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <EmptyState
          className="mt-2"
          icon={<SearchX />}
          title={t('list.noMatch')}
          description={t('list.noMatchHelp')}
          action={
            <Button onClick={() => setParams(new URLSearchParams(), { replace: true })}>{t('filters.clear')}</Button>
          }
        />
      ) : (
        <div className="mt-2 rounded-lg border border-border bg-surface">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">{t('list.caption')}</caption>
            <thead>
              <tr className="text-left text-muted">
                <Th className="rounded-tl-lg">{t('columns.lesson')}</Th>
                {groups ? null : <Th className="hidden w-[18%] lg:table-cell">{t('columns.module')}</Th>}
                <Th className="hidden w-32 sm:table-cell">{t('columns.status')}</Th>
                <Th className="hidden w-20 md:table-cell">{t('columns.duration')}</Th>
                <Th className="hidden w-16 md:table-cell">{t('columns.quiz')}</Th>
                <Th className="hidden w-24 lg:table-cell">{t('columns.translations')}</Th>
                <Th className="hidden w-28 xl:table-cell">{t('columns.updated')}</Th>
                <Th className="w-12 rounded-tr-lg sm:w-28">
                  <span className="sr-only">{t('columns.actions')}</span>
                </Th>
              </tr>
            </thead>
            {groups
              ? groups.map((g, gi) => (
                  <tbody key={`${g.key}-${gi}`} className="border-t border-border">
                    <GroupRow colSpan={columnCount} track={g.track} domain={domainOf(g.track?.id ?? null)} count={g.lessons.length} />
                    {g.lessons.map((l) => (
                      <LessonRow key={l.id} lesson={l} domain={domainOf(l.trackId)} actions={rowActions(l)} compact={compact} />
                    ))}
                  </tbody>
                ))
              : (
                  <tbody>
                    {visible.map((l) => (
                      <LessonRow key={l.id} lesson={l} domain={domainOf(l.trackId)} actions={rowActions(l)} compact={compact} track={tracks.find((tr) => tr.id === l.trackId) ?? null} showModule />
                    ))}
                  </tbody>
                )}
          </table>
          {rows.length > visible.length ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-sm text-muted">{t('list.shown', { shown: fmtInt(visible.length), total: fmtInt(rows.length) })}</span>
              <Button size="sm" onClick={() => setLimit((n) => n + PAGE)}>
                {t('list.showMore')}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t('delete.title')}
        description={t('delete.description', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('delete.confirm')}
        cancelLabel={tc('actions.cancel')}
        destructive
        onConfirm={() => {
          if (pendingDelete) void deleteLesson(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn('sticky top-14 z-10 border-b border-border bg-surface px-3 py-2.5 text-sm font-medium first:pl-4', className)}>
      {children}
    </th>
  );
}

function GroupRow({ track, domain, count, colSpan }: { track: Track | null; domain: Domain | null; count: number; colSpan: number }) {
  const { t } = useTranslation('lessons');
  return (
    <tr className="bg-surface-2/40">
      <th scope="colgroup" colSpan={colSpan} className="px-4 py-2 text-left font-medium">
        <span className="flex items-center gap-2">
          <DomainMark domain={domain} size="sm" />
          {domain ? <span className="sr-only">{domain.name}</span> : null}
          <span className="truncate">{track ? track.nameFr : t('list.noModule')}</span>
          <span className="tabular shrink-0 text-xs font-normal text-muted">{t('list.lessonCount', { count })}</span>
        </span>
      </th>
    </tr>
  );
}

type RowActions = { preview: () => void; edit: () => void; duplicate: () => void; remove: () => void };

function LessonRow({
  lesson: l,
  actions,
  track,
  domain,
  showModule,
  compact,
}: {
  lesson: Lesson;
  domain: Domain | null;
  actions: RowActions;
  compact: boolean;
  track?: Track | null;
  showModule?: boolean;
}) {
  const { t } = useTranslation('lessons');
  const { t: tc } = useTranslation();
  const empty = !hasContent(l);
  const quizCount = hasQuiz(l) ? l.quizzes.filter((q) => q.q.trim()).length : 0;

  return (
    <tr className="group border-t border-border/70 transition-colors first:border-t-0 hover:bg-surface-2/50">
      <td className="py-2 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <DomainMark domain={domain} />
          <div className="flex min-w-0 flex-col">
            <button
              type="button"
              onClick={actions.edit}
              className="truncate text-left text-base font-medium text-foreground hover:text-brand hover:underline focus-visible:underline"
            >
              {l.name || t('list.untitled')}
            </button>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="tabular">{l.id}</span>
              {showModule && track ? <span className="truncate lg:hidden">{track.nameFr}</span> : null}
              <span className="sm:hidden">
                <StatusBadge status={l.status} />
              </span>
              {empty ? (
                <Badge tone="warning" className="sm:hidden">
                  {t('status.empty')}
                </Badge>
              ) : null}
            </span>
          </div>
        </div>
      </td>
      {showModule ? (
        <td className="hidden truncate px-3 py-2 text-muted lg:table-cell">
          {track ? track.nameFr : <span className="italic">{t('list.noModule')}</span>}
        </td>
      ) : null}
      <td className="hidden px-3 py-2 sm:table-cell">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={l.status} />
          {empty ? <Badge tone="warning">{t('status.empty')}</Badge> : null}
        </div>
      </td>
      <td className="tabular hidden px-3 py-2 text-muted md:table-cell">{l.duration}</td>
      <td className="tabular hidden px-3 py-2 md:table-cell">
        {quizCount ? quizCount : <span className="text-muted" title={t('list.noQuiz')}>—<span className="sr-only">{t('list.noQuiz')}</span></span>}
      </td>
      <td className="hidden px-3 py-2 lg:table-cell">
        <TranslationMarks lesson={l} />
      </td>
      <td className="tabular hidden px-3 py-2 text-muted xl:table-cell">{fmtDate(l.updatedAt)}</td>
      <td className="py-1.5 pl-1 pr-2">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton className="hidden sm:inline-flex" label={t('actions.preview', { name: l.name })} icon={<Eye />} onClick={actions.preview} />
          <IconButton className="hidden sm:inline-flex" label={t('actions.edit', { name: l.name })} icon={<Pencil />} onClick={actions.edit} />
          <Menu>
            <MenuTrigger asChild>
              <IconButton label={t('actions.more', { name: l.name })} icon={<MoreHorizontal />} className="size-10 sm:size-9" />
            </MenuTrigger>
            <MenuContent>
              {compact ? (
                <>
                  <MenuItem icon={<Eye />} onSelect={actions.preview}>
                    {tc('actions.preview')}
                  </MenuItem>
                  <MenuItem icon={<Pencil />} onSelect={actions.edit}>
                    {tc('actions.edit')}
                  </MenuItem>
                </>
              ) : null}
              <MenuItem icon={<Copy />} onSelect={actions.duplicate}>
                {tc('actions.duplicate')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} destructive onSelect={actions.remove}>
                {tc('actions.delete')}
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </td>
    </tr>
  );
}
