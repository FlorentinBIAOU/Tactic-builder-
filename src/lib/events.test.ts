import { describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('./supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

const { fetchLessonFunnel, fetchRetention, isMissingRpc, num } = await import('./events');

describe('isMissingRpc', () => {
  it('recognises a function that is not installed', () => {
    expect(isMissingRpc({ code: 'PGRST202' })).toBe(true);
    expect(isMissingRpc({ code: '42883' })).toBe(true);
    expect(isMissingRpc({ message: 'Could not find the function public.x' })).toBe(true);
    expect(isMissingRpc({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingRpc(null)).toBe(false);
  });
});

describe('num', () => {
  it('parses numeric strings and rejects junk', () => {
    expect(num('12')).toBe(12);
    expect(num(undefined)).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('fetchLessonFunnel', () => {
  it('returns steps in order', async () => {
    rpc.mockResolvedValueOnce({ data: [{ step_index: 2, learners: 5 }, { step_index: 0, learners: 9 }], error: null });
    expect(await fetchLessonFunnel('a')).toEqual([
      { stepIndex: 0, learners: 9 },
      { stepIndex: 2, learners: 5 },
    ]);
  });

  it('throws on a real error, returns null when not installed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42702', message: 'ambiguous' } });
    await expect(fetchLessonFunnel('a')).rejects.toBeTruthy();
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } });
    expect(await fetchLessonFunnel('a')).toBeNull();
  });
});

describe('fetchRetention', () => {
  it('returns null when nobody is old enough to measure', async () => {
    rpc.mockResolvedValueOnce({ data: [{ d7: null, d30: null, cohort: 0 }], error: null });
    expect(await fetchRetention()).toBeNull();
  });
});
