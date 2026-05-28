// Lifecycle position confirmation — Trading Layer LIVE authoritative.
// Never mutates the market. Reads forced live TL positions for the admin's
// verified route and resolves the exact ticket associated with the active
// lifecycle authorisation (matching brokerSymbol + side + volume, preferring
// positions opened after entry_consumed_at). The local mt_positions table is
// touched only as an informational audit mirror.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { fetchTradingLayerLivePositions, upsertMirrorFromLive } from "../_shared/livePositions.ts";

const VERSION = "LIFECYCLE_CONFIRM_POSITION_V1_2026_05_28";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE);
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json({ success: false, error: "Unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return json({ success: false, version: VERSION, error: "ADMIN_REQUIRED" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const authorisationId = String(body?.authorisationId ?? "");
  if (!authorisationId) return json({ success: false, version: VERSION, error: "authorisationId required" }, 400);

  const { data: row } = await supabase
    .from("lifecycle_validation_authorisations").select("*").eq("id", authorisationId).maybeSingle();
  if (!row) return json({ success: false, version: VERSION, error: "AUTHORISATION_NOT_FOUND" }, 404);
  if (row.status !== "awaiting_position_confirmation") {
    return json({ success: false, version: VERSION, error: "NOT_IN_AWAITING_POSITION_CONFIRMATION", status: row.status }, 409);
  }

  const mapping = await resolveActiveMtMapping(supabase, user.id);
  const accountId = mapping?.traderId || (mapping as any)?.tradingLayerAccountId;
  if (!accountId) return json({ success: false, version: VERSION, error: "NO_VERIFIED_TL_MAPPING" }, 404);

  const live = await fetchTradingLayerLivePositions(accountId);
  const checkedAt = new Date().toISOString();
  if (!live.ok) {
    return json({
      success: false, version: VERSION,
      error: "tl_positions_lookup_failed",
      detail: live.error, httpStatus: live.httpStatus, checkedAt,
    }, 502);
  }

  const expectedSymbol = String(row.broker_symbol).toUpperCase();
  const expectedSide = String(row.entry_side).toLowerCase();
  const expectedVolume = Number(row.entry_volume);
  const dispatchedAt = row.entry_consumed_at ? new Date(row.entry_consumed_at).getTime() : 0;

  const matches = live.positions.filter((p) =>
    p.symbol === expectedSymbol &&
    p.side === expectedSide &&
    Math.abs(p.volume - expectedVolume) < 1e-8,
  );

  // Prefer positions opened at/after dispatch when timing info is present.
  const matchesAfter = dispatchedAt
    ? matches.filter((p) => {
        const t = p.openedAt ? new Date(p.openedAt).getTime() : 0;
        return t >= dispatchedAt - 5_000;
      })
    : matches;
  const candidatePool = matchesAfter.length > 0 ? matchesAfter : matches;

  const candidates = candidatePool.map((p) => ({
    ticket: p.ticket, symbol: p.symbol, side: p.side, volume: p.volume,
    openPrice: p.openPrice, openedAt: p.openedAt,
  }));

  if (candidates.length === 0) {
    return json({
      success: true, version: VERSION, checkedAt, source: "trading_layer_live_forced",
      route: { accountId, brokerSymbol: expectedSymbol },
      confirmed: false, reason: "no_live_match",
      candidates: [],
      message: "Live Trading Layer lookup did not yet identify the placed EURUSD position. Check native MT5 immediately and close manually if exposure must be removed.",
      mutationsPerformed: false,
    });
  }

  if (candidates.length > 1) {
    return json({
      success: true, version: VERSION, checkedAt, source: "trading_layer_live_forced",
      route: { accountId, brokerSymbol: expectedSymbol },
      confirmed: false, reason: "ambiguous_multiple_live_matches",
      candidates,
      message: "Multiple live positions match the lifecycle entry signature. Select the exact ticket before close is permitted.",
      mutationsPerformed: false,
    });
  }

  const chosen = candidatePool[0];

  // Atomically transition the row only if still in awaiting_position_confirmation.
  const { data: updated, error: updErr } = await supabase
    .from("lifecycle_validation_authorisations")
    .update({
      status: "position_confirmed_close_only",
      confirmed_position_ticket: String(chosen.ticket),
      confirmed_position_at: checkedAt,
      confirmed_position_evidence: {
        source: "trading_layer_live_forced",
        live: chosen.raw,
        route: { accountId, brokerSymbol: expectedSymbol },
        checkedAt,
      },
    })
    .eq("id", authorisationId)
    .eq("status", "awaiting_position_confirmation")
    .select()
    .maybeSingle();
  if (updErr) return json({ success: false, version: VERSION, error: "ROW_UPDATE_FAILED", detail: updErr.message }, 500);
  if (!updated) return json({ success: false, version: VERSION, error: "ROW_TRANSITION_LOST" }, 409);

  // Best-effort mirror upsert (informational audit only — not authoritative).
  let mirrorAction: any = "skipped";
  try {
    const localRowId = (mapping as any)?.localRowId || null;
    if (localRowId) {
      const m = await upsertMirrorFromLive(supabase, {
        userId: user.id,
        accountUuid: localRowId,
        live: chosen,
        brokerSymbol: expectedSymbol,
      });
      mirrorAction = m.action;
    } else {
      mirrorAction = "skipped_no_local_row";
    }
  } catch { mirrorAction = "failed"; }

  return json({
    success: true, version: VERSION, checkedAt, source: "trading_layer_live_forced",
    route: { accountId, brokerSymbol: expectedSymbol },
    confirmed: true,
    confirmedTicket: String(chosen.ticket),
    candidate: {
      ticket: chosen.ticket, symbol: chosen.symbol, side: chosen.side, volume: chosen.volume,
      openPrice: chosen.openPrice, openedAt: chosen.openedAt,
    },
    mirrorAction,
    message: "Live position confirmed from Trading Layer. Only the controlled close action for this exact ticket is now permitted.",
    mutationsPerformed: false,
  });
});
