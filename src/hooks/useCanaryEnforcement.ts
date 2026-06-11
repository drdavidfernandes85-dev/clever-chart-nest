// Centralised Limited Canary enforcement for execution tickets.
// While capability_state === "active_limited_canary" this hook returns the
// scope locks that BlackArrowTradePanel + QuickTradePanel MUST apply to the
// execution ticket (symbol, side, volume, disabled-controls).
//
// The backend (_shared/canaryPolicy.ts) remains authoritative — this hook
// is a UI-layer guard, NOT a substitute for the server policy gate.

import { useEffect, useState } from "react";
import { loadCanaryPolicy, type CanaryPolicy } from "@/lib/canaryPolicy";

export interface CanaryEnforcement {
  policy: CanaryPolicy | null;
  active: boolean;                // capability_state === active_limited_canary
  lockedSymbol: string | null;    // forced execution symbol (EURUSD)
  lockedSide: "buy" | "sell" | null;
  lockedVolume: number | null;    // 0.01
  buyDisabled: boolean;
  pendingDisabled: boolean;
  otherSymbolsDisabled: boolean;
  lockCode: string | null;
}

const POLL_MS = 10_000;

export function useCanaryEnforcement(): CanaryEnforcement {
  const [policy, setPolicy] = useState<CanaryPolicy | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const p = await loadCanaryPolicy();
      if (alive) setPolicy(p);
    };
    void run();
    const id = window.setInterval(run, POLL_MS);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const active = policy?.capability_state === "active_limited_canary"
    && !policy?.operational_use_lock?.locked;

  // Full live trading mode: when admin has enabled buys and all symbols,
  // the narrow EURUSD-SELL-0.01 UI lockdown is lifted entirely. Backend
  // policy (_shared/canaryPolicy.ts) remains the authoritative gate.
  const fullMode = !!active
    && (policy as any)?.buy_open_long === "enabled"
    && (policy as any)?.other_symbols === "enabled";

  const narrowActive = !!active && !fullMode;

  return {
    policy,
    active: narrowActive,
    lockedSymbol: narrowActive ? (policy?.allowed_broker_symbol ?? "EURUSD") : null,
    lockedSide: narrowActive ? "sell" : null,
    lockedVolume: narrowActive ? (Number(policy?.allowed_entry_volume) || 0.01) : null,
    buyDisabled: narrowActive,
    pendingDisabled: narrowActive,
    otherSymbolsDisabled: narrowActive,
    lockCode: policy?.operational_use_lock?.code ?? null,
  };
}

