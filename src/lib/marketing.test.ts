import { describe, expect, it } from 'vitest';
import {
  campaignRoi,
  computeKpis,
  filterByPeriod,
  marketingCorpusStats,
  presetPeriod,
  rollupByChannel,
  validateCampaign,
  type CampaignInput,
} from './marketing';
import type { Lesson, MarketingCampaign, Track } from './types';

const camp = (p: Partial<MarketingCampaign>): MarketingCampaign => ({
  id: p.id ?? 'c',
  name: 'Campagne',
  channel: 'Meta',
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  revenue: 0,
  startDate: null,
  endDate: null,
  status: 'active',
  ...p,
});

describe('computeKpis', () => {
  it('returns null everywhere without campaigns', () => {
    const k = computeKpis([]);
    expect(k.spend).toBeNull();
    expect(k.roi).toBeNull();
    expect(k.cac).toBeNull();
    expect(k.conversionRate).toBeNull();
  });

  it('keeps ratios null when their denominator is zero', () => {
    const k = computeKpis([camp({ spend: 0, revenue: 100 })]);
    expect(k.spend).toBe(0);
    expect(k.roi).toBeNull();
    expect(k.cac).toBeNull();
    expect(k.conversionRate).toBeNull();
  });

  it('sums and computes ratios', () => {
    const k = computeKpis([
      camp({ spend: 100, revenue: 150, clicks: 50, conversions: 5 }),
      camp({ spend: 100, revenue: 50, clicks: 50, conversions: 5 }),
    ]);
    expect(k.spend).toBe(200);
    expect(k.roi).toBe(0);
    expect(k.cac).toBe(20);
    expect(k.conversionRate).toBe(0.1);
  });
});

describe('campaignRoi and rollupByChannel', () => {
  it('is null without spend', () => {
    expect(campaignRoi({ spend: 0, revenue: 10 })).toBeNull();
    expect(campaignRoi({ spend: 10, revenue: 15 })).toBe(0.5);
  });

  it('groups by channel, sorted by spend', () => {
    const r = rollupByChannel([
      camp({ channel: 'Meta', spend: 10, revenue: 20 }),
      camp({ channel: 'Google', spend: 50, revenue: 25 }),
      camp({ channel: 'Meta', spend: 10, revenue: 0 }),
      camp({ channel: 'Email', spend: 0, revenue: 5 }),
    ]);
    expect(r.map((x) => x.channel)).toEqual(['Google', 'Meta', 'Email']);
    expect(r[1]).toMatchObject({ spend: 20, revenue: 20, roi: 0 });
    expect(r[2].roi).toBeNull();
  });
});

describe('period filter', () => {
  const list = [
    camp({ id: 'old', startDate: '2026-01-01', endDate: '2026-01-31' }),
    camp({ id: 'oct', startDate: '2026-10-01', endDate: '2026-10-31' }),
    camp({ id: 'running', startDate: '2026-11-01', endDate: null }),
    camp({ id: 'endOnly', startDate: null, endDate: '2026-11-05' }),
    camp({ id: 'undated' }),
  ];

  it('keeps everything for an open period', () => {
    const r = filterByPeriod(list, { from: null, to: null });
    expect(r.included).toHaveLength(5);
    expect(r.undated).toHaveLength(0);
  });

  it('keeps campaigns overlapping the period and sets undated apart', () => {
    const r = filterByPeriod(list, { from: '2026-10-15', to: '2026-11-13' });
    expect(r.included.map((c) => c.id)).toEqual(['oct', 'running', 'endOnly']);
    expect(r.undated.map((c) => c.id)).toEqual(['undated']);
  });

  it('excludes campaigns starting after the period', () => {
    const r = filterByPeriod(list, { from: null, to: '2026-09-30' });
    expect(r.included.map((c) => c.id)).toEqual(['old', 'endOnly']);
  });

  it('computes presets from today', () => {
    const today = new Date(2026, 10, 13);
    expect(presetPeriod('30d', today)).toEqual({ from: '2026-10-15', to: '2026-11-13' });
    expect(presetPeriod('year', today)).toEqual({ from: '2026-01-01', to: '2026-11-13' });
    expect(presetPeriod('12m', today)).toEqual({ from: '2025-11-14', to: '2026-11-13' });
    expect(presetPeriod('all', today)).toEqual({ from: null, to: null });
  });
});

describe('validateCampaign', () => {
  const base: CampaignInput = { ...camp({}), name: 'Rentrée' };
  it('accepts a valid campaign', () => {
    expect(validateCampaign(base)).toEqual({});
  });
  it('flags missing name, negative numbers and inverted dates', () => {
    const e = validateCampaign({ ...base, name: ' ', spend: -1, startDate: '2026-02-01', endDate: '2026-01-01' });
    expect(e).toEqual({ name: 'required', spend: 'negative', endDate: 'beforeStart' });
  });
});

describe('marketingCorpusStats', () => {
  const tracks = [
    { id: 't1', emoji: '💶', nameFr: 'Budget', level: 'Débutant', sortOrder: 0 },
    { id: 't2', emoji: '📈', nameFr: 'Bourse', level: 'Débutant', sortOrder: 1 },
  ] as Track[];
  const lesson = (id: string, trackId: string, status: 'draft' | 'published') =>
    ({ id, trackId, status, level: 'Débutant', tag: 'Core', blocks: [], quizzes: [], translations: {} }) as unknown as Lesson;

  it('counts published lessons only', () => {
    const s = marketingCorpusStats(
      [lesson('a', 't1', 'published'), lesson('b', 't1', 'draft'), lesson('c', 't2', 'draft')],
      tracks
    );
    expect(s.lessonCount).toBe(1);
    expect(s.trackCount).toBe(1);
    expect(s.topTracks).toEqual([{ track: 'Budget', count: 1 }]);
    expect(s.levels).toEqual([{ level: 'Débutant', count: 1 }]);
  });
});
