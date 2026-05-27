// sync-broker-symbol-catalog
// Server-side targeted/full broker symbol sync using Trading Layer OpenAPI.
// Caller must be authenticated and own the requested local MT account
// (or be an admin). Never accepts an arbitrary accountId from the body —
// always resolves via the verified MT mapping for the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import {
  getAccountInfo,
  getSymbolInfo,
  listAllSymbols,
  listSymbols,
} from "../_shared/tlClient.ts";
import {
  interpretTradeMode,
  interpretAccountTradeMode,
  TRADE_MODE_DISABLED,
} from "../_shared/tradingLayerTradeMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function canonicalize(s: string): string {
  return String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  if (!Deno.env.get("TRADING_LAYER_API_KEY")) {
    return json({ success: false, error: "Missing TRADING_LAYER_API_KEY" }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseService = createClient(supabaseUrl, serviceKey);

  const { data: userData } = await supabaseUser.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return json({ success: false, error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const requestedSymbols: string[] = Array.isArray(body?.symbols)
    ? body.symbols.map((s: any) => String(s)).filter(Boolean)
    : [];
  // Normalize mode. Treat missing mode, "info", or targeted-without-symbols as a
  // cheap info call so we never 400 on the permission/refresh path.
  const rawMode = body?.mode;
  const mode: "targeted" | "full" | "info" | "probe" =
    rawMode === "full" ? "full"
    : rawMode === "probe" ? "probe"
    : rawMode === "targeted" && requestedSymbols.length > 0 ? "targeted"
    : "info";

  // Admin override: allow resolving the mapping for a different user_id
  let resolveUid = uid;
  const targetUserId: string | null = typeof body?.targetUserId === "string" ? body.targetUserId : null;
  if (targetUserId && targetUserId !== uid) {
    const { data: isAdmin } = await supabaseService.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (isAdmin === true) resolveUid = targetUserId;
  }

  const mapping = await resolveActiveMtMapping(supabaseService, resolveUid);

  if (mapping.status === "missing" || !mapping.traderId) {
    return json({ success: false, error: "No connected MT account." }, 404);
  }

  // Load route verification state from user_mt_accounts.
  const { data: mtRow } = await supabaseService
    .from("user_mt_accounts")
    .select("id, account_route_verified, account_route_verified_at, trading_layer_account_route_id, account_route_mt5_login, account_route_mt5_server")
    .eq("id", mapping.localRowId)
    .maybeSingle();

  const verifiedRouteId: string | null = (mtRow as any)?.trading_layer_account_route_id ?? null;
  const routeVerified: boolean = !!(mtRow as any)?.account_route_verified && !!verifiedRouteId;

  const baseMapping = {
    id: mapping.localRowId,
    user_id: resolveUid,
    mt5_login: mapping.login ? String(mapping.login) : null,
    mt5_server: mapping.server ?? null,
    trading_layer_account_id: mapping.tradingLayerAccountId,
    trading_layer_trader_id: mapping.tradingLayerTraderId,
    trading_layer_external_trader_id: mapping.tradingLayerExternalTraderId,
    trading_layer_account_route_id: verifiedRouteId,
    account_route_verified: routeVerified,
    account_route_verified_at: (mtRow as any)?.account_route_verified_at ?? null,
    mapping_status: mapping.status,
    credential_status: mapping.credentialStatus,
    last_verified_at: mapping.lastVerifiedAt,
  };

  // INFO mode: cheap, no TL crawl, no verification required.
  if (mode === "info") {
    return json({
      success: true,
      mode,
      accountRouteVerified: routeVerified,
      verifiedRouteIdUsed: verifiedRouteId,
      mapping: baseMapping,
      blocker: routeVerified
        ? null
        : "Trading Layer account route must be verified against the connected MT5 login/server before broker symbols can be used for execution.",
    });
  }

  // From here on, only the verified route is allowed.
  if (!routeVerified || !verifiedRouteId) {
    return json({
      success: false,
      error: "ACCOUNT_ROUTE_UNVERIFIED",
      message: "Trading Layer account route must be verified before symbol sync.",
      mode,
      mapping: baseMapping,
    }, 409);
  }

  const accountId = verifiedRouteId;
  const now = new Date().toISOString();

  // Account info (confirms the verified route is still healthy)
  const account = await getAccountInfo(accountId);
  if (!account.ok || !account.data) {
    const is429 = account.status === 429;
    const isAuthFlap = account.status === 401;
    const transient = is429 || isAuthFlap || account.status >= 500;
    return json({
      success: false, step: "account_fetch",
      error: account.error ?? "account_fetch_failed",
      status: account.status,
      retryable: transient,
      message: is429
        ? "Trading Layer rate limit hit (429). Wait a few seconds and retry."
        : isAuthFlap
          ? "Trading Layer returned 401 transiently for this account. Wait a moment and retry; if it persists the upstream key/route may be revoked."
          : "Account info fetch failed.",
      mapping: baseMapping,
    }, transient ? 503 : 502);
  }

  // Trading Layer Mt5AccountInfo.trade_mode is MT5 ENUM_ACCOUNT_TRADE_MODE:
  //   0=DEMO, 1=CONTEST, 2=REAL. Informational only — NOT directional.
  // `trade_allowed` is the boolean account-level mutation gate.
  // Directional gating (BUY/SELL/close) is enforced per-symbol only.
  const accTm = account.data.trade_mode;
  const accInterp = interpretAccountTradeMode(accTm);
  const result: Record<string, unknown> = {
    success: true,
    accountRouteIdUsed: accountId,
    accountRouteVerified: true,
    accountTradeAllowed: account.data.trade_allowed,
    accountTradeModeRaw: accTm,
    accountTradeModeLabel: accInterp.label,
    accountTradeModeMeaning: "enum_account_trade_mode_informational",
    accountCanOpenBuy: account.data.trade_allowed === true,
    accountCanOpenSell: account.data.trade_allowed === true,
    accountCanClose: account.data.trade_allowed === true,
    mt5Login: account.data.login,
    mt5Server: account.data.server,
    accountPermissionCheckedAt: now,
    mode,
    mapping: baseMapping,
  };

  // PROBE mode: read-only diagnostic for raw broker symbol names ('+' investigation).
  if (mode === "probe") {
    const probes = requestedSymbols.length > 0 ? requestedSymbols : ["EURUSD", "XAUUSD"];
    const searchProbes: any[] = [];
    const directProbes: any[] = [];

    for (const base of probes) {
      const variants = [base, `${base}+`, `${base}.m`, `${base}.crp`];
      // search probes: each variant, with and without visible filter
      for (const v of [base, `${base}+`]) {
        for (const visibleFilter of [null, true]) {
          const r = await listSymbols(accountId, {
            search: v, visible: visibleFilter, limit: 1000, offset: 0, sort: "name", order: "asc",
          });
          const names = (r.data ?? []).map((x: any) => String(x?.name ?? ""));
          searchProbes.push({
            searchTerm: v,
            visibleFilter,
            httpStatus: r.status,
            ok: r.ok,
            count: names.length,
            rawNames: names,
            anyPlus: names.some(n => n.includes("+")),
            error: r.error ?? null,
          });
        }
      }
      // direct symbol-info probes
      for (const v of variants) {
        const d = await getSymbolInfo(accountId, v);
        directProbes.push({
          requestedSymbol: v,
          httpStatus: d.status,
          ok: d.ok,
          rawName: d.data?.name ?? null,
          rawPreservedExactly: d.ok && d.data?.name === v,
          description: d.data?.description ?? null,
          visible: d.data?.visible ?? null,
          tradeModeRaw: typeof d.data?.trade_mode === "number" ? d.data.trade_mode : null,
          tradeModeLabel: interpretTradeMode(d.data?.trade_mode ?? null).label,
          tradeExemode: d.data?.trade_exemode ?? null,
          orderMode: d.data?.order_mode ?? null,
          fillingMode: d.data?.filling_mode ?? null,
          volumeMin: d.data?.volume_min ?? null,
          volumeStep: d.data?.volume_step ?? null,
          error: d.error ?? null,
        });
      }
    }
    return json({ ...result, searchProbes, directProbes });
  }

  if (mode === "targeted") {
    const out: Array<{ displaySymbol: string; variants: Variant[] }> = [];
    for (const display of requestedSymbols) {
      const canonical = canonicalize(display);
      const list = await listSymbols(accountId, {
        search: canonical, limit: 1000, offset: 0, sort: "name", order: "asc",
      });
      const candidates = list.ok
        ? list.data.filter((s: any) => canonicalize(s?.name).includes(canonical))
        : [];

      const variants: Variant[] = [];
      for (const c of candidates) {
        const broker = String(c.name);
        const detail = await getSymbolInfo(accountId, broker);
        const d = detail.data;
        const tm = typeof d?.trade_mode === "number" ? d.trade_mode : null;
        variants.push({
          brokerSymbol: broker,
          visible: typeof d?.visible === "boolean" ? d.visible : null,
          symbolTradeModeRaw: tm,
          symbolTradeModeLabel: interpretTradeMode(tm).label,
          volumeMin: d?.volume_min ?? null,
          volumeMax: d?.volume_max ?? null,
          volumeStep: d?.volume_step ?? null,
        });

        if (d?.name) {
          try {
            await supabaseService.from("broker_symbol_catalog").upsert([{
              user_id: resolveUid,
              local_mt_account_id: mapping.localRowId ?? null,
              trading_layer_trader_id: mapping.traderId,
              trading_layer_account_id: accountId,
              source_endpoint_account_id: accountId,
              source_account_route_id: accountId,
              source_verified: true,
              route_identity_verified: true,
              execution_usable: tm != null && tm !== TRADE_MODE_DISABLED,
              mapping_status: tm != null && tm !== TRADE_MODE_DISABLED
                ? "executable_discovered_inspected"
                : "inspected_disabled",
              mt5_login: mapping.login ? String(mapping.login) : null,
              mt5_server: mapping.server ?? null,
              display_symbol: canonical,
              canonical_symbol: canonicalize(broker),
              broker_symbol: broker,
              description: d.description ?? null,
              digits: d.digits ?? null,
              contract_size: d.trade_contract_size ?? null,
              volume_min: d.volume_min ?? null,
              volume_max: d.volume_max ?? null,
              volume_step: d.volume_step ?? null,
              trade_mode: tm != null ? String(tm) : null,
              trade_mode_raw: tm != null ? String(tm) : null,
              trade_mode_interpretation: interpretTradeMode(tm).label,
              trade_eligible: tm != null && tm !== TRADE_MODE_DISABLED,
              source: "trading_layer_symbol_detail",
              last_synced_at: now,
              checked_at: now,
            }], { onConflict: "trading_layer_account_id,broker_symbol" });
          } catch { /* best-effort */ }
        }
      }
      out.push({ displaySymbol: canonical, variants });
    }
    return json({ ...result, results: out });
  }

  // FULL catalogue sync — paginated offset crawl.
  // `catalogueScope`:
  //   - "visible_market_watch" → uses visible=true. UI-only view, NEVER authoritative for execution.
  //   - "full_execution_catalogue" (default) → no visible filter. Authoritative for execution discovery.
  const catalogueScope: "visible_market_watch" | "full_execution_catalogue" =
    body?.catalogueScope === "visible_market_watch"
      ? "visible_market_watch"
      : "full_execution_catalogue";
  const crawlParams: Record<string, unknown> = { sort: "name", order: "asc" };
  if (catalogueScope === "visible_market_watch") crawlParams.visible = true;
  const crawl = await listAllSymbols(accountId, crawlParams as any);
  let stored = 0;
  if (crawl.ok && crawl.rows.length > 0) {
    const rows = crawl.rows.map((s: any) => {
      const broker = String(s?.name ?? "").trim();
      const canonical = canonicalize(broker);
      return broker ? {
        user_id: resolveUid,
        local_mt_account_id: mapping.localRowId ?? null,
        trading_layer_trader_id: mapping.traderId,
        trading_layer_account_id: accountId,
        source_endpoint_account_id: accountId,
        source_account_route_id: accountId,
        source_verified: true,
        route_identity_verified: true,
        // List endpoint does not populate trade_mode for every row;
        // execution remains gated until per-symbol info is loaded.
        execution_usable: false,
        mapping_status: catalogueScope === "visible_market_watch"
          ? "visible_market_watch_listed"
          : "executable_discovered_pending_inspection",
        mt5_login: mapping.login ? String(mapping.login) : null,
        mt5_server: mapping.server ?? null,
        display_symbol: canonical,
        canonical_symbol: canonical,
        broker_symbol: broker,
        description: s?.description ?? null,
        source: catalogueScope === "visible_market_watch"
          ? "trading_layer_symbols_list_visible"
          : "trading_layer_symbols_list_full",
        last_synced_at: now,
        catalogue_complete: crawl.complete,
        checked_at: now,
      } : null;
    }).filter(Boolean) as any[];
    if (rows.length > 0) {
      try {
        await supabaseService
          .from("broker_symbol_catalog")
          .upsert(rows, { onConflict: "trading_layer_account_id,broker_symbol" });
        stored = rows.length;
      } catch { /* best-effort */ }
    }
  }

  // Stamp the connected MT5 account row with the catalogue status so the
  // Order Ticket / per-account resolver can gate readiness without re-querying.
  if (mapping.localRowId) {
    try {
      await supabaseService
        .from("user_mt_accounts")
        .update({
          symbol_catalogue_status: crawl.complete
            ? "complete"
            : (crawl.errors && crawl.errors.length > 0 ? "failed" : "partial"),
          symbol_catalogue_synced_at: now,
          symbol_catalogue_version: `full_${new Date(now).toISOString().slice(0, 10)}_rows${stored}`,
        })
        .eq("id", mapping.localRowId);
    } catch (e) {
      console.warn("user_mt_accounts catalogue status update failed:", e);
    }
  }

  return json({
    ...result,
    catalogueScope,
    pages: crawl.pages,
    rowsFetched: crawl.rows.length,
    catalogueComplete: crawl.complete,
    rowsStored: stored,
    errors: crawl.errors,
  });
});
