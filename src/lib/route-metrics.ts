/**
 * Lightweight client-side instrumentation for diagnosing the
 * "screen goes black on every page" reports.
 *
 * Tracks:
 *   - Route navigation start → first content paint duration
 *   - Suspense fallback display frequency and total time shown
 *
 * Data is stored in window.__routeMetrics and logged to the console
 * with a [route-metrics] prefix so it can be filtered easily.
 */

type RouteSample = {
  path: string;
  startedAt: number;
  durationMs?: number;
  showedFallback: boolean;
  fallbackMs?: number;
};

type Metrics = {
  samples: RouteSample[];
  fallbackShownCount: number;
  totalNavigations: number;
};

declare global {
  interface Window {
    __routeMetrics?: Metrics;
  }
}

function getStore(): Metrics {
  if (typeof window === "undefined") {
    return { samples: [], fallbackShownCount: 0, totalNavigations: 0 };
  }
  if (!window.__routeMetrics) {
    window.__routeMetrics = {
      samples: [],
      fallbackShownCount: 0,
      totalNavigations: 0,
    };
  }
  return window.__routeMetrics;
}

let activeSample: RouteSample | null = null;
let fallbackStart: number | null = null;

export function markNavigationStart(path: string) {
  if (typeof window === "undefined") return;
  const store = getStore();
  store.totalNavigations += 1;
  activeSample = {
    path,
    startedAt: performance.now(),
    showedFallback: false,
  };
  store.samples.push(activeSample);
  // Keep only the last 50 samples to avoid unbounded growth
  if (store.samples.length > 50) store.samples.shift();
  console.info(`[route-metrics] navigation start → ${path}`);
}

export function markNavigationEnd() {
  if (!activeSample) return;
  const dur = performance.now() - activeSample.startedAt;
  activeSample.durationMs = Math.round(dur);
  console.info(
    `[route-metrics] navigation end ← ${activeSample.path} in ${activeSample.durationMs}ms` +
      (activeSample.showedFallback
        ? ` (fallback shown for ${activeSample.fallbackMs}ms)`
        : ""),
  );
  activeSample = null;
}

export function markFallbackShown() {
  if (typeof window === "undefined") return;
  const store = getStore();
  store.fallbackShownCount += 1;
  fallbackStart = performance.now();
  if (activeSample) activeSample.showedFallback = true;
  console.info(
    `[route-metrics] suspense fallback shown (${store.fallbackShownCount} total)`,
  );
}

export function markFallbackHidden() {
  if (fallbackStart == null) return;
  const dur = Math.round(performance.now() - fallbackStart);
  if (activeSample) activeSample.fallbackMs = dur;
  fallbackStart = null;
  console.info(`[route-metrics] suspense fallback hidden after ${dur}ms`);
}

export function getRouteMetrics(): Metrics {
  return getStore();
}
