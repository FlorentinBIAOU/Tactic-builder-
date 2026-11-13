import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, Copy, Megaphone, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Panel } from '@/components/ui/page';
import { ChartBox, SERIES, axis, grid, tooltipStyle } from '@/components/ui/chart';
import { toast } from '@/components/Toast';
import { cn } from '@/lib/utils';
import {
  campaignRoi,
  computeKpis,
  deleteCampaign,
  fetchCampaigns,
  filterByPeriod,
  isOpenPeriod,
  presetPeriod,
  rollupByChannel,
  upsertCampaign,
  type CampaignInput,
  type Period,
  type PeriodPreset,
} from '@/lib/marketing';
import { fetchChannelAttribution, fetchDemoStatus, type ChannelAttribution, type DemoStatus } from '@/lib/events';
import type { MarketingCampaign } from '@/lib/types';
import { CampaignDialog } from './CampaignDialog';
import { StatusBadge, useChannelName } from './shared';
import { NONE, day, eur, eurCompact, int, pct, signedPct } from './format';

const PRESETS: PeriodPreset[] = ['all', '30d', '90d', '12m', 'year', 'custom'];

type Load<T> = { status: 'loading' } | { status: 'error'; detail?: string } | { status: 'ready'; data: T };

/** Campaign figures, channels, attribution and the campaign table. */
export function CampaignsTab({
  createSignal,
}: {
  /** Incremented by the page header's "New campaign" button. */
  createSignal: number;
}) {
  const { t } = useTranslation('marketing');
  const { t: tc } = useTranslation('common');
  const channelName = useChannelName();

  const [campaigns, setCampaigns] = useState<Load<MarketingCampaign[]>>({ status: 'loading' });
  const [attribution, setAttribution] = useState<Load<ChannelAttribution[] | null>>({ status: 'loading' });
  const [demo, setDemo] = useState<DemoStatus | null>(null);

  const [preset, setPreset] = useState<PeriodPreset>('all');
  const [custom, setCustom] = useState<Period>({ from: null, to: null });

  const [editing, setEditing] = useState<CampaignInput | MarketingCampaign | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<MarketingCampaign | null>(null);

  const loadCampaigns = useCallback(async () => {
    setCampaigns({ status: 'loading' });
    try {
      setCampaigns({ status: 'ready', data: await fetchCampaigns() });
    } catch (e) {
      setCampaigns({ status: 'error', detail: (e as { message?: string })?.message });
    }
  }, []);

  const loadAttribution = useCallback(async () => {
    setAttribution({ status: 'loading' });
    try {
      const [rows, status] = await Promise.all([fetchChannelAttribution(), fetchDemoStatus().catch(() => null)]);
      setDemo(status);
      setAttribution({ status: 'ready', data: rows });
    } catch {
      setAttribution({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
    void loadAttribution();
  }, [loadCampaigns, loadAttribution]);

  const openCreate = useCallback((prefill: CampaignInput | null = null) => {
    setEditing(prefill);
    setDialogOpen(true);
  }, []);

  const seenSignal = useRef(createSignal);
  useEffect(() => {
    if (createSignal !== seenSignal.current) {
      seenSignal.current = createSignal;
      openCreate();
    }
  }, [createSignal, openCreate]);

  const period = useMemo(() => presetPeriod(preset, new Date(), custom), [preset, custom]);
  const all = useMemo(() => (campaigns.status === 'ready' ? campaigns.data : []), [campaigns]);
  const { included, undated } = useMemo(() => filterByPeriod(all, period), [all, period]);
  const kpis = useMemo(() => computeKpis(included), [included]);
  const channels = useMemo(() => rollupByChannel(included), [included]);
  const filtered = !isOpenPeriod(period);

  const save = async (c: CampaignInput) => {
    try {
      const saved = await upsertCampaign(c);
      setCampaigns((s) => {
        if (s.status !== 'ready') return s;
        const exists = s.data.some((x) => x.id === saved.id);
        return { status: 'ready', data: exists ? s.data.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...s.data] };
      });
      toast(c.id ? t('toast.saved') : t('toast.created'), 'success');
      return true;
    } catch {
      toast(t('toast.saveError'), 'error');
      return false;
    }
  };

  const duplicate = (c: MarketingCampaign) => {
    // Opens the form pre-filled; nothing is saved until the user confirms.
    const { id: _id, createdAt: _createdAt, ...rest } = c;
    openCreate({ ...rest, name: `${c.name} ${t('copySuffix')}` });
  };

  const confirmDelete = async () => {
    const c = toDelete;
    setToDelete(null);
    if (!c) return;
    try {
      await deleteCampaign(c.id);
      setCampaigns((s) => (s.status === 'ready' ? { status: 'ready', data: s.data.filter((x) => x.id !== c.id) } : s));
      toast(t('toast.deleted'), 'success');
    } catch {
      toast(t('toast.deleteError'), 'error');
    }
  };

  const dateRange = (c: MarketingCampaign) => {
    if (c.startDate && c.endDate) return t('table.range', { from: day(c.startDate), to: day(c.endDate) });
    if (c.startDate) return t('table.since', { date: day(c.startDate) });
    if (c.endDate) return t('table.until', { date: day(c.endDate) });
    return t('table.noDates');
  };

  if (campaigns.status === 'error') {
    return (
      <Notice
        tone="danger"
        title={t('loadError')}
        action={
          <Button size="sm" onClick={() => void loadCampaigns()}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {t('loadErrorHelp')}
      </Notice>
    );
  }

  const loading = campaigns.status === 'loading';
  const noCampaignAtAll = !loading && all.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Period */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('period.label')} className="w-full sm:w-56">
            <NativeSelect value={preset} onChange={(e) => setPreset(e.target.value as PeriodPreset)}>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {t(`period.${p}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {preset === 'custom' ? (
            <>
              <Field label={t('period.from')} className="w-[calc(50%-0.375rem)] sm:w-44">
                <Input
                  type="date"
                  value={custom.from ?? ''}
                  max={custom.to ?? undefined}
                  onChange={(e) => setCustom((p) => ({ ...p, from: e.target.value || null }))}
                />
              </Field>
              <Field label={t('period.to')} className="w-[calc(50%-0.375rem)] sm:w-44">
                <Input
                  type="date"
                  value={custom.to ?? ''}
                  min={custom.from ?? undefined}
                  onChange={(e) => setCustom((p) => ({ ...p, to: e.target.value || null }))}
                />
              </Field>
            </>
          ) : null}
          {!loading ? (
            <p className="pb-2 text-sm text-muted" aria-live="polite">
              {filtered
                ? t('period.summary', { count: included.length })
                : t('period.summaryAll', { count: included.length })}
              {filtered && included.length > 0 ? `. ${t('period.fullAmounts')}` : ''}
            </p>
          ) : null}
        </div>
        {filtered && undated.length > 0 ? (
          <Notice tone="info">{t('period.undated', { count: undated.length })}</Notice>
        ) : null}
      </div>

      {/* Key figures */}
      <section aria-label={t('kpi.label')}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={cn('flex flex-col gap-2 bg-surface p-4', i === 4 && 'col-span-2 lg:col-span-1')}>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))
            : (
                [
                  {
                    label: t('kpi.spend'),
                    value: eur(kpis.spend),
                    hint: kpis.campaigns ? t('kpi.spendHint', { count: kpis.campaigns }) : t('kpi.noData'),
                  },
                  {
                    label: t('kpi.revenue'),
                    value: eur(kpis.revenue),
                    hint: kpis.conversions != null ? t('kpi.revenueHint', { count: kpis.conversions, n: int(kpis.conversions) }) : t('kpi.noData'),
                  },
                  {
                    label: t('kpi.roi'),
                    value: signedPct(kpis.roi),
                    hint: kpis.roi == null ? (kpis.campaigns ? t('kpi.noSpend') : t('kpi.noData')) : t('kpi.roiHint'),
                    tone: kpis.roi == null ? undefined : kpis.roi >= 0 ? ('success' as const) : ('danger' as const),
                  },
                  {
                    label: t('kpi.cac'),
                    value: eur(kpis.cac, 2),
                    hint: kpis.cac == null ? (kpis.campaigns ? t('kpi.noConversion') : t('kpi.noData')) : t('kpi.cacHint'),
                  },
                  {
                    label: t('kpi.conversion'),
                    value: pct(kpis.conversionRate),
                    hint:
                      kpis.conversionRate == null
                        ? kpis.campaigns
                          ? t('kpi.noClick')
                          : t('kpi.noData')
                        : t('kpi.conversionHint', { count: kpis.clicks ?? 0, n: int(kpis.clicks) }),
                  },
                ] as { label: string; value: string; hint: string; tone?: 'success' | 'danger' }[]
              ).map((k, i) => (
                <div
                  key={k.label}
                  className={cn('flex min-w-0 flex-col gap-1 bg-surface p-4', i === 4 && 'col-span-2 lg:col-span-1')}
                >
                  <dt className="text-sm text-muted">{k.label}</dt>
                  <dd
                    className={cn(
                      'tabular text-2xl font-semibold',
                      k.value === NONE && 'text-muted',
                      k.tone === 'success' && 'text-success',
                      k.tone === 'danger' && 'text-danger'
                    )}
                  >
                    {k.value}
                  </dd>
                  <dd className="text-sm text-muted">{k.hint}</dd>
                </div>
              ))}
        </dl>
      </section>

      {/* Channels + attribution */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <Panel title={t('channels.title')} description={t('channels.description')} actions={<ChartLegend />}>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : channels.length === 0 ? (
            <p className="py-16 text-center text-base text-muted">{t('channels.empty')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <ChartBox label={t('channels.chartLabel')} height={240}>
                <BarChart data={channels.map((c) => ({ ...c, name: channelName(c.channel) }))} barGap={4} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="name" {...axis} interval={0} />
                  <YAxis {...axis} width={64} tickFormatter={(v: number) => eurCompact(v)} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: number, key: string) => [eur(v), key === 'spend' ? t('channels.spend') : t('channels.revenue')]}
                  />
                  <Bar dataKey="spend" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="revenue" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ChartBox>
              <ul className="divide-y divide-border border-t border-border text-sm">
                {channels.map((c) => (
                  <li key={c.channel} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate font-medium">{channelName(c.channel)}</span>
                    <span className="flex items-center gap-4 text-muted tabular">
                      <span className="hidden sm:inline">
                        {eur(c.spend)} / {eur(c.revenue)}
                      </span>
                      <RoiValue value={c.roi} prefix={t('channels.roi')} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title={t('attribution.title')} description={t('attribution.description')} bodyClassName="p-0">
          <AttributionBody state={attribution} demo={demo} onRetry={() => void loadAttribution()} />
        </Panel>
      </div>

      {/* Campaign table */}
      <section className="flex flex-col gap-3" aria-labelledby="campaigns-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="campaigns-title" className="text-md font-semibold">
            {t('table.title')}
            {!loading ? <span className="ml-2 text-base font-normal text-muted tabular">{included.length}</span> : null}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : noCampaignAtAll ? (
          <EmptyState
            icon={<Megaphone />}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              <Button onClick={() => openCreate()}>
                <Plus aria-hidden />
                {t('newCampaign')}
              </Button>
            }
          />
        ) : included.length === 0 ? (
          <EmptyState
            icon={<CalendarRange />}
            title={t('empty.periodTitle')}
            description={t('empty.periodDescription')}
            action={<Button onClick={() => setPreset('all')}>{t('empty.showAll')}</Button>}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">{t('table.caption')}</caption>
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('table.name')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('table.dates')}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t('table.status')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.spend')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.impressions')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.clicks')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.conversions')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.revenue')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('table.roi')}</th>
                  <th scope="col" className="w-12 px-2 py-2.5">
                    <span className="sr-only">{tc('actions.more')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {included.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/50">
                    <td className="max-w-64 px-4 py-2">
                      <button
                        type="button"
                        onClick={() => openCreate(c)}
                        className="block max-w-full truncate rounded-sm text-left font-medium hover:text-brand hover:underline"
                      >
                        {c.name}
                      </button>
                      <span className="block text-muted">{channelName(c.channel)}</span>
                    </td>
                    <td className={cn('whitespace-nowrap px-3 py-2', !c.startDate && !c.endDate && 'text-muted')}>{dateRange(c)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular">{eur(c.spend)}</td>
                    <td className="px-3 py-2 text-right tabular">{int(c.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular">{int(c.clicks)}</td>
                    <td className="px-3 py-2 text-right tabular">{int(c.conversions)}</td>
                    <td className="px-3 py-2 text-right tabular">{eur(c.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular">
                      <RoiValue value={campaignRoi(c)} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Menu>
                        <MenuTrigger asChild>
                          <IconButton label={t('table.actions', { name: c.name })} icon={<MoreHorizontal />} className="size-10" />
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem icon={<Pencil />} onSelect={() => openCreate(c)}>
                            {tc('actions.edit')}
                          </MenuItem>
                          <MenuItem icon={<Copy />} onSelect={() => duplicate(c)}>
                            {tc('actions.duplicate')}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem icon={<Trash2 />} destructive onSelect={() => setToDelete(c)}>
                            {tc('actions.delete')}
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CampaignDialog open={dialogOpen} campaign={editing} onClose={() => setDialogOpen(false)} onSave={save} />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => (o ? undefined : setToDelete(null))}
        title={t('delete.title', { name: toDelete?.name ?? '' })}
        description={t('delete.body')}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function ChartLegend() {
  const { t } = useTranslation('marketing');
  return (
    <div className="flex items-center gap-4 text-sm text-muted" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: SERIES[0] }} />
        {t('channels.spend')}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-sm" style={{ background: SERIES[1] }} />
        {t('channels.revenue')}
      </span>
    </div>
  );
}

/** Return on investment with its sign, coloured; "—" when undefined. */
function RoiValue({ value, prefix }: { value: number | null; prefix?: string }) {
  return (
    <span className={cn('tabular', value == null ? 'text-muted' : value >= 0 ? 'text-success' : 'text-danger')}>
      {prefix ? <span className="mr-1 text-muted">{prefix}</span> : null}
      {signedPct(value)}
    </span>
  );
}

function AttributionBody({
  state,
  demo,
  onRetry,
}: {
  state: Load<ChannelAttribution[] | null>;
  demo: DemoStatus | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation('marketing');
  const { t: tc } = useTranslation('common');
  const channelName = useChannelName();

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2 p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="p-5">
        <Notice
          tone="danger"
          action={
            <Button size="sm" onClick={onRetry}>
              {tc('actions.retry')}
            </Button>
          }
        >
          {t('attribution.error')}
        </Notice>
      </div>
    );
  }
  if (state.data === null) {
    return (
      <div className="p-5">
        <Notice tone="info">{t('attribution.unavailable')}</Notice>
      </div>
    );
  }

  const rows = [...state.data].sort((a, b) => b.conversions - a.conversions);
  const maxRate = Math.max(0, ...rows.map((r) => r.conversionRate));
  const total = demo ? demo.demoRows + demo.realRows : 0;

  return (
    <div className="flex flex-col">
      {demo && demo.demoRows > 0 ? (
        <div className="px-5 pt-4">
          <Notice tone="warning" title={t('attribution.demoTitle')}>
            {t('attribution.demo', { demo: int(demo.demoRows), total: int(total) })}
          </Notice>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-base text-muted">{t('attribution.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-2.5 font-medium">{t('attribution.channel')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('attribution.touchpoints')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('attribution.conversions')}</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">{t('attribution.rate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.channel} className="hover:bg-surface-2/50">
                  <td className="px-5 py-2.5 font-medium">{channelName(r.channel)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{int(r.touchpoints)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{int(r.conversions)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${maxRate > 0 ? (r.conversionRate / maxRate) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-14 text-right tabular">{r.touchpoints > 0 ? pct(r.conversionRate) : NONE}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
