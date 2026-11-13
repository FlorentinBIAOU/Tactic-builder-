import { useTranslation } from 'react-i18next';
import { Copy, Lock, MoreHorizontal, UserCog, UserMinus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Badge } from '@/components/ui/badge';
import { fmtDate } from '@/components/ui/chart';
import { Tooltip } from '@/components/ui/tooltip';
import { toast } from '@/components/Toast';
import type { Member } from '@/lib/types';
import { Avatar, displayName, RoleBadge } from './roles';

type Props = {
  members: Member[];
  meId?: string;
  onChangeRole: (m: Member) => void;
  onRemove: (m: Member) => void;
};

export function TeamTable({ members, meId, onChangeRole, onRemove }: Props) {
  const { t } = useTranslation('team');

  const copy = async (email: string | null) => {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      toast(t('members.emailCopied'), 'success');
    } catch {
      toast(t('members.copyFailed'), 'error');
    }
  };

  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-left text-muted">
          <tr className="border-b border-border">
            <th scope="col" className="w-full px-5 py-2.5 font-medium">
              {t('members.colMember')}
            </th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">
              {t('members.colRole')}
            </th>
            <th scope="col" className="hidden whitespace-nowrap px-3 py-2.5 font-medium md:table-cell">
              {t('members.colJoined')}
            </th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">
              <span className="sr-only">{t('members.colActions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => {
            const isMe = m.id === meId;
            const name = displayName(m, t('members.noName'));
            return (
              <tr key={m.id} className="hover:bg-surface-2/50">
                <td className="w-full max-w-0 py-3 pl-5 pr-2 sm:pr-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar member={m} />
                    <div className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-base font-medium">{m.fullName?.trim() || m.email || t('members.noName')}</span>
                        {isMe ? <Badge className="shrink-0">{t('members.you')}</Badge> : null}
                      </span>
                      {m.fullName?.trim() && m.email ? <span className="truncate text-muted">{m.email}</span> : null}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
                        <RoleBadge role={m.role} className="sm:hidden" />
                        <span className="text-muted">{t('members.since', { date: fmtDate(m.createdAt) })}</span>
                      </span>
                    </div>
                  </div>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 align-middle sm:table-cell">
                  <RoleBadge role={m.role} />
                </td>
                <td className="tabular hidden whitespace-nowrap px-3 py-3 text-muted md:table-cell">{fmtDate(m.createdAt)}</td>
                <td className="whitespace-nowrap py-3 pl-0 pr-4 text-right sm:px-5">
                  <div className="flex items-center justify-end gap-1">
                    {isMe ? (
                      <Tooltip content={t('members.selfLocked')}>
                        <span
                          tabIndex={0}
                          aria-label={t('members.selfLocked')}
                          className="hidden size-9 items-center justify-center rounded text-muted lg:inline-flex"
                        >
                          <Lock aria-hidden className="size-4" />
                        </span>
                      </Tooltip>
                    ) : (
                      <Button size="sm" variant="ghost" className="hidden lg:inline-flex" onClick={() => onChangeRole(m)}>
                        {t('actions.changeRole')}
                      </Button>
                    )}
                    <Menu>
                      <MenuTrigger asChild>
                        <IconButton label={t('actions.memberActions', { name })} icon={<MoreHorizontal />} className="size-10 lg:size-9" />
                      </MenuTrigger>
                      <MenuContent>
                        {isMe ? (
                          <MenuLabel>{t('members.selfLocked')}</MenuLabel>
                        ) : (
                          <MenuItem icon={<UserCog />} onSelect={() => onChangeRole(m)}>
                            {t('actions.changeRole')}
                          </MenuItem>
                        )}
                        {m.email ? (
                          <MenuItem icon={<Copy />} onSelect={() => void copy(m.email)}>
                            {t('actions.copyEmail')}
                          </MenuItem>
                        ) : null}
                        {!isMe ? (
                          <>
                            <MenuSeparator />
                            <MenuItem icon={<UserMinus />} destructive onSelect={() => onRemove(m)}>
                              {t('actions.removeFromTeam')}
                            </MenuItem>
                          </>
                        ) : null}
                      </MenuContent>
                    </Menu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
