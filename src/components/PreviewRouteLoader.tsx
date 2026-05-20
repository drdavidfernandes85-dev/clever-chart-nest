import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Loader2, Home } from "lucide-react";

/**
 * Loading + timeout shell for internal-preview routes
 * (Leaderboard, Analytics, Video Library).
 *
 * - Shows an explicit loading state while the lazy chunk + page data
 *   come in.
 * - Trips a "took too long" fallback after `timeoutMs` so the user
 *   never sees an infinite spinner / black screen.
 * - Fallback offers Retry (re-mount the route) and Back to Dashboard.
 *
 * This is the Suspense fallback for the internal-preview routes; the
 * ErrorBoundary in InternalPreviewShell handles render-time crashes.
 */
const PreviewRouteLoader = ({
  label,
  timeoutMs = 12_000,
}: {
  label?: string;
  timeoutMs?: number;
}) => {
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setTimedOut(false);
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [timeoutMs, retryKey]);

  if (timedOut) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            {label ? `${label} is taking too long` : "This page is taking too long"}
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            We couldn't finish loading this internal-preview page. It may be
            offline or your connection may be slow. You can retry, or head back
            to the dashboard.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTimedOut(false);
                setRetryKey((k) => k + 1);
                // Hard reload guarantees a fresh chunk fetch.
                window.location.reload();
              }}
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

  return (
    <div
      className="flex min-h-[40vh] w-full items-center justify-center p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-full border border-[#FFCD05]/40 bg-[#0B0B0C]/85 px-4 py-2 shadow-[0_0_20px_rgba(255,205,5,0.25)]">
        <Loader2 className="h-4 w-4 animate-spin text-[#FFCD05]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F5F5F5]">
          Loading {label ?? "preview"}…
        </span>
      </div>
    </div>
  );
};

/**
 * Reusable hook for data fetches inside a preview route. Provides:
 *   - loading / error / data state
 *   - automatic timeout (default 12s)
 *   - manual retry()
 *
 * Use inside Leaderboard/Analytics/VideoLibrary widgets to swap raw
 * fetch calls for one with timeout + retry semantics.
 */
export function usePreviewFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: ReadonlyArray<unknown> = [],
  options: { timeoutMs?: number; retries?: number } = {},
): {
  data: T | null;
  error: Error | null;
  loading: boolean;
  retry: () => void;
} {
  const { timeoutMs = 12_000, retries = 1 } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let attempts = 0;

    const run = async (): Promise<void> => {
      attempts += 1;
      setLoading(true);
      setError(null);
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const result = await fetcher(controller.signal);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        if (attempts <= retries && e?.name !== "AbortError") {
          window.clearTimeout(timer);
          // Tiny backoff between attempts.
          await new Promise((r) => setTimeout(r, 600));
          if (!cancelled) return run();
        }
        setError(
          e?.name === "AbortError"
            ? new Error("Request timed out. Please retry.")
            : (e instanceof Error ? e : new Error(String(e ?? "Unknown error"))),
        );
      } finally {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, retry: () => setNonce((n) => n + 1) };
}

/**
 * Inline error block used by preview-route widgets that fail to load
 * data. Pairs with `usePreviewFetch().error`.
 */
export const PreviewFetchError = ({
  error,
  onRetry,
  children,
}: {
  error: Error;
  onRetry?: () => void;
  children?: ReactNode;
}) => (
  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
    <div className="flex-1">
      <div className="font-semibold mb-1">Couldn't load this section</div>
      <div className="opacity-80">{error.message}</div>
      {children}
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-destructive/40 px-2 py-0.5 hover:bg-destructive/20 shrink-0"
      >
        Retry
      </button>
    )}
  </div>
);

export default PreviewRouteLoader;
