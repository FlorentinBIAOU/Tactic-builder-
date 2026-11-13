/**
 * Analytics store (zustand).
 *
 * Loads cross-user aggregates (0003_admin_analytics.sql) and learning events
 * (0005_events.sql). Every RPC is a separate « block » with its own status,
 * so a page can show « unavailable + retry » on the one chart that failed
 * instead of an empty list that looks like « no data ».
 *
 * Block status:
 *  - `missing`  the RPC is not installed (the page shows a proxy or a note)
 *  - `error`    the call failed (network, permission…), `error` holds details
 *  - `ready`    data loaded (it may still be an empty list)
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import {
  fetchDemoStatus,
  fetchLessonTime,
  fetchQuizTradingCorr,
  fetchRetention,
  isMissingRpc,
  num,
  type CorrPoint,
  type DemoStatus,
  type LessonTime,
  type Retention,
} from '@/lib/events';

export type GlobalCounts = {
  /** `null` when the column is missing from the RPC result (never a fake 0). */
  total_users: number | null;
  admins: number | null;
  active_streakers: number | null;
  total_completions: number | null;
  total_coins: number | null;
  total_xp: number | null;
};

export type TopLessonRow = { lesson_id: string; completions: number; perfect_rate: number };
export type HardLessonRow = { lesson_id: string; completions: number; correct_rate: number };
export type MissionClaimRow = { mission_id: string; claims: number };

export const BLOCK_KEYS = ['counts', 'top', 'hardest', 'missions', 'retention', 'lessonTime', 'corr', 'demo'] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
export type BlockStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';
export type BlockState = { status: BlockStatus; error: string | null };

type Data = {
  counts: GlobalCounts | null;
  topCompleted: TopLessonRow[];
  hardest: HardLessonRow[];
  missions: MissionClaimRow[];
  /** `null` = no real cohort yet (RPC missing or nobody old enough): use the proxy. */
  retention: Retention | null;
  lessonTime: LessonTime[];
  corr: CorrPoint[];
  demo: DemoStatus | null;
};

type State = Data & {
  blocks: Record<BlockKey, BlockState>;
  loading: boolean;
  loaded: boolean;
  /** The core analytics RPCs (0003) are not installed. */
  unavailable: boolean;
  /** Load every block. Safe to call again to refresh. */
  load: () => Promise<void>;
  /** Reload a single block (the « Retry » button of a chart). */
  reload: (key: BlockKey) => Promise<void>;
};

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

/** Turns a raw RPC result into data, or throws a tagged error. */
class MissingRpcError extends Error {}

function unwrap<T>(res: RpcResult, map: (rows: Record<string, unknown>[]) => T): T {
  if (res.error) {
    if (isMissingRpc(res.error)) throw new MissingRpcError(res.error.message ?? 'missing');
    throw new Error(res.error.message || res.error.code || 'Request failed');
  }
  return map((res.data ?? []) as Record<string, unknown>[]);
}

/** Readable detail of any thrown value (Error, Supabase error object…). */
function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; code?: string } | null;
  return e?.message || e?.code || 'Request failed';
}

const optNum = (v: unknown): number | null => (v === undefined || v === null ? null : num(v));

export function mapCounts(rows: Record<string, unknown>[]): GlobalCounts | null {
  const r = rows[0];
  if (!r) return null;
  return {
    total_users: optNum(r.total_users),
    admins: optNum(r.admins),
    active_streakers: optNum(r.active_streakers),
    total_completions: optNum(r.total_completions),
    total_coins: optNum(r.total_coins),
    total_xp: optNum(r.total_xp),
  };
}

/** One loader per block: returns the slice of state it fills. */
const LOADERS: Record<BlockKey, () => Promise<Partial<Data>>> = {
  counts: async () => ({ counts: unwrap(await supabase.rpc('admin_global_counts'), mapCounts) }),
  top: async () => ({
    topCompleted: unwrap(await supabase.rpc('admin_top_completed_lessons', { p_limit: 10 }), (rows) =>
      rows.map((r) => ({ lesson_id: String(r.lesson_id), completions: num(r.completions), perfect_rate: num(r.perfect_rate) }))
    ),
  }),
  hardest: async () => ({
    hardest: unwrap(await supabase.rpc('admin_hardest_lessons', { p_min_completions: 3, p_limit: 10 }), (rows) =>
      rows.map((r) => ({ lesson_id: String(r.lesson_id), completions: num(r.completions), correct_rate: num(r.correct_rate) }))
    ),
  }),
  missions: async () => ({
    missions: unwrap(await supabase.rpc('admin_mission_claims_summary', { p_limit: 20 }), (rows) =>
      rows.map((r) => ({ mission_id: String(r.mission_id), claims: num(r.claims) }))
    ),
  }),
  retention: async () => {
    const retention = await fetchRetention();
    if (!retention) throw new MissingRpcError('no cohort');
    return { retention };
  },
  lessonTime: async () => {
    const lessonTime = await fetchLessonTime(15);
    if (lessonTime === null) throw new MissingRpcError('admin_lesson_time');
    return { lessonTime };
  },
  corr: async () => {
    const corr = await fetchQuizTradingCorr(300);
    if (corr === null) throw new MissingRpcError('admin_quiz_trading_corr');
    return { corr };
  },
  demo: async () => {
    const demo = await fetchDemoStatus();
    if (demo === null) throw new MissingRpcError('admin_demo_status');
    return { demo };
  },
};

/** Value each block falls back to when it is missing or failed. */
const EMPTY: Data = {
  counts: null,
  topCompleted: [],
  hardest: [],
  missions: [],
  retention: null,
  lessonTime: [],
  corr: [],
  demo: null,
};
const FIELD: Record<BlockKey, keyof Data> = {
  counts: 'counts',
  top: 'topCompleted',
  hardest: 'hardest',
  missions: 'missions',
  retention: 'retention',
  lessonTime: 'lessonTime',
  corr: 'corr',
  demo: 'demo',
};

const idle = () =>
  Object.fromEntries(BLOCK_KEYS.map((k) => [k, { status: 'idle', error: null }])) as Record<BlockKey, BlockState>;

export const useAnalytics = create<State>((set, get) => {
  const runBlock = async (key: BlockKey) => {
    set((s) => ({ blocks: { ...s.blocks, [key]: { status: 'loading', error: null } } }));
    let patch: Partial<Data>;
    let block: BlockState;
    try {
      patch = await LOADERS[key]();
      block = { status: 'ready', error: null };
    } catch (err) {
      patch = { [FIELD[key]]: EMPTY[FIELD[key]] } as Partial<Data>;
      block =
        err instanceof MissingRpcError
          ? { status: 'missing', error: null }
          : { status: 'error', error: errorText(err) };
    }
    set((s) => ({
      ...patch,
      blocks: { ...s.blocks, [key]: block },
      ...(key === 'counts' ? { unavailable: block.status === 'missing' } : {}),
    }));
  };

  return {
    ...EMPTY,
    blocks: idle(),
    loading: false,
    loaded: false,
    unavailable: false,

    load: async () => {
      if (get().loading) return;
      set({ loading: true });
      await Promise.all(BLOCK_KEYS.map(runBlock));
      set({ loading: false, loaded: true });
    },

    reload: (key) => runBlock(key),
  };
});
