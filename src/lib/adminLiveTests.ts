// Client helper for the admin live execution test matrix (Supabase-backed).
//
// Replaces the previous localStorage matrix in AdminProductionModeTab.
// Every recorded row is RLS-protected — only admins can read/write.
import { supabase } from "@/integrations/supabase/client";

export type AdminTestType =
  | "market_buy"
  | "market_sell"
  | "full_close"
  | "partial_close"
  | "modify_sl"
  | "modify_tp"
  | "buy_limit"
  | "sell_limit"
  | "buy_stop"
  | "sell_stop"
  | "cancel_pending"
  | "invert_position";

export type AdminTestStatus = "pending" | "pass" | "fail" | "skipped";

export interface AdminLiveTestRow {
  id: string;
  tester_user_id: string;
  mt5_login: string | null;
  trading_layer_trader_id: string | null;
  test_type: AdminTestType;
  status: AdminTestStatus;
  trade_id: string | null;
  client_order_id: string | null;
  client_close_id: string | null;
  request_id: string | null;
  order_id: string | null;
  deal_id: string | null;
  position_ticket: string | null;
  broker_symbol: string | null;
  side: string | null;
  requested_volume: number | null;
  confirmed_volume: number | null;
  confirmation_status: string | null;
  retcode: number | null;
  retcode_name: string | null;
  retcode_description: string | null;
  latency_ms: number | null;
  rate_limit_hit: boolean;
  duplicate_detected: boolean;
  account_id_mismatch: boolean;
  notes: string | null;
  evidence_json: any;
  tested_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminLiveTestLimits {
  id: string;
  max_order_volume: number;
  max_simultaneous_test_positions: number;
  max_daily_live_test_orders: number;
  max_daily_test_loss_usd: number;
  pending_orders_enabled: boolean;
  partial_close_cap_increase_enabled: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "admin_live_execution_tests" as const;
const LIMITS_TABLE = "admin_live_test_limits" as const;

function sanitize(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const kl = k.toLowerCase();
    if (
      kl.includes("password") ||
      kl.includes("authorization") ||
      kl.includes("api_key") ||
      kl.includes("apikey") ||
      kl.includes("token") ||
      kl.includes("secret")
    ) continue;
    out[k] = sanitize(v);
  }
  return out;
}

export async function startAdminLiveTest(input: {
  testType: AdminTestType;
  tradeId?: string | null;
  brokerSymbol?: string | null;
  side?: string | null;
  requestedVolume?: number | null;
  clientOrderId?: string | null;
  clientCloseId?: string | null;
  positionTicket?: string | number | null;
  mt5Login?: string | null;
  traderId?: string | null;
  notes?: string | null;
}): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        tester_user_id: user.id,
        mt5_login: input.mt5Login ?? null,
        trading_layer_trader_id: input.traderId ?? null,
        test_type: input.testType,
        status: "pending",
        trade_id: input.tradeId ?? null,
        client_order_id: input.clientOrderId ?? null,
        client_close_id: input.clientCloseId ?? null,
        position_ticket: input.positionTicket != null ? String(input.positionTicket) : null,
        broker_symbol: input.brokerSymbol ?? null,
        side: input.side ?? null,
        requested_volume: input.requestedVolume ?? null,
        notes: input.notes ?? null,
        tested_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (error) return null;
    return data?.id ?? null;
  } catch { return null; }
}

export async function updateAdminLiveTest(id: string, patch: Partial<{
  status: AdminTestStatus;
  confirmation_status: string;
  request_id: string | null;
  order_id: string | null;
  deal_id: string | null;
  position_ticket: string | null;
  confirmed_volume: number | null;
  retcode: number | null;
  retcode_name: string | null;
  retcode_description: string | null;
  latency_ms: number | null;
  rate_limit_hit: boolean;
  duplicate_detected: boolean;
  account_id_mismatch: boolean;
  notes: string | null;
  evidence: any;
  verified: boolean;
}>): Promise<void> {
  try {
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (k === "evidence") row.evidence_json = sanitize(v);
      else if (k === "verified") row.verified_at = v ? new Date().toISOString() : null;
      else if (v !== undefined) row[k] = v as unknown;
    }
    await supabase.from(TABLE).update(row as any).eq("id", id);
  } catch { /* ignore */ }
}

export async function listAdminLiveTests(limit = 200): Promise<AdminLiveTestRow[]> {
  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AdminLiveTestRow[]) ?? [];
}

export async function getAdminLiveTestLimits(): Promise<AdminLiveTestLimits | null> {
  const { data } = await supabase
    .from(LIMITS_TABLE)
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as AdminLiveTestLimits) ?? null;
}

export async function updateAdminLiveTestLimits(
  id: string,
  patch: Partial<Omit<AdminLiveTestLimits, "id" | "created_at" | "updated_at" | "updated_by">>,
): Promise<AdminLiveTestLimits | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase
    .from(LIMITS_TABLE)
    .update({ ...patch, updated_by: user?.id ?? null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return (data as AdminLiveTestLimits) ?? null;
}

/**
 * Re-derive matrix status from execution_audit_events for the last N hours.
 * Only persisted evidence counts as a pass — broker-accepted-but-unconfirmed
 * states remain pending, rate-limited stays pending, never pass.
 */
export async function verifyFromAudit(sinceHours = 48): Promise<{
  scanned: number;
  byType: Record<string, { pass: number; fail: number; pending: number }>;
}> {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const { data } = await supabase
    .from("execution_audit_events")
    .select("status,outcome,raw,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = data ?? [];
  const byType: Record<string, { pass: number; fail: number; pending: number }> = {};

  const PASS_STATUSES = new Set([
    "position_confirmed", "closed", "partial_closed",
    "protection_modified", "sl_modification_confirmed", "tp_modification_confirmed",
    "pending_order_placed", "order_cancelled_confirmed",
  ]);
  const FAIL_STATUSES = new Set([
    "order_rejected", "close_rejected", "cancel_rejected",
    "modify_rejected", "blocked", "rule_violation",
    "close_unconfirmed_after_reconciliation", "cancel_unconfirmed_after_reconciliation",
    "modify_unconfirmed_after_reconciliation",
  ]);
  // Pending: broker_accepted_pending_confirmation, rate_limited, confirmation_delayed_*
  // Excluded from pass/fail: dry runs, pre-submission market/session checks.
  // Recorded but non-blocking pending retest: market-closed broker rejections.
  const EXCLUDED_CLASSIFICATIONS = new Set([
    "pretrade_check",
    "dry_run_no_live_order_sent",
    "market_closed_precheck",
    "symbol_not_tradable_precheck",
    "no_executable_tick_precheck",
  ]);
  const NON_BLOCKING_REJECTIONS = new Set([
    "order_rejected_market_closed",
    "order_rejected_trade_disabled_outside_session",
  ]);
  for (const r of rows) {
    const klass = ((r as any)?.raw?.classification as string | undefined) || null;
    if (!klass) continue;
    if (EXCLUDED_CLASSIFICATIONS.has(klass)) continue;
    const status = String((r as any).status || "").toLowerCase();
    const outcome = String((r as any).outcome || "").toLowerCase();
    byType[klass] = byType[klass] || { pass: 0, fail: 0, pending: 0 };
    if (NON_BLOCKING_REJECTIONS.has(klass)) {
      // Recorded but counted as pending — does not block final activation.
      byType[klass].pending += 1;
      continue;
    }
    if (PASS_STATUSES.has(status) || PASS_STATUSES.has(outcome) || outcome === "success") {
      byType[klass].pass += 1;
    } else if (FAIL_STATUSES.has(status) || FAIL_STATUSES.has(outcome)) {
      byType[klass].fail += 1;
    } else {
      byType[klass].pending += 1;
    }
  }
  return { scanned: rows.length, byType };
}

