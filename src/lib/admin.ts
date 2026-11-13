/**
 * Data-access for the Team page.
 *
 * Member listing and role changes go through SECURITY DEFINER RPCs
 * (admin_list_staff / admin_list_members / admin_set_role) so the client
 * never needs broad access to `profiles`. Invites are handled by the
 * admin-ai edge function (it holds the service-role key). The audit log is
 * read directly.
 */

import { supabase } from './supabase';
import { aiInvite } from './ai';
import type { AdminRole, AuditEntry, Member, StaffPage } from './types';

type MemberRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string | null;
};

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  role: (r.role as AdminRole) ?? 'learner',
  createdAt: r.created_at ?? undefined,
});

/**
 * Every profile, learners included (the project is shared with the mobile
 * app, so this can be thousands of rows). Prefer fetchStaff().
 */
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase.rpc('admin_list_members');
  if (error) throw error;
  return (data as MemberRow[]).map(toMember);
}

/**
 * Team members (role other than learner), or, with `search`, any account
 * whose e-mail or name contains the text, team members first.
 * The server caps `limit` at 100.
 */
export async function fetchStaff(
  opts: { search?: string; limit?: number; offset?: number } = {}
): Promise<StaffPage> {
  const { data, error } = await supabase.rpc('admin_list_staff', {
    p_search: opts.search?.trim() || null,
    p_limit: opts.limit ?? 50,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data ?? []) as (MemberRow & { total_count: number | string | null })[];
  return {
    members: rows.map(toMember),
    total: rows.length ? Number(rows[0].total_count ?? rows.length) : 0,
  };
}

export async function setMemberRole(id: string, role: AdminRole): Promise<void> {
  const { error } = await supabase.rpc('admin_set_role', { p_id: id, p_role: role });
  if (error) throw error;
}

/** Why a team request failed, so the page can say it in plain words. */
export type AdminErrorKind = 'lastAdmin' | 'forbidden' | 'unknownMember' | 'missingMigration' | 'other';

export function adminErrorKind(err: unknown): AdminErrorKind {
  const e = (err ?? {}) as { message?: string; code?: string };
  const msg = e.message ?? '';
  if (/last admin/i.test(msg)) return 'lastAdmin';
  if (/unknown member/i.test(msg)) return 'unknownMember';
  if (e.code === '42501' || /admin role required|permission denied|row-level security/i.test(msg)) return 'forbidden';
  if (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(msg)) return 'missingMigration';
  return 'other';
}

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AuditRow[]).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    target: r.target,
    detail: r.detail ?? {},
    createdAt: r.created_at,
  }));
}

export type InviteResult =
  | { ok: true }
  /** `roleNotSet`: the e-mail went out but the role could not be saved. */
  | { ok: false; error: string; roleNotSet: boolean; alreadyExists: boolean };

/** Invite a collaborator by email (delegates to the edge function). */
export async function inviteMember(email: string, role: AdminRole): Promise<InviteResult> {
  const res = await aiInvite({ email, role });
  if (res.ok) return { ok: true };
  return {
    ok: false,
    error: res.error,
    // The edge function words partial success as "Invitation sent, but …".
    roleNotSet: /^invitation sent/i.test(res.error),
    alreadyExists: /already have an account|already (been )?registered/i.test(res.error),
  };
}
