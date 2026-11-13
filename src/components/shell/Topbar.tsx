import { useTranslation } from 'react-i18next';
import { Bot, Check, Languages, LogOut, Menu as MenuIcon, Moon, Search, Sun } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/lib/theme';
import { LANGUAGES } from '@/i18n';
import { Button, IconButton } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Kbd } from '@/components/ui/feedback';
import { useShell } from './store';
import { Wordmark } from './Sidebar';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Topbar() {
  const { t, i18n } = useTranslation();
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);
  const { theme, setTheme } = useTheme();
  const { setNavOpen, setCommandOpen, setAssistantOpen } = useShell();

  return (
    <header className="sticky top-0 z-topbar flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6">
      <IconButton className="lg:hidden" label={t('nav.openMenu')} icon={<MenuIcon />} onClick={() => setNavOpen(true)} />
      <Wordmark className="min-w-0 lg:hidden" />

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        aria-label={t('topbar.search')}
        className="ml-auto flex h-9 shrink-0 items-center justify-center gap-2 rounded border border-border bg-surface px-2.5 text-base text-muted transition-colors hover:border-input sm:w-full sm:max-w-xs sm:justify-start sm:px-3 lg:ml-0 lg:max-w-sm"
      >
        <Search aria-hidden className="size-4" />
        <span className="hidden flex-1 truncate text-left sm:inline">{t('topbar.search')}</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-auto">
        <Button variant="ghost" size="sm" onClick={() => setAssistantOpen(true)} className="gap-2">
          <Bot aria-hidden />
          <span className="hidden md:inline">{t('topbar.assistant')}</span>
        </Button>

        <Menu>
          <MenuTrigger asChild>
            <IconButton label={t('topbar.language')} icon={<Languages />} />
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>{t('topbar.language')}</MenuLabel>
            {LANGUAGES.map((l) => (
              <MenuItem key={l.code} onSelect={() => void i18n.changeLanguage(l.code)}>
                <span className="flex-1">{l.label}</span>
                {i18n.language?.startsWith(l.code) ? <Check aria-hidden className="!text-brand" /> : null}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>

        <IconButton
          label={`${t('topbar.theme')} : ${theme === 'dark' ? t('topbar.themeLight') : t('topbar.themeDark')}`}
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />

        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              aria-label={t('topbar.account')}
              className="ml-1 flex size-8 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold uppercase text-brand"
            >
              {(profile?.email ?? '?').slice(0, 1)}
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>
              {t('topbar.signedInAs')}
              <span className="block truncate text-foreground">{profile?.email}</span>
            </MenuLabel>
            <MenuSeparator />
            <MenuItem icon={<LogOut />} onSelect={() => void signOut()}>
              {t('topbar.signOut')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
