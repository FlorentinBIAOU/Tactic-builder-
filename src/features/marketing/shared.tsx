import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleDashed, PauseCircle, PlayCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CampaignStatus } from '@/lib/types';

export const CAMPAIGN_STATUSES: CampaignStatus[] = ['planned', 'active', 'paused', 'done'];

const STATUS_STYLE: Record<CampaignStatus, { tone: 'info' | 'success' | 'warning' | 'neutral'; Icon: typeof PlayCircle }> = {
  planned: { tone: 'info', Icon: CircleDashed },
  active: { tone: 'success', Icon: PlayCircle },
  paused: { tone: 'warning', Icon: PauseCircle },
  done: { tone: 'neutral', Icon: CheckCircle2 },
};

/** Campaign status: icon + word + colour, never colour alone. */
export function StatusBadge({ status }: { status: CampaignStatus }) {
  const { t } = useTranslation('marketing');
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.active;
  return (
    <Badge tone={s.tone}>
      <s.Icon aria-hidden className="size-3.5" />
      {t(`status.${status}`, { defaultValue: status })}
    </Badge>
  );
}

/** Readable channel name; unknown channels are shown as stored. */
export function useChannelName() {
  const { t } = useTranslation('marketing');
  return (channel: string) => t(`channels.names.${channel}`, { defaultValue: channel });
}
