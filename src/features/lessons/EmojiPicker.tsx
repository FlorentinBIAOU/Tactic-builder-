import { useState } from 'react';
import * as P from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Emojis that fit the corpus (money, markets, learning). */
const EMOJIS = [
  '📖', '📘', '📚', '🎓', '💡', '🧠', '🎯', '✅',
  '💶', '💰', '🪙', '💳', '🏦', '🧾', '📊', '📈',
  '📉', '🕯️', '🧺', '🏢', '🏠', '🛟', '🛡️', '⚖️',
  '⏳', '🔥', '⚠️', '🚀', '🌍', '🤝', '🧮', '🔍',
];

/**
 * Small emoji chooser: a grid of common picks plus a free field for any
 * other emoji. The trigger shows the current emoji.
 */
export function EmojiPicker({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (emoji: string) => void;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation('lessons');
  const [open, setOpen] = useState(false);
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger
        aria-label={`${label} : ${value || t('editor.noEmoji')}`}
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded border border-input/70 bg-background text-lg transition-colors hover:border-input',
          className
        )}
      >
        <span aria-hidden>{value || '＋'}</span>
      </P.Trigger>
      <P.Portal>
        <P.Content
          align="start"
          sideOffset={6}
          className="z-toast w-72 rounded-md border border-border bg-surface p-3 shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <p className="mb-2 text-sm font-medium">{label}</p>
          <div className="grid grid-cols-8 gap-1" role="group" aria-label={label}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={value === e}
                onClick={() => {
                  onChange(e);
                  setOpen(false);
                }}
                className={cn(
                  'flex size-8 items-center justify-center rounded text-md hover:bg-surface-2',
                  value === e && 'bg-brand/15 ring-1 ring-brand/60'
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="mt-3 flex flex-col gap-1.5 text-sm">
            <span className="text-muted">{t('editor.otherEmoji')}</span>
            <Input value={value} maxLength={8} onChange={(e) => onChange(e.target.value)} className="w-24 text-center text-md" />
          </label>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
