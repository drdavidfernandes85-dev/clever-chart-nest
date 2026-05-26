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
  const [mapping, setMapping] = useState<VerifiedMapping | null>(null);

  const loadFromCache = useCallback(() => {
    const next: Record<string, ExecutionEligibility | null> = {};
    for (const s of TRACKED_SYMBOLS) next[s] = readCachedEligibility(s);
    setData(next);
  }, []);

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

  useEffect(() => { loadFromCache(); loadMapping(); }, [loadFromCache, loadMapping]);

  const anyData = Object.values(data).find(Boolean) ?? null;
  const rawAccountInterp = anyData?.accountTradeModeInterpretation ?? "unknown";
  const accountInterp: ModeInterpretation =
    rawAccountInterp === "eligible" || rawAccountInterp === "blocked" ||
    rawAccountInterp === "awaiting_enum_confirmation"
      ? rawAccountInterp
      : (typeof rawAccountInterp === "string" && rawAccountInterp.toLowerCase().includes("awaiting"))
      ? "awaiting_enum_confirmation"
      : "unknown";
  const accountEligible = anyData?.accountTradeEligible === true;
  const permissionFields = anyData?.permissionFieldsFound ?? {};
  const permissionFieldEntries = Object.entries(permissionFields);
  const catalogue = anyData?.catalogue;

  const readyForVerifiedTest =
    accountEligible &&
    catalogue?.complete === true &&
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
              BLOCKED — Awaiting complete Trading Layer broker-symbol catalogue and confirmed execution-permission interpretation
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={refreshAll} disabled={busy}>
          <RefreshCw className={`h-3 w-3 mr-1 ${busy ? "animate-spin" : ""}`} />
          Refresh Execution Eligibility
        </Button>
      </div>

      <p className="text-[10.5px] text-muted-foreground mb-3 leading-relaxed">
        Account execution permission is independent of market-data visibility.
        Numeric account.trade_mode values are surfaced raw and never auto-interpreted
        as "trade disabled" — live mutation stays fail-closed until Trading Layer
        confirms the enum mapping or returns an explicit trading-allowed boolean.
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
            {anyData?.accountIdRelationshipVerified ? "yes" : "unverified"}
          </span>
          <span className="text-muted-foreground">trader HTTP status</span>
          <span>{anyData?.traderHttpStatus ?? "—"}</span>
          <span className="text-muted-foreground">account.trade_mode (raw)</span>
          <span>{anyData?.accountTradeModeRaw ?? anyData?.accountTradeMode ?? "—"}</span>
          <span className="text-muted-foreground">trade_mode interpretation</span>
          <span className={interpretationTone(accountInterp)}>
            {String(anyData?.accountTradeModeInterpretation ?? interpretationLabel(accountInterp))}
          </span>
          <span className="text-muted-foreground">account type interpretation</span>
          <span className="text-amber-300">
            {anyData?.accountTypeInterpretation ?? "—"}
          </span>
          <span className="text-muted-foreground">account execution permission</span>
          <span className={accountEligible ? "text-emerald-300" : "text-amber-300"}>
            {anyData?.accountExecutionPermission ?? "unknown"}
          </span>
          <span className="text-muted-foreground">permission source</span>
          <span>{anyData?.accountExecutionPermissionSource ?? "none — awaiting Trading Layer confirmation"}</span>
          <span className="text-muted-foreground">checkedAt</span>
          <span>{ageString(anyData?.checkedAt ?? null)}</span>
        </div>
        {permissionFieldEntries.length > 0 ? (
          <div className="mt-2 pt-2 border-t border-border/30">
            <div className="text-[9.5px] uppercase text-muted-foreground mb-1">
              Explicit permission fields exposed by /traders
            </div>
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(permissionFields, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-amber-300">
            Trading Layer trader response exposes account.trade_mode but no explicit account execution-permission boolean.
          </div>
        )}
      </div>

      <div className="rounded border border-border/40 p-2.5 mb-3 bg-muted/10">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
          Broker-symbol catalogue
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <span className="text-muted-foreground">Catalogue status</span>
          <span className={catalogue?.complete ? "text-emerald-300" : "text-amber-300"}>
            {catalogue?.status ?? "unknown"}
          </span>
          <span className="text-muted-foreground">Symbols loaded</span>
          <span>{catalogue?.symbolsLoaded ?? 0}</span>
          <span className="text-muted-foreground">Total available</span>
          <span>{catalogue?.totalReported ?? "not reported"}</span>
          <span className="text-muted-foreground">Pages fetched</span>
          <span>{catalogue?.pagesFetched ?? 0}</span>
          <span className="text-muted-foreground">Pagination complete</span>
          <span className={catalogue?.paginationComplete ? "text-emerald-300" : "text-amber-300"}>
            {catalogue?.paginationComplete ? "yes" : "no"}
          </span>
          <span className="text-muted-foreground">Direct symbol lookup</span>
          <span>
            {catalogue?.directSearchAttempted
              ? `attempted — ${catalogue.directSearchHits} hit(s)`
              : "not needed"}
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Tracked symbols (read-only; not suppressed by account block)
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
                  No matching catalogue rows. Click Refresh to crawl + direct-lookup.
                </div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-normal py-0.5">brokerSymbol</th>
                      <th className="text-left font-normal py-0.5">canonical</th>
                      <th className="text-left font-normal py-0.5">trade_mode (raw)</th>
                      <th className="text-left font-normal py-0.5">interpreted</th>
                      <th className="text-left font-normal py-0.5">source acctId</th>
                      <th className="text-left font-normal py-0.5">verified</th>
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
                        <td className="py-0.5">{maskTraderId(v.sourceAccountId ?? null)}</td>
                        <td className={`py-0.5 ${v.sourceVerified ? "text-emerald-300" : "text-amber-300"}`}>
                          {v.sourceVerified ? "yes" : "no"}
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
              : "BLOCKED — Awaiting complete Trading Layer broker-symbol catalogue and confirmed execution-permission interpretation"}
          </span>
        </div>
        <div className="text-muted-foreground">
          Required next action: Confirm Trading Layer trade_mode enum or
          explicit trading-allowed field, and complete broker-symbol catalogue
          pagination so EURUSD/XAUUSD exact broker symbols can be verified.
        </div>
      </div>
    </Card>
  );
}
