import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, Search, Database, ShieldCheck, ShieldAlert, KeyRound, Download, Eye,
} from "lucide-react";

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
  accountTradeModeMeaning?: string | null;
  accountCanOpenBuy?: boolean;
  accountCanOpenSell?: boolean;
  accountCanClose?: boolean;
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

const ACK_SETTING_KEY = "broker_symbol_acknowledgements";

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

const statusBadge = (kind: "ok" | "warn" | "bad" | "muted", text: string) => {
  const color =
    kind === "ok" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
    kind === "warn" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
    kind === "bad" ? "bg-destructive/15 text-destructive border-destructive/30" :
    "bg-muted/40 text-muted-foreground border-border/40";
  return <Badge variant="outline" className={color}>{text}</Badge>;
};

const canBuy = (raw: number | null | undefined) => raw === 1 || raw === 4;
const canSell = (raw: number | null | undefined) => raw === 2 || raw === 4;
const canClose = (raw: number | null | undefined) => raw != null && raw !== 0;

// Per-symbol cached targeted result, persisted in-memory across button clicks
// so EURUSD readiness is NOT overwritten by a later XAUUSD lookup.
interface TargetedCache {
  [canonical: string]: { variants: Variant[]; checkedAt: string };
}

// Per-symbol cached probe matrix, kept across actions.
interface ProbeCache {
  searchProbes: Record<string, SyncResponse["searchProbes"] extends (infer U)[] | undefined ? U : never>;
  directProbes: Record<string, SyncResponse["directProbes"] extends (infer U)[] | undefined ? U : never>;
}

export default function AdminBrokerSymbolsTab() {
  const [mapping, setMapping] = useState<VerifiedMapping | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResp, setLastResp] = useState<SyncResponse | null>(null);
  const [verifyResp, setVerifyResp] = useState<VerifyResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [targetedCache, setTargetedCache] = useState<TargetedCache>({});
  const [probeCache, setProbeCache] = useState<ProbeCache>({ searchProbes: {}, directProbes: {} });
  const [ack, setAck] = useState<{ acknowledged: boolean; at: string | null; by: string | null }>({
    acknowledged: false, at: null, by: null,
  });
  const [ackSaving, setAckSaving] = useState(false);

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

  const loadAck = useCallback(async () => {
    const { data } = await (supabase.from as any)("site_settings")
      .select("value")
      .eq("key", ACK_SETTING_KEY)
      .maybeSingle();
    const v = (data as any)?.value?.eurusd_mt5_suffix_discrepancy;
    if (v && typeof v === "object") {
      setAck({
        acknowledged: !!v.acknowledged,
        at: v.acknowledged_at ?? null,
        by: v.acknowledged_by ?? null,
      });
    }
  }, []);

  const saveAck = async (next: boolean) => {
    setAckSaving(true);
    try {
      const { data: existing } = await (supabase.from as any)("site_settings")
        .select("id, value")
        .eq("key", ACK_SETTING_KEY)
        .maybeSingle();
      const user = (await supabase.auth.getUser()).data.user;
      const valueObj = {
        ...(((existing as any)?.value as object) ?? {}),
        eurusd_mt5_suffix_discrepancy: {
          acknowledged: next,
          acknowledged_at: next ? new Date().toISOString() : null,
          acknowledged_by: next ? user?.id ?? null : null,
          route_id: mapping?.trading_layer_account_route_id ?? null,
          mt5_login: mapping?.mt5_login ?? null,
        },
      };
      if (existing?.id) {
        await (supabase.from as any)("site_settings")
          .update({ value: valueObj, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await (supabase.from as any)("site_settings")
          .insert({ key: ACK_SETTING_KEY, value: valueObj });
      }
      await loadAck();
      toast.success(next ? "Discrepancy acknowledgement recorded" : "Acknowledgement cleared");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save acknowledgement");
    } finally {
      setAckSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoadingMapping(true);
      const fromDb = await loadMappingFromDB();
      if (fromDb) {
        setMapping(fromDb);
        setLoadingMapping(false);
        loadCatalog(fromDb.trading_layer_account_route_id ?? fromDb.trading_layer_account_id);
        loadAck();
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
      loadAck();
      setLoadingMapping(false);
    })();
  }, [loadMappingFromDB, loadCatalog, loadAck]);

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
      const resp = data as SyncResponse;
      setLastResp(resp);

      // Persist targeted results per-symbol so a later lookup does NOT
      // erase a previously inspected symbol from the readiness summary.
      if (Array.isArray(resp?.results) && resp.results.length > 0) {
        const now = new Date().toISOString();
        setTargetedCache((prev) => {
          const next = { ...prev };
          for (const r of resp.results!) {
            next[r.displaySymbol] = { variants: r.variants, checkedAt: now };
          }
          return next;
        });
      }
      // Persist probes per requested symbol.
      if (Array.isArray(resp?.searchProbes) || Array.isArray(resp?.directProbes)) {
        setProbeCache((prev) => {
          const sp = { ...prev.searchProbes };
          const dp = { ...prev.directProbes };
          for (const p of resp.searchProbes ?? []) sp[p.searchTerm] = p as any;
          for (const p of resp.directProbes ?? []) dp[p.requestedSymbol] = p as any;
          return { searchProbes: sp, directProbes: dp };
        });
      }

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
  const syncVisibleMarketWatch = () => invoke("Sync visible market watch", { mode: "full", catalogueScope: "visible_market_watch" });
  const syncFullExecutionCatalogue = () => invoke("Sync full execution catalogue", { mode: "full", catalogueScope: "full_execution_catalogue" });

  const routeVerified = !!mapping?.account_route_verified && !!mapping?.trading_layer_account_route_id;

  // Targeted results come from the persistent per-symbol cache, NOT from the
  // single last response (which gets overwritten on every action).
  const eurVariants = targetedCache["EURUSD"]?.variants ?? [];
  const xauVariants = targetedCache["XAUUSD"]?.variants ?? [];
  const eurExecutable = eurVariants.filter((v) => v.symbolTradeModeRaw != null && v.symbolTradeModeRaw !== 0);
  const xauExecutable = xauVariants.filter((v) => v.symbolTradeModeRaw != null && v.symbolTradeModeRaw !== 0);

  // EURUSD resolution: unique LIST/SEARCH-discovered executable candidate.
  const eurResolved = eurExecutable.length === 1 ? eurExecutable[0] : null;
  // XAUUSD: ambiguous when more than one executable variant was discovered.
  const xauAmbiguous = xauExecutable.length > 1;
  const xauResolved = xauExecutable.length === 1 ? xauExecutable[0] : null;

  const tradeAllowed = routeVerified ? lastResp?.accountTradeAllowed : undefined;
  const accountExecPermitted = tradeAllowed === true;

  // Symbol-level eligibility (independent of ack — ack only gates "ready for live test").
  const eurSymbolBuyEligible = !!eurResolved && canBuy(eurResolved.symbolTradeModeRaw);
  const eurSymbolSellEligible = !!eurResolved && canSell(eurResolved.symbolTradeModeRaw);
  const eurSymbolCloseEligible = !!eurResolved && canClose(eurResolved.symbolTradeModeRaw);

  // Ready-for-controlled-test gate: requires route + perm + symbol eligibility + ack.
  const eurBuyReady = routeVerified && accountExecPermitted && eurSymbolBuyEligible && ack.acknowledged;
  const eurSellReady = routeVerified && accountExecPermitted && eurSymbolSellEligible && ack.acknowledged;

  const eurBlocker = !routeVerified
    ? "Wrong or unverified Trading Layer account route; executable symbol catalogue not verified."
    : tradeAllowed === false ? "Account trade_allowed = false"
    : tradeAllowed == null ? "Account permission not yet checked"
    : !eurResolved ? "EURUSD exact broker symbol not yet inspected — run Lookup EURUSD."
    : !(eurSymbolBuyEligible || eurSymbolSellEligible)
      ? `EURUSD symbol.trade_mode = ${eurResolved.symbolTradeModeRaw} (${eurResolved.symbolTradeModeLabel ?? "?"}) blocks both sides`
    : !ack.acknowledged
      ? "API execution symbol resolved as EURUSD; acknowledgement required due to MT5 suffix-display discrepancy."
      : null;

  const xauBlocker = xauAmbiguous
    ? `Multiple executable broker symbols match XAUUSD: ${xauExecutable.map((v) => v.brokerSymbol).join(", ")}. Select a verified execution default or obtain Trading Layer confirmation before testing.`
    : !xauResolved && xauVariants.length > 0
      ? "No executable XAUUSD broker symbol discovered."
      : !xauVariants.length
        ? "XAUUSD not yet inspected — run Lookup XAUUSD."
        : null;

  // Combined probe rows (alias-resolution interpretation).
  const allDirectProbes = useMemo(() => Object.values(probeCache.directProbes), [probeCache]);
  const allSearchProbes = useMemo(() => Object.values(probeCache.searchProbes), [probeCache]);

  // Sanitized evidence export — no auth, no keys, no headers.
  const exportEvidence = () => {
    const evidence = {
      generated_at: new Date().toISOString(),
      verified_execution_route_id: mapping?.trading_layer_account_route_id ?? null,
      mt5: { login: mapping?.mt5_login ?? null, server: mapping?.mt5_server ?? null },
      account: {
        trade_allowed: tradeAllowed ?? null,
        trade_mode_raw: lastResp?.accountTradeModeRaw ?? null,
        trade_mode_label: lastResp?.accountTradeModeLabel ?? null,
        trade_mode_meaning: "account_type_informational_not_directional",
      },
      targeted: {
        EURUSD: targetedCache["EURUSD"] ?? null,
        XAUUSD: targetedCache["XAUUSD"] ?? null,
      },
      search_probes: allSearchProbes,
      direct_probes: allDirectProbes.map((p: any) => ({
        requested: p.requestedSymbol,
        returned: p.rawName,
        exact_request_match: p.ok ? p.rawPreservedExactly : null,
        http: p.httpStatus,
        trade_mode_raw: p.tradeModeRaw,
        trade_mode_label: p.tradeModeLabel,
        visible: p.visible,
      })),
      question_for_trading_layer:
        "Does the API intentionally expose EURUSD/XAUUSD as the executable symbol for this route even if the native MT5 terminal displays suffixed instrument naming?",
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tl-evidence-${(mapping?.mt5_login ?? "account")}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <Button size="sm" variant="outline" onClick={syncVisibleMarketWatch} disabled={busy !== null || !routeVerified}>
            {busy === "Sync visible market watch" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
            Sync Visible Market Watch
          </Button>
          <Button size="sm" variant="default" onClick={syncFullExecutionCatalogue} disabled={busy !== null || !routeVerified}>
            {busy === "Sync full execution catalogue" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Database className="h-3.5 w-3.5 mr-1.5" />}
            Sync Full Execution Catalogue
          </Button>
          <Button size="sm" variant="outline" onClick={exportEvidence} disabled={!mapping}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Trading Layer Evidence
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Visible Market Watch is a UI-only view (uses Trading Layer <code className="text-amber-400">visible=true</code> filter) and is <strong>never authoritative</strong> for execution-symbol resolution.
          Full Execution Catalogue runs offset pagination with no visibility filter and is the authoritative discovery source.
        </p>
        {!routeVerified && (
          <p className="mt-2 text-[11px] text-amber-400">
            Symbol-sync and lookup actions are disabled until the account route is verified.
          </p>
        )}
      </Card>

      {/* MT5 Suffix Discrepancy Acknowledgement */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold">EURUSD Discrepancy Acknowledgement (admin)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Trading Layer API returned executable symbol <code className="text-primary">EURUSD</code> for the verified route, while the MT5 terminal appears to show suffixed instruments.
          API broker symbol is resolved; external symbol-display discrepancy remains under review. The acknowledgement below is required before any controlled live test may proceed.
        </p>
        <label className="flex items-start gap-2 text-xs">
          <Checkbox
            checked={ack.acknowledged}
            disabled={ackSaving}
            onCheckedChange={(v) => saveAck(v === true)}
          />
          <span>
            I acknowledge that Trading Layer returned <code className="text-primary">EURUSD</code> as the exact executable broker symbol for this verified route, despite the MT5 suffix display discrepancy.
            {ack.acknowledged && ack.at && (
              <span className="block text-[10px] text-muted-foreground mt-1">
                acknowledged at {fmtTime(ack.at)}{ack.by ? ` by ${ack.by.slice(0, 8)}…` : ""}
              </span>
            )}
          </span>
        </label>
      </Card>

      {/* Targeted Lookup Results */}
      {(eurVariants.length > 0 || xauVariants.length > 0) && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Targeted Lookup Results (cached per symbol)</h3>
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
                {(["EURUSD", "XAUUSD"] as const).flatMap((sym) =>
                  (targetedCache[sym]?.variants ?? []).map((v, i) => (
                    <tr key={`${sym}-${v.brokerSymbol}-${i}`}>
                      <td className="py-2 px-2 font-mono">{sym}</td>
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

      {/* Raw '+' Symbol Probe Results */}
      {(allSearchProbes.length > 0 || allDirectProbes.length > 0) && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Raw '+' Symbol Probe (read-only Trading Layer evidence)</h3>
          {allSearchProbes.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Search probes (LIST/SEARCH endpoint)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/50 text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 px-2">search</th>
                      <th className="text-left py-2 px-2">visible filter</th>
                      <th className="text-left py-2 px-2">HTTP</th>
                      <th className="text-left py-2 px-2">count</th>
                      <th className="text-left py-2 px-2">any '+'</th>
                      <th className="text-left py-2 px-2">raw names</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {allSearchProbes.map((p: any, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-2 font-mono">{p.searchTerm}</td>
                        <td className="py-1.5 px-2 font-mono">{p.visibleFilter == null ? "any" : String(p.visibleFilter)}</td>
                        <td className="py-1.5 px-2 font-mono">{p.httpStatus}</td>
                        <td className="py-1.5 px-2 font-mono">{p.count}</td>
                        <td className="py-1.5 px-2">{yesNoBadge(p.anyPlus)}</td>
                        <td className="py-1.5 px-2 font-mono text-[10px] break-all max-w-md">{p.rawNames.slice(0, 20).join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {allDirectProbes.length > 0 && (
            <div>
              <div className="text-xs font-semibold mb-2 text-muted-foreground">
                Direct symbol-info probes — note: the direct endpoint may resolve a requested alias to a different returned broker symbol.
                This is NOT evidence of a storage preservation bug and is NOT evidence the requested alias exists.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/50 text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 px-2">Requested</th>
                      <th className="text-left py-2 px-2">Returned</th>
                      <th className="text-left py-2 px-2">Exact Request Match</th>
                      <th className="text-left py-2 px-2">trade_mode</th>
                      <th className="text-left py-2 px-2">Interpretation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {allDirectProbes.map((p: any, i) => {
                      const exact = p.ok && p.rawPreservedExactly;
                      let interpretation: string;
                      if (!p.ok) interpretation = `HTTP ${p.httpStatus} — endpoint did not return symbol info`;
                      else if (exact) interpretation = p.tradeModeRaw === 0
                        ? "Exact broker symbol exists but disabled"
                        : "Exact broker symbol exists";
                      else interpretation = `Alias resolved to base; ${p.requestedSymbol} not proven to exist`;
                      return (
                        <tr key={i}>
                          <td className="py-1.5 px-2 font-mono">{p.requestedSymbol}</td>
                          <td className="py-1.5 px-2 font-mono text-primary">{p.rawName ?? "—"}</td>
                          <td className="py-1.5 px-2">{p.ok ? yesNoBadge(exact) : "—"}</td>
                          <td className="py-1.5 px-2">{tradeModeBadge(p.tradeModeRaw, p.tradeModeLabel)}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{interpretation}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
                <th className="text-left py-2 px-2">Metadata Status</th>
                <th className="text-left py-2 px-2">Execution Status</th>
                <th className="text-left py-2 px-2">Route Verified</th>
                <th className="text-left py-2 px-2">Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {catalog.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">No symbols cached yet. Verify the route, then run a sync.</td></tr>
              ) : catalog.map(c => {
                const raw = c.trade_mode_raw != null ? Number(c.trade_mode_raw) : null;
                const inspected = raw != null;
                let execStatus: { kind: "ok" | "warn" | "bad" | "muted"; text: string };
                if (!inspected) execStatus = { kind: "muted", text: "Not evaluated" };
                else if (raw === 0) execStatus = { kind: "bad", text: "Disabled / not usable" };
                else if (c.execution_usable) execStatus = { kind: "ok", text: "Eligible" };
                else execStatus = { kind: "warn", text: "Quarantined" };
                return (
                  <tr key={c.broker_symbol}>
                    <td className="py-1.5 px-2 font-mono">{c.display_symbol}</td>
                    <td className="py-1.5 px-2 font-mono text-primary">{c.broker_symbol}</td>
                    <td className="py-1.5 px-2 text-muted-foreground">{c.description ?? "—"}</td>
                    <td className="py-1.5 px-2">
                      {inspected
                        ? tradeModeBadge(raw, c.trade_mode_interpretation)
                        : statusBadge("muted", "Not inspected")}
                    </td>
                    <td className="py-1.5 px-2">{statusBadge(execStatus.kind, execStatus.text)}</td>
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
          <div><div className="text-muted-foreground">Account trade_allowed</div><div>{tradeAllowed == null ? <Badge variant="outline">unknown</Badge> : yesNoBadge(tradeAllowed)}</div></div>
          <div><div className="text-muted-foreground">Account type</div><div className="text-muted-foreground">{lastResp?.accountTradeModeLabel ?? "—"} (informational)</div></div>

          <div><div className="text-muted-foreground">EURUSD brokerSymbol</div><div className="font-mono">{eurResolved?.brokerSymbol ?? (eurVariants.length === 0 ? "not inspected" : "ambiguous")}</div></div>
          <div><div className="text-muted-foreground">EURUSD symbol.trade_mode</div><div>{eurResolved ? tradeModeBadge(eurResolved.symbolTradeModeRaw, eurResolved.symbolTradeModeLabel) : "—"}</div></div>
          <div><div className="text-muted-foreground">EURUSD exact API symbol verified</div><div>{yesNoBadge(!!eurResolved)}</div></div>

          <div><div className="text-muted-foreground">EURUSD BUY symbol eligible</div><div>{yesNoBadge(eurSymbolBuyEligible)}</div></div>
          <div><div className="text-muted-foreground">EURUSD SELL symbol eligible</div><div>{yesNoBadge(eurSymbolSellEligible)}</div></div>
          <div><div className="text-muted-foreground">EURUSD CLOSE symbol eligible</div><div>{yesNoBadge(eurSymbolCloseEligible)}</div></div>

          <div><div className="text-muted-foreground">Discrepancy ack recorded</div><div>{yesNoBadge(ack.acknowledged)}</div></div>
          <div><div className="text-muted-foreground">EURUSD BUY ready for test</div><div>{yesNoBadge(eurBuyReady)}</div></div>
          <div><div className="text-muted-foreground">EURUSD SELL ready for test</div><div>{yesNoBadge(eurSellReady)}</div></div>

          <div><div className="text-muted-foreground">XAUUSD brokerSymbol</div><div className="font-mono">{xauAmbiguous ? "ambiguous" : (xauResolved?.brokerSymbol ?? (xauVariants.length === 0 ? "not inspected" : "—"))}</div></div>
          <div><div className="text-muted-foreground">XAUUSD test readiness</div><div>{yesNoBadge(false)}</div></div>
          <div><div className="text-muted-foreground">XAUUSD resolution</div><div className="text-muted-foreground">{xauAmbiguous ? "ambiguous_multiple_executable_variants" : (xauResolved ? "resolved_unique" : "pending")}</div></div>

          {eurBlocker && (
            <div className="col-span-2 md:col-span-3">
              <div className="text-muted-foreground">EURUSD blocker</div>
              <div className="text-amber-400">{eurBlocker}</div>
            </div>
          )}
          {xauBlocker && (
            <div className="col-span-2 md:col-span-3">
              <div className="text-muted-foreground">XAUUSD blocker</div>
              <div className="text-amber-400">{xauBlocker}</div>
            </div>
          )}
        </div>
        {eurResolved && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Diagnostic: Trading Layer API returned executable symbol <code className="text-primary">EURUSD</code>, while the MT5 terminal appears to show suffixed instruments. API broker symbol is resolved; external symbol-display discrepancy remains under review.
          </p>
        )}
      </Card>
    </div>
  );
}
