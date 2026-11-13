import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

/**
 * Route guard. Session loading → spinner. No session → /auth.
 * Signed in without the admin role → explanation and a way out.
 */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const loading = useAuth((s) => s.loading);
  const session = useAuth((s) => s.session);
  const isAdmin = useAuth((s) => s.isAdmin);
  const profile = useAuth((s) => s.profile);
  const signOut = useAuth((s) => s.signOut);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy>
        <Loader2 aria-label={t('states.loading')} className="size-6 animate-spin text-muted" />
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          className="max-w-lg border-solid bg-surface"
          icon={<Lock />}
          title={t('accessDenied.title')}
          description={profile ? t('accessDenied.body', { email: profile.email ?? '' }) : t('accessDenied.noProfile')}
          action={<Button onClick={() => void signOut()}>{t('topbar.signOut')}</Button>}
        />
      </div>
    );
  }

  return <>{children}</>;
}
