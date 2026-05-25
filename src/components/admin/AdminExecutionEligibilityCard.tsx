/**
 * Trading Execution Eligibility — read-only Admin card.
 *
 * Surfaces RAW Trading Layer trade_mode values for the account and for each
 * matched broker-symbol variant. Until TL confirms the numeric trade_mode
 * enum mapping, numeric values are labelled "awaiting enum confirmation"
 * and live mutation remains fail-closed. Read-only catalogue inspection is
 * never suppressed by an account-level execution block.
 */
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  fetchExecutionEligibility,
  readCachedEligibility,
  type ExecutionEligibility,
  type ModeInterpretation,
} from "@/lib/executionEligibility";
import { toast } from "sonner";

const TRACKED_SYMBOLS = ["EURUSD", "XAUUSD"] as const;

const maskTraderId = (id: string | null) =>
  !id ? "—" : id.length <= 12 ? "••••" : `${id.slice(0, 8)}…${id.slice(-4)}`;

function ageString(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

const interpretationLabel = (i: ModeInterpretation | undefined): string => {
  switch (i) {
    case "eligible": return "eligible";
    case "blocked": return "blocked";
    case "awaiting_enum_confirmation":
      return "awaiting Trading Layer enum confirmation";
    default: return "unknown";
  }
};

const interpretationTone = (i: ModeInterpretation | undefined): string => {
  switch (i) {
    case "eligible": return "text-emerald-300";
    case "blocked": return "text-red-300";
    case "awaiting_enum_confirmation": return "text-amber-300";
    default: return "text-muted-foreground";
  }
};

export default function AdminExecutionEligibilityCard() {
  const [data, setData] = useState<Record<string, ExecutionEligibility | null>>({});
  const [busy, setBusy] = useState(false);

  const loadFromCache = useCallback(() => {
    const next: Record<string, ExecutionEligibility | null> = {};
    for (const s of TRACKED_SYMBOLS) next[s] = readCachedEligibility(s);
    setData(next);
  }, []);

  const refreshAll = useCallback(async () => {
    setBusy(true);
    try {
      const next: Record<string, ExecutionEligibility | null> = {};
      for (const s of TRACKED_SYMBOLS) {
        next[s] = await fetchExecutionEligibility(s, { refresh: true });
      }
      setData(next);
      toast.success("Execution eligibility refreshed");
    } catch (e: any) {
      toast.error("Eligibility refresh failed", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { loadFromCache(); }, [loadFromCache]);

  const anyData = Object.values(data).find(Boolean) ?? null;
  const accountInterp = anyData?.accountTradeModeInterpretation ?? "unknown";
  const accountEligible = accountInterp === "eligible";
  const enumSource = anyData?.enumMappingSource ?? null;

  const readyForVerifiedTest =
    accountEligible &&
    TRACKED_SYMBOLS.some((s) => {
      const e = data[s];
      return !!e?.brokerSymbol &&
        e.symbolTradeModeInterpretation === "eligible" &&
        e.eligibility === "eligible";
    });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Trading Execution Eligibility</h3>
          {readyForVerifiedTest ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-300 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> Ready for broker-symbol verified test
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              BLOCKED — Awaiting Trading Layer trade-mode interpretation
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={refreshAll} disabled={busy}>
          <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
          Refresh Execution Eligibility
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
        Trading Layer returned numeric trade-mode values. Live execution remains
        blocked until those values are mapped to confirmed executable states.
        Market-data availability and execution permission are independent.
      </p>

      <div className="rounded border border-border/40 p-2.5 mb-3 bg-muted/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          IDs & Account
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <span className="text-muted-foreground">Trader ID</span>
          <span>{maskTraderId(anyData?.traderIdUsed ?? anyData?.traderId ?? null)}</span>
          <span className="text-muted-foreground">Account ID (for /symbols)</span>
          <span>{maskTraderId(anyData?.accountIdUsedForSymbols ?? null)}</span>
          <span className="text-muted-foreground">Account ID from /traders</span>
          <span>{maskTraderId(anyData?.accountIdFromTrader ?? null)}</span>
          <span className="text-muted-foreground">ID relationship verified</span>
          <span className={anyData?.accountIdRelationshipVerified ? "text-emerald-300" : "text-amber-300"}>
            {anyData?.accountIdRelationshipVerified ? "yes" : "no"}
          </span>
          <span className="text-muted-foreground">account.trade_mode (raw)</span>
          <span>{anyData?.accountTradeMode ?? "—"}</span>
          <span className="text-muted-foreground">interpreted</span>
          <span className={interpretationTone(accountInterp)}>
            {interpretationLabel(accountInterp)}
          </span>
          <span className="text-muted-foreground">mutation eligibility</span>
          <span className={accountEligible ? "text-emerald-300" : "text-red-300"}>
            {accountEligible ? "eligible" : "blocked until confirmed"}
          </span>
          <span className="text-muted-foreground">enum mapping source</span>
          <span>{enumSource ?? "none — awaiting Trading Layer confirmation"}</span>
          <span className="text-muted-foreground">checkedAt</span>
          <span>{ageString(anyData?.checkedAt ?? null)}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Symbol catalogue (read-only; not suppressed by account block)
        </div>
        {TRACKED_SYMBOLS.map((s) => {
          const e = data[s];
          const variants = e?.variants ?? [];
          return (
            <div key={s} className="rounded border border-border/40 px-2.5 py-2 text-[11px] font-mono">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-foreground">{s}</span>
                <span className="uppercase text-[10px] text-muted-foreground">
                  {variants.length} variant{variants.length === 1 ? "" : "s"}
                </span>
              </div>
              {variants.length === 0 ? (
                <div className="text-[10px] text-amber-300">
                  No matching catalogue rows. Click Refresh to upsert.
                </div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-normal py-0.5">brokerSymbol</th>
                      <th className="text-left font-normal py-0.5">canonical</th>
                      <th className="text-left font-normal py-0.5">trade_mode (raw)</th>
                      <th className="text-left font-normal py-0.5">interpreted</th>
                      <th className="text-left font-normal py-0.5">checkedAt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.brokerSymbol} className="border-t border-border/20">
                        <td className="py-0.5 text-foreground font-semibold">{v.brokerSymbol}</td>
                        <td className="py-0.5">{v.canonicalSymbol ?? "—"}</td>
                        <td className="py-0.5">{v.tradeMode ?? "—"}</td>
                        <td className={`py-0.5 ${interpretationTone(v.interpretation)}`}>
                          {interpretationLabel(v.interpretation)}
                        </td>
                        <td className="py-0.5">{ageString(v.checkedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded border border-border/40 p-2 text-[10.5px] font-mono space-y-1">
        <div>
          <span className="text-muted-foreground">Live execution readiness: </span>
          <span className={readyForVerifiedTest ? "text-emerald-300" : "text-amber-300"}>
            {readyForVerifiedTest
              ? "READY — exact broker symbol with confirmed eligibility"
              : "BLOCKED — Awaiting Trading Layer trade-mode interpretation and verified broker symbol eligibility"}
          </span>
        </div>
        <div className="text-muted-foreground">
          Required next action: Confirm Trading Layer trade_mode enum values and
          review exact EURUSD/XAUUSD broker-symbol rows above.
        </div>
      </div>
    </Card>
  );
}
