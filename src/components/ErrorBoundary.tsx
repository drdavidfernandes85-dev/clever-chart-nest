import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Optional label for diagnostics — e.g. "route:/analytics" or "widget:Leaderboard". */
  scope?: string;
  /** Render a compact inline fallback instead of the full-page one. */
  inline?: boolean;
  /** Custom fallback render function. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React error boundary. Catches errors from descendants and prevents
 * a single failing widget or page from crashing the whole app into a black
 * screen. Use at the root, around lazy routes, and around risky widgets
 * (charts, terminal panels, third-party embeds).
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console in all environments; Sentry/etc can hook here later.
     
    console.error(
      `[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ""}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            This section failed to load.
          </span>
          <button
            type="button"
            onClick={this.reset}
            className="rounded border border-destructive/40 px-2 py-0.5 hover:bg-destructive/20"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            Something went wrong
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            This section ran into an unexpected error. You can retry, or go back
            to the dashboard.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-muted p-2 text-left text-[10px] text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
