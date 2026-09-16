import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error | null;
}

function isChunkLoadError(error?: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    error.name === 'ChunkLoadError'
  );
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

    // Auto-recover from stale chunks after a new deployment
    if (isChunkLoadError(error)) {
      const storageKey = 'rf_chunk_reload_attempt';
      const lastAttempt = sessionStorage.getItem(storageKey);
      const now = Date.now();
      // Debounce reload: only once per 15s to prevent infinite loops if offline
      if (!lastAttempt || now - Number(lastAttempt) > 15000) {
        sessionStorage.setItem(storageKey, String(now));
        window.location.reload();
      }
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);

      return (
        <div
          className="grid min-h-screen place-items-center bg-rf-canvas px-4"
          role="alert"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rf-border bg-rf-surface p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xl font-bold">
              {isChunkError ? '🔄' : '⚠️'}
            </div>
            <h1 className="font-rf-heading text-xl font-extrabold tracking-tight text-rf-ink">
              {isChunkError ? 'New Version Available' : 'Something went wrong'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-rf-ink-muted">
              {isChunkError
                ? 'RecruitFlow has been updated with the latest changes and improvements. Please reload to load the newest version.'
                : 'An unexpected error occurred while rendering this workspace. Try again or reload to resolve it.'}
            </p>
            {this.state.error && !isChunkError && (
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
              {!isChunkError && (
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-rf-action px-5 text-[13px] font-bold text-rf-on-action transition hover:bg-rf-action-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rf-action/40 cursor-pointer"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={this.handleReload}
                className={`inline-flex h-10 items-center justify-center rounded-xl px-5 text-[13px] font-bold transition focus-visible:outline-none focus-visible:ring-2 cursor-pointer ${
                  isChunkError
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                    : 'border border-rf-border bg-rf-surface text-rf-ink hover:bg-rf-surface-subtle focus-visible:ring-rf-border'
                }`}
              >
                {isChunkError ? 'Update & Reload Now' : 'Reload workspace'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
