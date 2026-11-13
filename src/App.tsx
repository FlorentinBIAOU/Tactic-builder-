import { lazy, Suspense, useEffect } from 'react';
import Loader from '@/components/Loader';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import RequireAdmin from '@/components/RequireAdmin';
import AppShell from '@/components/AppShell';
import { ToastHost } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';

// Each view is its own chunk, loaded on first visit.
const AuthView = lazy(() => import('@/views/AuthView'));
const ExploreView = lazy(() => import('@/views/ExploreView'));
const ExportView = lazy(() => import('@/views/ExportView'));
const StatsView = lazy(() => import('@/views/StatsView'));
const IdeasView = lazy(() => import('@/views/IdeasView'));
const AgentsView = lazy(() => import('@/views/AgentsView'));
const MarketingView = lazy(() => import('@/views/MarketingView'));
const ContentView = lazy(() => import('@/views/ContentView'));
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
              <Suspense fallback={<Loader full />}>
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
          <Route index element={<Navigate to="/explore" replace />} />
          <Route path="/explore" element={<ExploreView />} />
          <Route path="/ideas" element={<IdeasView />} />
          <Route path="/content" element={<ContentView />} />
          <Route path="/export" element={<ExportView />} />
          <Route path="/stats" element={<StatsView />} />
          <Route path="/marketing" element={<MarketingView />} />
          <Route path="/agents" element={<AgentsView />} />
          <Route path="/members" element={<MembersView />} />
        </Route>

        <Route path="*" element={<Navigate to="/explore" replace />} />
      </Routes>

      <ToastHost />
    </>
  );
}
