// Limited Canary Activation — shared policy guard.
//
// Reads `site_settings.limited_canary_policy` and enforces the narrow release
// scope defined for the post-lifecycle-PASS canary phase. This guard is
// invoked by every live mutation entry point BEFORE any Trading Layer call.
//
// Initial canary scope (immutable defaults, only the capability_state changes
// via admin action):
//   - admin allowlist only
//   - MT5 87943580 / InfinoxLimited-MT5Live
//   - verified route 559a12e4-16d8-4db3-be48-40fbea54bcfe
//   - EURUSD market SELL 0.01 entry
//   - exact platform-owned confirmed position close
// Pending orders, modify SL/TP, partial close, arbitrary close, BUY entry,
// other symbols, and XAUUSD remain disabled.

export const CANARY_POLICY_KEY = "limited_canary_policy";
export const CANARY_POLICY_VERSION = "LIMITED_CANARY_V1_2026_05_29";

export type CanaryCapabilityState =
  | "eligible_for_manual_activation"
  | "active_limited_canary"
  | "disabled_by_admin"
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
  allowed_entry_operation: "market_sell";
  allowed_entry_volume: number;
  allowed_close_operation: "close_exact_platform_confirmed_position_only";
  pending_orders: "disabled";
  cancel_pending_orders: "disabled";
  modify_sl_tp: "disabled";
  partial_close: "disabled";
  arbitrary_manual_close: "disabled";
  buy_open_long: "disabled_pending_separate_validation";
  other_symbols: "disabled_pending_separate_validation";
  xauusd: "disabled_ambiguous_multiple_executable_variants";
  activation_requires_manual_admin_action: true;
  automatic_activation: false;
}

const DEFAULT_POLICY: CanaryPolicy = {
  capability_state: "eligible_for_manual_activation",
  release_scope:
    "single_admin_account_eurusd_market_sell_and_exact_close_only",
  allowed_mt5_login: "87943580",
  allowed_mt5_server: "InfinoxLimited-MT5Live",
  allowed_route_account_id: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
  allowed_display_symbol: "EURUSD",
  allowed_broker_symbol: "EURUSD",
  allowed_entry_operation: "market_sell",
  allowed_entry_volume: 0.01,
  allowed_close_operation:
    "close_exact_platform_confirmed_position_only",
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

export async function loadCanaryPolicy(supabase: any): Promise<CanaryPolicy> {
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", CANARY_POLICY_KEY)
      .maybeSingle();
    if (data?.value && typeof data.value === "object") {
      return { ...DEFAULT_POLICY, ...(data.value as any) } as CanaryPolicy;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_POLICY };
}

async function isAdminUser(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return !!data;
  } catch { return false; }
}

export type CanaryGuardCode =
  | "CANARY_SCOPE_OK"
  | "CANARY_NOT_ACTIVE"
  | "CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE"
  | "CANARY_SUSPENDED_AFTER_EXECUTION_INCIDENT"
  | "CANARY_SCOPE_USER_NOT_ALLOWED"
  | "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED"
  | "CANARY_SCOPE_SYMBOL_NOT_ALLOWED"
  | "CANARY_SCOPE_OPERATION_NOT_ALLOWED"
  | "CANARY_SCOPE_VOLUME_NOT_ALLOWED"
  | "CANARY_SCOPE_PENDING_ORDER_DISABLED"
  | "CANARY_SCOPE_MODIFY_PROTECTION_DISABLED"
  | "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED"
  | "CANARY_SCOPE_POSITION_NOT_PLATFORM_OWNED"
  | "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED";


export interface CanaryGuardResult {
  allowed: boolean;
  code: CanaryGuardCode;
  reason?: string;
  policy: CanaryPolicy;
  policyVersion: string;
}

export interface CanaryEntryInput {
  userId: string;
  login?: string | null;
  routeAccountId?: string | null;
  displaySymbol?: string | null;
  brokerSymbol?: string | null;
  side?: string | null;
  volume?: number | null;
  operation?: string | null; // "market_buy" | "market_sell" | "buy_limit" | ...
}

export async function assertCanaryEntryAllowed(
  supabase: any,
  input: CanaryEntryInput,
): Promise<CanaryGuardResult> {
  const policy = await loadCanaryPolicy(supabase);

  // FAIL-CLOSED. The canary policy itself is the authoritative gate. No live
  // canary entry mutation may proceed unless the policy is explicitly active.
  if (policy.capability_state !== "active_limited_canary") {
    return {
      allowed: false,
      code: "CANARY_NOT_ACTIVE",
      policy,
      policyVersion: CANARY_POLICY_VERSION,
      reason:
        "Limited canary execution is not active. Manual activation is required before any canary entry order may be submitted.",
    };
  }
  // Operational-use lock: even when active, block new entries if the
  // activation audit evidence is incomplete or the lock is engaged.
  const lock = (policy as any).operational_use_lock as
    | { locked?: boolean; code?: string; reason?: string }
    | undefined;
  const evidenceStatus = String(
    (policy as any).activation_audit_evidence_status ?? "",
  );
  if (
    (lock && lock.locked === true) ||
    evidenceStatus.startsWith("incomplete") ||
    !(policy as any).activated_at ||
    !(policy as any).activated_by_user_id
  ) {
    return {
      allowed: false,
      code: "CANARY_ACTIVATION_AUDIT_EVIDENCE_INCOMPLETE",
      policy,
      policyVersion: CANARY_POLICY_VERSION,
      reason:
        lock?.reason ??
        "Canary activation audit evidence is incomplete (missing activated_at / activated_by_user_id). Re-activate with atomic audit write before submitting any new canary entry.",
    };
  }

  }
  const admin = await isAdminUser(supabase, input.userId);
  if (!admin) {
    return { allowed: false, code: "CANARY_SCOPE_USER_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Limited canary restricts execution to admin allowlist." };
  }
  const sym = String(input.displaySymbol ?? "").toUpperCase();
  if (sym === "XAUUSD") {
    return { allowed: false, code: "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "XAUUSD is ambiguous (multiple executable variants); disabled." };
  }
  if (sym !== policy.allowed_display_symbol ||
      String(input.brokerSymbol ?? "").toUpperCase() !== policy.allowed_broker_symbol) {
    return { allowed: false, code: "CANARY_SCOPE_SYMBOL_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: `Only ${policy.allowed_display_symbol} permitted by limited canary.` };
  }
  if (input.login && String(input.login) !== policy.allowed_mt5_login) {
    return { allowed: false, code: "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: `Only MT5 login ${policy.allowed_mt5_login} permitted by limited canary.` };
  }
  if (input.routeAccountId && String(input.routeAccountId) !== policy.allowed_route_account_id) {
    return { allowed: false, code: "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Route accountId does not match verified canary route." };
  }
  const side = String(input.side ?? "").toLowerCase();
  const op = String(input.operation ?? `market_${side}`).toLowerCase();
  if (side !== "sell" || op !== "market_sell") {
    return { allowed: false, code: "CANARY_SCOPE_OPERATION_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Only market SELL entry permitted by limited canary." };
  }
  if (Math.abs(Number(input.volume ?? 0) - policy.allowed_entry_volume) > 1e-8) {
    return { allowed: false, code: "CANARY_SCOPE_VOLUME_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: `Only volume ${policy.allowed_entry_volume} permitted by limited canary.` };
  }
  return { allowed: true, code: "CANARY_SCOPE_OK", policy, policyVersion: CANARY_POLICY_VERSION };
}

export interface CanaryCloseInput {
  userId: string;
  login?: string | null;
  routeAccountId?: string | null;
  brokerSymbol?: string | null;
  ticket?: string | null;
  requestedVolume?: number | null;
  positionVolume?: number | null; // exact remaining volume of confirmed position
}

// Optional outstanding-owned-position carve-out persisted on the policy
// record. Only matched tickets are eligible for emergency exposure-reduction
// close while the canary is suspended or admin-disabled. Never permits any
// new entry; never weakens ticket/route ownership checks.
export interface OutstandingOwnedPosition {
  ticket: string;
  broker_symbol: string;
  route_account_id: string;
  mt5_login: string;
  volume: number;
}

export async function assertCanaryCloseAllowed(
  supabase: any,
  input: CanaryCloseInput,
): Promise<CanaryGuardResult> {
  const policy = await loadCanaryPolicy(supabase);

  // Determine which paths through the close guard apply.
  // A — active canary: full close scope check.
  // B — suspended/disabled with explicit outstanding owned position match:
  //     emergency_exposure_reduction_close_only.
  // C — otherwise: FAIL-CLOSED.
  const active = policy.capability_state === "active_limited_canary";
  const outstanding = (policy as any).outstanding_owned_position as
    | OutstandingOwnedPosition
    | undefined;
  const emergencyEligible =
    !active &&
    (policy.capability_state === "suspended_after_execution_incident" ||
      policy.capability_state === "disabled_by_admin" ||
      policy.capability_state === "disabled_by_kill_switch") &&
    !!outstanding &&
    !!input.ticket &&
    String(outstanding.ticket) === String(input.ticket) &&
    String(outstanding.broker_symbol).toUpperCase() ===
      String(input.brokerSymbol ?? "").toUpperCase() &&
    (!input.routeAccountId ||
      String(outstanding.route_account_id) === String(input.routeAccountId)) &&
    (!input.login || String(outstanding.mt5_login) === String(input.login));

  if (!active && !emergencyEligible) {
    return {
      allowed: false,
      code: "CANARY_NOT_ACTIVE",
      policy,
      policyVersion: CANARY_POLICY_VERSION,
      reason:
        "Limited canary close is not active and no eligible outstanding platform-owned canary position is recorded.",
    };
  }

  const admin = await isAdminUser(supabase, input.userId);
  if (!admin) {
    return { allowed: false, code: "CANARY_SCOPE_USER_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Limited canary restricts close to admin allowlist." };
  }
  if (!input.ticket) {
    return { allowed: false, code: "CANARY_SCOPE_POSITION_NOT_PLATFORM_OWNED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Exact platform-owned position ticket is required." };
  }
  if (input.login && String(input.login) !== policy.allowed_mt5_login) {
    return { allowed: false, code: "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION };
  }
  if (input.routeAccountId && String(input.routeAccountId) !== policy.allowed_route_account_id) {
    return { allowed: false, code: "CANARY_SCOPE_ACCOUNT_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION };
  }
  if (String(input.brokerSymbol ?? "").toUpperCase() !== policy.allowed_broker_symbol) {
    return { allowed: false, code: "CANARY_SCOPE_SYMBOL_NOT_ALLOWED", policy, policyVersion: CANARY_POLICY_VERSION };
  }
  // Reject partial close — close volume must equal the live remaining volume.
  if (input.requestedVolume != null && input.positionVolume != null &&
      Math.abs(Number(input.requestedVolume) - Number(input.positionVolume)) > 1e-8) {
    return { allowed: false, code: "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED", policy, policyVersion: CANARY_POLICY_VERSION,
      reason: "Partial close disabled by limited canary." };
  }
  return {
    allowed: true,
    code: "CANARY_SCOPE_OK",
    policy,
    policyVersion: CANARY_POLICY_VERSION,
    reason: emergencyEligible
      ? "emergency_exposure_reduction_close_only"
      : undefined,
  };
}

/**
 * Capabilities that the canary policy permanently disables, regardless of
 * capability_state. Always returns allowed=false; callers should hard-fail.
 */
export async function assertCanaryCapabilityDisabled(
  supabase: any,
  capability: "pending_order" | "cancel_pending" | "modify_protection" | "partial_close",
): Promise<CanaryGuardResult> {
  const policy = await loadCanaryPolicy(supabase);
  const code: CanaryGuardCode = capability === "modify_protection"
    ? "CANARY_SCOPE_MODIFY_PROTECTION_DISABLED"
    : capability === "partial_close"
      ? "CANARY_SCOPE_PARTIAL_CLOSE_DISABLED"
      : "CANARY_SCOPE_PENDING_ORDER_DISABLED";
  const reason = capability === "modify_protection"
    ? "Modify SL/TP disabled by limited canary policy."
    : capability === "partial_close"
      ? "Partial close disabled by limited canary policy."
      : capability === "cancel_pending"
        ? "Cancel pending order disabled by limited canary policy."
        : "Pending order placement disabled by limited canary policy.";
  return { allowed: false, code, reason, policy, policyVersion: CANARY_POLICY_VERSION };
}

export function canaryGuardResponseBody(result: CanaryGuardResult, version: string) {
  return {
    success: false,
    version,
    canaryGuard: {
      code: result.code,
      reason: result.reason,
      capability_state: result.policy.capability_state,
      policyVersion: result.policyVersion,
    },
    error: result.reason ?? result.code,
  };
}
