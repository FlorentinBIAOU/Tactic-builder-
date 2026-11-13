/**
 * Client wrappers around the `admin-ai` Supabase edge function.
 *
 * Every call goes through `supabase.functions.invoke('admin-ai', ...)`,
 * which automatically attaches the caller's JWT — the function rejects
 * non-admins. The OpenAI key never touches the browser bundle.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';
import type { ZodType, ZodTypeDef } from 'zod';
import type { Block, Quiz, Translation } from '@/lib/types';
import {
  agentReportSchema,
  generatedContentSchema,
  ideasSchema,
  inviteSchema,
  marketingSchema,
  moduleIdeasSchema,
  replySchema,
  translateSchema,
} from '@/lib/aiSchemas';

export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function invoke<T>(
  body: Record<string, unknown>,
  schema: ZodType<T, ZodTypeDef, unknown>
): Promise<AiResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('admin-ai', { body });
    if (error) {
      // Non-2xx answers carry a readable `error` in their JSON body.
      if (error instanceof FunctionsHttpError) {
        const status = (error.context as Response).status;
        if (status === 429) return { ok: false, error: i18n.t('messages.aiQuota') };
        if (status === 413) return { ok: false, error: i18n.t('messages.aiTooLarge') };
        if (status === 401 || status === 403) return { ok: false, error: i18n.t('messages.errPermission') };
        const b = await error.context.json().catch(() => null);
        // 400 = the server explains what is missing in the request.
        if (status === 400 && b && typeof b.error === 'string') return { ok: false, error: b.error };
        return { ok: false, error: i18n.t('messages.aiFailed') };
      }
      return { ok: false, error: i18n.t('messages.errNetwork') };
    }
    if (data && typeof data === 'object' && (data as any).ok === true) {
      const parsed = schema.safeParse((data as any).data);
      if (!parsed.success) {
        console.error('admin-ai: unexpected answer shape', parsed.error.issues);
        return { ok: false, error: i18n.t('messages.aiBadAnswer') };
      }
      return { ok: true, data: parsed.data };
    }
    return {
      ok: false,
      error: i18n.t('messages.aiBadAnswer'),
    };
  } catch (err) {
    console.error('admin-ai call failed', err);
    return { ok: false, error: i18n.t('messages.errNetwork') };
  }
}

// ─── generate_content ─────────────────────────────────────────────────────

export type GeneratedContent = {
  blocks: Block[];
  quiz: Quiz;
};

export function aiGenerateContent(input: {
  name: string;
  level: string;
  tag: string;
  track?: string;
  duration?: string;
}): Promise<AiResult<GeneratedContent>> {
  return invoke({ task: 'generate_content', lesson: input }, generatedContentSchema);
}

// ─── translate ────────────────────────────────────────────────────────────

export type TranslatePayload = {
  en?: Translation;
  es?: Translation;
};

export function aiTranslate(input: {
  langs: ('en' | 'es')[];
  lesson: { title: string; blocks: Block[]; quizzes: Quiz[] };
}): Promise<AiResult<TranslatePayload>> {
  return invoke({ task: 'translate', ...input }, translateSchema);
}

// ─── ideas ────────────────────────────────────────────────────────────────

export type LessonIdea = { emoji: string; name: string; tag: string; why: string; summary?: string };
export type ModuleIdea = { emoji: string; name: string; why: string };

export function aiLessonIdeas(input: {
  level: string;
  theme?: string;
  existing?: string[];
}): Promise<AiResult<{ ideas: LessonIdea[] }>> {
  return invoke({ task: 'lesson_ideas', ...input }, ideasSchema);
}

/** Generate lesson drafts from the course syllabus text. */
export function aiSyllabusLessons(input: {
  level: string;
  syllabus: string;
  existing?: string[];
}): Promise<AiResult<{ ideas: LessonIdea[] }>> {
  return invoke({ task: 'syllabus_lessons', ...input }, ideasSchema);
}

export function aiModuleIdeas(input: {
  level: string;
  existing?: string[];
}): Promise<AiResult<{ ideas: ModuleIdea[] }>> {
  return invoke({ task: 'module_ideas', ...input }, moduleIdeasSchema);
}

// ─── agents ───────────────────────────────────────────────────────────────

export type AgentReport = {
  findings: string[];
  sections?: { title: string; content: string }[];
  lessons?: { id?: string; name: string; rationale: string }[];
};

export type AgentDef = {
  id: string;
  label: string;
  mission: string;
  tasks?: string;
  constraints?: string;
  reportFormat?: string;
  tone?: 'professional' | 'concise' | 'technical' | 'narrative';
  /** Ids of agents whose latest output this agent consumes. */
  dependsOn?: string[];
};

export function aiRunAgent(input: {
  agent: AgentDef;
  corpus?: {
    stats: Record<string, unknown>;
    lessons: { id: string; name: string; level: string; track?: string; tag?: string }[];
  };
  /** Arbitrary extra context (performance, syllabus coverage, upstream reports…). */
  context?: Record<string, unknown>;
}): Promise<AiResult<AgentReport>> {
  return invoke({ task: 'run_agent', ...input }, agentReportSchema);
}

// ─── marketing ────────────────────────────────────────────────────────────

export type MarketingCopy = {
  headlines: string[];
  social_posts: string[];
  value_props: string[];
  cta: string;
};

export function aiMarketing(input: {
  corpusStats: Record<string, unknown>;
  audience?: string;
  goal?: string;
}): Promise<AiResult<MarketingCopy>> {
  return invoke({ task: 'marketing', ...input }, marketingSchema);
}

// ─── invite (admin panel) ─────────────────────────────────────────────────

export function aiInvite(input: {
  email: string;
  role: string;
}): Promise<AiResult<{ invited: string }>> {
  return invoke({ task: 'invite', ...input }, inviteSchema);
}

// ─── Robot Tact assistant ─────────────────────────────────────────────────

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export function aiAssistant(input: {
  message: string;
  history?: ChatTurn[];
  context?: Record<string, unknown>;
}): Promise<AiResult<{ reply: string }>> {
  return invoke({ task: 'assistant', ...input }, replySchema);
}
