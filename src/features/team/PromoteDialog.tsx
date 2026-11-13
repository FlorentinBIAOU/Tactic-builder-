import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, UserPlus, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { fmtInt } from '@/components/ui/chart';
import { adminErrorKind, fetchStaff } from '@/lib/admin';
import type { Member } from '@/lib/types';
import { Avatar, displayName, RoleBadge } from './roles';
import { errorText } from './RoleDialog';

const LIMIT = 20;
const MIN_CHARS = 2;

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; msg: string }
  | { status: 'ready'; query: string; members: Member[]; total: number };

type Props = {
  open: boolean;
  initialQuery?: string;
  meId?: string;
  /** Bumped by the parent after a role change, to refresh the results. */
  version: number;
  onOpenChange: (open: boolean) => void;
  onChoose: (member: Member) => void;
  onInvite: (email: string) => void;
};

/** Find any account (learners included) to give it a role. */
export function PromoteDialog({ open, initialQuery = '', meId, version, onOpenChange, onChoose, onInvite }: Props) {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (open) setQuery(initialQuery);
  }, [open, initialQuery]);

  const q = query.trim();

  useEffect(() => {
    if (!open) return;
    if (q.length < MIN_CHARS) {
      setState({ status: 'idle' });
      return;
    }
    const id = ++seq.current;
    setState((s) => (s.status === 'ready' && s.query === q ? s : { status: 'loading' }));
    const timer = window.setTimeout(async () => {
      try {
        const page = await fetchStaff({ search: q, limit: LIMIT });
        if (id === seq.current) setState({ status: 'ready', query: q, ...page });
      } catch (e) {
        if (id === seq.current) setState({ status: 'error', msg: errorText(adminErrorKind(e), t, t('errors.search')) });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, q, version, attempt, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('promote.title')}
        description={t('promote.description')}
        closeLabel={tc('actions.close')}
        className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto"
      >
        <Field label={t('promote.search')} hint={q.length < MIN_CHARS ? t('promote.hint') : undefined}>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              autoFocus
              autoComplete="off"
              placeholder={t('promote.searchPlaceholder')}
              className="h-10 pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </Field>

        <div className="mt-4 min-h-40" aria-live="polite">
          {state.status === 'idle' ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted">
              <UserSearch aria-hidden className="size-8" />
            </div>
          ) : null}

          {state.status === 'loading' ? (
            <ul className="flex flex-col divide-y divide-border" aria-busy>
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {state.status === 'error' ? (
            <Notice
              tone="danger"
              action={
                <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  {tc('actions.retry')}
                </Button>
              }
            >
              {state.msg}
            </Notice>
          ) : null}

          {state.status === 'ready' && state.members.length === 0 ? (
            <EmptyState
              title={t('promote.emptyTitle', { query: state.query })}
              description={t('promote.emptyBody')}
              action={
                <Button variant="outline" onClick={() => onInvite(state.query.includes('@') ? state.query : '')}>
                  <UserPlus aria-hidden />
                  {t('promote.inviteInstead')}
                </Button>
              }
            />
          ) : null}

          {state.status === 'ready' && state.members.length > 0 ? (
            <>
              <p className="mb-1 text-sm text-muted">{t('promote.results', { count: state.total })}</p>
              <ul className="flex max-h-[min(22rem,50vh)] flex-col divide-y divide-border overflow-y-auto">
                {state.members.map((m) => {
                  const isMe = m.id === meId;
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                      <Avatar member={m} />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{displayName(m, t('members.noName'))}</span>
                        {m.fullName && m.email ? <span className="truncate text-sm text-muted">{m.email}</span> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <RoleBadge role={m.role} />
                        {isMe ? (
                          <span className="text-sm text-muted">{t('members.you')}</span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-10 sm:h-8" onClick={() => onChoose(m)}>
                            {m.role === 'learner' ? t('promote.chooseRole') : t('actions.changeRole')}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {state.total > state.members.length ? (
                <p className="mt-2 text-sm text-muted">
                  {t('promote.more', { shown: fmtInt(state.members.length), total: fmtInt(state.total) })}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
