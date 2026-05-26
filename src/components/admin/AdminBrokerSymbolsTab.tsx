import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Database, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";

interface VerifiedMapping {
  id: string;
  user_id: string;
  mt5_login: string | null;
  mt5_server: string | null;
  trading_layer_account_id: string | null;
  trading_layer_trader_id: string | null;
  trading_layer_external_trader_id: string | null;
  trading_layer_account_route_id?: string | null;
  account_route_verified?: boolean;
  account_route_verified_at?: string | null;
  mapping_status: string | null;
  credential_status: string | null;
  last_verified_at: string | null;
}

interface Variant {
  brokerSymbol: string;
  visible: boolean | null;
  symbolTradeModeRaw: number | null;
  symbolTradeModeLabel: string | null;
  volumeMin?: number | null;
  volumeMax?: number | null;
  volumeStep?: number | null;
}

interface TargetedResult {
  displaySymbol: string;
  variants: Variant[];
}

interface SyncResponse {
  success: boolean;
  error?: string;
  blocker?: string | null;
  accountRouteIdUsed?: string;
  accountRouteVerified?: boolean;
  verifiedRouteIdUsed?: string | null;
  accountTradeAllowed?: boolean;
  accountTradeModeRaw?: number | null;
  accountTradeModeLabel?: string | null;
  mt5Login?: string | number | null;
  mt5Server?: string | null;
  accountPermissionCheckedAt?: string;
  results?: TargetedResult[];
  pages?: number;
  rowsFetched?: number;
  catalogueComplete?: boolean;
  rowsStored?: number;
  errors?: unknown;
  mode?: string;
  mapping?: VerifiedMapping;
  searchProbes?: Array<{ searchTerm: string; visibleFilter: boolean | null; httpStatus: number; ok: boolean; count: number; rawNames: string[]; anyPlus: boolean; error: string | null }>;
  directProbes?: Array<{ requestedSymbol: string; httpStatus: number; ok: boolean; rawName: string | null; rawPreservedExactly: boolean; description: string | null; visible: boolean | null; tradeModeRaw: number | null; tradeModeLabel: string | null; tradeExemode: number | null; orderMode: number | null; fillingMode: number | null; volumeMin: number | null; volumeStep: number | null; error: string | null }>;
}

interface CandidateReport {
  label: "trader_route" | "stored_account_route";
  id: string;
  idMasked: string | null;
  httpStatus: number;
  ok: boolean;
  login: string | number | null;
  server: string | null;
  tradeAllowed: boolean | null;
  tradeModeRaw: number | null;
  tradeModeLabel: string | null;
  identityMatchesExpectedLogin: boolean;
  identityMatchesExpectedServer: boolean;
  identityMatch?: boolean;
  executionAllowed?: boolean;
  useForExecution?: boolean;
  routeStatus?: string;
  reason?: string;
  matches: boolean;
}

interface VerifyResponse {
  success: boolean;
  error?: string;
  blocker?: string | null;
  verified?: boolean;
  ambiguous?: boolean;
  verificationNote?: string;
  verifiedRouteId?: string | null;
  verifiedRouteIdMasked?: string | null;
  expected?: { mt5Login: string | null; mt5Server: string | null };
  candidates?: CandidateReport[];
}

interface CatalogRow {
  broker_symbol: string;
  display_symbol: string;
  canonical_symbol: string;
  description: string | null;
  trade_mode_raw: string | null;
  trade_mode_interpretation: string | null;
  trade_eligible: boolean;
  execution_usable?: boolean;
  route_identity_verified?: boolean;
  checked_at: string | null;
  last_synced_at: string | null;
}

const mask = (v: string | null | undefined) =>
  !v ? "—" : v.length <= 12 ? v : `${v.slice(0, 8)}…${v.slice(-4)}`;

const fmtTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString() : "—";

const tradeModeBadge = (raw: number | null | undefined, label?: string | null) => {
  if (raw == null) return <Badge variant="outline">Not inspected</Badge>;
  const color =
    raw === 4 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    raw === 0 ? "bg-destructive/15 text-destructive border-destructive/30" :
    "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return <Badge variant="outline" className={color}>{raw} · {label ?? "—"}</Badge>;
};

const yesNoBadge = (v: boolean) => (
  <Badge variant="outline" className={v ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
    {v ? "yes" : "no"}
  </Badge>
);

const canBuy = (raw: number | null | undefined) => raw === 1 || raw === 4;
const canSell = (raw: number | null | undefined) => raw === 2 || raw === 4;
const canClose = (raw: number | null | undefined) => raw != null && raw !== 0;

export default function AdminBrokerSymbolsTab() {
  const [mapping, setMapping] = useState<VerifiedMapping | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResp, setLastResp] = useState<SyncResponse | null>(null);
  const [verifyResp, setVerifyResp] = useState<VerifyResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);

  const loadMappingFromDB = useCallback(async (): Promise<VerifiedMapping | null> => {
    const { data } = await (supabase.from as any)("user_mt_accounts")
      .select("id, user_id, mt5_login, mt5_server, trading_layer_account_id, trading_layer_trader_id, trading_layer_external_trader_id, trading_layer_account_route_id, account_route_verified, account_route_verified_at, mapping_status, credential_status, last_verified_at, login, server_name, status")
      .eq("status", "connected")
      .not("trading_layer_account_id", "is", null)
      .not("trading_layer_trader_id", "is", null)
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(50);
    const rows = (data ?? []) as any[];
    const normalized: VerifiedMapping[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      mt5_login: r.mt5_login ?? (r.login != null ? String(r.login) : null),
      mt5_server: r.mt5_server ?? r.server_name ?? null,
      trading_layer_account_id: r.trading_layer_account_id,
      trading_layer_trader_id: r.trading_layer_trader_id,
      trading_layer_external_trader_id: r.trading_layer_external_trader_id,
      trading_layer_account_route_id: r.trading_layer_account_route_id ?? null,
      account_route_verified: !!r.account_route_verified,
      account_route_verified_at: r.account_route_verified_at ?? null,
      mapping_status: r.mapping_status,
      credential_status: r.credential_status,
      last_verified_at: r.last_verified_at,
    }));
    return normalized.find((r) => r.mt5_login === "87943580") ?? normalized[0] ?? null;
  }, []);

  const loadCatalog = useCallback(async (routeId?: string | null) => {
    const id = routeId ?? mapping?.trading_layer_account_route_id ?? mapping?.trading_layer_account_id;
    if (!id) return;
    const { data } = await (supabase.from as any)("broker_symbol_catalog")
      .select("broker_symbol, display_symbol, canonical_symbol, description, trade_mode_raw, trade_mode_interpretation, trade_eligible, execution_usable, route_identity_verified, checked_at, last_synced_at")
      .eq("trading_layer_account_id", id)
      .order("broker_symbol", { ascending: true })
      .limit(1000);
    setCatalog((data as CatalogRow[]) ?? []);
  }, [mapping?.trading_layer_account_route_id, mapping?.trading_layer_account_id]);

  useEffect(() => {
    (async () => {
      setLoadingMapping(true);
      const fromDb = await loadMappingFromDB();
      if (fromDb) {
        setMapping(fromDb);
        setLoadingMapping(false);
        loadCatalog(fromDb.trading_layer_account_route_id ?? fromDb.trading_layer_account_id);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("sync-broker-symbol-catalog", {
          body: { mode: "info" },
        });
        const m = (data as any)?.mapping;
        if (m?.trading_layer_account_id) {
          setMapping(m as VerifiedMapping);
          setLastResp(data as SyncResponse);
          loadCatalog(m.trading_layer_account_route_id ?? m.trading_layer_account_id);
        }
      } catch { /* ignore */ }
      setLoadingMapping(false);
    })();
  }, [loadMappingFromDB, loadCatalog]);

  const invoke = async (action: string, body: any) => {
    setBusy(action);
    try {
      const payload = { ...body, targetUserId: mapping?.user_id };
      const { data, error } = await supabase.functions.invoke("sync-broker-symbol-catalog", { body: payload });
      if (error) {
        toast.error(error.message || "Request failed");
        setLastResp({ success: false, error: error.message });
        return;
      }
      setLastResp(data as SyncResponse);
      const respMapping = (data as any)?.mapping as VerifiedMapping | undefined;
      if (respMapping) setMapping(respMapping);
      const routeId = (data as any)?.accountRouteIdUsed
        ?? (data as any)?.verifiedRouteIdUsed
        ?? respMapping?.trading_layer_account_route_id
        ?? respMapping?.trading_layer_account_id
        ?? mapping?.trading_layer_account_route_id
        ?? mapping?.trading_layer_account_id;
      if ((data as any)?.success) {
        toast.success(`${action} complete`);
        await loadCatalog(routeId);
      } else {
        toast.error((data as any)?.error || "Sync failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Network error");
      setLastResp({ success: false, error: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const verifyRoute = async () => {
    setBusy("Verify Account Route");
    try {
      const { data, error } = await supabase.functions.invoke(
        "verify-trading-layer-account-route",
        { body: { targetUserId: mapping?.user_id, localMtAccountId: mapping?.id } },
      );
      if (error) {
        toast.error(error.message || "Verification failed");
        return;
      }
      setVerifyResp(data as VerifyResponse);
      if ((data as any)?.verified) {
        toast.success("Account route verified (execution-allowed candidate selected)");
        const fresh = await loadMappingFromDB();
        if (fresh) setMapping(fresh);
      } else if ((data as any)?.ambiguous) {
        toast.error("Ambiguous: multiple routes returned trade_allowed=true. Manual clarification required.");
      } else {
        toast.error((data as any)?.verificationNote || "No execution-allowed route matched the connected MT5 identity");
      }
    } catch (e: any) {
      toast.error(e?.message || "Network error");
    } finally {
      setBusy(null);
    }
  };

  const refreshPermission = () => invoke("Account permission", { mode: "info" });
  const lookupEURUSD = () => invoke("EURUSD lookup", { mode: "targeted", symbols: ["EURUSD"] });
  const lookupXAUUSD = () => invoke("XAUUSD lookup", { mode: "targeted", symbols: ["XAUUSD"] });
  const probePlusSymbols = () => invoke("Probe + symbols", { mode: "probe", symbols: ["EURUSD", "XAUUSD"] });
  const fullSync = () => invoke("Full catalogue sync", { mode: "full" });

  const routeVerified = !!mapping?.account_route_verified && !!mapping?.trading_layer_account_route_id;

  const eurResolved = lastResp?.results?.find(r => r.displaySymbol === "EURUSD")?.variants?.[0] ?? null;
  const xauResolved = lastResp?.results?.find(r => r.displaySymbol === "XAUUSD")?.variants?.[0] ?? null;
  const tradeAllowed = routeVerified ? lastResp?.accountTradeAllowed : undefined;
  const accountTradeModeRaw = routeVerified ? lastResp?.accountTradeModeRaw : null;

  // ACCOUNT-LEVEL gate is ONLY trade_allowed. account.trade_mode is the MT5
  // account TYPE (0=demo / 1=contest / 2=real) — NOT a directional restriction.
  // Symbol direction is decided exclusively by symbol.trade_mode on the exact
  // broker symbol returned by Trading Layer.
  const accountExecPermitted = tradeAllowed === true;

  const eurBuyReady = routeVerified && accountExecPermitted && !!eurResolved && canBuy(eurResolved.symbolTradeModeRaw);
  const eurSellReady = routeVerified && accountExecPermitted && !!eurResolved && canSell(eurResolved.symbolTradeModeRaw);

  const blocker = !routeVerified
    ? "Wrong or unverified Trading Layer account route; executable symbol catalogue not verified."
    : tradeAllowed === false ? "Account trade_allowed = false"
    : tradeAllowed == null ? "Account permission not yet checked"
    : !eurResolved ? "EURUSD exact broker symbol not yet inspected — run Lookup or Probe '+' symbols."
    : !canBuy(eurResolved.symbolTradeModeRaw) && !canSell(eurResolved.symbolTradeModeRaw) ? `EURUSD symbol.trade_mode = ${eurResolved.symbolTradeModeRaw} (${eurResolved.symbolTradeModeLabel ?? "?"}) blocks both sides`
    : null;

  return (
    <div className="space-y-4">
      {/* Selected Account */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Selected Account</h3>
        </div>
        {loadingMapping ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !mapping ? (
          <p className="text-sm text-muted-foreground">No connected MT account.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div><div className="text-muted-foreground">MT5 Login</div><div className="font-mono">{mapping.mt5_login ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Server</div><div className="font-mono">{mapping.mt5_server ?? "—"}</div></div>
            <div><div className="text-muted-foreground">Mapping Status</div><div><Badge variant="outline">{mapping.mapping_status ?? "—"}</Badge></div></div>
            <div><div className="text-muted-foreground">Credential</div><div><Badge variant="outline">{mapping.credential_status ?? "—"}</Badge></div></div>
            <div><div className="text-muted-foreground">TL accountId</div><div className="font-mono">{mask(mapping.trading_layer_account_id)}</div></div>
            <div><div className="text-muted-foreground">TL traderId</div><div className="font-mono">{mask(mapping.trading_layer_trader_id)}</div></div>
            <div><div className="text-muted-foreground">Verified Route</div><div className="font-mono">{routeVerified ? mask(mapping.trading_layer_account_route_id) : <span className="text-amber-400">unverified</span>}</div></div>
            <div><div className="text-muted-foreground">Verified At</div><div className="font-mono">{fmtTime(mapping.account_route_verified_at)}</div></div>
          </div>
        )}
      </Card>

      {/* Route Verification */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Trading Layer Route Verification</h3>
          </div>
          <Button size="sm" variant={routeVerified ? "outline" : "default"} onClick={verifyRoute} disabled={busy !== null || !mapping}>
            {busy === "Verify Account Route" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
            {routeVerified ? "Re-verify Account Route" : "Verify Account Route"}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/50 text-muted-foreground">
              <tr>
                <th className="text-left py-2 px-2">Candidate</th>
                <th className="text-left py-2 px-2">ID</th>
                <th className="text-left py-2 px-2">HTTP</th>
                <th className="text-left py-2 px-2">Login</th>
                <th className="text-left py-2 px-2">Server</th>
                <th className="text-left py-2 px-2">trade_allowed</th>
                <th className="text-left py-2 px-2">trade_mode</th>
                <th className="text-left py-2 px-2">MT5 Match</th>
                <th className="text-left py-2 px-2">Use for Exec</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {!verifyResp?.candidates?.length ? (
                <tr><td colSpan={9} className="py-4 text-center text-muted-foreground">Click "Verify Account Route" to query Trading Layer (read-only).</td></tr>
              ) : verifyResp.candidates.map((c) => {
                const useExec = c.useForExecution ?? (c.matches && c.tradeAllowed === true);
                const statusLabel = c.routeStatus
                  ? c.routeStatus.replace(/_/g, " ")
                  : (c.matches ? (c.tradeAllowed ? "identity match execution allowed" : "identity match execution blocked") : "identity mismatch");
                return (
                  <tr key={c.id}>
                    <td className="py-2 px-2">{c.label === "trader_route" ? "Trader route" : "Stored route"}</td>
                    <td className="py-2 px-2 font-mono">{c.idMasked}</td>
                    <td className="py-2 px-2 font-mono">{c.httpStatus}</td>
                    <td className="py-2 px-2 font-mono">{c.login ?? "—"}</td>
                    <td className="py-2 px-2 font-mono">{c.server ?? "—"}</td>
                    <td className="py-2 px-2">{c.tradeAllowed == null ? "—" : yesNoBadge(c.tradeAllowed)}</td>
                    <td className="py-2 px-2">{tradeModeBadge(c.tradeModeRaw, c.tradeModeLabel)}</td>
                    <td className="py-2 px-2">{yesNoBadge(c.matches)}</td>
                    <td className="py-2 px-2">
                      {yesNoBadge(useExec)}
                      <div className="text-[10px] text-muted-foreground mt-1">{statusLabel}</div>
                      {c.reason && <div className="text-[10px] text-muted-foreground">{c.reason}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {verifyResp?.expected && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Expected MT5 identity: login <span className="font-mono">{verifyResp.expected.mt5Login ?? "—"}</span> / server <span className="font-mono">{verifyResp.expected.mt5Server ?? "—"}</span>
          </p>
        )}
        {!routeVerified && (
          <p className="mt-2 text-[11px] text-amber-400">
            Trading Layer account route must be verified against the connected MT5 login/server before broker symbols can be used for execution.
          </p>
        )}
      </Card>

      {/* Account Execution Permission */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {routeVerified && tradeAllowed ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}
          <h3 className="text-sm font-semibold">Account Execution Permission</h3>
        </div>
        {!routeVerified ? (
          <p className="text-xs text-amber-400">unverified — verify the account route first.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><div className="text-muted-foreground">trade_allowed</div><div>{tradeAllowed == null ? <Badge variant="outline">unavailable</Badge> : yesNoBadge(tradeAllowed)}</div></div>
            <div className="md:col-span-2"><div className="text-muted-foreground">Account trade_mode (raw / type)</div><div className="flex items-center gap-2"><Badge variant="outline">{lastResp?.accountTradeModeRaw ?? "—"}</Badge><span className="text-muted-foreground">{lastResp?.accountTradeModeLabel ?? "—"} — informational, not directional</span></div></div>
            <div><div className="text-muted-foreground">Account exec permitted</div><div>{yesNoBadge(accountExecPermitted)}</div></div>
            <div className="md:col-span-2"><div className="text-muted-foreground">Directional gating source</div><div className="text-muted-foreground">selected exact symbol.trade_mode (not account.trade_mode)</div></div>
            <div><div className="text-muted-foreground">Last Checked</div><div>{fmtTime(lastResp?.accountPermissionCheckedAt)}</div></div>
            <div><div className="text-muted-foreground">Route accountId</div><div className="font-mono">{mask(lastResp?.accountRouteIdUsed)}</div></div>
          </div>
        )}
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Actions (read-only)</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={refreshPermission} disabled={busy !== null}>
            {busy === "Account permission" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh Account Permission
          </Button>
          <Button size="sm" variant="outline" onClick={lookupEURUSD} disabled={busy !== null || !routeVerified}>
            {busy === "EURUSD lookup" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Lookup EURUSD
          </Button>
          <Button size="sm" variant="outline" onClick={lookupXAUUSD} disabled={busy !== null || !routeVerified}>
            {busy === "XAUUSD lookup" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Lookup XAUUSD
          </Button>
          <Button size="sm" variant="outline" onClick={probePlusSymbols} disabled={busy !== null || !routeVerified}>
            {busy === "Probe + symbols" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Probe '+' Symbols (raw)
          </Button>
          <Button size="sm" variant="default" onClick={fullSync} disabled={busy !== null || !routeVerified}>
            {busy === "Full catalogue sync" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            Sync Full Visible Catalogue
          </Button>
        </div>
        {!routeVerified && (
          <p className="mt-2 text-[11px] text-amber-400">
            Symbol-sync and lookup actions are disabled until the account route is verified.
          </p>
        )}
      </Card>

      {/* Targeted Lookup Results */}
      {lastResp?.results && lastResp.results.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Targeted Lookup Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/50 text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-2">Display</th>
                  <th className="text-left py-2 px-2">Broker Symbol</th>
                  <th className="text-left py-2 px-2">Visible</th>
                  <th className="text-left py-2 px-2">Trade Mode</th>
                  <th className="text-left py-2 px-2">Buy</th>
                  <th className="text-left py-2 px-2">Sell</th>
                  <th className="text-left py-2 px-2">Close</th>
                  <th className="text-left py-2 px-2">Vol Min/Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {lastResp.results.flatMap(r => r.variants.map((v, i) => (
                  <tr key={`${r.displaySymbol}-${v.brokerSymbol}-${i}`}>
                    <td className="py-2 px-2 font-mono">{r.displaySymbol}</td>
                    <td className="py-2 px-2 font-mono font-semibold text-primary">{v.brokerSymbol}</td>
                    <td className="py-2 px-2">{v.visible == null ? "—" : yesNoBadge(v.visible)}</td>
                    <td className="py-2 px-2">{tradeModeBadge(v.symbolTradeModeRaw, v.symbolTradeModeLabel)}</td>
                    <td className="py-2 px-2">{yesNoBadge(canBuy(v.symbolTradeModeRaw))}</td>
                    <td className="py-2 px-2">{yesNoBadge(canSell(v.symbolTradeModeRaw))}</td>
                    <td className="py-2 px-2">{yesNoBadge(canClose(v.symbolTradeModeRaw))}</td>
                    <td className="py-2 px-2 font-mono">{v.volumeMin ?? "—"} / {v.volumeStep ?? "—"}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Stored Catalogue */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Stored Catalogue ({catalog.length})</h3>
          {lastResp?.mode === "full" && (
            <div className="text-xs text-muted-foreground">
              pages: {lastResp.pages} · fetched: {lastResp.rowsFetched} · complete: {String(lastResp.catalogueComplete)} · stored: {lastResp.rowsStored}
            </div>
          )}
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-xs">
            <thead className="border-b border-border/50 text-muted-foreground sticky top-0 bg-background">
              <tr>
                <th className="text-left py-2 px-2">Display</th>
                <th className="text-left py-2 px-2">Broker Symbol</th>
                <th className="text-left py-2 px-2">Description</th>
                <th className="text-left py-2 px-2">Trade Mode</th>
                <th className="text-left py-2 px-2">Exec Usable</th>
                <th className="text-left py-2 px-2">Route Verified</th>
                <th className="text-left py-2 px-2">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {catalog.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">No symbols cached yet. Verify the route, then run a sync.</td></tr>
              ) : catalog.map(c => {
                const raw = c.trade_mode_raw != null ? Number(c.trade_mode_raw) : null;
                return (
                  <tr key={c.broker_symbol}>
                    <td className="py-1.5 px-2 font-mono">{c.display_symbol}</td>
                    <td className="py-1.5 px-2 font-mono text-primary">{c.broker_symbol}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{c.description ?? "—"}</td>
                    <td className="py-1.5 px-2">{tradeModeBadge(raw, c.trade_mode_interpretation)}</td>
                    <td className="py-1.5 px-2">{yesNoBadge(!!c.execution_usable)}</td>
                    <td className="py-1.5 px-2">{yesNoBadge(!!c.route_identity_verified)}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{fmtTime(c.checked_at ?? c.last_synced_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Readiness */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Readiness Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div><div className="text-muted-foreground">Route verified</div><div>{yesNoBadge(routeVerified)}</div></div>
          <div><div className="text-muted-foreground">EURUSD brokerSymbol</div><div className="font-mono">{eurResolved?.brokerSymbol ?? "unresolved"}</div></div>
          <div><div className="text-muted-foreground">XAUUSD brokerSymbol</div><div className="font-mono">{xauResolved?.brokerSymbol ?? "unresolved"}</div></div>
          <div><div className="text-muted-foreground">Account trade_allowed</div><div>{tradeAllowed == null ? <Badge variant="outline">unknown</Badge> : yesNoBadge(tradeAllowed)}</div></div>
          <div><div className="text-muted-foreground">EURUSD BUY ready</div><div>{yesNoBadge(eurBuyReady)}</div></div>
          <div><div className="text-muted-foreground">EURUSD SELL ready</div><div>{yesNoBadge(eurSellReady)}</div></div>
          {blocker && (
            <div className="col-span-2 md:col-span-3">
              <div className="text-muted-foreground">Blocker</div>
              <div className="text-amber-400">{blocker}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
