import { beforeEach, describe, expect, it, vi } from 'vitest';

type Res = { data: unknown; error: { code?: string; message?: string } | null };
const responses: Record<string, Res> = {};
const rpc = vi.fn(async (name: string) => responses[name] ?? { data: [], error: null });

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (name: string) => rpc(name) } }));

const { useAnalytics, BLOCK_KEYS } = await import('./analytics');

const RPC_OF = {
  counts: 'admin_global_counts',
  top: 'admin_top_completed_lessons',
  hardest: 'admin_hardest_lessons',
  missions: 'admin_mission_claims_summary',
  retention: 'admin_retention',
  lessonTime: 'admin_lesson_time',
  corr: 'admin_quiz_trading_corr',
  demo: 'admin_demo_status',
} as const;

const OK: Record<string, unknown[]> = {
  admin_global_counts: [{ total_users: 10, admins: 1, active_streakers: 4, total_completions: 20, total_coins: 5, total_xp: 7 }],
  admin_top_completed_lessons: [{ lesson_id: 'a', completions: '12', perfect_rate: 0.5 }],
  admin_hardest_lessons: [{ lesson_id: 'b', completions: 4, correct_rate: 0.2 }],
  admin_mission_claims_summary: [{ mission_id: 'm', claims: 3 }],
  admin_retention: [{ d7: 0.3, d30: 0.1, cohort: 50 }],
  admin_lesson_time: [{ lesson_id: 'a', avg_seconds: 90, learners: 8 }],
  admin_quiz_trading_corr: [{ lesson_id: 'a', quiz_completion: 0.8, pnl: 12 }],
  admin_demo_status: [{ demo_rows: 0, real_rows: 40 }],
};

const reset = () => {
  for (const k of Object.keys(responses)) delete responses[k];
  for (const [k, v] of Object.entries(OK)) responses[k] = { data: v, error: null };
  useAnalytics.setState({ loaded: false, loading: false, unavailable: false });
};

describe('analytics store', () => {
  beforeEach(reset);

  it('loads every block', async () => {
    await useAnalytics.getState().load();
    const s = useAnalytics.getState();
    for (const k of BLOCK_KEYS) expect(s.blocks[k].status).toBe('ready');
    expect(s.counts?.total_users).toBe(10);
    expect(s.topCompleted[0].completions).toBe(12);
    expect(s.retention?.cohort).toBe(50);
    expect(s.loaded).toBe(true);
  });

  // Each RPC error must surface on its own block — never as a silent empty list.
  for (const key of BLOCK_KEYS) {
    it(`reports an error on « ${key} » only`, async () => {
      responses[RPC_OF[key]] = { data: null, error: { code: '500', message: 'boom' } };
      await useAnalytics.getState().load();
      const s = useAnalytics.getState();
      expect(s.blocks[key]).toEqual({ status: 'error', error: 'boom' });
      for (const other of BLOCK_KEYS.filter((k) => k !== key)) expect(s.blocks[other].status).toBe('ready');
    });

    it(`marks « ${key} » as missing when the RPC is not installed`, async () => {
      responses[RPC_OF[key]] = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      await useAnalytics.getState().load();
      expect(useAnalytics.getState().blocks[key].status).toBe('missing');
    });
  }

  it('flags the whole feature unavailable when the core counts RPC is missing', async () => {
    responses.admin_global_counts = { data: null, error: { code: '42883', message: 'function does not exist' } };
    await useAnalytics.getState().load();
    expect(useAnalytics.getState().unavailable).toBe(true);
  });

  it('retention with an empty cohort falls back to the proxy (missing), not 0 %', async () => {
    responses.admin_retention = { data: [{ d7: null, d30: null, cohort: 0 }], error: null };
    await useAnalytics.getState().load();
    const s = useAnalytics.getState();
    expect(s.blocks.retention.status).toBe('missing');
    expect(s.retention).toBeNull();
  });

  it('keeps a missing counts column as null instead of a fake 0', async () => {
    responses.admin_global_counts = { data: [{ total_users: 3 }], error: null };
    await useAnalytics.getState().load();
    const c = useAnalytics.getState().counts!;
    expect(c.total_users).toBe(3);
    expect(c.active_streakers).toBeNull();
  });

  it('reload retries a single block and clears its error', async () => {
    responses.admin_hardest_lessons = { data: null, error: { message: 'timeout' } };
    await useAnalytics.getState().load();
    expect(useAnalytics.getState().blocks.hardest.status).toBe('error');
    responses.admin_hardest_lessons = { data: OK.admin_hardest_lessons, error: null };
    rpc.mockClear();
    await useAnalytics.getState().reload('hardest');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(useAnalytics.getState().blocks.hardest).toEqual({ status: 'ready', error: null });
    expect(useAnalytics.getState().hardest).toHaveLength(1);
  });
});
