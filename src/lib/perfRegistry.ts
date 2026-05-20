/**
 * Lightweight performance registry used by the Dev Mode
 * Performance Diagnostics panel.
 *
 *  - tracks heavy components currently mounted
 *  - tracks render counts per heavy component (warns past a threshold)
 *  - tracks network requests via PerformanceObserver (req/min, largest
 *    sources by host, last failure)
 *  - exposes a tiny pub/sub so the panel can render without polling
 *
 * Nothing here changes app behavior — it's diagnostics only.
 */

import { useEffect, useRef } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  for (const l of listeners) {
    try { l(); } catch { /* ignore */ }
  }
}
export function subscribePerfRegistry(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---- Heavy components ----------------------------------------------------

const mounted = new Map<string, number>(); // name -> count of instances
const renderCounts = new Map<string, number>();

export function registerHeavyMount(name: string) {
  mounted.set(name, (mounted.get(name) ?? 0) + 1);
  emit();
}
export function unregisterHeavyMount(name: string) {
  const n = (mounted.get(name) ?? 1) - 1;
  if (n <= 0) mounted.delete(name);
  else mounted.set(name, n);
  emit();
}
export function bumpRenderCount(name: string) {
  renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
}
export function getMountedHeavy(): Array<{ name: string; instances: number; renders: number }> {
  return Array.from(mounted.entries()).map(([name, instances]) => ({
    name,
    instances,
    renders: renderCounts.get(name) ?? 0,
  }));
}

/** Tag a component as "heavy" so it shows in diagnostics. */
export function useHeavyComponent(name: string) {
  bumpRenderCount(name);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    registerHeavyMount(name);
    return () => unregisterHeavyMount(name);
  }, [name]);
}

// ---- Network observer ----------------------------------------------------

type ReqRecord = { t: number; host: string; bytes: number };
const reqLog: ReqRecord[] = [];
let lastFailed: { url: string; status: number | string; at: number } | null = null;
let scanStartedAt = 0;
let lastScanAt = 0;

function pruneOld(now: number) {
  const cutoff = now - 60_000;
  while (reqLog.length && reqLog[0].t < cutoff) reqLog.shift();
}

function hostOf(url: string): string {
  try { return new URL(url, location.href).host || "(self)"; } catch { return "(unknown)"; }
}

let started = false;
export function startPerfNetObserver() {
  if (started || typeof PerformanceObserver === "undefined") return;
  started = true;
  scanStartedAt = Date.now();

  try {
    const po = new PerformanceObserver((list) => {
      const now = Date.now();
      for (const e of list.getEntries()) {
        const r = e as PerformanceResourceTiming;
        if (r.initiatorType !== "fetch" && r.initiatorType !== "xmlhttprequest") continue;
        reqLog.push({
          t: now,
          host: hostOf(r.name),
          bytes: r.transferSize || r.encodedBodySize || 0,
        });
      }
      pruneOld(now);
      lastScanAt = now;
      emit();
    });
    po.observe({ entryTypes: ["resource"] });
  } catch { /* ignore */ }

  // patch fetch only to capture failures (status >= 400 or thrown)
  const origFetch = window.fetch?.bind(window);
  if (origFetch && !(window as any).__perfFetchPatched) {
    (window as any).__perfFetchPatched = true;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      try {
        const res = await origFetch(...args);
        if (!res.ok) {
          lastFailed = { url, status: res.status, at: Date.now() };
          emit();
        }
        return res;
      } catch (err) {
        lastFailed = { url, status: (err as any)?.message ?? "error", at: Date.now() };
        emit();
        throw err;
      }
    };
  }
}

export function getNetStats() {
  const now = Date.now();
  pruneOld(now);
  const byHost = new Map<string, { count: number; bytes: number }>();
  for (const r of reqLog) {
    const cur = byHost.get(r.host) ?? { count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += r.bytes;
    byHost.set(r.host, cur);
  }
  const top = Array.from(byHost.entries())
    .map(([host, v]) => ({ host, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    requestsPerMinute: reqLog.length,
    topSources: top,
    lastFailed,
    scanStartedAt,
    lastScanAt,
  };
}

export function getMemoryInfo(): { usedMB: number; limitMB: number } | null {
  const m = (performance as any).memory;
  if (!m) return null;
  return {
    usedMB: Math.round(m.usedJSHeapSize / 1048576),
    limitMB: Math.round(m.jsHeapSizeLimit / 1048576),
  };
}
