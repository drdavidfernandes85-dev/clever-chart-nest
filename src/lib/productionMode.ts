/**
 * Production Mode — single source of truth for platform/execution gating.
 *
 * `platform_mode = production` and `review_access_mode = false` are enforced
 * in code (see src/lib/accessMode.ts).
 * `live_refresh_enabled = true` is enforced in src/lib/tradingLayerControl.ts.
 *
 * `execution_mode` controls who can submit live Buy/Sell:
 *   - "dry_run"              → live orders disabled
 *   - "controlled_live_test" → admin allowlist only, conservative
 *   - "admin_live_test"      → admin allowlist only; full real trading
 *                              toolset (Buy/Sell, Close, Partial, Modify
 *                              SL/TP, Pending, Cancel) enabled in the UI
 *   - "live"                 → full client live execution
 *
 * Authoritative enforcement lives in
 * `supabase/functions/_shared/executionMode.ts` — this client-side flag only
 * governs UI exposure. The mode is persisted in the `site_settings` table
 * (key `execution_mode`) so backend edge functions and every browser stay
 * in sync; a localStorage mirror keeps the UI snappy for non-admin reads.
 */

import { supabase } from "@/integrations/supabase/client";
import { reviewAccessModeEnabled } from "@/lib/accessMode";

export type ExecutionMode =
  | "dry_run"
  | "controlled_live_test"
  | "admin_live_test"
  | "live";
export type MarketDataMode = "live_ws_with_fallback" | "paused";
export type PlatformMode = "production" | "review";

const EXEC_KEY = "ltr.executionMode";
const LIVE_READY_KEY = "ltr.finalLiveTestPassed";
const ADMIN_ACK_KEY = "ltr.adminLiveTestAck"; // sessionStorage
const EVT = "ltr:production-mode-change";

export const ADMIN_TESTER_TRADER_ID =
  "29008868-d583-4ab5-a6c1-57586fe92007";
export const ADMIN_TESTER_MT5_LOGIN = "87943580";

export function getPlatformMode(): PlatformMode {
  return reviewAccessModeEnabled ? "review" : "production";
}

export function getMarketDataMode(): MarketDataMode {
  return "live_ws_with_fallback";
}

export function isLiveRefreshEnabled(): boolean {
  return true;
}

function normalizeMode(v: unknown): ExecutionMode {
  return v === "live" ||
    v === "admin_live_test" ||
    v === "controlled_live_test" ||
    v === "dry_run"
    ? v
    : "controlled_live_test";
}

/** Synchronous read of the cached execution mode (mirrors site_settings). */
export function getExecutionMode(): ExecutionMode {
  try {
    return normalizeMode(localStorage.getItem(EXEC_KEY));
  } catch {
    return "controlled_live_test";
  }
}

/** Refresh the cached execution mode from the database. */
export async function refreshExecutionMode(): Promise<ExecutionMode> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "execution_mode")
      .maybeSingle();
    const mode = normalizeMode((data?.value as any)?.mode);
    try {
      localStorage.setItem(EXEC_KEY, mode);
      window.dispatchEvent(new CustomEvent(EVT));
    } catch { /* ignore */ }
    return mode;
  } catch {
    return getExecutionMode();
  }
}

/** Admin-only. Persists to site_settings (RLS limits writes to admins). */
export async function setExecutionMode(mode: ExecutionMode): Promise<void> {
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "execution_mode", value: { mode } as any },
      { onConflict: "key" },
    );
  if (error) throw error;
  try {
    localStorage.setItem(EXEC_KEY, mode);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch { /* ignore */ }
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
  } catch { /* ignore */ }
}

/** Final activation requires final live test to have passed. */
export function isFinalLiveActivationEligible(): boolean {
  return hasFinalLiveTestPassed();
}

/** Session-scoped acknowledgement for the admin live test warning. */
export function hasAdminLiveTestAck(): boolean {
  try {
    return sessionStorage.getItem(ADMIN_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminLiveTestAck(v: boolean) {
  try {
    if (v) sessionStorage.setItem(ADMIN_ACK_KEY, "1");
    else sessionStorage.removeItem(ADMIN_ACK_KEY);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch { /* ignore */ }
}

export const PRODUCTION_MODE_EVENT = EVT;

/* ============================================================
 * Execution permission status (external broker/TL permission gate)
 * ============================================================
 *
 * Tracks the result of real Trading Layer order attempts that returned
 * TRADE_RETCODE_TRADE_DISABLED across multiple symbols. This is an
 * external blocker — code does not change account/risk/coordinator
 * behaviour, it only prevents further admin live-order submissions
 * while the issue is being resolved with Trading Layer / INFINOX.
 *
 * Persisted in site_settings under key `execution_permission_status`.
 */
export type ExecutionPermissionStatus =
  | "unknown"
  | "blocked_trade_disabled"
  | "cleared_for_retest";

export interface ExecutionPermissionState {
  status: ExecutionPermissionStatus;
  reason: string | null;
  evidence: string[];
  updatedAt: string | null;
}

const PERM_KEY = "ltr.executionPermissionStatus";
const DEFAULT_PERM: ExecutionPermissionState = {
  status: "unknown",
  reason: null,
  evidence: [],
  updatedAt: null,
};

function normalizePerm(v: unknown): ExecutionPermissionState {
  const raw = (v as any) ?? {};
  const status: ExecutionPermissionStatus =
    raw.status === "blocked_trade_disabled" ||
    raw.status === "cleared_for_retest" ||
    raw.status === "unknown"
      ? raw.status
      : "unknown";
  return {
    status,
    reason: typeof raw.reason === "string" ? raw.reason : null,
    evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
  };
}

export function getExecutionPermissionState(): ExecutionPermissionState {
  try {
    const cached = localStorage.getItem(PERM_KEY);
    if (cached) return normalizePerm(JSON.parse(cached));
  } catch { /* ignore */ }
  return DEFAULT_PERM;
}

export async function refreshExecutionPermissionStatus(): Promise<ExecutionPermissionState> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "execution_permission_status")
      .maybeSingle();
    const state = normalizePerm(data?.value);
    try {
      localStorage.setItem(PERM_KEY, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent(EVT));
    } catch { /* ignore */ }
    return state;
  } catch {
    return getExecutionPermissionState();
  }
}

export async function setExecutionPermissionStatus(
  status: ExecutionPermissionStatus,
  reason?: string,
): Promise<void> {
  const prev = getExecutionPermissionState();
  const next = {
    status,
    reason: reason ?? prev.reason ?? null,
    evidence: prev.evidence ?? [],
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      { key: "execution_permission_status", value: next as any },
      { onConflict: "key" },
    );
  if (error) throw error;
  try {
    localStorage.setItem(PERM_KEY, JSON.stringify(normalizePerm(next)));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch { /* ignore */ }
}

export function isExecutionPermissionBlocked(): boolean {
  return getExecutionPermissionState().status === "blocked_trade_disabled";
}
