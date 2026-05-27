/**
 * Trading Execution Eligibility — read-only Admin card.
 *
 * Now sourced exclusively from the authoritative per-account resolver
 * `get-terminal-execution-eligibility`. The legacy
 * `get-trading-execution-eligibility` endpoint and its
 * `lib/executionEligibility.ts` wrapper are no longer used anywhere in
 * the trading stack. This card is read-only and never submits an order.
 */
import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  fetchTerminalExecutionEligibility,
  type TerminalExecutionEligibility,
} from "@/lib/terminalExecutionEligibility";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VerifiedMapping {
  login: string | null;
  server: string | null;
  traderId: string | null;
  accountId: string | null;
  externalTraderId: string | null;
  relationshipVerified: boolean;
  ignoredCount: number;
}

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

const resolutionTone = (r: string | undefined) => {
  switch (r) {
    case "resolved_unique_verified": return "text-emerald-300";
    case "resolved_unique_verified_ack_required": return "text-amber-300";
    case "ambiguous_multiple_executable_variants": return "text-amber-300";
    default: return "text-red-300";
  }
};

export default function AdminExecutionEligibilityCard() {
  const [data, setData] = useState<Record<string, TerminalExecutionEligibility | null>>({});
  const [busy, setBusy] = useState(false);
  const [mapping, setMapping] = useState<VerifiedMapping | null>(null);

  const loadMapping = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;
    const { data: active } = await supabase
      .from("user_mt_accounts")
      .select("login, server_name, trading_layer_trader_id, trading_layer_account_id, trading_layer_external_trader_id, account_id_relationship_verified")
      .eq("user_id", uid)
      .eq("platform", "mt5")
      .eq("status", "connected")
      .or("ignored_for_execution.is.null,ignored_for_execution.eq.false")
      .order("last_verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count: ignoredCount } = await supabase
      .from("user_mt_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("ignored_for_execution", true);
    setMapping({
      login: active?.login ?? null,
      server: active?.server_name ?? null,
      traderId: active?.trading_layer_trader_id ?? null,
      accountId: active?.trading_layer_account_id ?? null,
      externalTraderId: active?.trading_layer_external_trader_id ?? null,
      relationshipVerified: !!active?.account_id_relationship_verified,
      ignoredCount: ignoredCount ?? 0,
    });
  }, []);

  const refreshAll = useCallback(async () => {
    setBusy(true);
    try {
      const next: Record<string, TerminalExecutionEligibility | null> = {};
      for (const s of TRACKED_SYMBOLS) {
        next[s] = await fetchTerminalExecutionEligibility(s);
      }
      setData(next);
      toast.success("Terminal execution eligibility refreshed");
    } catch (e: any) {
      toast.error("Eligibility refresh failed", { description: e?.message });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refreshAll(); void loadMapping(); }, [refreshAll, loadMapping]);

  const anyData = Object.values(data).find(Boolean) ?? null;
  const readyForVerifiedTest = TRACKED_SYMBOLS.some((s) => {
    const e = data[s];
    return !!e?.brokerSymbol &&
      e.routeVerified === true &&
      (e.buyReady === true || e.sellReady === true);
  });

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Trading Execution Eligibility (terminal authoritative)</h3>
          {readyForVerifiedTest ? (
            <Badge variant="outline" className="gap-1 border-emerald-500/40 text-emerald-300 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> Per-account broker symbol resolved
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-300 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              BLOCKED — Per-account terminal resolver did not return an executable broker symbol
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={refreshAll} disabled={busy}>
          <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
          Refresh Execution Eligibility
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
        Source of truth: <code>get-terminal-execution-eligibility</code> (per-account
        resolver, verified route, no cross-account contamination). The legacy
        global <code>get-trading-execution-eligibility</code> endpoint is no longer
        called from any client. The upstream retcode-10017 broker block remains
        independent of this card.
      </p>

      {mapping && (
        <div className="rounded border border-emerald-500/30 p-2.5 mb-3 bg-emerald-500/5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 mb-1.5">
            Verified MT5 → Trading Layer mapping
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
            <span className="text-muted-foreground">MT5 login</span>
            <span>{mapping.login ?? "—"}</span>
            <span className="text-muted-foreground">Server</span>
            <span>{mapping.server ?? "—"}</span>
            <span className="text-muted-foreground">Trader ID</span>
            <span>{maskTraderId(mapping.traderId)}</span>
            <span className="text-muted-foreground">Account ID (for /symbols)</span>
            <span>{maskTraderId(mapping.accountId)}</span>
            <span className="text-muted-foreground">External trader ID</span>
            <span>{maskTraderId(mapping.externalTraderId)}</span>
            <span className="text-muted-foreground">ID relationship verified</span>
            <span className={mapping.relationshipVerified ? "text-emerald-300" : "text-amber-300"}>
              {mapping.relationshipVerified ? "YES" : "no"}
            </span>
            <span className="text-muted-foreground">Ignored stale mapping rows</span>
            <span className={mapping.ignoredCount > 0 ? "text-emerald-300" : "text-muted-foreground"}>
              {mapping.ignoredCount} excluded from execution
            </span>
          </div>
        </div>
      )}

      <div className="rounded border border-border/40 p-2.5 mb-3 bg-muted/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Account (from terminal resolver)
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <span className="text-muted-foreground">Route account ID (masked)</span>
          <span>{anyData?.routeAccountIdMasked ?? "—"}</span>
          <span className="text-muted-foreground">Route verified</span>
          <span className={anyData?.routeVerified ? "text-emerald-300" : "text-amber-300"}>
            {anyData?.routeVerified ? "yes" : "no"}
          </span>
          <span className="text-muted-foreground">account.trade_mode (raw / label)</span>
          <span>
            {anyData?.accountTradeModeRaw ?? "—"}
            {anyData?.accountTradeModeLabel ? ` (${anyData.accountTradeModeLabel})` : ""}
          </span>
          <span className="text-muted-foreground">tradeAllowed</span>
          <span className={anyData?.tradeAllowed ? "text-emerald-300" : "text-amber-300"}>
            {anyData?.tradeAllowed == null ? "—" : anyData.tradeAllowed ? "yes" : "no"}
          </span>
          <span className="text-muted-foreground">Resolver version</span>
          <span>{anyData?.version ?? anyData?.executionPolicyVersion ?? "—"}</span>
          <span className="text-muted-foreground">checkedAt</span>
          <span>{ageString(anyData?.checkedAt ?? null)}</span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Tracked symbols (read-only)
        </div>
        {TRACKED_SYMBOLS.map((s) => {
          const e = data[s];
          return (
            <div key={s} className="rounded border border-border/40 px-2.5 py-2 text-[11px] font-mono">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-foreground">{s}</span>
                <span className={`uppercase text-[10px] ${resolutionTone(e?.brokerSymbolResolution)}`}>
                  {e?.brokerSymbolResolution ?? "unresolved"}
                </span>
              </div>
              {!e ? (
                <div className="text-[10px] text-amber-300">No data — click Refresh.</div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px]">
                  <span className="text-muted-foreground">brokerSymbol</span>
                  <span className="text-foreground font-semibold">{e.brokerSymbol ?? "—"}</span>
                  <span className="text-muted-foreground">symbol.trade_mode</span>
                  <span>
                    {e.symbolTradeModeRaw ?? "—"}
                    {e.symbolTradeModeLabel ? ` (${e.symbolTradeModeLabel})` : ""}
                  </span>
                  <span className="text-muted-foreground">BUY ready</span>
                  <span className={e.buyReady ? "text-emerald-300" : "text-red-300"}>
                    {e.buyReady ? "yes" : (e.buyBlockedReason || "no")}
                  </span>
                  <span className="text-muted-foreground">SELL ready</span>
                  <span className={e.sellReady ? "text-emerald-300" : "text-red-300"}>
                    {e.sellReady ? "yes" : (e.sellBlockedReason || "no")}
                  </span>
                  {e.ambiguousVariants && e.ambiguousVariants.length > 1 ? (
                    <>
                      <span className="text-muted-foreground">Ambiguous variants</span>
                      <span className="text-amber-300">{e.ambiguousVariants.join(", ")}</span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">checkedAt</span>
                  <span>{ageString(e.checkedAt ?? null)}</span>
                </div>
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
              ? "Resolver READY — upstream retcode-10017 broker block still gates live submission"
              : "BLOCKED at resolver"}
          </span>
        </div>
        <div className="text-muted-foreground">
          Source: <code>get-terminal-execution-eligibility</code>. Display only —
          does not authorise live order submission on its own.
        </div>
      </div>
    </Card>
  );
}
