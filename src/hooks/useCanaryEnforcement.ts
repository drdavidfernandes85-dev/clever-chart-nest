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

  return {
    policy,
    active: !!active,
    lockedSymbol: active ? (policy?.allowed_broker_symbol ?? "EURUSD") : null,
    lockedSide: active ? (policy?.allowed_entry_operation === "market_sell" ? "sell" : "sell") : null,
    lockedVolume: active ? (Number(policy?.allowed_entry_volume) || 0.01) : null,
    buyDisabled: !!active,
    pendingDisabled: !!active,
    otherSymbolsDisabled: !!active,
    lockCode: policy?.operational_use_lock?.code ?? null,
  };
}
