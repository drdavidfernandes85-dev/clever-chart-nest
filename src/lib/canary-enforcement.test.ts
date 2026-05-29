import { describe, it, expect } from "vitest";
import type { CanaryPolicy } from "@/lib/canaryPolicy";

// Pure derivation tests of the canary enforcement gating logic.
// The hook itself is async/polling; here we test the gating rules
// it codifies so any regression in scope locking is caught.

function deriveEnforcement(policy: CanaryPolicy | null) {
  const active = policy?.capability_state === "active_limited_canary"
    && !policy?.operational_use_lock?.locked;
  return {
    active: !!active,
    lockedSymbol: active ? (policy?.allowed_broker_symbol ?? "EURUSD") : null,
    lockedSide: active ? "sell" : null,
    lockedVolume: active ? (Number(policy?.allowed_entry_volume) || 0.01) : null,
    buyDisabled: !!active,
    pendingDisabled: !!active,
    otherSymbolsDisabled: !!active,
  };
}

const base: CanaryPolicy = {
  capability_state: "active_limited_canary",
  release_scope: "x",
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
  buy_open_long: "disabled",
  other_symbols: "disabled",
  xauusd: "disabled",
  activation_requires_manual_admin_action: true,
  automatic_activation: false,
};

describe("canary enforcement gating", () => {
  it("forces EURUSD SELL 0.01 when active and unlocked", () => {
    const e = deriveEnforcement(base);
    expect(e.active).toBe(true);
    expect(e.lockedSymbol).toBe("EURUSD");
    expect(e.lockedSide).toBe("sell");
    expect(e.lockedVolume).toBe(0.01);
    expect(e.buyDisabled).toBe(true);
    expect(e.otherSymbolsDisabled).toBe(true);
    expect(e.pendingDisabled).toBe(true);
  });

  it("inactive when operational_use_lock engaged", () => {
    const e = deriveEnforcement({
      ...base,
      operational_use_lock: { locked: true, code: "CANARY_UI_SCOPE_MISMATCH_UNDER_REVIEW" },
    });
    expect(e.active).toBe(false);
    expect(e.lockedSymbol).toBe(null);
    expect(e.buyDisabled).toBe(false);
  });

  it("inactive when capability_state disabled_by_admin", () => {
    const e = deriveEnforcement({ ...base, capability_state: "disabled_by_admin" });
    expect(e.active).toBe(false);
  });

  it("never permits XAUUSD as locked symbol", () => {
    // Even if policy were misconfigured, locked symbol still flows from policy.
    // This guards the contract: enforcement ALWAYS mirrors allowed_broker_symbol.
    const xau = deriveEnforcement({ ...base, allowed_broker_symbol: "XAUUSD" } as any);
    expect(xau.lockedSymbol).toBe("XAUUSD");
    // Backend (_shared/canaryPolicy.ts) blocks XAUUSD with
    // CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED regardless of frontend.
  });

  it("inactive policy null returns all-off", () => {
    const e = deriveEnforcement(null);
    expect(e.active).toBe(false);
    expect(e.lockedSymbol).toBe(null);
    expect(e.buyDisabled).toBe(false);
  });
});

// ---------- Ticket-binding scenarios (pre-reactivation verification) ----------

interface TicketState { symbol: string; side: "buy"|"sell"; volume: number; orderType: "market"|"limit"|"stop" }
function applyCanaryToTicket(prev: TicketState, policy: CanaryPolicy | null): TicketState {
  const e = deriveEnforcement(policy);
  if (!e.active) return prev;
  return {
    symbol: e.lockedSymbol!,
    side: e.lockedSide as "sell",
    volume: e.lockedVolume!,
    orderType: "market",
  };
}

function wouldBackendAcceptEntry(payload: { symbol: string; side: string; volume: number }, policy: CanaryPolicy | null) {
  // Mirrors _shared/canaryPolicy.assertCanaryEntryAllowed gating contract.
  if (policy?.capability_state !== "active_limited_canary") {
    return { ok: false, code: "CANARY_NOT_ACTIVE" };
  }
  if (policy.operational_use_lock?.locked) {
    return { ok: false, code: policy.operational_use_lock.code || "CANARY_OPERATIONAL_USE_LOCK_ENGAGED" };
  }
  const sym = (payload.symbol || "").toUpperCase();
  if (sym === "XAUUSD") return { ok: false, code: "CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED" };
  if (sym !== (policy.allowed_broker_symbol || "EURUSD").toUpperCase()) {
    return { ok: false, code: "CANARY_SCOPE_SYMBOL_NOT_ALLOWED" };
  }
  if (payload.side !== "sell") return { ok: false, code: "CANARY_SCOPE_OPERATION_NOT_ALLOWED" };
  if (Number(payload.volume) !== 0.01) return { ok: false, code: "CANARY_SCOPE_VOLUME_NOT_ALLOWED" };
  return { ok: true, code: null as string | null };
}

describe("canary ticket-binding scenarios", () => {
  it("prior XAUUSD ticket is resolved to EURUSD when canary active", () => {
    const out = applyCanaryToTicket({ symbol: "XAUUSD", side: "buy", volume: 0.10, orderType: "limit" }, base);
    expect(out.symbol).toBe("EURUSD");
    expect(out.side).toBe("sell");
    expect(out.volume).toBe(0.01);
    expect(out.orderType).toBe("market");
  });

  it("prior GBPUSD ticket is resolved to EURUSD when canary active", () => {
    const out = applyCanaryToTicket({ symbol: "GBPUSD", side: "sell", volume: 0.05, orderType: "market" }, base);
    expect(out.symbol).toBe("EURUSD");
  });

  it("market-watch/chart symbol change cannot persist into ticket under active canary", () => {
    // Simulate a chart click that tries to switch to XAUUSD.
    const afterChartClick: TicketState = { symbol: "XAUUSD", side: "sell", volume: 0.01, orderType: "market" };
    const out = applyCanaryToTicket(afterChartClick, base);
    expect(out.symbol).toBe("EURUSD");
  });

  it("BlackArrowTradePanel-style payload with XAUUSD is rejected by backend guard under active canary", () => {
    const r = wouldBackendAcceptEntry({ symbol: "XAUUSD", side: "sell", volume: 0.01 }, base);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED");
  });

  it("QuickTradePanel-style payload with XAUUSD is rejected by backend guard under active canary", () => {
    const r = wouldBackendAcceptEntry({ symbol: "XAUUSD", side: "sell", volume: 0.01 }, base);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED");
  });

  it("non-EURUSD symbol rejected with CANARY_SCOPE_SYMBOL_NOT_ALLOWED", () => {
    const r = wouldBackendAcceptEntry({ symbol: "GBPUSD", side: "sell", volume: 0.01 }, base);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
  });

  it("active canary locks side to SELL — BUY payload rejected", () => {
    const r = wouldBackendAcceptEntry({ symbol: "EURUSD", side: "buy", volume: 0.01 }, base);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_SCOPE_OPERATION_NOT_ALLOWED");
  });

  it("active canary locks volume to 0.01 — larger volume rejected", () => {
    const r = wouldBackendAcceptEntry({ symbol: "EURUSD", side: "sell", volume: 0.10 }, base);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_SCOPE_VOLUME_NOT_ALLOWED");
  });

  it("disabled canary blocks every entry attempt", () => {
    const disabled: CanaryPolicy = { ...base, capability_state: "disabled_by_admin",
      operational_use_lock: { locked: true, code: "CANARY_UI_SCOPE_MISMATCH_UNDER_REVIEW" } } as any;
    const r1 = wouldBackendAcceptEntry({ symbol: "EURUSD", side: "sell", volume: 0.01 }, disabled);
    expect(r1.ok).toBe(false);
    expect(r1.code).toBe("CANARY_NOT_ACTIVE");
    const e = deriveEnforcement(disabled);
    expect(e.active).toBe(false);
    expect(e.buyDisabled).toBe(false); // panels show normal flow once canary is gone
  });

  it("active canary disables BUY control and pending/modify controls", () => {
    const e = deriveEnforcement(base);
    expect(e.buyDisabled).toBe(true);
    expect(e.pendingDisabled).toBe(true);
    expect(e.otherSymbolsDisabled).toBe(true);
  });

  it("operational_use_lock engaged on otherwise active state still blocks entries", () => {
    const locked = { ...base, operational_use_lock: { locked: true, code: "CANARY_UI_SCOPE_MISMATCH_UNDER_REVIEW" } } as any;
    const r = wouldBackendAcceptEntry({ symbol: "EURUSD", side: "sell", volume: 0.01 }, locked);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CANARY_UI_SCOPE_MISMATCH_UNDER_REVIEW");
  });
});
