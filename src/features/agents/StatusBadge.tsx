import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AgentReportStatus } from '@/lib/types';
import type { AgentStatus } from '@/lib/agents';

export type DisplayStatus = AgentStatus | 'running' | 'failed';

const AGENT_TONE = {
  never: 'neutral',
  fresh: 'success',
  outdated: 'warning',
  blocked: 'neutral',
  running: 'brand',
  failed: 'danger',
} as const;

const AGENT_ICON = {
  never: Circle,
  fresh: CheckCircle2,
  outdated: RotateCcw,
  blocked: Lock,
  running: Loader2,
  failed: AlertTriangle,
} as const;

/** Agent state: icon + text + colour (never colour alone). */
export function AgentStatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useTranslation('agents');
  const Icon = AGENT_ICON[status];
  return (
    <Badge tone={AGENT_TONE[status]}>
      <Icon aria-hidden className={status === 'running' ? 'size-3 animate-spin' : 'size-3'} />
      {t(`status.${status}`)}
    </Badge>
  );
}

const REPORT_TONE = {
  new: 'info',
  in_progress: 'warning',
  done: 'success',
  archived: 'neutral',
} as const;

export function ReportStatusBadge({ status }: { status: AgentReportStatus }) {
  const { t } = useTranslation('agents');
  return <Badge tone={REPORT_TONE[status]}>{t(`reportStatus.${status}`)}</Badge>;
}
