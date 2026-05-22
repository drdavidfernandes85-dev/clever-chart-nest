/**
 * Production Mode — single source of truth for platform/execution gating.
 *
 * `platform_mode = production` and `review_access_mode = false` are enforced
 * in code (see src/lib/accessMode.ts).
 * `live_refresh_enabled = true` is enforced in src/lib/tradingLayerControl.ts.
 *
 * `execution_mode` controls who can submit live Buy/Sell:
 *   - "controlled_live_test" (current): only admin/test accounts may submit
 *     live orders, subject to all existing risk/kill-switch limits.
 *   - "live": full client live execution. ONLY flipped to "live" after the
 *     final authenticated 0.01 open/close confirmation test passes.
 *
 * The flag is persisted in `localStorage` so it can be flipped from the
 * Admin Production Mode panel without a redeploy. Backend risk validation,
 * fresh-tick gates, kill switch, testing-mode caps and reconciliation
 * integrity remain the authoritative enforcement — this flag only governs
 * frontend exposure of unrestricted live Buy/Sell to non-admin users.
 */

import { reviewAccessModeEnabled } from "@/lib/accessMode";

export type ExecutionMode = "controlled_live_test" | "live";
export type MarketDataMode = "live_ws_with_fallback" | "paused";
export type PlatformMode = "production" | "review";

const EXEC_KEY = "ltr.executionMode";
const LIVE_READY_KEY = "ltr.finalLiveTestPassed";
const EVT = "ltr:production-mode-change";

export function getPlatformMode(): PlatformMode {
  return reviewAccessModeEnabled ? "review" : "production";
}

export function getMarketDataMode(): MarketDataMode {
  return "live_ws_with_fallback";
}

export function isLiveRefreshEnabled(): boolean {
  return true;
}

export function getExecutionMode(): ExecutionMode {
  try {
    const v = localStorage.getItem(EXEC_KEY);
    return v === "live" ? "live" : "controlled_live_test";
  } catch {
    return "controlled_live_test";
  }
}

export function setExecutionMode(mode: ExecutionMode) {
  try {
    localStorage.setItem(EXEC_KEY, mode);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function hasFinalLiveTestPassed(): boolean {
  try {
    return localStorage.getItem(LIVE_READY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setFinalLiveTestPassed(v: boolean) {
  try {
    if (v) localStorage.setItem(LIVE_READY_KEY, "1");
    else localStorage.removeItem(LIVE_READY_KEY);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

/** Final activation requires final live test to have passed. */
export function isFinalLiveActivationEligible(): boolean {
  return hasFinalLiveTestPassed();
}

export const PRODUCTION_MODE_EVENT = EVT;
