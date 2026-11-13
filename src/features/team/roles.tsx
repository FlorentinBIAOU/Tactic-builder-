import { useTranslation } from 'react-i18next';
import { KeyRound, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AdminRole, Member } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Order used in the role chooser and the roles panel: most access first. */
export const ROLE_ORDER: AdminRole[] = ['admin', 'ped', 'ux', 'data', 'learner'];

/** Roles that can be given by invitation (admin is given afterwards). */
export const INVITE_ROLES: AdminRole[] = ['ped', 'ux', 'data', 'learner'];

const TONE: Record<AdminRole, 'brand' | 'info' | 'success' | 'warning' | 'neutral'> = {
  admin: 'brand',
  ped: 'success',
  ux: 'info',
  data: 'warning',
  learner: 'neutral',
};

export function RoleBadge({ role, className }: { role: AdminRole; className?: string }) {
  const { t } = useTranslation('team');
  return (
    <Badge tone={TONE[role]} className={className}>
      {role === 'admin' ? <KeyRound aria-hidden className="size-3" /> : null}
      {t(`roles.${role}`)}
    </Badge>
  );
}

/** "Access to the tool" vs "Label only", with an icon so it is not colour-only. */
export function AccessLine({ role, className }: { role: AdminRole; className?: string }) {
  const { t } = useTranslation('team');
  const full = role === 'admin';
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', full ? 'text-success' : 'text-muted', className)}>
      {full ? <KeyRound aria-hidden className="size-3.5" /> : <Tag aria-hidden className="size-3.5" />}
      {full ? t('access.full') : role === 'learner' ? t('access.none') : t('access.label')}
    </span>
  );
}

/** Best readable name for a member. */
export function displayName(m: Pick<Member, 'fullName' | 'email'>, fallback: string): string {
  return m.fullName?.trim() || m.email || fallback;
}

export function initials(m: Pick<Member, 'fullName' | 'email'>): string {
  const base = m.fullName?.trim() || m.email?.split('@')[0] || '?';
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const s = parts.length > 1 ? parts[0][0] + parts[1][0] : base.slice(0, 2);
  return s.toUpperCase();
}

export function Avatar({ member }: { member: Pick<Member, 'fullName' | 'email'> }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold text-muted"
    >
      {initials(member)}
    </span>
  );
}
