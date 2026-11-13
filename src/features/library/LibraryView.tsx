import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  ExternalLink,
  Library,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import {
  corpusErrorMessage,
  deleteResource,
  fetchResources,
  isSafeUrl,
  RESOURCE_FILE_ACCEPT,
  uploadResourceFile,
  upsertResource,
} from '@/lib/corpus';
import { RESOURCE_KINDS, type Resource, type ResourceKind } from '@/lib/types';
import { toast } from '@/components/Toast';
import { Button, IconButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { fmtDate } from '@/components/ui/chart';
import { matches } from '@/features/structure/model';
import { ResourceDialog, type ResourceInput } from './ResourceDialog';
import { SyllabusPanel } from './SyllabusPanel';
import { checkFile, hostOf, KindIcon, kindFromFile } from './kinds';

const NO_MODULE = 'none';

function TableSkeleton() {
  return (
    <div
      className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
      aria-busy
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-64 max-w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Resource library (links and uploaded files) and the reference syllabus. */
export default function LibraryView() {
  const { t } = useTranslation(['library', 'common']);
  const loaded = useCorpus((s) => s.loaded);
  const loading = useCorpus((s) => s.loading);
  const loadError = useCorpus((s) => s.loadError);
  const load = useCorpus((s) => s.load);
  const tracks = useCorpus((s) => s.tracks);
  const lessons = useCorpus((s) => s.lessons);

  const [resources, setResources] = useState<Resource[]>([]);
  const [resLoading, setResLoading] = useState(true);
  const [resError, setResError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Resource | null>(null);

  const kindFilter = (params.get('kind') ?? '') as ResourceKind | '';
  const moduleFilter = params.get('module') ?? '';
  const setFilter = (key: 'kind' | 'module', value: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (value) n.set(key, value);
        else n.delete(key);
        return n;
      },
      { replace: true }
    );

  // Modules and lessons (for names and the module filter).
  useEffect(() => {
    if (!loaded && !loading && !loadError) void load();
  }, [loaded, loading, loadError, load]);

  const fetchAll = useCallback(() => {
    setResLoading(true);
    setResError(null);
    fetchResources()
      .then(setResources)
      .catch((e) => setResError(corpusErrorMessage(e)))
      .finally(() => setResLoading(false));
  }, []);
  useEffect(fetchAll, [fetchAll]);

  const syllabus = resources.find((r) => r.kind === 'syllabus') ?? null;
  const items = useMemo(() => resources.filter((r) => r.kind !== 'syllabus'), [resources]);
  const trackName = useMemo(() => new Map(tracks.map((x) => [x.id, x.nameFr])), [tracks]);
  const lessonName = useMemo(() => new Map(lessons.map((x) => [x.id, x.name])), [lessons]);

  const filtered = useMemo(
    () =>
      items.filter((r) => {
        if (kindFilter && r.kind !== kindFilter) return false;
        if (moduleFilter === NO_MODULE && r.trackId) return false;
        if (moduleFilter && moduleFilter !== NO_MODULE && r.trackId !== moduleFilter) return false;
        return matches(q, r.title, r.url);
      }),
    [items, kindFilter, moduleFilter, q]
  );
  const filtering = Boolean(kindFilter || moduleFilter || q.trim());

  // ─── writes ──────────────────────────────────────────────────────────────

  const save = async (r: ResourceInput): Promise<Resource | null> => {
    try {
      const saved = await upsertResource(r);
      setResources((list) =>
        list.some((x) => x.id === saved.id)
          ? list.map((x) => (x.id === saved.id ? saved : x))
          : [saved, ...list]
      );
      return saved;
    } catch (e) {
      toast(`${t('saveFailed')} ${corpusErrorMessage(e)}`, 'error');
      return null;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    try {
      await deleteResource(id);
      setResources((list) => list.filter((x) => x.id !== id));
      return true;
    } catch (e) {
      toast(`${t('saveFailed')} ${corpusErrorMessage(e)}`, 'error');
      return false;
    }
  };

  const onFile = async (file: File) => {
    const check = checkFile(file);
    if (check !== 'ok') {
      toast(t(`upload.${check}`, { name: file.name }), 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadResourceFile(file);
      const saved = await save({
        kind: kindFromFile(file),
        title: file.name,
        url,
        trackId: moduleFilter && moduleFilter !== NO_MODULE ? moduleFilter : null,
      });
      if (saved) {
        toast(t('upload.done'), 'success');
        // Let the user rename it or attach it to a module right away.
        setEditing(saved);
        setFormOpen(true);
      }
    } catch (e) {
      toast(`${t('upload.failed')} ${corpusErrorMessage(e)}`, 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setSyllabus = async (title: string, url: string) => {
    // Save the new syllabus first, then remove the old one, so a failed save
    // never leaves the project without a syllabus.
    const previous = syllabus;
    const saved = await save({ kind: 'syllabus', title, url });
    if (!saved) return false;
    if (previous) await remove(previous.id);
    toast(t('syllabus.saved'), 'success');
    return true;
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'), 'success');
    } catch {
      /* clipboard refused: nothing to do */
    }
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  // ─── render ──────────────────────────────────────────────────────────────

  const uploadButton = (
    <Button onClick={() => fileRef.current?.click()} loading={uploading}>
      {uploading ? null : <Upload aria-hidden />}
      {uploading ? t('actions.uploading') : t('actions.upload')}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            {uploadButton}
            <Button variant="primary" onClick={openNew}>
              <Plus aria-hidden />
              {t('actions.add')}
            </Button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept={RESOURCE_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <SyllabusPanel
        loading={resLoading}
        syllabus={syllabus}
        onSave={setSyllabus}
        onRemove={async () => {
          if (syllabus && (await remove(syllabus.id))) toast(t('syllabus.removed'), 'info');
        }}
      />

      <section aria-labelledby="library-list-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 id="library-list-title" className="text-lg font-semibold">
            {t('table.caption')}
          </h2>
          {!resLoading && !resError ? (
            <p className="tabular text-sm text-muted" aria-live="polite">
              {filtering
                ? t('filters.resultsOf', {
                    shown: filtered.length,
                    total: t('filters.results', { count: items.length }),
                  })
                : t('filters.results', { count: items.length })}
            </p>
          ) : null}
        </div>

        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <div className="relative min-w-0">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              aria-label={t('filters.search')}
              placeholder={t('filters.searchPlaceholder')}
              className="pl-9 max-sm:h-10"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <NativeSelect
            aria-label={t('filters.kind')}
            className="max-sm:h-10"
            value={kindFilter}
            onChange={(e) => setFilter('kind', e.target.value)}
          >
            <option value="">{t('filters.allKinds')}</option>
            {RESOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label={t('filters.module')}
            className="max-sm:h-10"
            value={moduleFilter}
            onChange={(e) => setFilter('module', e.target.value)}
          >
            <option value="">{t('filters.allModules')}</option>
            <option value={NO_MODULE}>{t('filters.noModule')}</option>
            {tracks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.nameFr}
              </option>
            ))}
          </NativeSelect>
        </div>

        {resError ? (
          <Notice
            tone="danger"
            title={t('error.title')}
            action={
              <Button size="sm" onClick={fetchAll}>
                {t('common:actions.retry')}
              </Button>
            }
          >
            {t('error.body')} <span className="text-muted">({resError})</span>
          </Notice>
        ) : resLoading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Library />}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <>
                <Button variant="primary" onClick={openNew}>
                  <Plus aria-hidden />
                  {t('actions.add')}
                </Button>
                {uploadButton}
              </>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title={t('empty.noMatch')}
            action={
              <Button
                onClick={() => {
                  setQ('');
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                <X aria-hidden />
                {t('actions.resetFilters')}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('table.caption')}</caption>
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    {t('table.title')}
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">
                    {t('table.kind')}
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">
                    {t('table.module')}
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">
                    {t('table.lesson')}
                  </th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">
                    {t('table.added')}
                  </th>
                  <th scope="col" className="w-12 px-2 py-2.5">
                    <span className="sr-only">{t('table.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const safe = isSafeUrl(r.url);
                  const mod = r.trackId ? trackName.get(r.trackId) : undefined;
                  const les = r.lessonId ? lessonName.get(r.lessonId) : undefined;
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/50">
                      <td className="min-w-[14rem] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <KindIcon kind={r.kind} />
                          <div className="flex min-w-0 flex-col">
                            {safe ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="line-clamp-2 break-words text-base font-medium text-foreground hover:text-brand hover:underline hover:underline-offset-4"
                              >
                                {r.title}
                              </a>
                            ) : (
                              <span className="line-clamp-2 break-words text-base font-medium">
                                {r.title}
                              </span>
                            )}
                            <span className="flex min-w-0 items-center gap-2 text-muted">
                              <span className="md:hidden">{t(`kinds.${r.kind}`)}</span>
                              {safe ? (
                                <span className="truncate">{hostOf(r.url)}</span>
                              ) : (
                                <Tooltip content={t('table.invalidLinkHint')}>
                                  <Badge tone="danger" tabIndex={0}>
                                    {t('table.invalidLink')}
                                  </Badge>
                                </Tooltip>
                              )}
                            </span>
                            {mod ? (
                              <span className="truncate text-muted sm:hidden">{mod}</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-muted md:table-cell">
                        {t(`kinds.${r.kind}`)}
                      </td>
                      <td className="hidden max-w-56 px-4 py-3 sm:table-cell">
                        {mod ? (
                          <span className="line-clamp-2">{mod}</span>
                        ) : (
                          <span className="text-muted">{t('table.none')}</span>
                        )}
                      </td>
                      <td className="hidden max-w-56 px-4 py-3 xl:table-cell">
                        {les ? (
                          <span className="line-clamp-2">{les}</span>
                        ) : (
                          <span className="text-muted">{t('table.none')}</span>
                        )}
                      </td>
                      <td className="tabular hidden whitespace-nowrap px-4 py-3 text-muted lg:table-cell">
                        {fmtDate(r.createdAt)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Menu>
                          <MenuTrigger asChild>
                            <IconButton
                              size="icon-sm"
                              className="max-sm:size-10"
                              label={t('actions.rowActions', { title: r.title })}
                              icon={<MoreHorizontal />}
                            />
                          </MenuTrigger>
                          <MenuContent>
                            {safe ? (
                              <>
                                <MenuItem
                                  icon={<ExternalLink />}
                                  onSelect={() =>
                                    window.open(r.url, '_blank', 'noopener,noreferrer')
                                  }
                                >
                                  {t('actions.open')}
                                </MenuItem>
                                <MenuItem icon={<Copy />} onSelect={() => void copy(r.url)}>
                                  {t('actions.copyLink')}
                                </MenuItem>
                              </>
                            ) : null}
                            <MenuItem
                              icon={<Pencil />}
                              onSelect={() => {
                                setEditing(r);
                                setFormOpen(true);
                              }}
                            >
                              {t('actions.edit')}
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem icon={<Trash2 />} destructive onSelect={() => setToDelete(r)}>
                              {t('actions.delete')}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">{t('upload.hint')}</p>
      </section>

      <ResourceDialog
        open={formOpen}
        resource={editing}
        onClose={() => setFormOpen(false)}
        onSave={async (r) => {
          const saved = await save(r);
          if (saved) toast(r.id ? t('form.saved') : t('form.created'), 'success');
          return Boolean(saved);
        }}
      />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('delete.title', { title: toDelete?.title ?? '' })}
        description={t('delete.body')}
        confirmLabel={t('delete.confirm')}
        cancelLabel={t('common:actions.cancel')}
        destructive
        onConfirm={() => {
          const r = toDelete;
          setToDelete(null);
          if (r) void remove(r.id).then((ok) => ok && toast(t('delete.done'), 'info'));
        }}
      />
    </>
  );
}
