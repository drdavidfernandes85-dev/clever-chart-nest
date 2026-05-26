import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search, Database, ShieldCheck, ShieldAlert } from "lucide-react";

interface VerifiedMapping {
  id: string;
  user_id: string;
  mt5_login: string | null;
  mt5_server: string | null;
  trading_layer_account_id: string | null;
  trading_layer_trader_id: string | null;
  trading_layer_external_trader_id: string | null;
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
  accountRouteIdUsed?: string;
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
}

interface CatalogRow {
  broker_symbol: string;
  display_symbol: string;
  canonical_symbol: string;
  description: string | null;
  trade_mode_raw: string | null;
  trade_mode_interpretation: string | null;
  trade_eligible: boolean;
  checked_at: string | null;
  last_synced_at: string | null;
}

const mask = (v: string | null | undefined) =>
  !v ? "—" : v.length <= 12 ? v : `${v.slice(0, 8)}…${v.slice(-4)}`;

const fmtTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString() : "—";

const tradeModeBadge = (raw: number | null | undefined, label?: string | null) => {
  if (raw == null) return <Badge variant="outline">unknown</Badge>;
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
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);

  const loadMapping = useCallback(async () => {
    setLoadingMapping(true);
    // Admins can SELECT all rows (RLS: "Admins view all mt accounts").
    // Eligible mapping requires Trading Layer IDs + validated credentials.
    const { data } = await (supabase.from as any)("user_mt_accounts")
      .select("id, user_id, mt5_login, mt5_server, trading_layer_account_id, trading_layer_trader_id, trading_layer_external_trader_id, mapping_status, credential_status, last_verified_at, login, server_name")
      .eq("status", "connected")
      .eq("credential_status", "validated")
      .eq("mapping_status", "valid")
      .not("trading_layer_account_id", "is", null)
      .not("trading_layer_trader_id", "is", null)
      .or("ignored_for_execution.is.null,ignored_for_execution.eq.false")
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(50);
    const rows = (data ?? []) as any[];
    // Normalize: prefer mt5_login/mt5_server but fall back to login/server_name
    const normalized: VerifiedMapping[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      mt5_login: r.mt5_login ?? (r.login != null ? String(r.login) : null),
      mt5_server: r.mt5_server ?? r.server_name ?? null,
      trading_layer_account_id: r.trading_layer_account_id,
      trading_layer_trader_id: r.trading_layer_trader_id,
      trading_layer_external_trader_id: r.trading_layer_external_trader_id,
      mapping_status: r.mapping_status,
      credential_status: r.credential_status,
      last_verified_at: r.last_verified_at,
    }));
    // Prefer the verified Infinox live login 87943580 if present, otherwise first row
    const preferred = normalized.find((r) => r.mt5_login === "87943580") ?? normalized[0] ?? null;
    setMapping(preferred);
    setLoadingMapping(false);
  }, []);


  const loadCatalog = useCallback(async () => {
    if (!mapping?.trading_layer_account_id) return;
    const { data } = await (supabase.from as any)("broker_symbol_catalog")
      .select("broker_symbol, display_symbol, canonical_symbol, description, trade_mode_raw, trade_mode_interpretation, trade_eligible, checked_at, last_synced_at")
      .eq("trading_layer_account_id", mapping.trading_layer_account_id)
      .order("broker_symbol", { ascending: true })
      .limit(500);
    setCatalog((data as CatalogRow[]) ?? []);
  }, [mapping?.trading_layer_account_id]);

  useEffect(() => { loadMapping(); }, [loadMapping]);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

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
      if ((data as any)?.success) {
        toast.success(`${action} complete`);
        await loadCatalog();
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


  const refreshPermission = () => invoke("Account permission", { mode: "targeted", symbols: ["EURUSD"] });
  const lookupEURUSD = () => invoke("EURUSD lookup", { mode: "targeted", symbols: ["EURUSD"] });
  const lookupXAUUSD = () => invoke("XAUUSD lookup", { mode: "targeted", symbols: ["XAUUSD"] });
  const fullSync = () => invoke("Full catalogue sync", { mode: "full" });

  const eurResolved = lastResp?.results?.find(r => r.displaySymbol === "EURUSD")?.variants?.[0]?.brokerSymbol
    ?? catalog.find(c => c.canonical_symbol === "EURUSD")?.broker_symbol ?? null;
  const xauResolved = lastResp?.results?.find(r => r.displaySymbol === "XAUUSD")?.variants?.[0]?.brokerSymbol
    ?? catalog.find(c => c.canonical_symbol === "XAUUSD")?.broker_symbol ?? null;
  const tradeAllowed = lastResp?.accountTradeAllowed;
  const readyForTest = !!eurResolved && tradeAllowed === true;
  const blocker = !mapping?.trading_layer_account_id ? "No verified Trading Layer accountId"
    : tradeAllowed === false ? "Account trade_allowed = false"
    : tradeAllowed == null ? "Account permission not yet checked"
    : !eurResolved ? "EURUSD broker symbol not yet resolved"
    : null;

  return (
    <div className="space-y-4">
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
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {tradeAllowed ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}
          <h3 className="text-sm font-semibold">Account Execution Permission</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><div className="text-muted-foreground">trade_allowed</div><div>{tradeAllowed == null ? <Badge variant="outline">unavailable</Badge> : yesNoBadge(tradeAllowed)}</div></div>
          <div><div className="text-muted-foreground">Account trade_mode</div><div>{tradeModeBadge(lastResp?.accountTradeModeRaw, lastResp?.accountTradeModeLabel)}</div></div>
          <div><div className="text-muted-foreground">Last Checked</div><div>{fmtTime(lastResp?.accountPermissionCheckedAt)}</div></div>
          <div><div className="text-muted-foreground">Route accountId</div><div className="font-mono">{mask(lastResp?.accountRouteIdUsed)}</div></div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Execution uses the exact broker symbol returned by Trading Layer for this connected MT5 account. Symbols are never guessed or manually suffixed.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Actions (read-only)</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={refreshPermission} disabled={busy !== null}>
            {busy === "Account permission" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Refresh Account Permission
          </Button>
          <Button size="sm" variant="outline" onClick={lookupEURUSD} disabled={busy !== null}>
            {busy === "EURUSD lookup" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Lookup EURUSD
          </Button>
          <Button size="sm" variant="outline" onClick={lookupXAUUSD} disabled={busy !== null}>
            {busy === "XAUUSD lookup" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
            Lookup XAUUSD
          </Button>
          <Button size="sm" variant="default" onClick={fullSync} disabled={busy !== null}>
            {busy === "Full catalogue sync" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            Sync Full Visible Catalogue
          </Button>
        </div>
      </Card>

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
                <th className="text-left py-2 px-2">Eligible</th>
                <th className="text-left py-2 px-2">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {catalog.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No symbols cached yet. Run a sync.</td></tr>
              ) : catalog.map(c => {
                const raw = c.trade_mode_raw != null ? Number(c.trade_mode_raw) : null;
                return (
                  <tr key={c.broker_symbol}>
                    <td className="py-1.5 px-2 font-mono">{c.display_symbol}</td>
                    <td className="py-1.5 px-2 font-mono text-primary">{c.broker_symbol}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{c.description ?? "—"}</td>
                    <td className="py-1.5 px-2">{tradeModeBadge(raw, c.trade_mode_interpretation)}</td>
                    <td className="py-1.5 px-2">{yesNoBadge(c.trade_eligible)}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{fmtTime(c.checked_at ?? c.last_synced_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Readiness Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div><div className="text-muted-foreground">EURUSD brokerSymbol</div><div className="font-mono">{eurResolved ?? "unresolved"}</div></div>
          <div><div className="text-muted-foreground">XAUUSD brokerSymbol</div><div className="font-mono">{xauResolved ?? "unresolved"}</div></div>
          <div><div className="text-muted-foreground">Account trade_allowed</div><div>{tradeAllowed == null ? <Badge variant="outline">unknown</Badge> : yesNoBadge(tradeAllowed)}</div></div>
          <div><div className="text-muted-foreground">Ready for controlled EURUSD test</div><div>{yesNoBadge(readyForTest)}</div></div>
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
