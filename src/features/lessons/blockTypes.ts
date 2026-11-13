import { AlertTriangle, Globe2, Info, Lightbulb, Text, Zap, type LucideIcon } from 'lucide-react';
import type { BlockType } from '@/lib/types';

/** Order shown in the "add a block" menu. */
export const BLOCK_TYPES: BlockType[] = ['hook', 'content', 'tip', 'trap', 'real', 'info'];

/**
 * Look of each block type, shared by the editor and the app preview.
 * `accent` colours the left rule, `text` the label and icon.
 */
export const BLOCK_STYLE: Record<BlockType, { icon: LucideIcon; accent: string; text: string; soft: string }> = {
  hook: { icon: Zap, accent: 'border-l-brand', text: 'text-brand', soft: 'bg-brand/10' },
  content: { icon: Text, accent: 'border-l-input', text: 'text-muted', soft: 'bg-surface-2/60' },
  tip: { icon: Lightbulb, accent: 'border-l-success', text: 'text-success', soft: 'bg-success/10' },
  trap: { icon: AlertTriangle, accent: 'border-l-danger', text: 'text-danger', soft: 'bg-danger/10' },
  real: { icon: Globe2, accent: 'border-l-info', text: 'text-info', soft: 'bg-info/10' },
  info: { icon: Info, accent: 'border-l-warning', text: 'text-warning', soft: 'bg-warning/10' },
};

export function blockStyle(type: string) {
  return BLOCK_STYLE[type as BlockType] ?? BLOCK_STYLE.content;
}
