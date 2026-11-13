import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as D from '@radix-ui/react-dialog';
import { ArrowUp, RotateCcw } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { computeCorpusHealth } from '@/lib/analytics';
import { aiAssistant, type ChatTurn } from '@/lib/ai';
import { richText } from '@/lib/richtext';
import { SheetContent } from '@/components/ui/dialog';
import { Button, IconButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useShell } from './store';

/** Robot Tact: a chat panel opened from the top bar or ⌘K. */
export function AssistantPanel() {
  const { t, i18n } = useTranslation();
  const { assistantOpen, setAssistantOpen } = useShell();
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const lessons = useCorpus((s) => s.lessons);
  const tracks = useCorpus((s) => s.tracks);
  const domains = useCorpus((s) => s.domains);
  const loaded = useCorpus((s) => s.loaded);
  const load = useCorpus((s) => s.load);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (assistantOpen && !loaded) void load();
  }, [assistantOpen, loaded, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    const history = turns;
    setTurns((x) => [...x, { role: 'user', content: message }]);
    setInput('');
    setBusy(true);
    const h = computeCorpusHealth(lessons, tracks);
    const context = {
      language: i18n.language,
      lessons: h.total,
      published: h.published,
      drafts: h.drafts,
      modules: h.trackCount,
      domains: domains.map((d) => d.name),
      topModules: h.byTrack.slice(0, 8),
    };
    const res = await aiAssistant({ message, history, context });
    setBusy(false);
    setTurns((x) => [
      ...x,
      { role: 'assistant', content: res.ok ? res.data.reply : t('assistant.error', { error: res.error }) },
    ]);
  };

  return (
    <D.Root open={assistantOpen} onOpenChange={setAssistantOpen}>
      <SheetContent
        title={t('assistant.title')}
        description={t('assistant.subtitle')}
        width="sm:max-w-md"
        closeLabel={t('actions.close')}
        footer={
          <form
            className="flex w-full items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              {t('assistant.placeholder')}
            </label>
            <Textarea
              id="assistant-input"
              rows={1}
              value={input}
              placeholder={t('assistant.placeholder')}
              className="min-h-10 resize-none"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <IconButton type="submit" variant="primary" label={t('assistant.send')} icon={<ArrowUp />} disabled={busy || !input.trim()} />
          </form>
        }
      >
        <div className="flex flex-col gap-3" aria-live="polite">
          {turns.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-base text-muted">{t('assistant.welcome')}</p>
              <div className="flex flex-col gap-2">
                {(t('assistant.suggestions', { returnObjects: true }) as string[]).map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => void send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[90%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-base leading-relaxed',
                    turn.role === 'user' ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-surface-2'
                  )}
                >
                  {turn.role === 'assistant' ? richText(turn.content) : turn.content}
                </div>
              ))}
              <Button variant="ghost" size="sm" className="self-center" onClick={() => setTurns([])}>
                <RotateCcw aria-hidden />
                {t('assistant.clear')}
              </Button>
            </>
          )}
          {busy ? <p className="text-sm text-muted">{t('assistant.thinking')}</p> : null}
          <div ref={endRef} />
        </div>
      </SheetContent>
    </D.Root>
  );
}
