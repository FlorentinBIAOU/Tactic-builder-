/**
 * Runtime validation of the JSON returned by the admin-ai edge function.
 * The model's output is not trusted: every answer is parsed and normalised
 * here before the UI uses it, so a malformed answer becomes an error
 * message instead of a crash.
 */

import { z } from 'zod';
import type { Block, BlockType, Quiz, Translation } from './types';

const text = (max = 4000) =>
  z.preprocess((v) => (v == null ? '' : typeof v === 'string' ? v : String(v)), z.string()).transform((s) => s.slice(0, max));

const optText = (max = 400) =>
  z.preprocess((v) => (v == null || v === '' ? undefined : String(v)), z.string().optional()).transform((s) => s?.slice(0, max));

const BLOCK_TYPES: BlockType[] = ['hook', 'content', 'tip', 'trap', 'real', 'info'];

export const blockSchema: z.ZodType<Block, z.ZodTypeDef, unknown> = z
  .object({
    type: z.preprocess((v) => (BLOCK_TYPES.includes(v as BlockType) ? v : 'content'), z.enum(['hook', 'content', 'tip', 'trap', 'real', 'info'])),
    text: text(),
    emo: optText(8),
    title: optText(200),
  })
  .transform((b) => b as Block);

export const quizSchema: z.ZodType<Quiz, z.ZodTypeDef, unknown> = z
  .object({
    q: text(500),
    opts: z.array(text(300)).min(2).max(6),
    correct: z.preprocess((v) => Number(v), z.number().int().catch(0)),
    expl: text(800),
  })
  .transform((q) => ({ ...q, correct: q.correct >= 0 && q.correct < q.opts.length ? q.correct : 0 }));

const blocks = z.array(z.unknown()).transform((arr) =>
  arr.flatMap((b) => {
    const r = blockSchema.safeParse(b);
    return r.success && r.data.text.trim() ? [r.data] : [];
  })
);

const quizzes = z.array(z.unknown()).transform((arr) =>
  arr.flatMap((q) => {
    const r = quizSchema.safeParse(q);
    return r.success ? [r.data] : [];
  })
);

export const generatedContentSchema = z.object({
  blocks: blocks.refine((b) => b.length > 0, 'no blocks'),
  quiz: quizSchema,
});

const translationSchema: z.ZodType<Translation, z.ZodTypeDef, unknown> = z.object({
  title: optText(200),
  blocks: blocks.optional(),
  quizzes: quizzes.optional(),
});

export const translateSchema = z
  .object({ en: translationSchema.optional(), es: translationSchema.optional() })
  .refine((t) => t.en || t.es, 'no translation');

const ideaSchema = z.object({
  emoji: text(8),
  name: text(200).refine((s) => s.trim().length > 0),
  tag: text(60),
  why: text(300),
  summary: optText(400),
});

export const ideasSchema = z.object({
  ideas: z.array(z.unknown()).transform((arr) =>
    arr.flatMap((i) => {
      const r = ideaSchema.safeParse(i);
      return r.success ? [r.data] : [];
    })
  ),
});

export const moduleIdeasSchema = z.object({
  ideas: z.array(z.unknown()).transform((arr) =>
    arr.flatMap((i) => {
      const r = ideaSchema.omit({ tag: true, summary: true }).safeParse(i);
      return r.success ? [r.data] : [];
    })
  ),
});

const strList = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((arr) => arr.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean).slice(0, max));

export const agentReportSchema = z.object({
  findings: strList(20),
  sections: z
    .array(z.object({ title: text(200), content: text(6000) }))
    .optional()
    .catch(undefined),
  lessons: z
    .array(z.object({ id: optText(80), name: text(200), rationale: text(600) }))
    .optional()
    .catch(undefined),
});

export const marketingSchema = z.object({
  headlines: strList(10),
  social_posts: strList(10),
  value_props: strList(10),
  cta: text(80),
});

export const replySchema = z.object({ reply: text(8000) });
export const inviteSchema = z.object({ invited: text(254) });
