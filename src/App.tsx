import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import RequireAdmin from '@/components/RequireAdmin';
import AppShell from '@/components/AppShell';
import { ToastHost } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';

// Each view is its own chunk, loaded on first visit.
const AuthView = lazy(() => import('@/views/AuthView'));
const LessonsView = lazy(() => import('@/features/lessons/LessonsView'));
const ImportExportView = lazy(() => import('@/features/import-export/ImportExportView'));
const StatsView = lazy(() => import('@/views/StatsView'));
const IdeasView = lazy(() => import('@/features/ideas/IdeasView'));
const AgentsView = lazy(() => import('@/views/AgentsView'));
const MarketingView = lazy(() => import('@/views/MarketingView'));
const StructureView = lazy(() => import('@/features/structure/StructureView'));
const LibraryView = lazy(() => import('@/features/library/LibraryView'));
const MembersView = lazy(() => import('@/views/MembersView'));

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => init(), [init]);

  return (
    <>
      <Routes>
        <Route
          path="/auth"
          element={
            <ErrorBoundary>
              <Suspense fallback={null}>
                <AuthView />
              </Suspense>
            </ErrorBoundary>
          }
        />

        <Route
          element={
            <RequireAdmin>
              <AppShell />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/lessons" replace />} />
          {/* Dashboard page arrives in sprint 5; statistics until then. */}
          <Route path="/dashboard" element={<StatsView />} />
          <Route path="/lessons" element={<LessonsView />} />
          <Route path="/structure" element={<StructureView />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/import-export" element={<ImportExportView />} />
          <Route path="/ideas" element={<IdeasView />} />
          <Route path="/agents" element={<AgentsView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/marketing" element={<MarketingView />} />
          <Route path="/team" element={<MembersView />} />

          {/* Old addresses still work. */}
          <Route path="/explore" element={<Navigate to="/lessons" replace />} />
          <Route path="/content" element={<Navigate to="/structure" replace />} />
          <Route path="/export" element={<Navigate to="/import-export" replace />} />
          <Route path="/members" element={<Navigate to="/team" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastHost />
    </>
  );
}
