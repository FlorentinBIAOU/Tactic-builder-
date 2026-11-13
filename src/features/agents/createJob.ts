import { create } from 'zustand';
import i18n from '@/i18n';
import { useCorpus } from '@/store/corpus';
import { LessonConflictError, fetchLessonBlocks, updateLesson } from '@/lib/corpus';
import { aiGenerateContent, type AiResult, type GeneratedContent } from '@/lib/ai';
import { toast } from '@/components/Toast';

type Progress = { done: number; total: number; current: string };

type JobState = {
  progress: Progress | null;
  stopping: boolean;
  start: (trackId: string) => Promise<void>;
  stop: () => void;
};

const ABORTED = Symbol('aborted');
let controller: AbortController | null = null;

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, { ns: 'agents', ...opts });

/**
 * Create agent, generation job: blocks + quiz for every empty lesson of a
 * module, saved as drafts. Lives outside the component so it keeps running
 * when the agent panel is closed. A lesson that gained content in the
 * meantime (in this tab or in the database) is skipped.
 */
export const useCreateJob = create<JobState>((set, get) => ({
  progress: null,
  stopping: false,

  stop: () => {
    if (!controller) return;
    set({ stopping: true });
    controller.abort();
  },

  start: async (trackId) => {
    if (get().progress) return;
    const { tracks, lessons } = useCorpus.getState();
    const track = tracks.find((tr) => tr.id === trackId);
    if (!track) return;
    const queue = lessons.filter((l) => l.trackId === trackId && l.blocks.length === 0);
    if (queue.length === 0) {
      toast(t('create.noneEmpty'), 'info');
      return;
    }

    controller = new AbortController();
    const signal = controller.signal;
    const aborted = new Promise<typeof ABORTED>((resolve) =>
      signal.addEventListener('abort', () => resolve(ABORTED), { once: true })
    );
    let ok = 0;
    let skipped = 0;
    let failed = 0;
    let stopped = false;

    for (const [i, l] of queue.entries()) {
      if (signal.aborted) {
        stopped = true;
        break;
      }
      set({ progress: { done: i, total: queue.length, current: l.name } });
      const res: AiResult<GeneratedContent> | typeof ABORTED = await Promise.race([
        aiGenerateContent({ name: l.name, level: l.level, tag: l.tag, track: track.nameFr, duration: l.duration }),
        aborted,
      ]);
      if (res === ABORTED) {
        stopped = true;
        break;
      }
      if (!res.ok) {
        failed++;
        continue;
      }
      // Someone may have added content to this lesson during generation:
      // check this tab and the database, and leave it alone if so.
      const latest = useCorpus.getState().lessons.find((x) => x.id === l.id) ?? l;
      const dbBlocks = await fetchLessonBlocks(l.id).catch(() => null);
      if (latest.blocks.length > 0 || dbBlocks === null || dbBlocks.length > 0) {
        skipped++;
        continue;
      }
      // Saved directly (not through the store) so the run ends with a single
      // summary toast. The update only applies if `updatedAt` still matches:
      // a conflict means the lesson was edited meanwhile, so it is skipped.
      try {
        const saved = await updateLesson({
          ...latest,
          blocks: res.data.blocks ?? [],
          quizzes: res.data.quiz ? [res.data.quiz] : latest.quizzes,
          status: 'draft',
        });
        useCorpus.setState((s) => ({ lessons: s.lessons.map((x) => (x.id === saved.id ? saved : x)) }));
        ok++;
      } catch (err) {
        if (err instanceof LessonConflictError) skipped++;
        else failed++;
      }
    }

    controller = null;
    set({ progress: null, stopping: false });
    const parts = [t('create.summary', { ok, total: queue.length })];
    if (skipped) parts.push(t('create.summarySkipped', { count: skipped }));
    if (failed) parts.push(t('create.summaryFailed', { count: failed }));
    if (stopped) parts.push(t('create.summaryStopped'));
    toast(parts.join(' '), ok ? 'success' : failed && !stopped ? 'error' : 'info');
  },
}));
