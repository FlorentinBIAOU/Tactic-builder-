import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useAnalytics } from '@/store/analytics';
import { fetchLessonFunnel, type FunnelStep } from '@/lib/events';
import { formatDuration } from '@/lib/format';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { Stat } from '@/components/ui/page';
import { Notice, Skeleton } from '@/components/ui/feedback';
import { ChartBox, SERIES, axis, fmtEur, fmtInt, fmtPct, grid, tooltipStyle } from '@/components/ui/chart';
import { AnalyticsError, Block, BlockError, BlockHeader, HBars, ProxyNote, useLessonNames } from './parts';

const dash = '—';
const n = (v: number | null | undefined) => (v === null || v === undefined ? dash : fmtInt(v));

export default function LearnersTab() {
  const { t } = useTranslation('stats');
  const a = useAnalytics();
  const name = useLessonNames();

  if (a.unavailable) {
    return (
      <Notice tone="info" title={t('learners.notInstalledTitle')}>
        {t('learners.notInstalledBody')}
      </Notice>
    );
  }

  const st = a.blocks;
  const loadingOf = (k: keyof typeof st) => st[k].status === 'idle' || st[k].status === 'loading';

  return (
    <div className="flex flex-col gap-6">
      {/* Key figures */}
      <Block>
        <BlockHeader title={t('learners.figures')} />
        {loadingOf('counts') ? (
          <Skeleton className="h-16 w-full" />
        ) : st.counts.status === 'error' ? (
          <AnalyticsError block="counts" />
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t('learners.users')} value={n(a.counts?.total_users)} />
            <Stat label={t('learners.admins')} value={n(a.counts?.admins)} />
            <Stat label={t('learners.streakers')} value={n(a.counts?.active_streakers)} hint={t('learners.streakersHint')} />
            <Stat label={t('learners.completions')} value={n(a.counts?.total_completions)} />
            <Stat label={t('learners.xp')} value={n(a.counts?.total_xp)} />
            <Stat label={t('learners.coins')} value={n(a.counts?.total_coins)} />
          </div>
        )}
      </Block>

      {/* Retention */}
      <Retention />

      <div className="grid gap-6 lg:grid-cols-2">
        <Block>
          <BlockHeader title={t('learners.top')} info={t('learners.topInfo')} />
          {loadingOf('top') ? (
            <Skeleton className="h-56 w-full" />
          ) : st.top.status === 'error' ? (
            <AnalyticsError block="top" />
          ) : a.topCompleted.length === 0 ? (
            <p className="text-base text-muted">{t('learners.noCompletions')}</p>
          ) : (
            <HBars
              data={a.topCompleted.map((r) => ({ name: name(r.lesson_id), value: r.completions }))}
              label={t('learners.top')}
              seriesName={t('learners.completionsSeries')}
              color={SERIES[2]}
            />
          )}
        </Block>
        <Block>
          <BlockHeader title={t('learners.hardest')} info={t('learners.hardestInfo')} />
          {loadingOf('hardest') ? (
            <Skeleton className="h-56 w-full" />
          ) : st.hardest.status === 'error' ? (
            <AnalyticsError block="hardest" />
          ) : a.hardest.length === 0 ? (
            <p className="text-base text-muted">{t('learners.noHardest')}</p>
          ) : (
            <HBars
              data={a.hardest.map((r) => ({ name: name(r.lesson_id), value: r.correct_rate }))}
              label={t('learners.hardest')}
              seriesName={t('learners.correctRate')}
              color={SERIES[4]}
              format={(v) => fmtPct(v)}
              domain={[0, 1]}
            />
          )}
        </Block>
      </div>

      <Funnel />

      <div className="grid gap-6 lg:grid-cols-2">
        <Block>
          <BlockHeader title={t('learners.time')} info={t('learners.timeInfo')} />
          {loadingOf('lessonTime') ? (
            <Skeleton className="h-56 w-full" />
          ) : st.lessonTime.status === 'error' ? (
            <AnalyticsError block="lessonTime" />
          ) : a.lessonTime.length === 0 ? (
            <p className="text-base text-muted">{st.lessonTime.status === 'missing' ? t('learners.eventsNotInstalled') : t('learners.noEvents')}</p>
          ) : (
            <HBars
              data={a.lessonTime.map((r) => ({ name: name(r.lessonId), value: r.avgSeconds }))}
              label={t('learners.time')}
              seriesName={t('learners.avgTime')}
              color={SERIES[1]}
              format={formatDuration}
            />
          )}
        </Block>
        <Block>
          <BlockHeader title={t('learners.missions')} info={t('learners.missionsInfo')} />
          {loadingOf('missions') ? (
            <Skeleton className="h-56 w-full" />
          ) : st.missions.status === 'error' ? (
            <AnalyticsError block="missions" />
          ) : st.missions.status === 'missing' ? (
            <p className="text-base text-muted">{t('learners.missionsMissing')}</p>
          ) : a.missions.length === 0 ? (
            <p className="text-base text-muted">{t('learners.noMissions')}</p>
          ) : (
            <HBars
              data={a.missions.map((m) => ({ name: m.mission_id, value: m.claims }))}
              label={t('learners.missions')}
              seriesName={t('learners.claims')}
              color={SERIES[3]}
            />
          )}
        </Block>
      </div>

      <QuizPnl />
    </div>
  );
}

// ─── Retention ─────────────────────────────────────────────────────────────

function Retention() {
  const { t } = useTranslation('stats');
  const a = useAnalytics();
  const s = a.blocks.retention.status;
  const real = a.retention;
  const proxy =
    a.counts?.total_users && a.counts.active_streakers !== null ? a.counts.active_streakers / a.counts.total_users : null;
  const mastery = a.topCompleted.length ? a.topCompleted.reduce((x, r) => x + r.perfect_rate, 0) / a.topCompleted.length : null;

  return (
    <Block>
      <BlockHeader title={t('learners.retention')} info={t('learners.retentionInfo')} />
      {s === 'idle' || s === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : s === 'error' ? (
        <AnalyticsError block="retention" />
      ) : (
        <>
          {!real ? <ProxyNote>{t('learners.retentionProxy')}</ProxyNote> : null}
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            <Stat
              label={t('learners.d7')}
              value={real ? fmtPct(real.d7) : proxy !== null ? fmtPct(proxy) : dash}
              hint={real ? t('learners.cohort', { count: real.cohort, n: fmtInt(real.cohort) }) : t('learners.d7Proxy')}
            />
            <Stat
              label={t('learners.d30')}
              value={real ? fmtPct(real.d30) : dash}
              hint={real ? t('learners.cohort', { count: real.cohort, n: fmtInt(real.cohort) }) : t('learners.d30Proxy')}
            />
            <Stat label={t('learners.mastery')} value={mastery !== null ? fmtPct(mastery) : dash} hint={t('learners.masteryHint')} />
          </div>
        </>
      )}
    </Block>
  );
}

// ─── Drop-off funnel ───────────────────────────────────────────────────────

function Funnel() {
  const { t } = useTranslation('stats');
  const name = useLessonNames();
  const lessonTime = useAnalytics((s) => s.lessonTime);
  const timeStatus = useAnalytics((s) => s.blocks.lessonTime.status);
  const hardest = useAnalytics((s) => s.hardest);
  const [lessonId, setLessonId] = useState('');
  const [steps, setSteps] = useState<FunnelStep[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const options = lessonTime;
  const selected = lessonId || options[0]?.lessonId || '';

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setState('loading');
    setError(null);
    try {
      const res = await fetchLessonFunnel(id);
      setSteps(res ?? []);
      setState(res === null ? 'missing' : 'ready');
    } catch (err) {
      const e = err as { message?: string } | null;
      setError(e?.message ?? null);
      setSteps(null);
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load(selected);
  }, [selected, load]);

  const data = useMemo(() => {
    if (!steps?.length) return [];
    const start = steps[0].learners || 1;
    return steps.map((s, i) => ({
      step: t('learners.step', { n: s.stepIndex }),
      learners: s.learners,
      share: s.learners / start,
      drop: i === 0 ? 0 : (steps[i - 1].learners - s.learners) / (steps[i - 1].learners || 1),
    }));
  }, [steps, t]);
  const worst = data.slice(1).reduce<(typeof data)[number] | null>((w, d) => (!w || d.drop > w.drop ? d : w), null);

  const noEvents = timeStatus === 'missing' || (timeStatus === 'ready' && options.length === 0);

  return (
    <Block>
      <BlockHeader title={t('learners.funnel')} info={t('learners.funnelInfo')} />
      {timeStatus === 'idle' || timeStatus === 'loading' ? (
        <Skeleton className="h-64 w-full" />
      ) : timeStatus === 'error' ? (
        <AnalyticsError block="lessonTime" />
      ) : noEvents ? (
        <>
          <ProxyNote>{t('learners.funnelProxy')}</ProxyNote>
          {hardest.length === 0 ? (
            <p className="text-base text-muted">{t('learners.noHardest')}</p>
          ) : (
            <HBars
              data={hardest.slice(0, 8).map((r) => ({ name: name(r.lesson_id), value: 1 - r.correct_rate }))}
              label={t('learners.funnel')}
              seriesName={t('learners.errorRate')}
              color={SERIES[4]}
              format={(v) => fmtPct(v)}
              domain={[0, 1]}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t('learners.funnelLesson')} className="max-w-md">
            <NativeSelect value={selected} onChange={(e) => setLessonId(e.target.value)}>
              {options.map((o) => (
                <option key={o.lessonId} value={o.lessonId}>
                  {name(o.lessonId)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {state === 'loading' || state === 'idle' ? (
            <Skeleton className="h-56 w-full" />
          ) : state === 'error' ? (
            <BlockError detail={error} onRetry={() => void load(selected)} />
          ) : data.length === 0 ? (
            <p className="text-base text-muted">{state === 'missing' ? t('learners.eventsNotInstalled') : t('learners.funnelEmpty')}</p>
          ) : (
            <>
              {worst && worst.drop > 0 ? (
                <p className="text-base">
                  {t('learners.funnelWorst', { step: worst.step, pct: fmtPct(worst.drop) })}
                </p>
              ) : null}
              <ChartBox label={t('learners.funnel')} height={240}>
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...grid} />
                  <XAxis dataKey="step" {...axis} />
                  <YAxis {...axis} allowDecimals={false} tickFormatter={fmtInt} />
                  <RTooltip
                    {...tooltipStyle}
                    formatter={(v: number, _n, item) => [
                      `${fmtInt(v)} (${fmtPct((item.payload as { share: number }).share)})`,
                      t('learners.learnersSeries'),
                    ]}
                  />
                  <Bar dataKey="learners" name={t('learners.learnersSeries')} radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                    {data.map((d) => (
                      <Cell key={d.step} fill={worst && d.step === worst.step ? SERIES[4] : SERIES[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartBox>
            </>
          )}
        </div>
      )}
    </Block>
  );
}

// ─── Quiz × PnL ────────────────────────────────────────────────────────────

function QuizPnl() {
  const { t } = useTranslation('stats');
  const name = useLessonNames();
  const corr = useAnalytics((s) => s.corr);
  const status = useAnalytics((s) => s.blocks.corr.status);
  const top = useAnalytics((s) => s.topCompleted);

  const real = corr.length > 0;
  const proxyPoints = top.map((r) => ({ x: r.perfect_rate, y: r.completions, label: name(r.lesson_id) }));
  const points = real ? corr.map((p) => ({ x: p.quizCompletion, y: p.pnl, label: name(p.lessonId) })) : proxyPoints;

  return (
    <Block>
      <BlockHeader title={t('learners.corr')} info={t('learners.corrInfo')} />
      {status === 'idle' || status === 'loading' ? (
        <Skeleton className="h-64 w-full" />
      ) : status === 'error' ? (
        <AnalyticsError block="corr" />
      ) : (
        <>
          {real ? (
            <p className="mb-3 text-sm text-muted">{t('learners.corrSub', { count: corr.length, n: fmtInt(corr.length) })}</p>
          ) : (
            <ProxyNote>{status === 'missing' ? t('learners.corrProxyMissing') : t('learners.corrProxyEmpty')}</ProxyNote>
          )}
          {points.length === 0 ? (
            <p className="text-base text-muted">{t('learners.noCompletions')}</p>
          ) : (
            <ChartBox label={t('learners.corr')} height={280}>
              <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: 4 }}>
                <CartesianGrid {...grid} vertical />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[0, 1]}
                  {...axis}
                  tickFormatter={(v: number) => fmtPct(v)}
                  name={real ? t('learners.quizCompletion') : t('learners.perfectRate')}
                  label={{ value: real ? t('learners.quizCompletion') : t('learners.perfectRate'), position: 'insideBottom', offset: -10, fill: 'rgb(var(--c-muted))', fontSize: 12 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  {...axis}
                  width={64}
                  tickFormatter={real ? fmtEur : fmtInt}
                  name={real ? t('learners.pnl') : t('learners.completionsSeries')}
                />
                <ZAxis range={[48, 48]} />
                {real ? <ReferenceLine y={0} stroke="rgb(var(--c-input))" /> : null}
                <RTooltip
                  {...tooltipStyle}
                  cursor={{ strokeDasharray: '3 3', stroke: 'rgb(var(--c-border))' }}
                  formatter={(v: number, key: string) =>
                    key === (real ? t('learners.quizCompletion') : t('learners.perfectRate')) ? [fmtPct(v), key] : [real ? fmtEur(v) : fmtInt(v), key]
                  }
                  labelFormatter={() => ''}
                />
                <Scatter data={points} isAnimationActive={false} fillOpacity={0.8}>
                  {points.map((p, i) => (
                    <Cell key={i} fill={real ? (p.y >= 0 ? SERIES[2] : SERIES[4]) : SERIES[0]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ChartBox>
          )}
          {real ? <p className="mt-2 text-sm text-muted">{t('learners.corrLegend')}</p> : null}
        </>
      )}
    </Block>
  );
}
