import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { BookOpenText, Bot, Plus, Search } from 'lucide-react';
import { useCorpus } from '@/store/corpus';
import { NAV_ITEMS } from './nav';
import { useShell } from './store';

const item =
  'flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-base outline-none data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted';
const heading = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-muted';

/** ⌘K / Ctrl+K: jump to a page, open a lesson, run an action. */
export function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { commandOpen, setCommandOpen, setAssistantOpen } = useShell();
  const lessons = useCorpus((s) => s.lessons);
  const openEditor = useCorpus((s) => s.openEditor);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!useShell.getState().commandOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandOpen]);

  const run = (fn: () => void) => {
    setCommandOpen(false);
    fn();
  };

  return (
    <D.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-overlay bg-black/55 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <D.Content className="fixed left-1/2 top-[12vh] z-overlay w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <D.Title className="sr-only">{t('topbar.search')}</D.Title>
          <Command label={t('topbar.search')} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search aria-hidden className="size-4 text-muted" />
              <Command.Input
                autoFocus
                placeholder={t('topbar.searchPlaceholder')}
                className="h-12 flex-1 bg-transparent text-md outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className={`max-h-[60vh] overflow-y-auto p-2 ${heading}`}>
              <Command.Empty className="px-3 py-6 text-center text-base text-muted">{t('command.empty')}</Command.Empty>
              <Command.Group heading={t('command.actions')}>
                <Command.Item className={item} onSelect={() => run(() => openEditor())}>
                  <Plus aria-hidden />
                  {t('command.newLesson')}
                </Command.Item>
                <Command.Item className={item} onSelect={() => run(() => setAssistantOpen(true))}>
                  <Bot aria-hidden />
                  {t('command.openAssistant')}
                </Command.Item>
              </Command.Group>
              <Command.Group heading={t('command.pages')}>
                {NAV_ITEMS.map((n) => (
                  <Command.Item key={n.to} className={item} value={`page ${t(`nav.${n.key}`)}`} onSelect={() => run(() => navigate(n.to))}>
                    <n.icon aria-hidden />
                    {t(`nav.${n.key}`)}
                  </Command.Item>
                ))}
              </Command.Group>
              {lessons.length ? (
                <Command.Group heading={t('command.lessons')}>
                  {lessons.slice(0, 600).map((l) => (
                    <Command.Item
                      key={l.id}
                      value={`${l.name} ${l.id}`}
                      className={item}
                      onSelect={() => run(() => openEditor(l))}
                    >
                      <BookOpenText aria-hidden />
                      <span className="flex-1 truncate">{l.name}</span>
                      <span className="text-sm text-muted">{l.id}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
