// =========================================================================
// ADMIN-AI — multiplexed OpenAI proxy for the Corpus Builder
//
// One Supabase Edge Function endpoint, keyed by a `task` field.
// Admin-gated: the function verifies the caller's JWT and checks
// public.is_admin() before doing any work. Keeps the OpenAI API key off
// the browser bundle (same pattern as tact-chat).
//
// Tasks:
//   generate_content  — draft lesson blocks + quiz from {name,level,tag,track}
//   translate         — FR lesson body → EN and/or ES
//   lesson_ideas      — propose lesson titles for a level/theme
//   module_ideas      — propose track names for a level
//   run_agent         — run a named admin "agent" against trimmed corpus context
//   marketing         — marketing copy from corpus stats
//   syllabus_lessons  — lesson drafts from a pasted syllabus
//   assistant         — Robot Tact chat
//   invite            — invite a collaborator (service role, no OpenAI call)
//
// Limits: request body ≤ 200 KB, every text field is clipped, OpenAI calls
// time out after 60 s, and each admin has a daily quota (AI_DAILY_LIMIT,
// default 200 calls, counted by public.admin_ai_consume from 0007).
//
// Optional secrets:
//   AI_DAILY_LIMIT    — calls per admin per day (default 200)
//   ADMIN_SITE_URL    — deployed admin URL; used as the invite redirect and,
//                       when set, as the allowed CORS origin
//   ADMIN_EXTRA_ORIGINS — extra allowed origins, comma-separated
//
// Deploy:
//   supabase functions deploy admin-ai --no-verify-jwt
//   (secrets OPENAI_API_KEY / OPENAI_MODEL already set for tact-chat)
// =========================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ADMIN_SITE_URL = (Deno.env.get('ADMIN_SITE_URL') || '').replace(/\/+$/, '');

// When ADMIN_SITE_URL is set, only that origin (plus ADMIN_EXTRA_ORIGINS,
// comma-separated, e.g. a preview URL or http://localhost:5173) may call the
// function from a browser. Unset: any origin (the JWT check still applies).
const ALLOWED_ORIGINS = [
  ADMIN_SITE_URL,
  ...(Deno.env.get('ADMIN_EXTRA_ORIGINS') || '').split(',').map((o) => o.trim().replace(/\/+$/, '')),
].filter(Boolean);

function corsHeaders(requestOrigin: string): Record<string, string> {
  const allow = !ALLOWED_ORIGINS.length
    ? '*'
    : ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

const MAX_BODY_CHARS = 200_000;
const OPENAI_TIMEOUT_MS = 60_000;

// ─── Input clipping ───────────────────────────────────────────────────────
// The body is cast, not trusted: every field is coerced to the expected
// type and clipped so a single call cannot send an unbounded prompt.

function str(v: unknown, max: number, fallback = ''): string {
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).slice(0, max);
  return fallback;
}

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(v) ? v.slice(0, maxItems).map((x) => str(x, maxLen)).filter(Boolean) : [];
}

function jsonClip(v: unknown, max: number): string {
  let out = '';
  try {
    out = JSON.stringify(v ?? {});
  } catch {
    out = '{}';
  }
  return out.length > max ? out.slice(0, max) + ' …[truncated]' : out;
}

class InputError extends Error {}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

type Block = { type: 'hook' | 'content' | 'tip' | 'trap' | 'real' | 'info'; emo?: string; title?: string; text: string };
type Quiz = { q: string; opts: string[]; correct: number; expl: string };

type GenerateContentBody = {
  task: 'generate_content';
  lesson: { name: string; level: string; tag: string; track?: string; duration?: string };
};
type TranslateBody = {
  task: 'translate';
  langs: ('en' | 'es')[];
  lesson: { title: string; blocks: Block[]; quizzes: Quiz[] };
};
type LessonIdeasBody = {
  task: 'lesson_ideas';
  level: string;
  theme?: string;
  existing?: string[];
};
type ModuleIdeasBody = {
  task: 'module_ideas';
  level: string;
  existing?: string[];
};
type RunAgentBody = {
  task: 'run_agent';
  agent: {
    id: string;
    label: string;
    mission: string;
    tasks?: string;
    constraints?: string;
    reportFormat?: string;
    tone?: string;
    dependsOn?: string[];
  };
  corpus?: {
    stats: Record<string, unknown>;
    lessons: { id: string; name: string; level: string; track?: string; tag?: string }[];
  };
  context?: Record<string, unknown>;
};
type MarketingBody = {
  task: 'marketing';
  corpusStats: Record<string, unknown>;
  audience?: string;
  goal?: string;
};
type InviteBody = {
  task: 'invite';
  email: string;
  role: string;
};
type SyllabusLessonsBody = {
  task: 'syllabus_lessons';
  level: string;
  syllabus: string;
  existing?: string[];
};
type AssistantBody = {
  task: 'assistant';
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: Record<string, unknown>;
};

type Body =
  | GenerateContentBody
  | TranslateBody
  | LessonIdeasBody
  | ModuleIdeasBody
  | RunAgentBody
  | MarketingBody
  | InviteBody
  | SyllabusLessonsBody
  | AssistantBody;

async function gateAdmin(
  req: Request,
): Promise<{ ok: true; userId: string; sb: SupabaseClient } | { ok: false; status: number; error: string }> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 500, error: 'Server not configured' };
  }
  if (!authHeader) return { ok: false, status: 401, error: 'Not signed in' };

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await sb.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return { ok: false, status: 401, error: 'Not signed in' };

  const { data: row } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (!row || (row as { role?: string }).role !== 'admin') {
    return { ok: false, status: 403, error: 'Admin role required' };
  }
  return { ok: true, userId, sb };
}

// Daily quota per admin. Returns null when allowed, or an error Response.
async function checkQuota(sb: SupabaseClient): Promise<Response | null> {
  const limit = Number(Deno.env.get('AI_DAILY_LIMIT')) || 200;
  const { data, error } = await sb.rpc('admin_ai_consume', { p_limit: limit });
  if (error) {
    // Migration 0007 not applied yet: don't block, but log it.
    if (error.code === 'PGRST202' || error.code === '42883') {
      console.error('admin_ai_consume missing — apply migration 0007');
      return null;
    }
    console.error('admin_ai_consume failed', error.message);
    return json({ ok: false, error: 'The AI quota could not be checked. Try again.' }, { status: 503 });
  }
  if (data === false) {
    return json({ ok: false, error: 'Daily AI limit reached. Try again tomorrow.' }, { status: 429 });
  }
  return null;
}

// ─── Prompt builders ──────────────────────────────────────────────────────

function generateContentPrompt(b: GenerateContentBody): { system: string; user: string } {
  const system = `You are TACTIC's pedagogical content engine. You write concise, accurate, slightly playful French financial-education lessons aimed at young adult investors.

OUTPUT STRICT JSON — no prose around it. Schema:
{
  "blocks": [
    { "type": "hook"|"content"|"tip"|"trap", "emo": string, "title"?: string, "text": string }
  ],
  "quiz": { "q": string, "opts": [string,string,string,string], "correct": number, "expl": string }
}

RULES
- All text in French.
- 1 hook + 1 content + 1 tip + optional 1 trap. Keep each block ≤ 600 chars.
- Use simple, vivid language. **Bold** key terms with **double asterisks** (not HTML).
- Quiz: 4 plausible options, 1 correct, "correct" is the 0-based index.
- Explanation references the correct concept in ≤ 2 sentences.
- Do NOT name famous investors. Do NOT prescribe real-money advice.`;
  const l = (b.lesson ?? {}) as Partial<GenerateContentBody['lesson']>;
  const name = str(l.name, 200);
  if (!name) throw new InputError('Lesson name is required');
  const user = `LESSON META:
- name: ${name}
- level: ${str(l.level, 40, 'Débutant')}
- tag: ${str(l.tag, 60, 'Core')}
- track: ${str(l.track, 120, '—')}
- duration: ${str(l.duration, 20, '1 min')}

Write the lesson now. JSON only.`;
  return { system, user };
}

function translatePrompt(b: TranslateBody): { system: string; user: string } {
  const langs = strList(b.langs, 2, 2).filter((x): x is 'en' | 'es' => x === 'en' || x === 'es');
  if (!langs.length) throw new InputError('Choose at least one target language');
  const src = (b.lesson ?? {}) as Partial<TranslateBody['lesson']>;
  b = {
    ...b,
    langs,
    lesson: {
      title: str(src.title, 200),
      blocks: (Array.isArray(src.blocks) ? src.blocks : []).slice(0, 30).map((x: any) => ({
        type: str(x?.type, 20, 'content') as Block['type'],
        emo: str(x?.emo, 8),
        title: str(x?.title, 200),
        text: str(x?.text, 2000),
      })),
      quizzes: (Array.isArray(src.quizzes) ? src.quizzes : []).slice(0, 10).map((q: any) => ({
        q: str(q?.q, 400),
        opts: strList(q?.opts, 6, 300),
        correct: Number(q?.correct) || 0,
        expl: str(q?.expl, 600),
      })),
    },
  };
  const targets = b.langs.includes('en') && b.langs.includes('es')
    ? '"en" and "es"'
    : b.langs[0] === 'en'
    ? '"en"'
    : '"es"';
  const system = `You translate TACTIC pedagogical lessons from French to ${b.langs.includes('en') ? 'English' : ''}${b.langs.includes('en') && b.langs.includes('es') ? ' and ' : ''}${b.langs.includes('es') ? 'Spanish' : ''}, preserving meaning, pedagogical tone, **bold** markers, and emoji.

OUTPUT STRICT JSON. Schema:
{
  ${b.langs.includes('en') ? '"en": { "title": string, "blocks": [...same shape...], "quizzes": [...] }' : ''}${b.langs.includes('en') && b.langs.includes('es') ? ',\n  ' : ''}${b.langs.includes('es') ? '"es": { "title": string, "blocks": [...], "quizzes": [...] }' : ''}
}

RULES
- Translate "text", "title", "q", "opts", "expl" — keep "type", "emo", "correct" indices, structure identical.
- Keep **bold** markers verbatim around the corresponding translated term.
- Don't add or remove blocks or quiz options.`;
  const user = `Translate to ${targets}:\n\n${JSON.stringify(b.lesson)}`;
  return { system, user };
}

function lessonIdeasPrompt(b: LessonIdeasBody): { system: string; user: string } {
  const system = `You suggest TACTIC lesson titles. Output STRICT JSON:
{ "ideas": [ { "emoji": string, "name": string, "tag": string, "why": string } ] }
- 6 ideas, all in French.
- Each "name" ≤ 80 chars, catchy, descriptive.
- "tag" is one of: Base, Stratégie, Pratique, Analyse, Psychologie, Fiscalité, Vocab, ETF, Crypto, Immo, Macro, Retraite, Expert, Dérivés, Risque.
- "why" ≤ 120 chars rationale.
- Avoid topics already in EXISTING.`;
  const theme = str(b.theme, 300);
  const user = `LEVEL: ${str(b.level, 40, 'Débutant')}
${theme ? `THEME: ${theme}` : ''}
EXISTING: ${strList(b.existing, 80, 120).join('; ') || '(none)'}`;
  return { system, user };
}

function moduleIdeasPrompt(b: ModuleIdeasBody): { system: string; user: string } {
  const system = `You suggest TACTIC tracks (modules) — coherent groups of ~5-10 lessons. Output STRICT JSON:
{ "ideas": [ { "emoji": string, "name": string, "why": string } ] }
- 6 ideas, French.
- "name" ≤ 50 chars, no leading emoji (emoji is separate).
- "why" ≤ 140 chars, what the module covers.
- Avoid duplicates with EXISTING.`;
  const user = `LEVEL: ${str(b.level, 40, 'Débutant')}
EXISTING: ${strList(b.existing, 40, 120).join('; ') || '(none)'}`;
  return { system, user };
}

function runAgentPrompt(b: RunAgentBody): { system: string; user: string } {
  const a = (b.agent ?? {}) as Partial<RunAgentBody['agent']>;
  const label = str(a.label, 80);
  const mission = str(a.mission, 3000);
  if (!label || !mission) throw new InputError('Agent label and mission are required');
  b = {
    ...b,
    agent: {
      id: str(a.id, 60),
      label,
      mission,
      tasks: str(a.tasks, 3000),
      constraints: str(a.constraints, 2000),
      reportFormat: str(a.reportFormat, 1500),
      tone: str(a.tone, 60),
    },
  };
  const tone = b.agent.tone || 'professional';
  const system = `You are "${b.agent.label}", an analytical agent inside the TACTIC Corpus Builder admin panel.

MISSION
${b.agent.mission}

TONE: ${tone}.

OUTPUT STRICT JSON. Schema:
{
  "findings":   [ string ],                                       // 3-8 bullet-style observations
  "sections":   [ { "title": string, "content": string } ]?,      // optional deeper sections
  "lessons":    [ { "id"?: string, "name": string, "rationale": string } ]?
}

RULES
- Findings are concrete, evidence-based statements derived from CORPUS.
- Don't invent lessons that aren't in CORPUS unless the mission explicitly asks for proposals.
- ≤ 8 findings. ≤ 4 sections.`;
  const corpusBlock = b.corpus
    ? `CORPUS STATS:
${jsonClip(b.corpus.stats, 4000)}

CORPUS LESSONS (sample, trimmed to id/name/level/track/tag):
${jsonClip((Array.isArray(b.corpus.lessons) ? b.corpus.lessons : []).slice(0, 80), 12000)}`
    : '';
  const contextBlock = b.context
    ? `CONTEXT (performance, syllabus coverage, and upstream agent outputs):
${jsonClip(b.context, 9000)}`
    : '';
  const user = `TASKS:
${b.agent.tasks || '(none specified)'}

CONSTRAINTS:
${b.agent.constraints || '(none)'}

REPORT FORMAT:
${b.agent.reportFormat || 'JSON as specified above.'}

${corpusBlock}

${contextBlock}

Run the analysis now. JSON only.`;
  return { system, user };
}

function syllabusLessonsPrompt(b: SyllabusLessonsBody): { system: string; user: string } {
  const system = `You turn a course SYLLABUS into concrete TACTIC lesson drafts. Output STRICT JSON:
{ "ideas": [ { "emoji": string, "name": string, "tag": string, "summary": string, "why": string } ] }
- 6-10 lessons that faithfully follow the syllabus structure and order.
- All text in French.
- "name" ≤ 80 chars; "summary" ≤ 160 chars (what the lesson covers); "why" ≤ 120 chars.
- "tag" is one of: Base, Stratégie, Pratique, Analyse, Psychologie, Fiscalité, Vocab, ETF, Crypto, Immo, Macro, Retraite, Expert, Dérivés, Risque.
- Avoid duplicating anything in EXISTING.`;
  const syllabus = str(b.syllabus, 6000);
  if (!syllabus.trim()) throw new InputError('Paste a syllabus first');
  const user = `LEVEL: ${str(b.level, 40, 'Débutant')}
EXISTING LESSONS: ${strList(b.existing, 60, 120).join('; ') || '(none)'}

SYLLABUS:
${syllabus}`;
  return { system, user };
}

function marketingPrompt(b: MarketingBody): { system: string; user: string } {
  const system = `You write punchy marketing copy for TACTIC, a gamified French financial-education app for young adult investors.

OUTPUT STRICT JSON:
{
  "headlines": [ string ],          // 5, ≤ 70 chars
  "social_posts": [ string ],       // 3, ≤ 240 chars, French, no hashtags spam
  "value_props": [ string ],        // 5 short bullets
  "cta": string                     // ≤ 40 chars
}`;
  const user = `AUDIENCE: ${str(b.audience, 300) || 'Young adult investors in France'}
GOAL: ${str(b.goal, 300) || 'Drive signups for the app'}

CORPUS STATS (use to make claims concrete, e.g. lesson counts):
${jsonClip(b.corpusStats, 4000)}`;
  return { system, user };
}

// ─── Invite (admin panel) ─────────────────────────────────────────────────

// Invites never grant 'admin' directly: invite with a lower role, then
// promote from the Collaborators tab (admin_set_role, audited).
const INVITE_ROLES = ['learner', 'ux', 'ped', 'data'];

async function handleInvite(b: InviteBody, actorId: string, origin: string | null): Promise<Response> {
  const email = str(b.email, 254).trim().toLowerCase();
  const role = str(b.role, 20) || 'learner';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: 'A valid email is required' }, { status: 400 });
  }
  if (!INVITE_ROLES.includes(role)) {
    return json({ ok: false, error: 'Invite with a non-admin role, then promote the member.' }, { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: 'Invite not configured (missing service role key)' }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Invite link lands on the admin's /auth page (not the project Site URL).
  const base = ADMIN_SITE_URL || origin || '';
  const redirectTo = base ? `${base}/auth?invite=1` : undefined;

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (inviteErr) {
    console.error('invite failed', inviteErr.message);
    return json({ ok: false, error: 'The invitation could not be sent. The address may already have an account.' }, { status: 502 });
  }

  // Assign the role on the profile row. The profiles trigger may already
  // have created it, so upsert by id — and report a failure instead of
  // pretending it worked.
  const newUserId = invited?.user?.id;
  if (!newUserId) {
    return json({ ok: false, error: 'Invitation sent, but the account id was not returned. Set the role from the members list.' }, { status: 502 });
  }
  if (role !== 'learner') {
    const { error: roleErr } = await admin
      .from('profiles')
      .upsert({ id: newUserId, email, role }, { onConflict: 'id' });
    if (roleErr) {
      console.error('invite role upsert failed', roleErr.message);
      return json({ ok: false, error: 'Invitation sent, but the role could not be set. Set it from the members list.' }, { status: 502 });
    }
  }

  // Audit trail.
  const { data: actor } = await admin
    .from('profiles')
    .select('email')
    .eq('id', actorId)
    .maybeSingle();
  const { error: auditErr } = await admin.from('admin_audit_log').insert({
    actor_id: actorId,
    actor_email: (actor as { email?: string } | null)?.email ?? null,
    action: 'invite',
    target: email,
    detail: { role },
  });
  if (auditErr) console.error('invite audit insert failed', auditErr.message);

  return json({ ok: true, data: { invited: email } });
}

// ─── Robot Tact assistant (chat) ──────────────────────────────────────────

async function handleAssistant(b: AssistantBody, model: string, apiKey: string): Promise<Response> {
  const system = `You are "Robot Tact", the in-app assistant for the TACTIC Corpus Builder admin panel.
You help the team manage a gamified French financial-education corpus: lessons, tracks (modules),
domains (tags), translations, marketing, and analytics. Be concise, concrete, and friendly.
Answer in the user's language. Use the CONTEXT (corpus stats) when relevant. You cannot perform
actions directly — guide the admin to the right tab/button.

CONTEXT:
${jsonClip(b.context, 4000)}`;

  const message = str(b.message, 4000);
  if (!message.trim()) throw new InputError('Message is empty');
  const messages: { role: string; content: string }[] = [{ role: 'system', content: system }];
  for (const t of (Array.isArray(b.history) ? b.history : []).slice(-8)) {
    messages.push({ role: t?.role === 'assistant' ? 'assistant' : 'user', content: str(t?.content, 2000) });
  }
  messages.push({ role: 'user', content: message });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, max_tokens: 700, temperature: 0.5 }),
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('OpenAI assistant error', res.status, t);
      return json({ ok: false, error: 'The assistant is unavailable right now. Try again.' }, { status: 502 });
    }
    const data: any = await res.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? '…';
    return json({ ok: true, data: { reply } });
  } catch (err) {
    console.error('assistant failed', err);
    return json({ ok: false, error: 'The assistant is unavailable right now. Try again.' }, { status: 502 });
  }
}

// ─── OpenAI call ──────────────────────────────────────────────────────────

async function callOpenAI(system: string, user: string, model: string, apiKey: string, maxTokens = 1400): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('OpenAI error', res.status, errText);
    throw new Error('The AI service returned an error. Try again.');
  }
  const data: any = await res.json();
  const choice = data?.choices?.[0];
  if (choice?.finish_reason === 'length') {
    console.error('OpenAI output truncated (max_tokens)', maxTokens);
    throw new Error('The AI answer was too long and got cut off. Try again with less content.');
  }
  const content: string = choice?.message?.content ?? '{}';
  try {
    return JSON.parse(content);
  } catch {
    console.error('OpenAI returned non-JSON:', content.slice(0, 400));
    throw new Error('The AI answer could not be read. Try again.');
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────

// CORS headers are added to every response here, per request.
Deno.serve(async (req: Request) => {
  const origin = (req.headers.get('Origin') || '').replace(/\/+$/, '');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  const res = await handle(req);
  for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  return res;
});

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const gate = await gateAdmin(req);
  if (!gate.ok) return json({ ok: false, error: gate.error }, { status: gate.status });

  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) {
      return json({ ok: false, error: 'Request too large' }, { status: 413 });
    }
    body = JSON.parse(raw) as Body;
    if (!body || typeof body !== 'object' || typeof (body as { task?: unknown }).task !== 'string') {
      throw new Error('no task');
    }
  } catch {
    return json({ ok: false, error: 'Invalid request' }, { status: 400 });
  }

  // ── invite: service-role action, not an OpenAI call ─────────────────────
  if (body.task === 'invite') {
    try {
      return await handleInvite(body, gate.userId, req.headers.get('Origin'));
    } catch (err) {
      console.error('invite error', err);
      return json({ ok: false, error: 'The invitation failed. Try again.' }, { status: 500 });
    }
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error('OPENAI_API_KEY not configured');
    return json({ ok: false, error: 'AI is not configured on the server.' }, { status: 500 });
  }
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

  const quota = await checkQuota(gate.sb);
  if (quota) return quota;

  try {
    if (body.task === 'assistant') {
      return await handleAssistant(body, model, apiKey);
    }
    let prompt: { system: string; user: string };
    let maxTokens = 1400;

    switch (body.task) {
      case 'generate_content':
        prompt = generateContentPrompt(body);
        break;
      case 'translate':
        prompt = translatePrompt(body);
        maxTokens = 2400;
        break;
      case 'lesson_ideas':
        prompt = lessonIdeasPrompt(body);
        maxTokens = 900;
        break;
      case 'module_ideas':
        prompt = moduleIdeasPrompt(body);
        maxTokens = 700;
        break;
      case 'run_agent':
        prompt = runAgentPrompt(body);
        maxTokens = 1800;
        break;
      case 'marketing':
        prompt = marketingPrompt(body);
        maxTokens = 1000;
        break;
      case 'syllabus_lessons':
        prompt = syllabusLessonsPrompt(body);
        maxTokens = 1600;
        break;
      default:
        return json({ ok: false, error: 'Unknown task' }, { status: 400 });
    }

    const data = await callOpenAI(prompt.system, prompt.user, model, apiKey, maxTokens);
    return json({ ok: true, data });
  } catch (err) {
    if (err instanceof InputError) {
      return json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error('admin-ai error', err);
    const msg = err instanceof Error && err.message.startsWith('The AI') ? err.message : 'The AI request failed. Try again.';
    return json({ ok: false, error: msg }, { status: 502 });
  }
}
