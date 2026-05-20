/**
 * Global Trading Layer auto-refresh control.
 *
 * Until live execution is fixed, auto-polling against the MT5/Trading Layer
 * is fully paused. All hooks/contexts gate their interval ticks behind
 * `isAutoRefreshAllowed()`. Users must click Refresh (which dispatches the
 * `mt:refresh-*` events) to fetch fresh data. Manual refresh always works.
 *
 * If a 429 response slips through (e.g. from a manual click), call
 * `checkAndHandle429(data, error)` to start a 60s cooldown and surface a
 * toast so the UI freezes outgoing calls.
 */

import { toast } from "sonner";

// Hard switch: when true, no automatic interval poll is allowed to hit the
// Trading Layer. Manual `mt:refresh-*` events still fire and bypass this.
const AUTO_REFRESH_DISABLED = true;

/* ---------------- Global execution lock ---------------- */
/**
 * One global lock around any in-flight Buy / Sell / Close call.
 * Subscribers (buttons) disable themselves while locked and re-enable
 * after `unlockExecution()`. Lock is also released automatically when the
 * configured TTL elapses, to avoid a stuck UI if a caller forgets.
 */
const EXEC_LOCK_EVT = "mt:exec-lock";
let execLockedUntil = 0;
let execLockReason: string | null = null;
let execLockTimer: number | null = null;

export function isExecutionLocked(): boolean {
  return Date.now() < execLockedUntil || getCooldownRemainingMs() > 0;
}
export function getExecutionLockReason(): string | null {
  if (getCooldownRemainingMs() > 0) return "rate_limited";
  return Date.now() < execLockedUntil ? execLockReason : null;
}
function broadcastLock() {
  try { window.dispatchEvent(new CustomEvent(EXEC_LOCK_EVT)); } catch { /* ignore */ }
}
export function lockExecution(reason: string, ttlMs = 20000) {
  execLockedUntil = Date.now() + ttlMs;
  execLockReason = reason;
  if (execLockTimer != null) {
    try { window.clearTimeout(execLockTimer); } catch { /* ignore */ }
  }
  execLockTimer = window.setTimeout(() => {
    execLockedUntil = 0;
    execLockReason = null;
    broadcastLock();
  }, ttlMs + 50);
  broadcastLock();
}
export function unlockExecution() {
  execLockedUntil = 0;
  execLockReason = null;
  if (execLockTimer != null) {
    try { window.clearTimeout(execLockTimer); } catch { /* ignore */ }
    execLockTimer = null;
  }
  broadcastLock();
}
export async function withExecutionLock<T>(reason: string, fn: () => Promise<T>, ttlMs = 30000): Promise<T> {
  if (isExecutionLocked()) {
    throw new Error("Another execution is in progress. Please wait.");
  }
  lockExecution(reason, ttlMs);
  try { return await fn(); }
  finally { unlockExecution(); }
}
export const EXEC_LOCK_EVENT = EXEC_LOCK_EVT;

/* ---------------- Auto-refresh / cooldown ---------------- */


let cooldownUntil = 0;

export function isAutoRefreshAllowed(): boolean {
  if (AUTO_REFRESH_DISABLED) return false;
  // Pause all secondary polling whenever the tab is hidden. This kills
  // dozens of background timers (chart header, ticker bars, market movers,
  // news, watchlists) the instant the user switches tabs, which is the
  // single biggest cause of "the website slows my computer" reports.
  if (typeof document !== "undefined" && document.visibilityState === "hidden")
    return false;
  return Date.now() >= cooldownUntil;
}

export function getCooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

export function triggerRateLimitCooldown(seconds = 60) {
  const ms = seconds * 1000;
  cooldownUntil = Math.max(cooldownUntil, Date.now() + ms);
  try {
    window.dispatchEvent(
      new CustomEvent("mt:rate-limited", { detail: { until: cooldownUntil } }),
    );
  } catch {
    /* ignore */
  }
  try {
    toast.warning(`Rate limit reached. Retrying after ${seconds} seconds.`);
  } catch {
    /* ignore */
  }
}

/** Inspect an edge-function response for a 429 / rate-limited signal. */
export function checkAndHandle429(data: any, error: any): boolean {
  const status =
    data?.tradingLayerStatus ??
    data?.status ??
    (error as any)?.context?.status ??
    (error as any)?.status;
  const msg = String(data?.error ?? data?.brokerMessage ?? error?.message ?? "");
  const looksRateLimited =
    status === 429 ||
    /rate limit|too many requests/i.test(msg) ||
    (data?.retryable === true && Number(data?.retryAfter) > 0);
  if (looksRateLimited) {
    const seconds = Number(data?.retryAfter) > 0 ? Number(data.retryAfter) : 60;
    triggerRateLimitCooldown(seconds);
    return true;
  }
  return false;
}
