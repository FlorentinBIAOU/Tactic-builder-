import { useCallback, useEffect, useRef, useState } from 'react';
import { adminErrorKind, fetchAuditLog, fetchStaff, type AdminErrorKind } from '@/lib/admin';
import type { AuditEntry, Member } from '@/lib/types';

const PAGE = 50;
const AUDIT_STEP = 50;
const AUDIT_MAX = 200;

type Load<T> = { status: 'loading' } | { status: 'error'; kind: AdminErrorKind } | { status: 'ready'; data: T };

/** Team members (paged) and the activity log, loaded independently. */
export function useTeam() {
  const [staff, setStaff] = useState<Load<{ members: Member[]; total: number }>>({ status: 'loading' });
  const [moreBusy, setMoreBusy] = useState(false);
  const [audit, setAudit] = useState<Load<AuditEntry[]>>({ status: 'loading' });
  const [auditLimit, setAuditLimit] = useState(AUDIT_STEP);
  const seq = useRef(0);

  const loadStaff = useCallback(async () => {
    const id = ++seq.current;
    setStaff((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    try {
      const page = await fetchStaff({ limit: PAGE });
      if (id === seq.current) setStaff({ status: 'ready', data: page });
    } catch (e) {
      if (id === seq.current) setStaff({ status: 'error', kind: adminErrorKind(e) });
    }
  }, []);

  const loadAudit = useCallback(async (limit: number) => {
    try {
      setAudit({ status: 'ready', data: await fetchAuditLog(limit) });
    } catch (e) {
      setAudit({ status: 'error', kind: adminErrorKind(e) });
    }
  }, []);

  useEffect(() => {
    void loadStaff();
    void loadAudit(AUDIT_STEP);
  }, [loadStaff, loadAudit]);

  const loadMore = useCallback(async () => {
    if (staff.status !== 'ready') return;
    setMoreBusy(true);
    try {
      const next = await fetchStaff({ limit: PAGE, offset: staff.data.members.length });
      setStaff((s) => {
        if (s.status !== 'ready') return s;
        const seen = new Set(s.data.members.map((m) => m.id));
        return {
          status: 'ready',
          data: { members: [...s.data.members, ...next.members.filter((m) => !seen.has(m.id))], total: next.total },
        };
      });
    } catch (e) {
      setStaff({ status: 'error', kind: adminErrorKind(e) });
    } finally {
      setMoreBusy(false);
    }
  }, [staff]);

  const moreAudit = useCallback(() => {
    const next = Math.min(auditLimit + AUDIT_STEP, AUDIT_MAX);
    setAuditLimit(next);
    void loadAudit(next);
  }, [auditLimit, loadAudit]);

  /** Reload both after a change (role, invite). */
  const refresh = useCallback(() => {
    void loadStaff();
    void loadAudit(auditLimit);
  }, [loadStaff, loadAudit, auditLimit]);

  const retryStaff = useCallback(() => {
    setStaff({ status: 'loading' });
    void loadStaff();
  }, [loadStaff]);

  const retryAudit = useCallback(() => {
    setAudit({ status: 'loading' });
    void loadAudit(auditLimit);
  }, [loadAudit, auditLimit]);

  return {
    staff,
    audit,
    moreBusy,
    loadMore,
    canLoadMoreAudit: audit.status === 'ready' && audit.data.length >= auditLimit && auditLimit < AUDIT_MAX,
    moreAudit,
    refresh,
    retryStaff,
    retryAudit,
  };
}
