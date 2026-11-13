import { Component, type ErrorInfo, type ReactNode } from 'react';

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
    return (
      <div role="alert" style={{ padding: 32, maxWidth: 560 }}>
        <h2 style={{ margin: '0 0 8px' }}>This page hit an error.</h2>
        <p style={{ margin: '0 0 16px', opacity: 0.8 }}>
          Your data is safe. Try again, or reload the page if it keeps happening.
        </p>
        <button type="button" className="btn primary" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
