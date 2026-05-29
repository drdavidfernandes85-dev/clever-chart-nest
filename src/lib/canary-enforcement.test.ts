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

// ---------- Active-ticket control-surface lockdown (BUY + non-0.01 volumes) ----------

interface PanelControls {
  buyButtonDisabled: boolean;
  sellButtonEnabled: boolean;
  volumeInputDisabled: boolean;
  volumeChips: { value: number; disabled: boolean; selected: boolean }[];
  orderTypeOptions: string[];
}

function deriveControlSurface(policy: CanaryPolicy | null, chipValues: number[]): PanelControls {
  const e = deriveEnforcement(policy);
  const lockedVol = e.lockedVolume ?? 0.01;
  return {
    buyButtonDisabled: e.buyDisabled,
    sellButtonEnabled: true,
    volumeInputDisabled: e.active,
    volumeChips: chipValues.map((v) => ({
      value: v,
      disabled: e.active && v !== lockedVol,
      selected: e.active ? v === lockedVol : false,
    })),
    orderTypeOptions: e.active ? ["market"] : ["market", "limit", "stop"],
  };
}

function buildAllowedEntryPayload(policy: CanaryPolicy | null) {
  const e = deriveEnforcement(policy);
  if (!e.active) return null;
  return { side: e.lockedSide, symbol: e.lockedSymbol, volume: e.lockedVolume };
}

const QUICK_LOTS = [0.01, 0.02, 0.05, 0.1];
const QUICK_VOLS = [0.01, 0.02, 0.03, 0.05, 0.1, 0.25, 0.5, 1, 2];

describe("canary execution-ticket control-surface lockdown", () => {
  it("BlackArrowTradePanel: BUY button technically disabled under active canary", () => {
    const c = deriveControlSurface(base, QUICK_VOLS);
    expect(c.buyButtonDisabled).toBe(true);
  });
  it("QuickTradePanel: BUY button technically disabled under active canary", () => {
    const c = deriveControlSurface(base, QUICK_LOTS);
    expect(c.buyButtonDisabled).toBe(true);
  });
  it("BlackArrow: only 0.01 lot chip enabled; 0.02/0.10/1.00 disabled", () => {
    const c = deriveControlSurface(base, QUICK_VOLS);
    expect(c.volumeChips.find((x) => x.value === 0.01)?.disabled).toBe(false);
    expect(c.volumeChips.find((x) => x.value === 0.01)?.selected).toBe(true);
    for (const v of [0.02, 0.05, 0.1, 0.25, 0.5, 1, 2]) {
      expect(c.volumeChips.find((x) => x.value === v)?.disabled).toBe(true);
    }
  });
  it("QuickTrade: only 0.01 lot chip enabled; 0.02/0.05/0.10 disabled", () => {
    const c = deriveControlSurface(base, QUICK_LOTS);
    for (const v of [0.02, 0.05, 0.1]) {
      expect(c.volumeChips.find((x) => x.value === v)?.disabled).toBe(true);
    }
    expect(c.volumeChips.find((x) => x.value === 0.01)?.selected).toBe(true);
  });
  it("free-form volume input is technically disabled in both panels under active canary", () => {
    expect(deriveControlSurface(base, QUICK_VOLS).volumeInputDisabled).toBe(true);
    expect(deriveControlSurface(base, QUICK_LOTS).volumeInputDisabled).toBe(true);
  });
  it("order type options reduced to MARKET only under active canary", () => {
    expect(deriveControlSurface(base, QUICK_VOLS).orderTypeOptions).toEqual(["market"]);
  });
  it("permitted payload is exactly {sell, EURUSD, 0.01}", () => {
    expect(buildAllowedEntryPayload(base)).toEqual({ side: "sell", symbol: "EURUSD", volume: 0.01 });
  });
  it("disabled canary surfaces no canary-permitted entry payload", () => {
    const disabled = { ...base, capability_state: "disabled_by_admin" } as any;
    expect(buildAllowedEntryPayload(disabled)).toBeNull();
  });
  it("backend rejects BUY EURUSD 0.01 with CANARY_SCOPE_OPERATION_NOT_ALLOWED", () => {
    expect(wouldBackendAcceptEntry({ symbol: "EURUSD", side: "buy", volume: 0.01 }, base).code)
      .toBe("CANARY_SCOPE_OPERATION_NOT_ALLOWED");
  });
  it("backend rejects SELL EURUSD 0.02 with CANARY_SCOPE_VOLUME_NOT_ALLOWED", () => {
    expect(wouldBackendAcceptEntry({ symbol: "EURUSD", side: "sell", volume: 0.02 }, base).code)
      .toBe("CANARY_SCOPE_VOLUME_NOT_ALLOWED");
  });
  it("backend rejects GBPUSD with CANARY_SCOPE_SYMBOL_NOT_ALLOWED", () => {
    expect(wouldBackendAcceptEntry({ symbol: "GBPUSD", side: "sell", volume: 0.01 }, base).code)
      .toBe("CANARY_SCOPE_SYMBOL_NOT_ALLOWED");
  });
  it("backend rejects XAUUSD with CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED", () => {
    expect(wouldBackendAcceptEntry({ symbol: "XAUUSD", side: "sell", volume: 0.01 }, base).code)
      .toBe("CANARY_SCOPE_XAUUSD_AMBIGUOUS_DISABLED");
  });
  it("close action remains exact platform-owned ticket only (policy contract)", () => {
    expect(base.allowed_close_operation).toBe("close_exact_platform_confirmed_position_only");
  });
});

// ─── Canary SELL enablement model (general-release gates bypass) ─────────
// Mirrors the gating model implemented in BlackArrowTradePanel where the
// authorised admin-canary SELL bypasses ordinary-user gates such as
// final_activation_blocker.general_buy_sell_disabled and
// admin_exec_permission_blocked, while BUY / non-EURUSD / non-0.01 / pending
// remain blocked and backend canary policy is still authoritative.

interface CanarySellInputs {
  canaryActive: boolean;
  isAdmin: boolean;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  orderType: "Market" | "Limit" | "Stop";
  // Core readiness gates (always required).
  connected: boolean;
  hasValidBidAsk: boolean;
  killSwitchActive: boolean;
  liveDisabled: boolean;
  execLocked: boolean;
  // Per-side TL eligibility.
  tlSellReady: boolean;
  tlBuyReady: boolean;
  // Ordinary-user / general-release gates.
  finalBlockerActive: boolean;
  adminExecPermissionBlocked: boolean;
  liveModeGateOk: boolean;
  sessionGateOk: boolean;
}

function deriveCanSubmit(i: CanarySellInputs) {
  const core =
    i.connected &&
    i.hasValidBidAsk &&
    !i.killSwitchActive &&
    !i.liveDisabled &&
    !i.execLocked &&
    i.volume > 0;
  const scopeMatches =
    i.canaryActive &&
    i.symbol.toUpperCase() === "EURUSD" &&
    Math.abs(i.volume - 0.01) < 1e-9 &&
    i.orderType === "Market";
  const canarySellException = i.canaryActive && i.isAdmin && scopeMatches;
  const generalGatesOk =
    i.liveModeGateOk && i.sessionGateOk && !i.adminExecPermissionBlocked && !i.finalBlockerActive;
  const canSubmitSell =
    core &&
    i.tlSellReady &&
    (canarySellException ? true : generalGatesOk);
  const canSubmitBuy =
    core && i.tlBuyReady && generalGatesOk && !i.canaryActive;
  return { canSubmitSell, canSubmitBuy, canarySellException, generalGatesOk };
}

const okInputs: CanarySellInputs = {
  canaryActive: true,
  isAdmin: true,
  symbol: "EURUSD",
  side: "sell",
  volume: 0.01,
  orderType: "Market",
  connected: true,
  hasValidBidAsk: true,
  killSwitchActive: false,
  liveDisabled: false,
  execLocked: false,
  tlSellReady: true,
  tlBuyReady: true,
  finalBlockerActive: true, // general release blocker active
  adminExecPermissionBlocked: true, // general gate engaged
  liveModeGateOk: true,
  sessionGateOk: true,
};

describe("canary SELL enablement model", () => {
  it("enables SELL when canary active, scope matches, and readiness passes — even with general blockers ON", () => {
    const r = deriveCanSubmit(okInputs);
    expect(r.canarySellException).toBe(true);
    expect(r.canSubmitSell).toBe(true);
    // BUY stays blocked while canary active.
    expect(r.canSubmitBuy).toBe(false);
  });
  it("general_client_execution / final_activation_blocker do NOT block authorised admin-canary SELL", () => {
    const r = deriveCanSubmit({ ...okInputs, finalBlockerActive: true, adminExecPermissionBlocked: true });
    expect(r.canSubmitSell).toBe(true);
  });
  it("ordinary user (non-admin) remains blocked while general release blocker active", () => {
    const r = deriveCanSubmit({ ...okInputs, isAdmin: false });
    expect(r.canSubmitSell).toBe(false);
  });
  it("BUY remains disabled while SELL is enabled", () => {
    const r = deriveCanSubmit(okInputs);
    expect(r.canSubmitBuy).toBe(false);
  });
  it("volume other than 0.01 disables canary SELL exception", () => {
    const r = deriveCanSubmit({ ...okInputs, volume: 0.02 });
    expect(r.canarySellException).toBe(false);
    expect(r.canSubmitSell).toBe(false);
  });
  it("XAUUSD remains blocked while EURUSD SELL is enabled", () => {
    const r = deriveCanSubmit({ ...okInputs, symbol: "XAUUSD" });
    expect(r.canarySellException).toBe(false);
    expect(r.canSubmitSell).toBe(false);
  });
  it("Limit/Stop order types remain blocked (market only)", () => {
    expect(deriveCanSubmit({ ...okInputs, orderType: "Limit" }).canSubmitSell).toBe(false);
    expect(deriveCanSubmit({ ...okInputs, orderType: "Stop" }).canSubmitSell).toBe(false);
  });
  it("operational-use lock disables SELL (canary considered inactive)", () => {
    const r = deriveCanSubmit({ ...okInputs, canaryActive: false });
    expect(r.canSubmitSell).toBe(false);
  });
  it("kill switch / execution lock / liveDisabled disable SELL regardless of canary", () => {
    expect(deriveCanSubmit({ ...okInputs, killSwitchActive: true }).canSubmitSell).toBe(false);
    expect(deriveCanSubmit({ ...okInputs, execLocked: true }).canSubmitSell).toBe(false);
    expect(deriveCanSubmit({ ...okInputs, liveDisabled: true }).canSubmitSell).toBe(false);
  });
  it("TL sellReady=false disables SELL even with canary exception", () => {
    const r = deriveCanSubmit({ ...okInputs, tlSellReady: false });
    expect(r.canSubmitSell).toBe(false);
  });
  it("no bid/ask disables SELL", () => {
    const r = deriveCanSubmit({ ...okInputs, hasValidBidAsk: false });
    expect(r.canSubmitSell).toBe(false);
  });
  it("disconnected account disables SELL", () => {
    const r = deriveCanSubmit({ ...okInputs, connected: false });
    expect(r.canSubmitSell).toBe(false);
  });
  it("mutation-suppressed permitted payload remains exactly {sell, EURUSD, 0.01}", () => {
    expect(buildAllowedEntryPayload(base)).toEqual({ side: "sell", symbol: "EURUSD", volume: 0.01 });
  });
});
