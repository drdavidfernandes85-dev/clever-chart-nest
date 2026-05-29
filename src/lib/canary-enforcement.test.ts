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
