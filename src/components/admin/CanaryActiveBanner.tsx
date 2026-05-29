// Limited Canary Active Banner — pure presentational widget.
// Renders an unmistakable scope notice above any admin trading ticket while
// capability_state === "active_limited_canary". Does not perform any write
// action and does not change canary scope or backend execution logic.

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { loadCanaryPolicy, type CanaryPolicy } from "@/lib/canaryPolicy";

const CanaryActiveBanner = () => {
  const [policy, setPolicy] = useState<CanaryPolicy | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await loadCanaryPolicy();
      if (alive) setPolicy(p);
    })();
    return () => { alive = false; };
  }, []);

  if (!policy || policy.capability_state !== "active_limited_canary") return null;

  const Row = ({ k, v, tone = "neutral" as "ok" | "warn" | "danger" | "neutral" }) => (
    <div className="flex items-center justify-between gap-2 py-0.5 text-[10px] font-mono">
      <span className="text-emerald-200/70 uppercase tracking-wider">{k}</span>
      <span className={
        tone === "ok" ? "text-emerald-200"
        : tone === "warn" ? "text-amber-200"
        : tone === "danger" ? "text-red-200"
        : "text-foreground/90"
      }>{v}</span>
    </div>
  );

  return (
    <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3 mb-3">
      <div className="flex items-start gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" />
        <p className="text-[12px] font-semibold leading-snug text-emerald-100">
          LIMITED CANARY ACTIVE — ONLY EURUSD SELL 0.01 IS PERMITTED. CLOSE IS
          ALLOWED ONLY FOR THE EXACT PLATFORM-OWNED CONFIRMED POSITION. ALL
          OTHER LIVE ACTIONS ARE BLOCKED.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-x-4 gap-y-0">
        <div>
          <Row k="allowed_account" v={`MT5 ${policy.allowed_mt5_login}`} tone="ok" />
          <Row k="broker_symbol" v={policy.allowed_broker_symbol} tone="ok" />
          <Row k="route" v="559a12e4…bcfe" tone="ok" />
          <Row k="entry_side_permitted" v="SELL only" tone="ok" />
          <Row k="entry_volume_fixed" v="0.01 (locked)" tone="ok" />
        </div>
        <div>
          <Row k="buy_entry" v="DISABLED · CANARY_SCOPE_OPERATION_NOT_ALLOWED" tone="danger" />
          <Row k="other_symbols" v="DISABLED" tone="warn" />
          <Row k="xauusd" v="DISABLED (ambiguous)" tone="danger" />
          <Row k="pending_orders" v="DISABLED" tone="warn" />
          <Row k="modify_sl_tp" v="DISABLED" tone="warn" />
        </div>
      </div>
      <p className="text-[10px] mt-2 flex items-start gap-1.5 text-amber-200/90 leading-snug">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        Lot-size controls are locked to 0.01 and the symbol selector is locked
        to EURUSD for canary execution. The exact-position close button is
        available only after a platform-owned confirmed canary position exists.
        Any rejection, mis-routing, missing confirmation or uncertain exposure
        transitions the canary to <code>suspended_after_execution_incident</code>.
      </p>
    </div>
  );
};

export default CanaryActiveBanner;
