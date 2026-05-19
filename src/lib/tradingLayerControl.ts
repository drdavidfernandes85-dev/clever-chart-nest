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

let cooldownUntil = 0;

export function isAutoRefreshAllowed(): boolean {
  if (AUTO_REFRESH_DISABLED) return false;
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
    toast.warning(`Rate limit reached. Retrying in ${seconds} seconds.`);
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
