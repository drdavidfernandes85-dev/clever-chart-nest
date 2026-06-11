// Shared pre-TL gate audit writer. Every mutating Edge Function (modify, close,
// submit, cancel, execute) MUST call auditGateBlock() before any pre-TL early
// return so blocked attempts are recorded in execution_audit_events. Without
// this, gate rejections (canary, mapping, exec-mode, kill-switch, broker-symbol
// gate, fresh trade_mode) are invisible to the compliance trail.
//
// HISTORICAL GAP: gate rejections from before 2026-06-11 are unrecorded. Any
// audit-count query that returns 0 for a path may simply mean every attempt was
// blocked at a pre-TL gate prior to this deploy.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type GateAction =
  | "modify_protection"
  | "close_position"
  | "cancel_pending"
  | "submit_pending"
  | "execute_trade";

export interface GateBlockArgs {
  userId: string;
  action: GateAction;
  /** e.g. "canary", "no_mapping", "stale_mapping", "exec_mode",
   *  "kill_switch", "live_trading_disabled", "broker_symbol_gate",
   *  "fresh_trade_mode", "bad_request" */
  gate: string;
  reason: string;
  ticket?: string | number | null;
  orderId?: string | number | null;
  symbol?: string | null;
  side?: "buy" | "sell" | null;
  volume?: number | null;
  version: string;
  extra?: Record<string, unknown>;
}

export async function auditGateBlock(
  supabase: SupabaseClient,
  args: GateBlockArgs,
): Promise<void> {
  const id =
    args.ticket != null ? `${args.action.split("_")[0]}-${args.ticket}` :
    args.orderId != null ? `${args.action.split("_")[0]}-${args.orderId}` :
    `${args.action}-gate-${Date.now()}`;
  try {
    await supabase.from("execution_audit_events").insert({
      user_id: args.userId,
      trade_id: id,
      symbol: args.symbol ?? null,
      side: args.side ?? "buy",
      volume: args.volume ?? 0,
      status: `${args.action}_blocked_${args.gate}`,
      outcome: "blocked",
      reason: args.reason,
      ticket: args.ticket != null ? String(args.ticket) : (args.orderId != null ? String(args.orderId) : null),
      raw: {
        classification: args.action,
        version: args.version,
        gateBlock: true,
        gate: args.gate,
        ...(args.extra ?? {}),
      },
    });
  } catch {
    // Audit failure must never mask the gate response to the caller.
  }
}
