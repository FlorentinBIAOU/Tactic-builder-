import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Download, Minus, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useCorpus } from '@/store/corpus';
import { computeQualityRows, qualityRowsToCsv, type LessonQuality } from '@/lib/analytics';
import { readabilityBand, type ReadabilityBand } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { ChartBox, SERIES, axis, fmtInt, grid, tooltipStyle } from '@/components/ui/chart';
import { toast } from '@/components/Toast';
import { Block, BlockHeader, DomainTag, InfoTip } from './parts';

type SortKey = 'name' | 'words' | 'blocks' | 'quizzes' | 'readability';
type Dir = 'asc' | 'desc';

const BAND_TONE: Record<ReadabilityBand, 'success' | 'warning' | 'danger' | 'neutral'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'danger',
  na: 'neutral',
};

function compareBy(k: SortKey, a: LessonQuality, b: LessonQuality): number {
  switch (k) {
    case 'words':
      return a.wordCount - b.wordCount;
    case 'blocks':
      return a.blockCount - b.blockCount;
    case 'quizzes':
      return a.quizCount - b.quizCount;
    case 'readability':
      // Lessons without a score always sort last.
      if (a.readability === null) return b.readability === null ? 0 : 1;
      if (b.readability === null) return -1;
      return a.readability - b.readability;
    default:
      return a.name.localeCompare(b.name);
  }
}

export default function QualityTab() {
  const { t } = useTranslation('stats');
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);

  const [domain, setDomain] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: 'name', dir: 'asc' });

  const all = useMemo(() => computeQualityRows(lessons, tracks), [lessons, tracks]);
  const lessonDomain = useMemo(() => {
    const trackDomain = new Map(tracks.map((tr) => [tr.id, tr.domainId ?? '']));
    return new Map(lessons.map((l) => [l.id, trackDomain.get(l.trackId ?? '') ?? '']));
  }, [lessons, tracks]);
  const domainById = useMemo(() => new Map(domains.map((d) => [d.id, d])), [domains]);

  const rows = useMemo(() => {
    let r = all;
    if (domain) r = r.filter((x) => lessonDomain.get(x.id) === domain);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) => x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q));
    return [...r].sort((a, b) => {
      const c = compareBy(sort.key, a, b);
      // Unscored readability stays last whatever the direction.
      if (sort.key === 'readability' && (a.readability === null || b.readability === null)) return c;
      return sort.dir === 'asc' ? c : -c;
    });
  }, [all, domain, lessonDomain, search, sort]);

  const bands = useMemo(() => {
    const c: Record<ReadabilityBand, number> = { easy: 0, medium: 0, hard: 0, na: 0 };
    for (const r of rows) c[readabilityBand(r.readability)]++;
    return (['easy', 'medium', 'hard', 'na'] as const).map((b) => ({ band: b, name: t(`quality.band.${b}`), value: c[b] }));
  }, [rows, t]);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));

  const downloadCsv = () => {
    try {
      const blob = new Blob([qualityRowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      link.href = url;
      link.download = `corpus-quality-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke later: Safari and Firefox need the URL while the download starts.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t('quality.csvDone', { count: rows.length }), 'success');
    } catch {
      toast(t('quality.csvError'), 'error');
    }
  };

  const bandColor: Record<ReadabilityBand, string> = { easy: SERIES[2], medium: SERIES[3], hard: SERIES[4], na: 'rgb(var(--c-input))' };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Block>
          <BlockHeader title={t('quality.readability')} info={t('quality.readabilityInfo')} sub={t('quality.readabilitySub')} />
          <ChartBox label={t('quality.readability')} height={200}>
            <BarChart data={bands} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid {...grid} />
              <XAxis dataKey="name" {...axis} interval={0} />
              <YAxis {...axis} allowDecimals={false} />
              <RTooltip {...tooltipStyle} formatter={(v: number) => [fmtInt(v), t('common.lessons')]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {bands.map((b) => (
                  <Cell key={b.band} fill={bandColor[b.band]} />
                ))}
              </Bar>
            </BarChart>
          </ChartBox>
        </Block>
        <Block>
          <BlockHeader title={t('quality.howTo')} />
          <dl className="flex flex-col gap-3 text-base">
            <div>
              <dt className="font-medium">{t('quality.readability')}</dt>
              <dd className="text-muted">{t('quality.readabilityInfo')}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('quality.bloom')}</dt>
              <dd className="text-muted">{t('quality.bloomInfo')}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('quality.translated')}</dt>
              <dd className="text-muted">{t('quality.translatedInfo')}</dd>
            </div>
          </dl>
        </Block>
      </div>

      <Block className="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <Field label={t('quality.search')} className="min-w-0 flex-1 basis-56">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                type="search"
                className="h-10 pl-9"
                placeholder={t('quality.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>
          <Field label={t('quality.domain')} className="min-w-0 basis-48">
            <NativeSelect className="h-10" value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">{t('quality.allDomains')}</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ? `${d.code} – ${d.name}` : d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Button className="h-10" variant="secondary" onClick={downloadCsv} disabled={rows.length === 0}>
            <Download aria-hidden />
            {t('quality.csv')}
          </Button>
        </div>
        <p className="px-4 pt-3 text-sm text-muted" aria-live="polite">
          {t('quality.count', { count: rows.length, n: fmtInt(rows.length), total: fmtInt(all.length) })}
        </p>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Search />}
              title={t('quality.noMatch')}
              description={t('quality.noMatchHelp')}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setDomain('');
                  }}
                >
                  {t('quality.clearFilters')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="relative max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[880px] text-sm">
              <caption className="sr-only">{t('quality.caption')}</caption>
              <thead className="sticky top-0 z-[1] bg-surface text-left text-muted shadow-[0_1px_0_rgb(var(--c-border))]">
                <tr>
                  <SortTh label={t('quality.col.lesson')} k="name" sort={sort} onSort={onSort} />
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('quality.col.domain')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('quality.col.module')}</th>
                  <SortTh label={t('quality.col.words')} k="words" sort={sort} onSort={onSort} right />
                  <SortTh label={t('quality.col.blocks')} k="blocks" sort={sort} onSort={onSort} right />
                  <SortTh label={t('quality.col.quizzes')} k="quizzes" sort={sort} onSort={onSort} right />
                  <SortTh
                    label={t('quality.col.readability')}
                    k="readability"
                    sort={sort}
                    onSort={onSort}
                    right
                    info={t('quality.readabilityInfo')}
                  />
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {t('quality.col.bloom')}
                      <InfoTip label={t('common.about', { what: t('quality.bloom') })}>{t('quality.bloomInfo')}</InfoTip>
                    </span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">EN</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">ES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const d = domainById.get(lessonDomain.get(r.id) ?? '');
                  const band = readabilityBand(r.readability);
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/50">
                      <td className="max-w-[260px] px-3 py-2.5">
                        <span className="block truncate font-medium text-foreground" title={r.name}>
                          {r.name}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {r.id}
                          {r.status === 'draft' ? <Badge className="py-0">{t('status.draft', { ns: 'common' })}</Badge> : null}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {d ? (
                          <span className="flex items-center gap-2">
                            <DomainTag code={d.code} />
                            <span className="max-w-[140px] truncate" title={d.name}>
                              {d.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-muted" title={r.track}>
                        {r.track}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{fmtInt(r.wordCount)}</td>
                      <td className="tabular px-3 py-2.5 text-right">{r.blockCount}</td>
                      <td className="tabular px-3 py-2.5 text-right">{r.quizCount}</td>
                      <td className="px-3 py-2.5 text-right">
                        {r.readability === null ? (
                          <span className="text-muted" title={t('quality.band.na')}>—</span>
                        ) : (
                          <Badge tone={BAND_TONE[band]} className="tabular">
                            {r.readability} {t(`quality.bandShort.${band}`)}
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">{r.blockCount ? t(`quality.bloomLevel.${r.bloom}`) : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2.5">
                        <YesNo yes={r.hasTranslationEn} />
                      </td>
                      <td className="px-3 py-2.5">
                        <YesNo yes={r.hasTranslationEs} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </div>
  );
}

function YesNo({ yes }: { yes: boolean }) {
  const { t } = useTranslation('stats');
  return yes ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check aria-hidden className="size-4" />
      <span className="sr-only">{t('quality.yes')}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted">
      <Minus aria-hidden className="size-4" />
      <span className="sr-only">{t('quality.no')}</span>
    </span>
  );
}

function SortTh({
  label,
  k,
  sort,
  onSort,
  right,
  info,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: Dir };
  onSort: (k: SortKey) => void;
  right?: boolean;
  info?: string;
}) {
  const { t } = useTranslation('stats');
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-1.5 py-1 font-medium"
    >
      <span className={`flex items-center gap-1 ${right ? 'justify-end' : ''}`}>
        <button
          type="button"
          onClick={() => onSort(k)}
          className={`inline-flex h-9 items-center gap-1 rounded px-1.5 hover:bg-surface-2 hover:text-foreground ${active ? 'text-foreground' : ''}`}
          title={t('quality.sortBy', { col: label })}
        >
          {label}
          <Icon aria-hidden className={`size-3.5 ${active ? 'text-brand' : 'opacity-60'}`} />
        </button>
        {info ? <InfoTip label={t('common.about', { what: label })}>{info}</InfoTip> : null}
      </span>
    </th>
  );
}
