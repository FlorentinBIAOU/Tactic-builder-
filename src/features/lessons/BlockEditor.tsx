import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { IconButton } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { richText } from '@/lib/richtext';
import { cn } from '@/lib/utils';
import type { Block, BlockType } from '@/lib/types';
import { BLOCK_TYPES, blockStyle } from './blockTypes';

type Props = {
  block: Block;
  index: number;
  total: number;
  showPreview: boolean;
  onChange: (patch: Partial<Block>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
};

/** One content block: type, emoji, text, and its place in the lesson. */
export function BlockEditor({ block, index, total, showPreview, onChange, onMove, onDelete }: Props) {
  const { t } = useTranslation('lessons');
  const style = blockStyle(block.type);
  const Icon = style.icon;
  const n = index + 1;
  const typeLabel = t(`blocks.types.${block.type}`, { defaultValue: block.type });

  return (
    <section
      aria-label={t('blocks.blockLabel', { n, type: typeLabel })}
      className={cn('rounded-md border border-border border-l-4 bg-background/40', style.accent)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
        <Icon aria-hidden className={cn('size-4 shrink-0', style.text)} />
        <span className="tabular text-sm text-muted">{n}</span>
        <NativeSelect
          aria-label={t('blocks.type', { n })}
          value={block.type}
          onChange={(e) => onChange({ type: e.target.value as BlockType })}
          className="h-8 w-auto min-w-36 text-sm"
        >
          {BLOCK_TYPES.map((bt) => (
            <option key={bt} value={bt}>
              {t(`blocks.types.${bt}`)}
            </option>
          ))}
        </NativeSelect>
        <Input
          aria-label={t('blocks.emoji', { n })}
          value={block.emo ?? ''}
          maxLength={8}
          placeholder={t('blocks.emojiPlaceholder')}
          onChange={(e) => onChange({ emo: e.target.value })}
          className="h-8 w-16 text-center"
        />
        <div className="ml-auto flex items-center">
          <IconButton size="icon-sm" className="size-10 sm:size-8" label={t('blocks.moveUp', { n })} icon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton size="icon-sm" className="size-10 sm:size-8" label={t('blocks.moveDown', { n })} icon={<ArrowDown />} disabled={index === total - 1} onClick={() => onMove(1)} />
          <IconButton size="icon-sm" className="size-10 text-danger sm:size-8" label={t('blocks.delete', { n })} icon={<Trash2 />} onClick={onDelete} />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <Textarea
          aria-label={t('blocks.text', { n })}
          value={block.text}
          rows={3}
          placeholder={t(`blocks.placeholders.${block.type}`, { defaultValue: t('blocks.placeholders.content') })}
          onChange={(e) => onChange({ text: e.target.value })}
          className="min-h-20 bg-background"
        />
        {showPreview ? (
          <div className={cn('rounded px-3 py-2 text-base leading-relaxed', style.soft)}>
            <span className="sr-only">{t('blocks.previewLabel')} : </span>
            {block.text.trim() ? richText(block.text) : <span className="text-muted">{t('blocks.emptyText')}</span>}
          </div>
        ) : null}
      </div>
    </section>
  );
}
