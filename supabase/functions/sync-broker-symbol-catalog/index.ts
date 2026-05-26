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
  const mode: "targeted" | "full" | "info" =
    rawMode === "full" ? "full"
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
  if (!mapping.tradingLayerAccountId) {
    return json({
      success: false,
      error: "TRADING_LAYER_ACCOUNT_ID_MISSING",
      message: "Verified Trading Layer accountId is required for symbol sync.",
    }, 409);
  }

  const accountId = mapping.tradingLayerAccountId;
  const now = new Date().toISOString();

  // Account info (also confirms the route id is healthy)
  const account = await getAccountInfo(accountId);
  if (!account.ok || !account.data) {
    const is429 = account.status === 429 || account.error === "account_fetch_429";
    return json({
      success: false, step: "account_fetch",
      error: account.error ?? "account_fetch_failed",
      status: account.status,
      retryable: is429,
      message: is429
        ? "Trading Layer rate limit hit (429). Wait a few seconds and retry."
        : "Account info fetch failed.",
    }, is429 ? 429 : 502);
  }

  const result: Record<string, unknown> = {
    success: true,
    accountRouteIdUsed: accountId,
    accountTradeAllowed: account.data.trade_allowed,
    accountTradeModeRaw: account.data.trade_mode,
    accountTradeModeLabel: interpretTradeMode(account.data.trade_mode).label,
    mt5Login: account.data.login,
    mt5Server: account.data.server,
    accountPermissionCheckedAt: now,
    mode,
    mapping: {
      id: mapping.localRowId,
      user_id: resolveUid,
      mt5_login: mapping.login ? String(mapping.login) : null,
      mt5_server: mapping.server ?? null,
      trading_layer_account_id: mapping.tradingLayerAccountId,
      trading_layer_trader_id: mapping.tradingLayerTraderId,
      trading_layer_external_trader_id: mapping.tradingLayerExternalTraderId,
      mapping_status: mapping.status,
      credential_status: mapping.credentialStatus,
      last_verified_at: mapping.lastVerifiedAt,
    },
  };

  if (body?.mode === "info") {
    return json(result);
  }

  if (mode === "targeted") {
    if (requestedSymbols.length === 0) {
      return json({ ...result, success: false, error: "symbols[] required for targeted mode" }, 400);
    }
    const out: Array<{ displaySymbol: string; variants: Variant[] }> = [];
    for (const display of requestedSymbols) {
      const canonical = canonicalize(display);
      // 1) search list (no visible filter — visible is unreliable in list endpoint).
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
              user_id: uid,
              local_mt_account_id: mapping.localRowId ?? null,
              trading_layer_trader_id: mapping.traderId,
              trading_layer_account_id: accountId,
              source_endpoint_account_id: accountId,
              source_verified: true,
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

  // FULL catalogue sync — paginated offset crawl, no visible filter
  const crawl = await listAllSymbols(accountId, { sort: "name", order: "asc" });
  let stored = 0;
  if (crawl.ok && crawl.rows.length > 0) {
    const rows = crawl.rows.map((s: any) => {
      const broker = String(s?.name ?? "").trim();
      const canonical = canonicalize(broker);
      return broker ? {
        user_id: uid,
        local_mt_account_id: mapping.localRowId ?? null,
        trading_layer_trader_id: mapping.traderId,
        trading_layer_account_id: accountId,
        source_endpoint_account_id: accountId,
        source_verified: true,
        mt5_login: mapping.login ? String(mapping.login) : null,
        mt5_server: mapping.server ?? null,
        display_symbol: canonical,
        canonical_symbol: canonical,
        broker_symbol: broker,
        description: s?.description ?? null,
        source: "trading_layer_symbols_list",
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
  return json({
    ...result,
    pages: crawl.pages,
    rowsFetched: crawl.rows.length,
    catalogueComplete: crawl.complete,
    rowsStored: stored,
    errors: crawl.errors,
  });
});
