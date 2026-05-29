// Frontend mirror of the Limited Canary policy stored in
// site_settings.limited_canary_policy. The backend (_shared/canaryPolicy.ts)
// is the authoritative enforcement layer — this module is for UI display
// and admin activation/deactivation controls.

import { supabase } from "@/integrations/supabase/client";

export const CANARY_POLICY_KEY = "limited_canary_policy";
export const CANARY_POLICY_VERSION = "LIMITED_CANARY_V1_2026_05_29";

export type CanaryCapabilityState =
  | "eligible_for_manual_activation"
  | "active_limited_canary"
  | "disabled_by_admin"
  | "disabled_by_admin_pending_audited_reactivation"
  | "disabled_by_kill_switch"
  | "blocked_by_readiness_failure"
  | "suspended_after_execution_incident";

export interface CanaryPolicy {
  capability_state: CanaryCapabilityState;
  release_scope: string;
  allowed_mt5_login: string;
  allowed_mt5_server: string;
  allowed_route_account_id: string;
  allowed_display_symbol: string;
  allowed_broker_symbol: string;
  allowed_entry_operation: string;
  allowed_entry_volume: number;
  allowed_close_operation: string;
  pending_orders: string;
  cancel_pending_orders: string;
  modify_sl_tp: string;
  partial_close: string;
  arbitrary_manual_close: string;
  buy_open_long: string;
  other_symbols: string;
  xauusd: string;
  activation_requires_manual_admin_action: boolean;
  automatic_activation: boolean;
  activated_at?: string | null;
  activated_by_user_id?: string | null;
  activated_by_display?: string | null;
  activation_audit_event_id?: string | null;
  activation_audit_evidence_status?: string | null;
  operational_use_lock?: {
    locked: boolean;
    code: string;
    engaged_at?: string;
    reason?: string;
  } | null;
}

const DEFAULT_POLICY: CanaryPolicy = {
  capability_state: "eligible_for_manual_activation",
  release_scope: "single_admin_account_eurusd_market_sell_and_exact_close_only",
  allowed_mt5_login: "87943580",
  allowed_mt5_server: "InfinoxLimited-MT5Live",
  allowed_route_account_id: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
  allowed_display_symbol: "EURUSD",
  allowed_broker_symbol: "EURUSD",
  allowed_entry_operation: "market_sell",
  allowed_entry_volume: 0.01,
  allowed_close_operation: "close_exact_platform_confirmed_position_only",
  pending_orders: "disabled",
  cancel_pending_orders: "disabled",
  modify_sl_tp: "disabled",
  partial_close: "disabled",
  arbitrary_manual_close: "disabled",
  buy_open_long: "disabled_pending_separate_validation",
  other_symbols: "disabled_pending_separate_validation",
  xauusd: "disabled_ambiguous_multiple_executable_variants",
  activation_requires_manual_admin_action: true,
  automatic_activation: false,
};

export async function loadCanaryPolicy(): Promise<CanaryPolicy> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", CANARY_POLICY_KEY)
      .maybeSingle();
    if (data?.value && typeof data.value === "object") {
      return { ...DEFAULT_POLICY, ...(data.value as any) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_POLICY };
}

export interface CanaryActivationContext {
  acknowledgements: Record<string, boolean>;
  policyTestResult?: Record<string, unknown> | null;
  routeAuditStatus?: string;
  brokerSymbolAuditStatus?: string;
/**
 * Atomic activate via the server-side Postgres function
 * `public.activate_limited_canary_audited`. The frontend NEVER writes the
 * audit row and policy row separately — both writes happen inside one
 * transaction with row-locking, admin auth check, stale-state rejection,
 * and concurrent-activation defence.
 */
export async function activateLimitedCanaryAudited(ctx: {
  acknowledgements: Record<string, boolean>;
  policyTestResult: Record<string, unknown>;
  liveExposureSnapshot: { open_positions: number; pending_orders: number; symbol?: string };
  routeAuditStatus?: string;
  brokerSymbolAuditStatus?: string;
}): Promise<CanaryPolicy> {
  const { data, error } = await (supabase.rpc as any)("activate_limited_canary_audited", {
    p_acknowledgements: ctx.acknowledgements,
    p_policy_test_result: ctx.policyTestResult,
    p_live_exposure_snapshot: ctx.liveExposureSnapshot,
    p_route_audit_status: ctx.routeAuditStatus ?? "pass",
    p_broker_symbol_audit_status: ctx.brokerSymbolAuditStatus ?? "pass",
  });
  if (error) throw new Error(error.message);
  const payload = data as { policy: CanaryPolicy; audit_event_id: string };
  return { ...DEFAULT_POLICY, ...(payload?.policy as any) };
}

/**
 * Atomic disable via the server-side Postgres function
 * `public.disable_limited_canary_audited`. Same transactional guarantees.
 */
export async function disableLimitedCanaryAudited(ctx: {
  reason: string;
  liveExposureSnapshot: { open_positions: number; pending_orders: number; symbol?: string };
}): Promise<CanaryPolicy> {
  const { data, error } = await (supabase.rpc as any)("disable_limited_canary_audited", {
    p_reason: ctx.reason,
    p_live_exposure_snapshot: ctx.liveExposureSnapshot,
  });
  if (error) throw new Error(error.message);
  const payload = data as { policy: CanaryPolicy; audit_event_id: string };
  return { ...DEFAULT_POLICY, ...(payload?.policy as any) };
}

