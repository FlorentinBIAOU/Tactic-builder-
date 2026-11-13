import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert">
      <EmptyState
        icon={<AlertTriangle />}
        title={t('states.pageError')}
        description={t('states.pageErrorHelp')}
        action={
          <Button variant="primary" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        }
      />
    </div>
  );
}

type Props = { children: ReactNode; fallback?: (reset: () => void) => ReactNode };
type State = { error: Error | null };

/**
 * Catches render errors so one broken view does not blank the whole app.
 * Wrap each routed page (keyed by path, so navigating away resets it).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('View crashed', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);
    return <ErrorFallback onRetry={this.reset} />;
  }
}
