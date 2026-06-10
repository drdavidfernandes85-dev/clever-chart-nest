// Limited Canary Active Banner — pure presentational widget.
// Renders an unmistakable scope notice above any admin trading ticket while
// capability_state === "active_limited_canary". Does not perform any write
// action and does not change canary scope or backend execution logic.
//
// Layout note: CANARY_STATE and ENTRY_VOLUME are intentionally rendered in
// distinct rows. The lot-size row must NEVER display an incident/suspension
// status — those belong to CANARY_STATE only.

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

  // Capability rows reflect the live policy switches rather than static text,
  // so enabling a capability in site_settings.limited_canary_policy is shown
  // here instead of perpetually reading "DISABLED".
  const capState = (v: string) =>
    String(v).toLowerCase() === "enabled"
      ? { v: "ENABLED", tone: "ok" as const }
      : { v: "DISABLED", tone: "warn" as const };
  const pending = capState(policy.pending_orders);
  const modify = capState(policy.modify_sl_tp);
  const partial = capState(policy.partial_close);

  const Row = ({
    k, v, tone = "neutral" as "ok" | "warn" | "danger" | "neutral",
  }) => (
    <div className="flex items-start justify-between gap-3 py-0.5 text-[10px] font-mono border-b border-emerald-500/10 last:border-b-0">
      <span className="text-emerald-200/70 uppercase tracking-wider shrink-0">{k}</span>
      <span
        className={
          "text-right break-words " +
          (tone === "ok" ? "text-emerald-200"
            : tone === "warn" ? "text-amber-200"
            : tone === "danger" ? "text-red-200"
            : "text-foreground/90")
        }
      >
        {v}
      </span>
    </div>
  );

  return (
    <div className="rounded-md border border-emerald-500/60 bg-emerald-500/10 p-3 mb-3">
      <div className="flex items-start gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" />
        <p className="text-[12px] font-semibold leading-snug text-emerald-100">
          LIMITED CANARY ACTIVE — RESTRICTED ADMIN EXECUTION
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-x-4">
        <div>
          <Row k="CANARY_STATE" v="active_limited_canary" tone="ok" />
          <Row k="ALLOWED_ACCOUNT" v={`MT5 ${policy.allowed_mt5_login} / ${policy.allowed_mt5_server}`} tone="ok" />
          <Row k="VERIFIED_ROUTE" v="559a12e4…bcfe" tone="ok" />
          <Row k="BROKER_SYMBOL" v={policy.allowed_broker_symbol} tone="ok" />
          <Row k="ENTRY_SIDE" v="SELL ONLY" tone="ok" />
          <Row k="ENTRY_VOLUME" v="0.01 (LOCKED)" tone="ok" />
          <Row k="CLOSE" v="EXACT PLATFORM-OWNED CONFIRMED POSITION ONLY" tone="ok" />
        </div>
        <div>
          <Row k="BUY_ENTRY" v="DISABLED · CANARY_SCOPE_OPERATION_NOT_ALLOWED" tone="danger" />
          <Row k="PENDING_ORDERS" v={pending.v} tone={pending.tone} />
          <Row k="MODIFY_SL_TP" v={modify.v} tone={modify.tone} />
          <Row k="PARTIAL_CLOSE" v={partial.v} tone={partial.tone} />
          <Row k="OTHER_SYMBOLS" v="DISABLED" tone="warn" />
          <Row k="XAUUSD" v="DISABLED · AMBIGUOUS" tone="danger" />
          <Row k="GENERAL_CLIENT_EXECUTION" v="DISABLED" tone="warn" />
        </div>
      </div>
      <p className="text-[10px] mt-2 flex items-start gap-1.5 text-amber-200/90 leading-snug">
        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
        Any rejection, route mismatch, missing confirmation, uncertain exposure
        or execution incident automatically suspends new canary entries. Exact
        risk-reducing close remains available only for a verified platform-owned
        confirmed open position.
      </p>
    </div>
  );
};

export default CanaryActiveBanner;
