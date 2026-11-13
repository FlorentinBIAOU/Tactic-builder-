import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { History, Mail, UserCog, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { locale } from '@/i18n';
import type { AdminRole, AuditEntry, Member } from '@/lib/types';
import { ROLE_ORDER } from './roles';

const asRole = (v: unknown): AdminRole | null =>
  typeof v === 'string' && (ROLE_ORDER as string[]).includes(v) ? (v as AdminRole) : null;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

type Props = {
  entries: AuditEntry[] | null;
  error: string | null;
  members: Member[];
  canLoadMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
};

/** Readable history: "Admin made X Pedagogy", grouped by local day. */
export function ActivityLog({ entries, error, members, canLoadMore, onLoadMore, onRetry }: Props) {
  const { t } = useTranslation('team');
  const { t: tc } = useTranslation();

  // E-mail → name, so the log shows people's names when we know them.
  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of members) if (x.email && x.fullName?.trim()) m.set(x.email.toLowerCase(), x.fullName.trim());
    return m;
  }, [members]);
  const who = (email: string | null, fallback: string) => (email ? (names.get(email.toLowerCase()) ?? email) : fallback);

  const groups = useMemo(() => {
    if (!entries) return [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayFmt = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const out: { key: string; label: string; items: AuditEntry[] }[] = [];
    for (const e of entries) {
      const d = new Date(e.createdAt);
      const key = dayKey(d);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const label =
          key === dayKey(today) ? t('activity.today') : key === dayKey(yesterday) ? t('activity.yesterday') : dayFmt.format(d);
        g = { key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] };
        out.push(g);
      }
      g.items.push(e);
    }
    return out;
  }, [entries, t]);

  if (error) {
    return (
      <Notice
        tone="danger"
        action={
          <Button size="sm" variant="outline" onClick={onRetry}>
            {tc('actions.retry')}
          </Button>
        }
      >
        {error}
      </Notice>
    );
  }

  if (!entries) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon={<History />} title={t('activity.emptyTitle')} description={t('activity.emptyBody')} />;
  }

  const timeFmt = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
  const fullFmt = new Intl.DateTimeFormat(locale(), { dateStyle: 'full', timeStyle: 'short' });
  const strong = <span className="font-medium text-foreground" />;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label}>
          <h3 className="mb-1 text-sm font-medium text-muted">{g.label}</h3>
          <ol className="flex flex-col divide-y divide-border">
            {g.items.map((e) => {
              const role = asRole(e.detail?.role);
              const actor = who(e.actorEmail, t('activity.someone'));
              const target = who(e.target, t('activity.unknownTarget'));
              const values = { actor, target, role: role ? t(`roles.${role}`) : '' };
              let key: string;
              let Icon = UserCog;
              if (e.action === 'set_role' && role === 'learner') {
                key = 'activity.removed';
                Icon = UserMinus;
              } else if (e.action === 'set_role' && role) {
                key = 'activity.setRole';
              } else if (e.action === 'invite') {
                key = role ? 'activity.invite' : 'activity.inviteNoRole';
                Icon = Mail;
              } else {
                key = 'activity.other';
                Icon = History;
              }
              const d = new Date(e.createdAt);
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                    <Icon className="size-3.5" />
                  </span>
                  <p className="min-w-0 flex-1 break-words text-base text-muted">
                    <Trans t={t} i18nKey={key} values={values} components={{ b: strong }} />
                  </p>
                  <time dateTime={e.createdAt} title={fullFmt.format(d)} className="tabular shrink-0 pt-0.5 text-sm text-muted">
                    {timeFmt.format(d)}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {canLoadMore ? (
        <Button variant="ghost" className="self-start" onClick={onLoadMore}>
          {t('actions.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
