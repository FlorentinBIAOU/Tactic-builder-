import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserSearch, Users, X } from 'lucide-react';
import { PageHeader, Panel } from '@/components/ui/page';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { fmtInt } from '@/components/ui/chart';
import { useAuth } from '@/store/auth';
import type { AdminRole, Member } from '@/lib/types';
import { useTeam } from './useTeam';
import { TeamTable } from './TeamTable';
import { ActivityLog } from './ActivityLog';
import { RoleDialog, errorText, type RoleTarget } from './RoleDialog';
import { InviteDialog } from './InviteDialog';
import { PromoteDialog } from './PromoteDialog';
import { AccessLine, ROLE_ORDER, RoleBadge } from './roles';

function TableSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-border" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Team page: who works on the corpus, their role, invitations and history. */
export default function TeamView() {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation();
  const me = useAuth((s) => s.profile);
  const team = useTeam();

  const [roleTarget, setRoleTarget] = useState<RoleTarget | null>(null);
  const [invite, setInvite] = useState<{ open: boolean; email: string }>({ open: false, email: '' });
  const [promote, setPromote] = useState<{ open: boolean; query: string }>({ open: false, query: '' });
  const [promoteVersion, setPromoteVersion] = useState(0);
  const [partial, setPartial] = useState<{ email: string; role: AdminRole } | null>(null);

  const members = team.staff.status === 'ready' ? team.staff.data.members : [];
  const total = team.staff.status === 'ready' ? team.staff.data.total : 0;

  const openRole = (member: Member, preset?: AdminRole) => {
    if (member.id === me?.id) return; // Changing your own role could lock you out.
    setRoleTarget({ member, preset });
  };

  const onRoleChanged = () => {
    team.refresh();
    setPromoteVersion((v) => v + 1);
    setPartial(null);
  };

  const openPromote = (query = '') => {
    setInvite((s) => ({ ...s, open: false }));
    setPromote({ open: true, query });
  };
  const openInvite = (email = '') => {
    setPromote((s) => ({ ...s, open: false }));
    setInvite({ open: true, email });
  };

  const staffError = team.staff.status === 'error' ? errorText(team.staff.kind, t, t('errors.load')) : null;
  const auditError = team.audit.status === 'error' ? errorText(team.audit.kind, t, t('errors.loadActivity')) : null;

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <>
            <Button variant="secondary" onClick={() => openPromote()}>
              <UserSearch aria-hidden />
              {t('actions.promote')}
            </Button>
            <Button variant="primary" onClick={() => openInvite()}>
              <UserPlus aria-hidden />
              {t('actions.invite')}
            </Button>
          </>
        }
      />

      {partial ? (
        <Notice
          tone="warning"
          className="mb-6"
          title={t('invite.partialTitle', { email: partial.email })}
          action={
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => openPromote(partial.email)}>
                {t('invite.partialAction')}
              </Button>
              <IconButton size="icon-sm" label={tc('actions.close')} icon={<X />} onClick={() => setPartial(null)} />
            </div>
          }
        >
          {t('invite.partialBody', { role: t(`roles.${partial.role}`) })}
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title={t('members.title')}
            description={team.staff.status === 'ready' && total > 0 ? t('members.count', { count: total }) : undefined}
            bodyClassName="py-0"
          >
            {team.staff.status === 'loading' ? <div className="py-2"><TableSkeleton /></div> : null}

            {staffError ? (
              <div className="py-5">
                <Notice
                  tone="danger"
                  action={
                    <Button size="sm" variant="outline" onClick={team.retryStaff}>
                      {tc('actions.retry')}
                    </Button>
                  }
                >
                  {staffError}
                </Notice>
              </div>
            ) : null}

            {team.staff.status === 'ready' && members.length === 0 ? (
              <div className="py-5">
                <EmptyState
                  icon={<Users />}
                  title={t('members.emptyTitle')}
                  description={t('members.emptyBody')}
                  action={
                    <>
                      <Button variant="outline" onClick={() => openInvite()}>
                        <UserPlus aria-hidden />
                        {t('actions.invite')}
                      </Button>
                      <Button variant="outline" onClick={() => openPromote()}>
                        <UserSearch aria-hidden />
                        {t('actions.promote')}
                      </Button>
                    </>
                  }
                />
              </div>
            ) : null}

            {members.length > 0 ? (
              <>
                <TeamTable
                  members={members}
                  meId={me?.id}
                  onChangeRole={(m) => openRole(m)}
                  onRemove={(m) => openRole(m, 'learner')}
                />
                {total > members.length ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-3">
                    <span className="text-sm text-muted">
                      {t('members.shown', { shown: fmtInt(members.length), total: fmtInt(total) })}
                    </span>
                    <Button variant="ghost" size="sm" loading={team.moreBusy} onClick={() => void team.loadMore()}>
                      {t('actions.loadMore')}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </Panel>

          <Panel title={t('activity.title')} description={t('activity.description')}>
            <ActivityLog
              entries={team.audit.status === 'ready' ? team.audit.data : null}
              error={auditError}
              members={members}
              canLoadMore={team.canLoadMoreAudit}
              onLoadMore={team.moreAudit}
              onRetry={team.retryAudit}
            />
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Panel title={t('rolesPanel.title')} description={t('rolesPanel.description')} bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {ROLE_ORDER.filter((r) => r !== 'learner').map((r) => (
                <li key={r} className="flex flex-col gap-1.5 px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <RoleBadge role={r} />
                    <AccessLine role={r} />
                  </div>
                  <p className="text-sm text-muted">{t(`roleInfo.${r}`)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-5 py-4">
              <p className="text-sm font-medium">{t('honesty.title')}</p>
              <p className="mt-1 text-sm text-muted">{t('honesty.body')}</p>
            </div>
          </Panel>
        </aside>
      </div>

      <RoleDialog target={roleTarget} onClose={() => setRoleTarget(null)} onChanged={onRoleChanged} />

      <InviteDialog
        open={invite.open}
        initialEmail={invite.email}
        onOpenChange={(open) => setInvite((s) => ({ ...s, open }))}
        onInvited={() => team.refresh()}
        onRoleNotSet={(email, role) => setPartial({ email, role })}
        onFindAccount={(email) => openPromote(email)}
      />

      <PromoteDialog
        open={promote.open}
        initialQuery={promote.query}
        meId={me?.id}
        version={promoteVersion}
        onOpenChange={(open) => setPromote((s) => ({ ...s, open }))}
        onChoose={(m) => openRole(m)}
        onInvite={(email) => openInvite(email)}
      />
    </div>
  );
}
