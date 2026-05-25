/**
 * Trading Execution Eligibility — read-only Admin card.
 *
 * Calls `get-trading-execution-eligibility` for tracked symbols and renders
 * the live account.trade_mode + per-symbol broker_symbol + trade_mode the
 * mutation gates use. No live orders are submitted from here.
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
} from "@/lib/executionEligibility";
import { toast } from "sonner";

const TRACKED_SYMBOLS = ["EURUSD", "XAUUSD"] as const;

const maskTraderId = (id: string | null) =>
  !id ? "—" : id.length <= 12 ? "••••" : `${id.slice(0, 8)}…${id.slice(-4)}`;

function ageString(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  return `${Math.round(secs / 3600)}h ago`;
}

const eligibilityTone = (e: ExecutionEligibility | null) => {
  if (!e) return "border-border/40 text-muted-foreground";
  if (e.eligibility === "eligible") return "border-emerald-500/40 text-emerald-300";
  if (e.eligibility === "blocked") return "border-red-500/40 text-red-300";
  return "border-amber-500/40 text-amber-300";
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

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  const anyData = Object.values(data).find(Boolean) ?? null;
  const accountEligible = anyData?.accountTradeEligible === true;
  const symbolEligibility = TRACKED_SYMBOLS.map((s) => ({ s, e: data[s] ?? null }));
  const readyForVerifiedTest =
    accountEligible &&
    symbolEligibility.some(
      ({ e }) =>
        e &&
        e.eligibility === "eligible" &&
        !!e.brokerSymbol &&
        e.symbolTradeEligible === true,
    );
  const blockerReason =
    !anyData
      ? "Refresh required — no Trading Layer eligibility data loaded yet."
      : !accountEligible
        ? `Account trade_mode not eligible (${anyData.accountTradeMode ?? "unknown"}).`
        : !readyForVerifiedTest
          ? "No tracked symbol explicitly tradable with a resolved broker symbol."
          : null;

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
              <AlertTriangle className="h-3 w-3" /> Not ready
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={refreshAll} disabled={busy}>
          <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
          Refresh Execution Eligibility
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
        Market-data availability and execution permission are separate. Live testing is
        enabled only when Trading Layer confirms the account and exact broker symbol
        are tradable.
      </p>

      <div className="rounded border border-border/40 p-2.5 mb-3 bg-muted/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Account
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <span className="text-muted-foreground">trader_id</span>
          <span>{maskTraderId(anyData?.traderId ?? null)}</span>
          <span className="text-muted-foreground">account.trade_mode</span>
          <span className={accountEligible ? "text-emerald-300" : "text-red-300"}>
            {anyData?.accountTradeMode ?? "unknown"}
          </span>
          <span className="text-muted-foreground">interpreted</span>
          <span className={accountEligible ? "text-emerald-300" : "text-red-300"}>
            {anyData ? (accountEligible ? "eligible" : "blocked") : "unknown"}
          </span>
          <span className="text-muted-foreground">last refreshed</span>
          <span>{ageString(anyData?.checkedAt ?? null)}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Symbol catalogue
        </div>
        {symbolEligibility.map(({ s, e }) => {
          const tone = eligibilityTone(e);
          return (
            <div key={s} className={`rounded border px-2.5 py-2 text-[11px] font-mono ${tone}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-foreground">{s}</span>
                <span className="uppercase text-[10px]">
                  {e?.eligibility ?? "unknown"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] opacity-90 text-foreground">
                <span className="text-muted-foreground">displaySymbol</span>
                <span>{e?.displaySymbol ?? s}</span>
                <span className="text-muted-foreground">brokerSymbol</span>
                <span>{e?.brokerSymbol ?? "—"}</span>
                <span className="text-muted-foreground">symbol.trade_mode</span>
                <span>{e?.symbolTradeMode ?? "—"}</span>
                <span className="text-muted-foreground">interpreted</span>
                <span>
                  {e
                    ? e.symbolTradeEligible
                      ? "eligible"
                      : e.brokerSymbol
                        ? "blocked"
                        : "unknown"
                    : "unknown"}
                </span>
                <span className="text-muted-foreground">mapping source</span>
                <span>trading_layer_symbols</span>
                <span className="text-muted-foreground">mapping refreshed</span>
                <span>{ageString(e?.checkedAt ?? null)}</span>
                {e?.blockedReason && (
                  <>
                    <span className="text-muted-foreground">blocked reason</span>
                    <span className="text-red-300">{e.blockedReason}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded border border-border/40 p-2 text-[10.5px] font-mono">
        <span className="text-muted-foreground">Ready for broker-symbol verified live test: </span>
        <span className={readyForVerifiedTest ? "text-emerald-300" : "text-amber-300"}>
          {readyForVerifiedTest ? "yes" : "no"}
        </span>
        {blockerReason && (
          <div className="mt-1 text-amber-300/90">Reason: {blockerReason}</div>
        )}
      </div>
    </Card>
  );
}
