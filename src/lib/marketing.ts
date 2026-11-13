/**
 * Data-access for marketing campaigns (`marketing_campaigns`) and the
 * aggregate KPI rollup (`admin_marketing_kpis`).
 *
 * Powers the Marketing Agent's KPI dashboard: ROI, CAC, conversion rate,
 * top channels, and budget allocation.
 */

import { supabase } from './supabase';
import { computeCorpusHealth } from './analytics';
import type { CampaignStatus, Lesson, MarketingCampaign, MarketingKpis, Track } from './types';

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  spend: number | string;
  impressions: number | string;
  clicks: number | string;
  conversions: number | string;
  revenue: number | string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

function rowToCampaign(r: CampaignRow): MarketingCampaign {
  return {
    id: r.id,
    name: r.name,
    channel: r.channel,
    spend: num(r.spend),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    conversions: num(r.conversions),
    revenue: num(r.revenue),
    startDate: r.start_date,
    endDate: r.end_date,
    status: (r.status as CampaignStatus) ?? 'active',
    createdAt: r.created_at,
  };
}

export async function fetchCampaigns(): Promise<MarketingCampaign[]> {
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CampaignRow[]).map(rowToCampaign);
}

export async function upsertCampaign(
  c: Omit<MarketingCampaign, 'id' | 'createdAt'> & { id?: string }
): Promise<MarketingCampaign> {
  const row = {
    ...(c.id ? { id: c.id } : {}),
    name: c.name,
    channel: c.channel,
    spend: c.spend,
    impressions: c.impressions,
    clicks: c.clicks,
    conversions: c.conversions,
    revenue: c.revenue,
    start_date: c.startDate || null,
    end_date: c.endDate || null,
    status: c.status,
  };
  const { data, error } = await supabase
    .from('marketing_campaigns')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();
  if (error) throw error;
  return rowToCampaign(data as CampaignRow);
}

export async function deleteCampaign(id: string): Promise<void> {
  const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMarketingKpis(): Promise<MarketingKpis | null> {
  const { data, error } = await supabase.rpc('admin_marketing_kpis');
  if (error) throw error;
  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  return {
    totalSpend: num(row.total_spend),
    totalRevenue: num(row.total_revenue),
    totalClicks: num(row.total_clicks),
    totalConversions: num(row.total_conversions),
    totalImpressions: num(row.total_impressions),
    roi: num(row.roi),
    cac: num(row.cac),
    conversionRate: num(row.conversion_rate),
    campaigns: num(row.campaigns),
  };
}

/** Per-channel rollup, computed client-side from the campaign list. */
export type ChannelRollup = {
  channel: string;
  spend: number;
  revenue: number;
  clicks: number;
  conversions: number;
  /** `null` when the channel has no spend (ROI is undefined, not 0). */
  roi: number | null;
};

export function rollupByChannel(campaigns: MarketingCampaign[]): ChannelRollup[] {
  const map = new Map<string, ChannelRollup>();
  for (const c of campaigns) {
    const cur =
      map.get(c.channel) ??
      { channel: c.channel, spend: 0, revenue: 0, clicks: 0, conversions: 0, roi: null };
    cur.spend += c.spend;
    cur.revenue += c.revenue;
    cur.clicks += c.clicks;
    cur.conversions += c.conversions;
    map.set(c.channel, cur);
  }
  return [...map.values()]
    .map((r) => ({ ...r, roi: ratio(r.revenue - r.spend, r.spend) }))
    .sort((a, b) => b.spend - a.spend);
}

// ─── KPIs (client-side, so they follow the period filter) ─────────────────

/** a / b, or `null` when b is 0 — a ratio over nothing is unknown, not 0. */
function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/** Return on investment of one campaign, `null` without spend. */
export function campaignRoi(c: Pick<MarketingCampaign, 'spend' | 'revenue'>): number | null {
  return ratio(c.revenue - c.spend, c.spend);
}

/**
 * Key figures over a set of campaigns. Every value is `null` when it cannot
 * be computed (no campaign, no spend, no click, no conversion) so the
 * screen shows "—" instead of a misleading 0 % or 0 €.
 */
export type KpiSummary = {
  campaigns: number;
  spend: number | null;
  revenue: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  /** (revenue − spend) / spend */
  roi: number | null;
  /** Cost per conversion: spend / conversions. */
  cac: number | null;
  /** conversions / clicks */
  conversionRate: number | null;
};

export function computeKpis(campaigns: MarketingCampaign[]): KpiSummary {
  if (campaigns.length === 0) {
    return {
      campaigns: 0,
      spend: null,
      revenue: null,
      impressions: null,
      clicks: null,
      conversions: null,
      roi: null,
      cac: null,
      conversionRate: null,
    };
  }
  let spend = 0;
  let revenue = 0;
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  for (const c of campaigns) {
    spend += c.spend;
    revenue += c.revenue;
    impressions += c.impressions;
    clicks += c.clicks;
    conversions += c.conversions;
  }
  return {
    campaigns: campaigns.length,
    spend,
    revenue,
    impressions,
    clicks,
    conversions,
    roi: ratio(revenue - spend, spend),
    cac: ratio(spend, conversions),
    conversionRate: ratio(conversions, clicks),
  };
}

// ─── Period filter ─────────────────────────────────────────────────────────

/** Inclusive date range as `YYYY-MM-DD`; a missing bound is open. */
export type Period = { from: string | null; to: string | null };

export type PeriodPreset = 'all' | '30d' | '90d' | '12m' | 'year' | 'custom';

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Date range of a preset, relative to `today`. `custom` returns `custom`. */
export function presetPeriod(preset: PeriodPreset, today: Date, custom: Period = { from: null, to: null }): Period {
  const back = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return isoDay(d);
  };
  switch (preset) {
    case '30d':
      return { from: back(29), to: isoDay(today) };
    case '90d':
      return { from: back(89), to: isoDay(today) };
    case '12m': {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return { from: isoDay(d), to: isoDay(today) };
    }
    case 'year':
      return { from: `${today.getFullYear()}-01-01`, to: isoDay(today) };
    case 'custom':
      return custom;
    default:
      return { from: null, to: null };
  }
}

export const isOpenPeriod = (p: Period) => !p.from && !p.to;

/**
 * Campaigns that ran during the period: their dates overlap it. A campaign
 * with only a start date is treated as still running; one with only an end
 * date as having run up to it. Campaigns without any date cannot be placed
 * in time: they are kept for an open period and listed apart otherwise.
 * Spend and revenue are counted in full (they are not prorated).
 */
export function filterByPeriod(
  campaigns: MarketingCampaign[],
  period: Period
): { included: MarketingCampaign[]; undated: MarketingCampaign[] } {
  if (isOpenPeriod(period)) return { included: campaigns, undated: [] };
  const included: MarketingCampaign[] = [];
  const undated: MarketingCampaign[] = [];
  for (const c of campaigns) {
    const start = c.startDate?.slice(0, 10) || null;
    const end = c.endDate?.slice(0, 10) || null;
    if (!start && !end) {
      undated.push(c);
      continue;
    }
    const startsBeforeEnd = !period.to || !start || start <= period.to;
    const endsAfterStart = !period.from || (end ?? '9999-12-31') >= period.from;
    if (startsBeforeEnd && endsAfterStart) included.push(c);
  }
  return { included, undated };
}

// ─── Campaign form validation ─────────────────────────────────────────────

export type CampaignInput = Omit<MarketingCampaign, 'id' | 'createdAt'> & { id?: string };

export type CampaignErrors = Partial<
  Record<'name' | 'endDate' | 'spend' | 'impressions' | 'clicks' | 'conversions' | 'revenue', 'required' | 'negative' | 'beforeStart'>
>;

/** Returns the problems of a campaign before saving (empty object = valid). */
export function validateCampaign(c: CampaignInput): CampaignErrors {
  const errors: CampaignErrors = {};
  if (!c.name.trim()) errors.name = 'required';
  for (const k of ['spend', 'impressions', 'clicks', 'conversions', 'revenue'] as const) {
    if (!Number.isFinite(c[k]) || c[k] < 0) errors[k] = 'negative';
  }
  if (c.startDate && c.endDate && c.endDate < c.startDate) errors.endDate = 'beforeStart';
  return errors;
}

// ─── Corpus figures sent to the copy generator ────────────────────────────

/**
 * Corpus figures for marketing copy. Only published lessons count: drafts
 * (often empty) are not something a learner can open, so they must not
 * inflate claims like "120 lessons".
 */
export function marketingCorpusStats(lessons: Lesson[], tracks: Track[]) {
  const published = lessons.filter((l) => l.status === 'published');
  const h = computeCorpusHealth(published, tracks);
  const tracksWithLessons = h.byTrack.filter((t) => t.count > 0);
  return {
    note: 'Counts include published lessons only.',
    lessonCount: published.length,
    published: published.length,
    trackCount: tracksWithLessons.length,
    levels: h.byLevel.filter((l) => l.count > 0).map((l) => ({ level: l.label, count: l.count })),
    topTracks: tracksWithLessons.slice(0, 5).map((t) => ({ track: t.label, count: t.count })),
  };
}
