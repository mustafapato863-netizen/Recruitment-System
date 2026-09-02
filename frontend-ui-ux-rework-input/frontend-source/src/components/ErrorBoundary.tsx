import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level render crash guard. Without this, an uncaught render error
 * white-screens the entire application instead of showing a recoverable state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Unhandled render error:', error, info.componentStack);
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="grid min-h-screen place-items-center bg-rf-canvas px-4"
          role="alert"
        >
          <div className="w-full max-w-md rounded-2xl border border-rf-border bg-rf-surface p-8 text-center shadow-sm">
            <h1 className="font-rf-heading text-xl font-extrabold tracking-tight text-rf-ink">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-6 text-rf-ink-muted">
              An unexpected error occurred while rendering this workspace. Try again or reload to resolve it.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rf-action px-5 text-[13px] font-bold text-rf-on-action transition hover:bg-rf-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/40"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rf-border bg-rf-surface px-5 text-[13px] font-bold text-rf-ink transition hover:bg-rf-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-border"
              >
                Reload workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
