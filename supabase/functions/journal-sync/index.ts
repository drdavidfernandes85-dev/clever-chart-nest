// journal-sync — paginates /history/deals for the requesting user's connected
// MT5 account, decodes side via the shared decoder, and upserts into
// public.journal_deals. Cursor stored in public.journal_sync_state.
//
// CONTRACT
//   - Window: body.dateFrom..dateTo (ISO). Defaults: last 60d (365d if full:true).
//   - Pagination: internal POST to /get-mt5-history with kind='deals'.
//   - TL DEVIATION #6: server ignores `limit` (verified up to 500) and returns
//     max ~10 rows/page. We do NOT gate hasMore on rows.length >= PAGE.
//   - Wall budget 25s per invocation; on exhaustion returns hasMore=true and
//     nextDateTo (oldest deal seen − 1ms) so the CLIENT can auto-invoke the
//     next chunk. Upserts are idempotent on (user_id, mt_login, ticket).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { decodeDealSide, isTradeDeal, decodeDealEntry } from "../_shared/mt5Decode.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status !== "valid" || !mapping.localRowId || !mapping.login) {
    return json({ success: false, error: "No connected MT5 account" }, 200);
  }
  const mtAccountId = mapping.localRowId;
  const mtLoginNum = Number(mapping.login);
  if (!Number.isFinite(mtLoginNum)) {
    return json({ success: false, error: "Invalid mt_login" }, 200);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }

  const now = Date.now();
  const defaultWindowDays = body?.full === true ? 365 : 60;
  const dateFrom = body?.dateFrom
    ? new Date(body.dateFrom).toISOString()
    : new Date(now - defaultWindowDays * 86400_000).toISOString();
  const dateTo = body?.dateTo ? new Date(body.dateTo).toISOString() : new Date(now).toISOString();

  const PAGE = 50;
  const MAX_PAGES = 80;
  const BUDGET_MS = 25_000;
  const started = Date.now();

  await supabase.from("journal_sync_state").upsert({
    user_id: user.id,
    mt_account_id: mtAccountId,
    mt_login: mtLoginNum,
    last_status: "running",
  }, { onConflict: "user_id,mt_account_id" });

  let offset = 0;
  let pages = 0;
  let totalFetched = 0;
  let upserted = 0;
  let maxDealTime: string | null = null;
  let maxDealTicket: number | null = null;
  let minDealTime: string | null = null;
  let lastError: string | null = null;
  let upstreamStatus = 0;
  let budgetExhausted = false;

  while (pages < MAX_PAGES) {
    if (Date.now() - started > BUDGET_MS) { budgetExhausted = true; break; }

    let parsed: any = null;
    // Single transient retry on upstream 5xx — TL has been returning intermittent
    // 502s mid-backfill. One retry after 2s; if it still fails we bail with the
    // cursor (minDealTime) so the client can resume past the bad point.
    let attempt = 0;
    let pageFailed = false;
    while (true) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/get-mt5-history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: JSON.stringify({ kind: "deals", dateFrom, dateTo, limit: PAGE, offset }),
        });
        upstreamStatus = r.status;
        const text = await r.text();
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
        if (!r.ok || parsed?.success === false) {
          const transient = r.status >= 500 && r.status < 600;
          if (transient && attempt === 0) {
            attempt++;
            await sleep(2000);
            continue;
          }
          lastError = parsed?.error
            ? String(parsed.error)
            : `HISTORY_HTTP_${r.status}: ${text.slice(0, 300)}`;
          pageFailed = true;
        }
        break;
      } catch (e) {
        if (attempt === 0) { attempt++; await sleep(2000); continue; }
        lastError = e instanceof Error ? e.message : String(e);
        pageFailed = true;
        break;
      }
    }
    if (pageFailed) break;

    const rows: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
    if (rows.length === 0) break;
    totalFetched += rows.length;

    const dbRows = rows.map((d) => {
      const typeRaw = d.type ?? d.deal_type ?? d.dealType;
      const entryRaw = d.entry ?? d.deal_entry ?? d.dealEntry;
      const reasonRaw = d.reason ?? d.deal_reason;
      const dealTime = toIso(d.time ?? d.deal_time ?? d.dealTime ?? d.timestamp ?? d.time_msc);
      const ticket = numOrNull(d.ticket ?? d.id ?? d.deal_id);
      const orderId = numOrNull(d.order ?? d.order_id ?? d.orderId);
      const positionId = numOrNull(d.position_id ?? d.positionId ?? d.position);
      if (dealTime && (!maxDealTime || dealTime > maxDealTime)) {
        maxDealTime = dealTime;
        maxDealTicket = ticket;
      }
      if (dealTime && (!minDealTime || dealTime < minDealTime)) {
        minDealTime = dealTime;
      }
      return {
        user_id: user.id,
        mt_account_id: mtAccountId,
        mt_login: mtLoginNum,
        ticket: ticket ?? 0,
        order_id: orderId,
        position_id: positionId,
        symbol: d.symbol ? String(d.symbol).toUpperCase() : null,
        type_raw: typeRaw != null ? Number(typeRaw) : 0,
        entry_raw: entryRaw != null ? Number(entryRaw) : null,
        entry: decodeDealEntry(entryRaw),
        reason_raw: reasonRaw != null ? Number(reasonRaw) : null,
        is_trade: isTradeDeal(typeRaw),
        side: decodeDealSide(typeRaw),
        volume: num(d.volume ?? d.lots),
        price: num(d.price),
        profit: num(d.profit),
        swap: num(d.swap),
        commission: num(d.commission),
        fee: num(d.fee),
        deal_time: dealTime ?? new Date(0).toISOString(),
        comment: d.comment ?? null,
        raw: d,
      };
    }).filter((r) => r.ticket > 0);

    if (dbRows.length > 0) {
      const { error: upErr } = await supabase
        .from("journal_deals")
        .upsert(dbRows, { onConflict: "user_id,mt_login,ticket" });
      if (upErr) { lastError = upErr.message; break; }
      upserted += dbRows.length;
    }

    const meta = parsed?.meta ?? {};
    // TL deviation #6: limit ignored, ~10/page. Continue unless meta says no.
    const hasMoreUpstream = meta.hasMore === false ? false : true;
    offset += rows.length;
    pages += 1;
    if (!hasMoreUpstream) break;
    await sleep(150);
  }

  const completedAt = new Date().toISOString();
  const { count: dealsTotal } = await supabase
    .from("journal_deals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("mt_login", mtLoginNum);

  // Resume cursor is preserved on BOTH partial outcomes:
  //   - budgetExhausted (clean stop, more to fetch)
  //   - lastError after at least one page (transient 5xx mid-backfill)
  // The client uses nextDateTo to skip past the failing page.
  const hasMore = (budgetExhausted || (!!lastError && totalFetched > 0)) && !!minDealTime;
  const nextDateTo = hasMore && minDealTime
    ? new Date(new Date(minDealTime).getTime() - 1).toISOString()
    : null;
  const resolvedStatus = lastError
    ? (hasMore ? "partial" : "error")
    : budgetExhausted
      ? "partial"
      : "ok";


  await supabase.from("journal_sync_state").upsert({
    user_id: user.id,
    mt_account_id: mtAccountId,
    mt_login: mtLoginNum,
    last_synced_at: completedAt,
    last_deal_time: maxDealTime,
    last_deal_ticket: maxDealTicket,
    last_status: lastError ? "error" : hasMore ? "partial" : "ok",
    last_error: lastError,
    deals_total: dealsTotal ?? 0,
  }, { onConflict: "user_id,mt_account_id" });

  return json({
    success: !lastError,
    error: lastError,
    upstreamStatus,
    window: { from: dateFrom, to: dateTo },
    pagesFetched: pages,
    dealsFetched: totalFetched,
    dealsUpserted: upserted,
    dealsTotal: dealsTotal ?? 0,
    maxDealTime,
    minDealTime,
    hasMore,
    nextDateTo,
    elapsedMs: Date.now() - started,
  });
});
