// journal-sync — pulls /history/deals from Trading Layer for the requesting
// user's connected MT5 account, decodes side via the shared decoder, and
// upserts into public.journal_deals. Bookkeeping cursor stored in
// public.journal_sync_state. Service-role writes; user SELECT for read.
//
// Sync contract:
//   - Window: body.dateFrom..dateTo (ISO). Defaults: last 60d.
//   - Pagination: GET /api/v1/accounts/{traderId}/history/deals?dateFrom&dateTo&limit&offset
//                  TL returns { data:[...], meta:{ limit, offset, count, hasMore } }
//                  We page in 200-row chunks until hasMore=false OR safety cap (50 pages).
//   - Rate limit: 250ms sleep between TL page calls; per-request budget cap 25s.
//   - Backfill: client can pass { full:true } to widen window to 1 year.
//   - Upsert key: (user_id, mt_login, ticket). Conflict → DO UPDATE on raw+decoded.
//   - Idempotent: re-running over same window only touches changed rows.
//   - Cursor: journal_sync_state.last_deal_time advances to max(deal_time) seen.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { decodeDealSide, decodeDealEntry, isTradeDeal } from "../_shared/mt5Decode.ts";

const TL_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const TL_BASE = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "number") {
    // TL sometimes returns epoch seconds; detect by magnitude.
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);
  if (!TL_KEY) return json({ success: false, error: "Missing TRADING_LAYER_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status !== "ok" || !mapping.traderId) {
    return json({ success: false, error: "No connected MT5 account" }, 200);
  }
  const traderId = mapping.traderId;
  const mtAccountId = mapping.localRowId;
  const mtLogin = String(mapping.login ?? "");

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const now = Date.now();
  const defaultWindowDays = body?.full === true ? 365 : 60;
  const dateFrom = body?.dateFrom
    ? new Date(body.dateFrom).toISOString()
    : new Date(now - defaultWindowDays * 86400_000).toISOString();
  const dateTo = body?.dateTo ? new Date(body.dateTo).toISOString() : new Date(now).toISOString();

  const PAGE = 200;
  const MAX_PAGES = 50;
  const BUDGET_MS = 25_000;
  const started = Date.now();

  // Mark sync state row as running.
  await supabase.from("journal_sync_state").upsert({
    user_id: user.id,
    mt_account_id: mtAccountId,
    mt_login: Number(mtLogin) || null,
    last_run_status: "running",
    last_run_started_at: new Date().toISOString(),
    last_run_window_from: dateFrom,
    last_run_window_to: dateTo,
  }, { onConflict: "user_id,mt_account_id" });

  let offset = 0;
  let pages = 0;
  let totalFetched = 0;
  let upserted = 0;
  let maxDealTime: string | null = null;
  let lastError: string | null = null;
  let upstreamStatus = 0;

  while (pages < MAX_PAGES) {
    if (Date.now() - started > BUDGET_MS) { lastError = "BUDGET_EXCEEDED"; break; }

    const qs = new URLSearchParams({
      dateFrom, dateTo, limit: String(PAGE), offset: String(offset),
    });
    const url = `${TL_BASE}/api/v1/accounts/${encodeURIComponent(traderId)}/history/deals?${qs}`;
    let parsed: any = null;
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TL_KEY}`, Accept: "application/json" } });
      upstreamStatus = r.status;
      const text = await r.text();
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!r.ok) { lastError = `TL_HTTP_${r.status}`; break; }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      break;
    }

    const rows: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
    if (rows.length === 0) break;
    totalFetched += rows.length;

    // Map → DB shape
    const dbRows = rows.map((d) => {
      const typeRaw = d.type ?? d.deal_type ?? d.dealType;
      const entryRaw = d.entry ?? d.deal_entry ?? d.dealEntry;
      const dealTime = toIso(d.time ?? d.deal_time ?? d.dealTime ?? d.timestamp);
      if (dealTime && (!maxDealTime || dealTime > maxDealTime)) maxDealTime = dealTime;
      return {
        user_id: user.id,
        mt_account_id: mtAccountId,
        mt_login: Number(mtLogin) || null,
        ticket: Number(d.ticket ?? d.id ?? d.deal_id ?? 0),
        order_id: d.order_id ?? d.orderId ?? d.order ? Number(d.order_id ?? d.orderId ?? d.order) : null,
        position_id: d.position_id ?? d.positionId ?? d.position ? Number(d.position_id ?? d.positionId ?? d.position) : null,
        symbol: d.symbol ? String(d.symbol).toUpperCase() : null,
        type_raw: typeRaw != null ? Number(typeRaw) : null,
        entry_raw: entryRaw != null ? Number(entryRaw) : null,
        is_trade: isTradeDeal(typeRaw),
        side: decodeDealSide(typeRaw),
        entry: decodeDealEntry(entryRaw),
        volume: num(d.volume ?? d.lots),
        price: num(d.price),
        profit: num(d.profit),
        swap: num(d.swap),
        commission: num(d.commission),
        fee: num(d.fee),
        deal_time: dealTime,
        comment: d.comment ?? null,
        raw: d,
      };
    }).filter((r) => r.ticket && Number.isFinite(r.ticket));

    if (dbRows.length > 0) {
      const { error: upErr, count } = await supabase
        .from("journal_deals")
        .upsert(dbRows, { onConflict: "user_id,mt_login,ticket", count: "exact" });
      if (upErr) { lastError = upErr.message; break; }
      upserted += count ?? dbRows.length;
    }

    const meta = parsed?.meta ?? {};
    const hasMore = Boolean(meta.hasMore) && rows.length >= PAGE;
    offset += rows.length;
    pages += 1;
    if (!hasMore) break;
    await sleep(250);
  }

  const completedAt = new Date().toISOString();
  await supabase.from("journal_sync_state").upsert({
    user_id: user.id,
    mt_account_id: mtAccountId,
    mt_login: Number(mtLogin) || null,
    last_run_status: lastError ? "error" : "ok",
    last_run_completed_at: completedAt,
    last_run_error: lastError,
    last_run_deals_fetched: totalFetched,
    last_run_deals_upserted: upserted,
    last_deal_time: maxDealTime,
    last_sync_at: completedAt,
  }, { onConflict: "user_id,mt_account_id" });

  return json({
    success: !lastError,
    error: lastError,
    upstreamStatus,
    window: { from: dateFrom, to: dateTo },
    pagesFetched: pages,
    dealsFetched: totalFetched,
    dealsUpserted: upserted,
    maxDealTime,
    elapsedMs: Date.now() - started,
  });
});
