import { lazy, Suspense, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as D from '@radix-ui/react-dialog';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Skeleton } from '@/components/ui/feedback';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarNav, Wordmark } from '@/components/shell/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { CommandPalette } from '@/components/shell/CommandPalette';
import { useShell } from '@/components/shell/store';
import { useCorpus } from '@/store/corpus';

// Heavy panels are loaded the first time they are opened.
const LessonEditor = lazy(() => import('@/features/lessons/LessonEditor').then((m) => ({ default: m.LessonEditor })));
const PreviewSheet = lazy(() => import('@/features/lessons/PreviewSheet').then((m) => ({ default: m.PreviewSheet })));
const AssistantPanel = lazy(() => import('@/components/shell/AssistantPanel').then((m) => ({ default: m.AssistantPanel })));

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-64 w-full" />
    </div>
  );
}

/** App frame: grouped sidebar, top bar, routed page, global panels. */
export default function AppShell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { navOpen, setNavOpen, assistantOpen } = useShell();
  const editorOpen = useCorpus((s) => s.editorOpen);
  const previewOpen = useCorpus((s) => !!s.previewLesson);
  const assistantUsed = useRef(false);
  const editorUsed = useRef(false);
  const previewUsed = useRef(false);
  // Once mounted, keep panels mounted so closing animations and state work.
  if (assistantOpen) assistantUsed.current = true;
  if (editorOpen) editorUsed.current = true;
  if (previewOpen) previewUsed.current = true;

  return (
    <TooltipProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('nav.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-sidebar hidden w-60 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-border px-6">
          <Wordmark />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
      </aside>

      {/* Phone / tablet navigation */}
      <D.Root open={navOpen} onOpenChange={setNavOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-overlay bg-black/55 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-overlay flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-overlay data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden">
            <D.Title className="flex h-14 items-center border-b border-border px-6">
              <Wordmark />
            </D.Title>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setNavOpen(false)} />
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette />
      <Suspense fallback={null}>
        {assistantUsed.current ? <AssistantPanel /> : null}
        {editorUsed.current ? <LessonEditor /> : null}
        {previewUsed.current ? <PreviewSheet /> : null}
      </Suspense>
    </TooltipProvider>
  );
}
