import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

/**
 * Top-level render crash guard. Without this, an uncaught render error
 * white-screens the entire application instead of showing a recoverable state.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="grid min-h-screen place-items-center bg-rf-canvas px-4"
          role="alert"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rf-border bg-rf-surface p-8 text-center shadow-sm">
            <h1 className="font-rf-heading text-xl font-extrabold tracking-tight text-rf-ink">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm leading-6 text-rf-ink-muted">
              An unexpected error occurred while rendering this workspace. Try again or reload to resolve it.
            </p>
            {this.state.error && (
              <div className="mt-4 text-left">
                <details className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-red-700 dark:text-red-400 select-none">
                    Error details: {this.state.error.message || 'Unknown error'}
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-red-600 dark:text-red-300">
                    {this.state.error.stack || this.state.error.message}
                  </pre>
                </details>
              </div>
            )}
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-rf-action px-5 text-[13px] font-bold text-rf-on-action transition hover:bg-rf-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/40 cursor-pointer"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-rf-border bg-rf-surface px-5 text-[13px] font-bold text-rf-ink transition hover:bg-rf-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-border cursor-pointer"
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
