import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, FileText, MoreHorizontal, RefreshCw, SearchX, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { EmptyState, Notice, Skeleton } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu';
import { AGENTS, isAgentId, localDateKey } from '@/lib/agents';
import { AGENT_REPORT_STATUSES, type AgentReportRecord, type AgentReportStatus } from '@/lib/types';
import { corpusErrorMessage } from '@/lib/corpus';
import { toast } from '@/components/Toast';
import { ReportStatusBadge } from './StatusBadge';
import { ReportBody } from './ReportBody';
import { fmtDateTime } from './format';
import { isLocalReport, type AgentsData } from './useAgentsData';

export type ReportFilters = { agent: string; status: string; from: string; to: string };
export const NO_FILTERS: ReportFilters = { agent: '', status: '', from: '', to: '' };

type Props = {
  data: AgentsData;
  filters: ReportFilters;
  onFiltersChange: (f: ReportFilters) => void;
  onGoPipeline: () => void;
};

export function ReportsTab({ data, filters, onFiltersChange, onGoPipeline }: Props) {
  const { t } = useTranslation(['agents', 'common']);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const agentName = (r: AgentReportRecord) => (isAgentId(r.agentId) ? t(`agent.${r.agentId}.name`) : r.agentLabel);
  const set = (patch: Partial<ReportFilters>) => onFiltersChange({ ...filters, ...patch });
  const hasFilters = Object.values(filters).some(Boolean);
  const badRange = !!filters.from && !!filters.to && filters.to < filters.from;

  const filtered = useMemo(
    () =>
      data.reports
        .filter((r) => {
          if (filters.agent && r.agentId !== filters.agent) return false;
          if (filters.status && r.status !== filters.status) return false;
          const day = localDateKey(r.createdAt);
          if (filters.from && day < filters.from) return false;
          if (filters.to && day > filters.to) return false;
          return true;
        })
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [data.reports, filters]
  );

  const open = data.reports.find((r) => r.id === openId) ?? null;
  const toDelete = data.reports.find((r) => r.id === deleteId) ?? null;

  const changeStatus = async (r: AgentReportRecord, status: AgentReportStatus) => {
    if (status === r.status) return;
    try {
      await data.changeStatus(r.id, status);
      toast(t('reports.statusChanged', { status: t(`reportStatus.${status}`) }), 'success');
    } catch (err) {
      toast(corpusErrorMessage(err), 'error');
    }
  };

  const remove = async (r: AgentReportRecord) => {
    try {
      await data.removeReport(r.id);
      if (openId === r.id) setOpenId(null);
      toast(t('reports.deleted'), 'info');
    } catch (err) {
      toast(corpusErrorMessage(err), 'error');
    }
  };

  // Agents that appear in the history but are not in the pipeline any more.
  const legacyAgents = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data.reports) if (!isAgentId(r.agentId)) m.set(r.agentId, r.agentLabel);
    return [...m.entries()];
  }, [data.reports]);

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
        <Field label={t('reports.agent')}>
          <NativeSelect value={filters.agent} onChange={(e) => set({ agent: e.target.value })}>
            <option value="">{t('reports.allAgents')}</option>
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {t(`agent.${a.id}.name`)}
              </option>
            ))}
            {legacyAgents.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('reports.status')}>
          <NativeSelect value={filters.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">{t('reports.allStatuses')}</option>
            {AGENT_REPORT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`reportStatus.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('reports.from')}>
          <Input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
        </Field>
        <Field label={t('reports.to')} error={badRange ? t('reports.invalidRange') : undefined}>
          <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </Field>
        <div className="col-span-2 flex items-center gap-1 md:col-span-1">
          <Button variant="ghost" className="h-10 md:h-9" disabled={!hasFilters} onClick={() => onFiltersChange(NO_FILTERS)}>
            {t('reports.reset')}
          </Button>
          <IconButton
            label={t('reports.refresh')}
            icon={<RefreshCw />}
            className="size-10 md:size-9"
            disabled={data.reportsState === 'loading'}
            onClick={() => void data.refreshReports()}
          />
        </div>
      </div>

      {data.reportsState === 'error' ? (
        <Notice
          tone="danger"
          title={t('reports.errorTitle')}
          action={
            <Button size="sm" onClick={() => void data.refreshReports()}>
              {t('common:actions.retry')}
            </Button>
          }
        >
          {t('reports.errorBody')}
        </Notice>
      ) : data.reportsState === 'loading' && !data.reports.length ? (
        <div className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data.reports.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title={t('reports.emptyTitle')}
          description={t('reports.emptyBody')}
          action={<Button onClick={onGoPipeline}>{t('reports.goPipeline')}</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={t('reports.noMatchTitle')}
          description={t('reports.noMatchBody')}
          action={<Button onClick={() => onFiltersChange(NO_FILTERS)}>{t('reports.reset')}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {t('reports.count', { count: filtered.length })}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[22rem] text-sm">
              <thead className="sticky top-0 bg-surface text-left text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('reports.agent')}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('reports.date')}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{t('reports.status')}</th>
                  <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">{t('reports.content')}</th>
                  <th scope="col" className="w-12 px-2 py-2.5">
                    <span className="sr-only">{t('common:actions.more')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => {
                  const date = fmtDateTime(r.createdAt);
                  const nFindings = r.report.findings?.length ?? 0;
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-1.5">
                        <button
                          type="button"
                          className="flex min-h-10 items-center gap-2 text-left text-base font-medium hover:text-brand hover:underline"
                          onClick={() => setOpenId(r.id)}
                        >
                          {agentName(r)}
                          {isLocalReport(r.id) ? <Badge tone="warning">{t('reports.localOnly')}</Badge> : null}
                        </button>
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-1.5 text-muted">{date}</td>
                      <td className="px-4 py-1.5">
                        <ReportStatusBadge status={r.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-1.5 text-muted sm:table-cell">{t('reports.findings', { count: nFindings })}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Menu>
                          <MenuTrigger asChild>
                            <IconButton label={t('reports.actions', { date })} icon={<MoreHorizontal />} className="size-10" />
                          </MenuTrigger>
                          <MenuContent>
                            <MenuItem icon={<Eye />} onSelect={() => setOpenId(r.id)}>
                              {t('reports.read')}
                            </MenuItem>
                            <MenuSeparator />
                            <MenuLabel>{t('reports.changeStatus')}</MenuLabel>
                            <MenuRadioGroup value={r.status} onValueChange={(v) => void changeStatus(r, v as AgentReportStatus)}>
                              {AGENT_REPORT_STATUSES.map((s) => (
                                <MenuRadioItem key={s} value={s}>
                                  {t(`reportStatus.${s}`)}
                                </MenuRadioItem>
                              ))}
                            </MenuRadioGroup>
                            <MenuSeparator />
                            <MenuItem icon={<Trash2 />} destructive onSelect={() => setDeleteId(r.id)}>
                              {t('reports.delete')}
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reading a report */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        {open ? (
          <SheetContent
            title={agentName(open)}
            description={fmtDateTime(open.createdAt)}
            width="sm:max-w-2xl"
            closeLabel={t('common:actions.close')}
            footer={
              <Button variant="danger" className="h-10" onClick={() => setDeleteId(open.id)}>
                <Trash2 aria-hidden />
                {t('reports.delete')}
              </Button>
            }
          >
            <div className="flex flex-col gap-6">
              <Field label={t('reports.status')} className="max-w-56">
                <NativeSelect value={open.status} onChange={(e) => void changeStatus(open, e.target.value as AgentReportStatus)}>
                  {AGENT_REPORT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`reportStatus.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <ReportBody report={open.report} />
            </div>
          </SheetContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={t('reports.deleteTitle')}
        description={toDelete ? t('reports.deleteBody', { name: agentName(toDelete), date: fmtDateTime(toDelete.createdAt) }) : undefined}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        destructive
        onConfirm={() => {
          if (toDelete) void remove(toDelete);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
