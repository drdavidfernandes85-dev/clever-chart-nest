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
  liveExposureSnapshot?: Record<string, unknown> | null;
}

/**
 * Atomically activates or disables the Limited Canary:
 *   1) writes a `canary_activation_audit` row first;
 *   2) only if that succeeds, updates `site_settings.limited_canary_policy`
 *      with activated_at / activated_by_user_id / audit_event_id and clears
 *      the operational-use lock on activation.
 *
 * If the audit write fails, the state change is aborted — a live capability
 * may not become active without its corresponding audit evidence.
 */
export async function applyCanaryStateChange(
  action: "activate_limited_canary" | "disable_limited_canary",
  next: CanaryCapabilityState,
  ctx: CanaryActivationContext,
): Promise<CanaryPolicy> {
  const { data: userResp } = await supabase.auth.getUser();
  const user = userResp?.user;
  if (!user) throw new Error("Not authenticated");

  const current = await loadCanaryPolicy();
  const scopeSnapshot = {
    allowed_mt5_login: current.allowed_mt5_login,
    allowed_mt5_server: current.allowed_mt5_server,
    allowed_route_account_id: current.allowed_route_account_id,
    allowed_display_symbol: current.allowed_display_symbol,
    allowed_broker_symbol: current.allowed_broker_symbol,
    allowed_entry_operation: current.allowed_entry_operation,
    allowed_entry_volume: current.allowed_entry_volume,
    allowed_close_operation: current.allowed_close_operation,
    pending_orders: current.pending_orders,
    cancel_pending_orders: current.cancel_pending_orders,
    modify_sl_tp: current.modify_sl_tp,
    partial_close: current.partial_close,
    buy_open_long: current.buy_open_long,
    other_symbols: current.other_symbols,
    xauusd: current.xauusd,
    release_scope: current.release_scope,
  };

  const display = user.email ?? user.id;

  // Step 1: write audit FIRST. If this fails, abort.
  const { data: auditRow, error: auditErr } = await supabase
    .from("canary_activation_audit")
    .insert({
      action,
      previous_state: current.capability_state,
      new_state: next,
      changed_by_user_id: user.id,
      changed_by_display: display,
      policy_version: CANARY_POLICY_VERSION,
      scope_snapshot: scopeSnapshot,
      acknowledgements: ctx.acknowledgements,
      policy_test_result: ctx.policyTestResult ?? null,
      route_audit_status: ctx.routeAuditStatus ?? "pass",
      broker_symbol_audit_status: ctx.brokerSymbolAuditStatus ?? "pass",
      live_exposure_snapshot: ctx.liveExposureSnapshot ?? null,
    })
    .select("id, changed_at")
    .single();

  if (auditErr || !auditRow) {
    throw new Error(
      `Audit write failed — state change aborted (${auditErr?.message ?? "unknown"}).`,
    );
  }

  // Step 2: persist new policy with activation evidence.
  const updated: CanaryPolicy & Record<string, unknown> = {
    ...current,
    capability_state: next,
    updated_at: new Date().toISOString(),
    activation_audit_event_id: auditRow.id,
    last_audit_event_id: auditRow.id,
    last_state_change_at: auditRow.changed_at,
    last_state_change_by_user_id: user.id,
    last_state_change_by_display: display,
  };

  if (action === "activate_limited_canary" && next === "active_limited_canary") {
    updated.activated_at = auditRow.changed_at;
    updated.activated_by_user_id = user.id;
    updated.activated_by_display = display;
    updated.activation_audit_evidence_status = "complete_atomic_write";
    updated.operational_use_lock = { locked: false, code: "CANARY_ACTIVATION_AUDIT_EVIDENCE_OK" };
  } else {
    // Disable / lockdown: clear activated_* so a future activation must
    // re-establish atomic evidence.
    updated.activated_at = null;
    updated.activated_by_user_id = null;
    updated.activated_by_display = null;
    updated.activation_audit_evidence_status =
      next === "disabled_by_admin_pending_audited_reactivation"
        ? "incomplete_pending_audited_reactivation"
        : "cleared_on_disable";
    updated.operational_use_lock = {
      locked: true,
      code: "CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE",
      engaged_at: new Date().toISOString(),
      reason: "Canary is not active; audit evidence cleared on disable.",
    };
  }

  const { error: upsertErr } = await supabase
    .from("site_settings")
    .upsert({ key: CANARY_POLICY_KEY, value: updated as any }, { onConflict: "key" });

  if (upsertErr) throw upsertErr;
  return updated as CanaryPolicy;
}
