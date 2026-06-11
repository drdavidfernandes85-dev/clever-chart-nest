// get-mt5-history — JWT-gated read-only wrapper for TL's history endpoints.
// Exposes /history/orders and /history/deals for the authenticated user's
// own connected MT5 account. No mutations. No mock data. Honest empty/error.
//
// Paging contract (passed through verbatim from TL):
//   request:  { kind: "orders"|"deals", dateFrom: ISO, dateTo: ISO,
//               symbol?: string, limit?: number, offset?: number }
//   response: { success, data: [...], meta: { limit, offset, count, hasMore } }
//
// Ownership is enforced server-side by looking up the requesting user's
// `user_mt_accounts.metaapi_account_id` — clients cannot pass an accountId.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolveActiveMtMapping,
  STALE_MAPPING_ERROR_CODE,
  STALE_MAPPING_USER_MESSAGE,
} from "../_shared/mtMapping.ts";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  if (!TRADING_LAYER_KEY) return json({ success: false, error: "Missing TRADING_LAYER_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ success: false, error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

  // Ownership via shared resolver — single auth path for read + execution
  // functions. Prefers rows with validated trading_layer_trader_id; rejects
  // stale ownerAccountId-only rows that would otherwise leak phantom history.
  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status === "missing") {
    return json({ success: false, accountConnected: false, error: "No connected MT5 account found." }, 200);
  }
  if (mapping.status === "stale" || !mapping.traderId) {
    return json({
      success: false, accountConnected: false,
      error: STALE_MAPPING_ERROR_CODE, message: STALE_MAPPING_USER_MESSAGE,
      mappingStatus: mapping.status, localRowId: mapping.localRowId,
    }, 409);
  }
  const accountId = mapping.traderId;

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const kindRaw = String(body?.kind ?? "deals").toLowerCase();
  if (kindRaw !== "orders" && kindRaw !== "deals") {
    return json({ success: false, error: "kind must be 'orders' or 'deals'" }, 400);
  }

  const now = Date.now();
  const dateFromRaw = body?.dateFrom != null ? String(body.dateFrom) : new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const dateToRaw = body?.dateTo != null ? String(body.dateTo) : new Date(now).toISOString();
  const dateFromMs = Date.parse(dateFromRaw);
  const dateToMs = Date.parse(dateToRaw);
  if (!Number.isFinite(dateFromMs) || !Number.isFinite(dateToMs)) {
    return json({ success: false, error: "dateFrom/dateTo must be ISO timestamps" }, 400);
  }
  const limit = Math.min(Math.max(Number(body?.limit ?? 50), 1), 500);
  const offset = Math.max(Number(body?.offset ?? 0), 0);
  const symbolFilter = body?.symbol ? String(body.symbol).toUpperCase() : null;

  const qs = new URLSearchParams({
    dateFrom: new Date(dateFromMs).toISOString(),
    dateTo: new Date(dateToMs).toISOString(),
    limit: String(limit),
    offset: String(offset),
  });
  if (symbolFilter) qs.set("symbol", symbolFilter);

  const url = `${BASE_URL}/api/v1/accounts/${encodeURIComponent(accountId)}/history/${kindRaw}?${qs.toString()}`;
  const startedAt = Date.now();
  let httpStatus = 0;
  let parsed: any = null;
  let networkError: string | null = null;
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${TRADING_LAYER_KEY}`, Accept: "application/json" },
    });
    httpStatus = r.status;
    const text = await r.text();
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  } catch (e) {
    networkError = e instanceof Error ? e.message : String(e);
  }
  const latencyMs = Date.now() - startedAt;

  if (networkError || httpStatus < 200 || httpStatus >= 300) {
    return json({
      success: false,
      kind: kindRaw,
      accountConnected: true,
      error: networkError ?? `Trading Layer returned HTTP ${httpStatus}`,
      tradingLayerStatus: httpStatus,
      latencyMs,
    }, 200);
  }

  const data = Array.isArray(parsed?.data) ? parsed.data : [];
  const meta = parsed?.meta ?? { limit, offset, count: data.length, hasMore: false };

  return json({
    success: true,
    accountConnected: true,
    kind: kindRaw,
    data,
    meta: {
      limit: Number(meta.limit ?? limit),
      offset: Number(meta.offset ?? offset),
      count: Number(meta.count ?? data.length),
      hasMore: Boolean(meta.hasMore ?? false),
    },
    dateFrom: new Date(dateFromMs).toISOString(),
    dateTo: new Date(dateToMs).toISOString(),
    symbol: symbolFilter,
    latencyMs,
    tradingLayerStatus: httpStatus,
    timestamp: new Date().toISOString(),
  });
});
