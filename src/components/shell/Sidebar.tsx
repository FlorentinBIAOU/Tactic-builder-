import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { NAV } from './nav';

/** Grouped navigation. Rendered fixed on desktop and inside a sheet on phones. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.mainNav')} className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((group, gi) => (
        <div key={group.key ?? gi} className="flex flex-col gap-0.5">
          {group.key ? (
            <p className="px-3 pb-1.5 text-sm text-muted">{t(`nav.groups.${group.key}`)}</p>
          ) : null}
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-9 items-center gap-3 rounded px-3 text-base font-medium transition-colors duration-fast',
                  isActive ? 'bg-surface-2 text-foreground' : 'text-muted hover:bg-surface-2/60 hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active marker: a gold bar, like a candle body on a chart. */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <item.icon aria-hidden className={cn('size-4 shrink-0', isActive ? 'text-brand' : 'text-muted group-hover:text-foreground')} />
                  <span className="truncate">{t(`nav.${item.key}`)}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-baseline gap-2', className)}>
      <span className="font-brand text-xl leading-none text-brand">TACTIC</span>
      <span className="hidden text-sm font-medium text-muted min-[400px]:inline lg:inline">Admin</span>
    </span>
  );
}
