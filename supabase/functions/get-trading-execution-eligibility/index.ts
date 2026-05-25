// Resolve Trading Layer execution eligibility for a connected MT5 account.
//
// Read-only diagnostics:
//   GET /api/v1/traders/{traderId}                 → account.trade_mode + permission fields
//   GET /api/v1/accounts/{accountId}/symbols       → paginated broker-symbol catalogue
//   GET /api/v1/accounts/{accountId}/symbols?search=… → direct lookup fallback
//
// NEVER interprets numeric account.trade_mode as "blocked": the value is
// surfaced raw and labelled "awaiting Trading Layer mapping confirmation".
// Live mutation only becomes eligible once an explicit account execution
// permission is confirmed AND a verified executable broker symbol resolves.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const CONFIRMED_TRADABLE_STRINGS = new Set([
  "full", "long_only", "short_only", "close_only",
  "enabled", "tradable", "full_access",
]);
const CONFIRMED_BLOCKED_STRINGS = new Set(["disabled", "no", "false", "off"]);

type ModeInterpretation =
  | "eligible" | "blocked" | "awaiting_enum_confirmation" | "unknown";

function interpretTradeMode(mode: unknown): {
  raw: string | null;
  interpretation: ModeInterpretation;
  isNumeric: boolean;
} {
  if (mode == null || mode === "") {
    return { raw: null, interpretation: "unknown", isNumeric: false };
  }
  const raw = String(mode).trim();
  const lower = raw.toLowerCase();
  const isNumeric = /^-?\d+$/.test(raw);
  if (isNumeric) {
    return { raw, interpretation: "awaiting_enum_confirmation", isNumeric: true };
  }
  if (CONFIRMED_BLOCKED_STRINGS.has(lower)) {
    return { raw, interpretation: "blocked", isNumeric: false };
  }
  if (
    CONFIRMED_TRADABLE_STRINGS.has(lower) ||
    lower.includes("full") || lower.includes("long") || lower.includes("short")
  ) {
    return { raw, interpretation: "eligible", isNumeric: false };
  }
  return { raw, interpretation: "awaiting_enum_confirmation", isNumeric: false };
}

function isTradable(mode: unknown): boolean {
  return interpretTradeMode(mode).interpretation === "eligible";
}

function canonicalize(sym: string): string {
  return String(sym || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function pick(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = k.split(".").reduce<any>(
      (acc, kk) => (acc && typeof acc === "object" ? acc[kk] : undefined),
      obj,
    );
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

// Keys we sanitize/expose from the trader payload to look for explicit
// execution-permission booleans. Any of these, if present in TL's payload,
// can override the numeric trade_mode block decision.
const PERMISSION_FIELD_KEYS = [
  "trade_allowed", "tradeAllowed",
  "account_trade_allowed", "accountTradeAllowed",
  "trade_expert", "tradeExpert", "expert_allowed", "expertAllowed",
  "trading_enabled", "tradingEnabled",
  "read_only", "readOnly",
  "investor_mode", "investorMode",
  "permissions",
];

function extractPermissionFields(
  parsed: any,
): { fields: Record<string, unknown>; anyExplicit: boolean } {
  const fields: Record<string, unknown> = {};
  const scopes = [
    parsed?.data?.account, parsed?.data?.trader, parsed?.data?.mt5,
    parsed?.account, parsed?.trader, parsed?.mt5, parsed?.data, parsed,
  ];
  for (const scope of scopes) {
    if (!scope || typeof scope !== "object") continue;
    for (const k of PERMISSION_FIELD_KEYS) {
      if (k in scope && fields[k] === undefined) {
        fields[k] = (scope as any)[k];
      }
    }
  }
  return { fields, anyExplicit: Object.keys(fields).length > 0 };
}

function interpretPermissionFields(
  fields: Record<string, unknown>,
): { interpretation: ModeInterpretation; source: string | null } {
  // Hard blocks first.
  const ro = fields["read_only"] ?? fields["readOnly"];
  if (ro === true) return { interpretation: "blocked", source: "read_only" };
  const inv = fields["investor_mode"] ?? fields["investorMode"];
  if (inv === true) return { interpretation: "blocked", source: "investor_mode" };
  const te = fields["trading_enabled"] ?? fields["tradingEnabled"];
  if (te === false) return { interpretation: "blocked", source: "trading_enabled" };
  const ta = fields["trade_allowed"] ?? fields["tradeAllowed"] ??
    fields["account_trade_allowed"] ?? fields["accountTradeAllowed"];
  if (ta === false) return { interpretation: "blocked", source: "trade_allowed" };

  // Explicit allows.
  if (ta === true) return { interpretation: "eligible", source: "trade_allowed" };
  if (te === true) return { interpretation: "eligible", source: "trading_enabled" };
  return { interpretation: "unknown", source: null };
}

// --- Symbol catalogue paginated fetch -------------------------------------
async function fetchAllSymbols(
  accountId: string,
  searchTerm?: string,
): Promise<{
  rows: any[];
  pages: number;
  totalReported: number | null;
  hasMoreFinal: boolean;
  paginationParamsUsed: string[];
  rawPageMeta: Array<Record<string, unknown>>;
  errors: string[];
}> {
  const errors: string[] = [];
  const rawPageMeta: Array<Record<string, unknown>> = [];
  const seen = new Map<string, any>();
  const paramsUsed: string[] = [];
  let totalReported: number | null = null;
  let hasMore = true;
  let page = 1;
  let cursor: string | null = null;
  const pageSize = 500;
  const MAX_PAGES = 20;

  while (hasMore && page <= MAX_PAGES) {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("limit", String(pageSize));
    qs.set("pageSize", String(pageSize));
    if (cursor) qs.set("cursor", cursor);
    if (searchTerm) {
      qs.set("search", searchTerm);
      qs.set("query", searchTerm);
      qs.set("symbol", searchTerm);
    }
    if (page === 1) paramsUsed.push(qs.toString());

    let r: Response;
    try {
      r = await fetch(
        `${BASE_URL}/api/v1/accounts/${accountId}/symbols?${qs.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${TRADING_LAYER_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );
    } catch (e) {
      errors.push(`page_${page}_fetch_failed:${(e as Error).message}`);
      break;
    }
    const txt = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
    if (!r.ok) {
      errors.push(`page_${page}_http_${r.status}`);
      break;
    }
    const list: any[] = Array.isArray(parsed?.data)
      ? parsed.data
      : Array.isArray(parsed?.items)
      ? parsed.items
      : Array.isArray(parsed?.symbols)
      ? parsed.symbols
      : Array.isArray(parsed)
      ? parsed
      : [];
    const meta: Record<string, unknown> = {
      page,
      count: list.length,
      total: pick(parsed, ["total", "totalCount", "data.total", "meta.total", "pagination.total"]),
      nextCursor: pick(parsed, ["nextCursor", "data.nextCursor", "meta.nextCursor", "pagination.nextCursor"]),
      hasMore: pick(parsed, ["hasMore", "data.hasMore", "meta.hasMore", "pagination.hasMore"]),
    };
    rawPageMeta.push(meta);
    if (totalReported == null && typeof meta.total === "number") {
      totalReported = meta.total as number;
    }
    for (const s of list) {
      const broker = String(
        pick(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "",
      ).trim();
      if (broker && !seen.has(broker)) seen.set(broker, s);
    }

    const nextCursor = meta.nextCursor;
    const reportedHasMore = meta.hasMore;
    if (typeof nextCursor === "string" && nextCursor) {
      cursor = nextCursor;
      page += 1;
      hasMore = true;
    } else if (reportedHasMore === true) {
      page += 1;
      hasMore = true;
    } else if (list.length >= pageSize) {
      // No explicit pagination metadata but the page was full → try next.
      page += 1;
      hasMore = true;
    } else {
      hasMore = false;
    }
  }

  return {
    rows: Array.from(seen.values()),
    pages: rawPageMeta.length,
    totalReported,
    hasMoreFinal: hasMore && page > MAX_PAGES,
    paginationParamsUsed: paramsUsed,
    rawPageMeta,
    errors,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }
  if (!TRADING_LAYER_KEY) {
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
  const displaySymbol: string = String(body?.symbol ?? "").trim();
  const refreshCatalog: boolean = body?.refresh !== false;
  const symbolCanonical = canonicalize(displaySymbol);

  const mapping = await resolveActiveMtMapping(supabaseService, uid);
  const traderId: string | null = mapping?.tradingLayerTraderId ?? null;
  let accountId: string | null = mapping?.tradingLayerAccountId ?? null;
  if (!traderId) {
    return json({
      success: false,
      step: "mapping",
      eligibility: "unknown",
      blockedReason: "No connected Trading Layer trader mapping",
    });
  }

  // 1) Trader endpoint — with one retry on 5xx/network errors.
  let accountTradeMode: string | null = null;
  let accountInterpretation: ModeInterpretation = "unknown";
  let traderFetchError: string | null = null;
  let traderHttpStatus: number | null = null;
  let accountIdFromTrader: string | null = null;
  let accountIdRelationshipVerified = false;
  let permissionFields: Record<string, unknown> = {};
  let permissionInterpretation: ModeInterpretation = "unknown";
  let permissionSource: string | null = null;
  let traderAccountKeys: string[] = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${BASE_URL}/api/v1/traders/${traderId}`, {
        headers: {
          Authorization: `Bearer ${TRADING_LAYER_KEY}`,
          "Content-Type": "application/json",
        },
      });
      traderHttpStatus = r.status;
      const txt = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
      if (!r.ok) {
        traderFetchError = `trader_fetch_${r.status}`;
        if (r.status >= 500 && attempt === 0) {
          await new Promise((res) => setTimeout(res, 400));
          continue;
        }
        break;
      }
      traderFetchError = null;
      const tm = pick(parsed, [
        "data.account.trade_mode", "account.trade_mode",
        "data.trade_mode", "trade_mode",
      ]);
      const interp = interpretTradeMode(tm);
      accountTradeMode = interp.raw;
      accountInterpretation = interp.interpretation;
      const acctId = pick(parsed, [
        "data.account.id", "data.account.accountId",
        "account.id", "account.accountId",
        "data.accountId", "accountId",
      ]);
      if (acctId) accountIdFromTrader = String(acctId);
      if (accountIdFromTrader && accountId) {
        accountIdRelationshipVerified = accountIdFromTrader === accountId;
      } else if (accountIdFromTrader && !accountId) {
        accountId = accountIdFromTrader;
        accountIdRelationshipVerified = true;
      }
      const acctScope = parsed?.data?.account ?? parsed?.account ?? null;
      if (acctScope && typeof acctScope === "object") {
        traderAccountKeys = Object.keys(acctScope);
      }
      const perm = extractPermissionFields(parsed);
      permissionFields = perm.fields;
      const interpPerm = interpretPermissionFields(perm.fields);
      permissionInterpretation = interpPerm.interpretation;
      permissionSource = interpPerm.source;
      break;
    } catch (e) {
      traderFetchError = (e as Error).message || "trader_fetch_failed";
      if (attempt === 0) {
        await new Promise((res) => setTimeout(res, 400));
        continue;
      }
    }
  }

  // Effective account-level interpretation: explicit permission field wins
  // over the numeric trade_mode value. Numeric trade_mode never auto-blocks.
  const effectiveAccountInterpretation: ModeInterpretation =
    permissionInterpretation !== "unknown"
      ? permissionInterpretation
      : accountInterpretation;

  // 2) Symbol catalogue — paginated. Try general crawl, then a direct
  // search lookup for the requested symbol if it wasn't found.
  let symbolsFetchError: string | null = null;
  let upsertedCount = 0;
  let symbolsSourceAccountId: string | null = null;
  let symbolsLoaded = 0;
  let symbolsTotalReported: number | null = null;
  let catalogPages = 0;
  let cataloguePaginationComplete = false;
  let cataloguePaginationParamsUsed: string[] = [];
  let rawPageMeta: Array<Record<string, unknown>> = [];
  let directSearchAttempted = false;
  let directSearchHits = 0;
  let allBrokerRows: any[] = [];

  if (refreshCatalog) {
    if (!accountId) {
      symbolsFetchError = "trading_layer_account_id_missing";
    } else {
      symbolsSourceAccountId = accountId;
      const crawl = await fetchAllSymbols(accountId);
      allBrokerRows = crawl.rows;
      catalogPages = crawl.pages;
      symbolsTotalReported = crawl.totalReported;
      symbolsLoaded = crawl.rows.length;
      cataloguePaginationComplete = !crawl.hasMoreFinal &&
        crawl.errors.length === 0;
      cataloguePaginationParamsUsed = crawl.paginationParamsUsed;
      rawPageMeta = crawl.rawPageMeta;
      if (crawl.errors.length > 0) symbolsFetchError = crawl.errors[0];

      // Direct search fallback if requested symbol wasn't found in the crawl.
      if (symbolCanonical) {
        const found = crawl.rows.some((s) => {
          const broker = String(
            pick(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "",
          );
          const c = canonicalize(broker);
          return c === symbolCanonical || c.startsWith(symbolCanonical);
        });
        if (!found) {
          directSearchAttempted = true;
          const direct = await fetchAllSymbols(accountId, symbolCanonical);
          directSearchHits = direct.rows.length;
          for (const s of direct.rows) {
            const broker = String(
              pick(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "",
            ).trim();
            if (broker && !allBrokerRows.some((existing) =>
              String(pick(existing, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "").trim() === broker
            )) {
              allBrokerRows.push(s);
            }
          }
          symbolsLoaded = allBrokerRows.length;
        }
      }

      if (allBrokerRows.length > 0) {
        const now = new Date().toISOString();
        const rows = allBrokerRows.map((s) => {
          const broker = String(
            pick(s, ["symbol", "name", "brokerSymbol", "broker_symbol"]) ?? "",
          ).trim();
          const canonical = canonicalize(broker);
          const tm = pick(s, ["trade_mode", "tradeMode"]);
          return {
            trading_layer_trader_id: traderId,
            trading_layer_account_id: accountId,
            source_endpoint_account_id: accountId,
            source_verified: accountIdRelationshipVerified,
            mt5_login: mapping.login ? String(mapping.login) : null,
            mt5_server: mapping.server ?? null,
            display_symbol: canonical,
            canonical_symbol: canonical,
            broker_symbol: broker,
            description: pick(s, ["description", "desc"]) ?? null,
            asset_class: pick(s, ["assetClass", "asset_class", "category"]) ?? null,
            digits: Number(pick(s, ["digits"])) || null,
            contract_size: Number(pick(s, ["contractSize", "contract_size"])) || null,
            trade_mode: tm != null ? String(tm) : null,
            trade_eligible: isTradable(tm),
            source: "trading_layer_symbols",
            last_synced_at: now,
            raw_metadata: null,
          };
        }).filter((r) => r.broker_symbol);
        if (rows.length > 0) {
          const { error: upErr } = await supabaseService
            .from("broker_symbol_catalog")
            .upsert(rows, { onConflict: "trading_layer_trader_id,broker_symbol" });
          if (!upErr) upsertedCount = rows.length;
        }
      }
    }
  }

  // 3) Resolve broker symbol(s) for the requested display symbol from the
  // catalogue. Only consider rows whose source_endpoint_account_id matches
  // the verified accountId for eligibility — others are surfaced raw.
  type CatRow = {
    broker_symbol: string;
    canonical_symbol: string | null;
    trade_mode: string | null;
    trade_eligible: boolean | null;
    last_synced_at: string | null;
    source_endpoint_account_id: string | null;
    source_verified: boolean | null;
    trading_layer_account_id: string | null;
  };
  let brokerSymbol: string | null = null;
  let symbolTradeMode: string | null = null;
  let symbolInterpretation: ModeInterpretation = "unknown";
  let symbolTradeEligible = false;
  let variants: Array<{
    brokerSymbol: string;
    canonicalSymbol: string | null;
    tradeMode: string | null;
    interpretation: ModeInterpretation;
    checkedAt: string | null;
    sourceAccountId: string | null;
    sourceVerified: boolean;
  }> = [];

  if (symbolCanonical) {
    const { data: catRows } = await supabaseService
      .from("broker_symbol_catalog")
      .select(
        "broker_symbol,canonical_symbol,trade_mode,trade_eligible,last_synced_at,source_endpoint_account_id,source_verified,trading_layer_account_id",
      )
      .eq("trading_layer_trader_id", traderId);
    const candidates: CatRow[] = (catRows ?? []).filter((r: any) => {
      const c = canonicalize(r.canonical_symbol || r.broker_symbol);
      return c === symbolCanonical || c.startsWith(symbolCanonical) ||
        symbolCanonical.startsWith(c);
    });
    variants = candidates.map((r) => {
      const interp = interpretTradeMode(r.trade_mode);
      return {
        brokerSymbol: r.broker_symbol,
        canonicalSymbol: r.canonical_symbol,
        tradeMode: r.trade_mode,
        interpretation: interp.interpretation,
        checkedAt: r.last_synced_at,
        sourceAccountId: r.source_endpoint_account_id,
        sourceVerified: !!r.source_verified,
      };
    });
    const exactVerified = candidates.find((r) =>
      canonicalize(r.canonical_symbol || r.broker_symbol) === symbolCanonical &&
      r.source_verified === true &&
      (!accountId || r.source_endpoint_account_id === accountId)
    );
    const chosen = exactVerified ?? null;
    if (chosen) {
      brokerSymbol = chosen.broker_symbol;
      symbolTradeMode = chosen.trade_mode ?? null;
      const interp = interpretTradeMode(chosen.trade_mode);
      symbolInterpretation = interp.interpretation;
      symbolTradeEligible = interp.interpretation === "eligible";
    }
  }

  // Catalogue completeness assessment (independent of pagination flag).
  const catalogueComplete = cataloguePaginationComplete &&
    (symbolsTotalReported == null || symbolsLoaded >= symbolsTotalReported);
  const catalogueStatus: "partial" | "complete" | "direct_lookup_complete" | "unknown" =
    !refreshCatalog
      ? "unknown"
      : catalogueComplete
      ? (directSearchAttempted ? "direct_lookup_complete" : "complete")
      : "partial";

  // 4) Mutation eligibility — fail closed.
  let eligibility:
    | "eligible"
    | "blocked"
    | "blocked_pending_trade_mode_interpretation"
    | "unknown" = "unknown";
  let blockedReason: string | null = null;

  if (!accountId) {
    eligibility = "blocked";
    blockedReason = "trading_layer_account_id_missing";
  } else if (accountIdFromTrader && !accountIdRelationshipVerified) {
    eligibility = "blocked";
    blockedReason = "account_id_relationship_unverified";
  } else if (traderFetchError) {
    eligibility = "unknown";
    blockedReason = `Trader endpoint unreachable (${traderFetchError}); cannot confirm execution permission.`;
  } else if (effectiveAccountInterpretation === "blocked") {
    eligibility = "blocked";
    blockedReason = permissionSource
      ? `account_execution_blocked:${permissionSource}`
      : "account_trade_mode_blocked";
  } else if (effectiveAccountInterpretation === "unknown" ||
             effectiveAccountInterpretation === "awaiting_enum_confirmation") {
    // Numeric trade_mode w/ no explicit permission boolean → blocked but
    // diagnostics-friendly. Catalogue still surfaced above.
    eligibility = "blocked_pending_trade_mode_interpretation";
    blockedReason =
      "Account execution permission not yet confirmed. Trading Layer exposes account.trade_mode but no explicit trading-allowed boolean was returned.";
  } else if (effectiveAccountInterpretation === "eligible") {
    if (!catalogueComplete) {
      eligibility = "blocked";
      blockedReason =
        "Broker-symbol catalogue incomplete or requested executable symbol unresolved.";
    } else if (symbolCanonical && !brokerSymbol) {
      eligibility = "blocked";
      blockedReason =
        "Broker-symbol catalogue incomplete or requested executable symbol unresolved.";
    } else if (symbolInterpretation === "awaiting_enum_confirmation") {
      eligibility = "blocked_pending_trade_mode_interpretation";
      blockedReason =
        "Trading Layer returned a numeric symbol.trade_mode value. Live execution remains blocked until the enum mapping is confirmed.";
    } else if (symbolInterpretation === "blocked") {
      eligibility = "blocked";
      blockedReason = "symbol_trade_mode_blocked";
    } else if (symbolInterpretation === "eligible" || !symbolCanonical) {
      eligibility = "eligible";
    } else {
      eligibility = "unknown";
      blockedReason = "symbol_trade_mode_unknown";
    }
  }

  return json({
    success: true,
    traderId,
    traderIdUsed: traderId,
    traderHttpStatus,
    accountIdUsedForSymbols: symbolsSourceAccountId,
    accountIdFromTrader,
    accountIdRelationshipVerified,
    accountTradeMode,
    accountTradeModeRaw: accountTradeMode,
    accountTradeModeInterpretation:
      accountInterpretation === "awaiting_enum_confirmation"
        ? "awaiting Trading Layer mapping confirmation"
        : accountInterpretation,
    accountTypeInterpretation:
      accountInterpretation === "awaiting_enum_confirmation"
        ? "possibly MT5 real account if native MT5 enum semantics apply"
        : null,
    accountExecutionPermission:
      permissionInterpretation !== "unknown"
        ? permissionInterpretation
        : "unknown until explicit trading-allowed field or Trading Layer mapping is confirmed",
    accountExecutionPermissionSource: permissionSource,
    accountTradeEligible: effectiveAccountInterpretation === "eligible",
    traderAccountKeysSeen: traderAccountKeys,
    permissionFieldsFound: permissionFields,
    enumMappingSource: permissionSource,
    displaySymbol: symbolCanonical || null,
    brokerSymbol,
    symbolTradeMode,
    symbolTradeEligible,
    symbolTradeModeInterpretation: symbolInterpretation,
    variants,
    catalogue: {
      status: catalogueStatus,
      complete: catalogueComplete,
      paginationComplete: cataloguePaginationComplete,
      symbolsLoaded,
      totalReported: symbolsTotalReported,
      pagesFetched: catalogPages,
      paginationParamsUsed: cataloguePaginationParamsUsed,
      pageMeta: rawPageMeta,
      directSearchAttempted,
      directSearchHits,
    },
    symbolsTotal: symbolsLoaded,
    eligibility,
    blockedReason,
    catalogUpsertedCount: upsertedCount,
    checkedAt: new Date().toISOString(),
    diagnostics: { traderFetchError, symbolsFetchError },
  });
});
