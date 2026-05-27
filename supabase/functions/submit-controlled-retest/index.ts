// One-shot controlled retest dispatcher.
//
// Strictly admin-only. Consumes a single unconsumed row from
// `controlled_retest_authorisations` whose (symbol, side, volume,
// route_account_id) match the authorised retest, sets `consumed_at` BEFORE
// dispatching, posts the strict minimal Trading Layer DTO
//   { side, symbol, volume }
// to /api/v1/accounts/{routeAccountId}/trades/send, and records the
// outcome (placed | rejected | pretrade_blocked) onto the authorisation
// row. Also flips `site_settings.final_activation_blocker` to either
// `controlled_retest_position_confirmed_close_only` (on acceptance) or
// `BROKER_REJECTED_MINIMAL_DTO_TRADE_DISABLED` (on retcode 10017).
//
// Supports a mutation-suppressed preview via { previewOnly: true } that
// echoes the literal outbound DTO/endpoint/headers without dispatching.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { assertLiveExecutionAllowed } from "../_shared/executionMode.ts";
import { refreshTradeModeFromTradingLayer } from "../_shared/brokerSymbol.ts";
import { resolveFreshExecutionTick } from "../_shared/freshTick.ts";
import { loadRiskSettings, loadDailyUsage, checkOpenRisk } from "../_shared/risk.ts";
import { sideToOperation } from "../_shared/tradingLayerTradeMode.ts";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY")!;
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE);
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    auth.replace("Bearer ", ""),
  );
  if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);
  if (!(await isAdmin(supabase, user.id))) {
    return json({ success: false, error: "ADMIN_REQUIRED" }, 403);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const previewOnly = body?.previewOnly === true;
  const authorisationId = body?.authorisationId ? String(body.authorisationId) : null;

  // 1) Locate one unconsumed authorisation.
  // Preview mode does NOT require an existing authorisation row — it just
  // echoes the literal DTO that *would* be sent. Fall back to permitted
  // defaults (EURUSD SELL 0.01 on the verified route) so the admin card
  // can preview before authorising.
  let authRow: any = null;
  {
    let query = supabase
      .from("controlled_retest_authorisations")
      .select("*")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("authorised_at", { ascending: false })
      .limit(1);
    if (authorisationId) query = query.eq("id", authorisationId);
    const { data: rows, error: rowErr } = await query;
    if (rowErr) return json({ success: false, step: "load_authorisation", error: rowErr.message }, 500);
    authRow = rows?.[0] ?? null;
  }

  if (!authRow && !previewOnly) {
    return json({ success: false, step: "load_authorisation", error: "NO_VALID_AUTHORISATION" }, 404);
  }

  const symbol = String(authRow?.permitted_symbol ?? "EURUSD");
  const brokerSymbol = String(authRow?.permitted_broker_symbol ?? "EURUSD");
  const side = String(authRow?.permitted_side ?? "sell") as "buy" | "sell";
  const volume = Number(authRow?.permitted_volume ?? 0.01);
  const routeAccountId = String(
    authRow?.permitted_route_account_id ?? "559a12e4-16d8-4db3-be48-40fbea54bcfe",
  );

  // 2) Pretrade chain (mapping → exec mode → trade-mode → fresh tick → risk).
  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status !== "active" || !mapping.traderId) {
    return await markPretradeBlocked(supabase, authRow.id, "MAPPING_NOT_ACTIVE");
  }
  const gate = await assertLiveExecutionAllowed(supabase, user.id, {
    traderId: mapping.traderId, login: mapping.login,
  });
  if (!gate.allowed) {
    return await markPretradeBlocked(supabase, authRow.id, gate.code || "EXECUTION_MODE_BLOCKED");
  }
  const gateFresh = await refreshTradeModeFromTradingLayer(supabase, {
    traderId: mapping.traderId,
    accountId: mapping.tradingLayerAccountId,
    brokerSymbol,
    login: mapping.login,
    server: mapping.server,
    operation: sideToOperation(side, "market"),
  });
  if (!gateFresh.ok) {
    return await markPretradeBlocked(supabase, authRow.id, gateFresh.errorCode || "TRADE_MODE_GATE_BLOCKED");
  }
  const ft = await resolveFreshExecutionTick({
    routeAccountId, brokerSymbol, displaySymbol: symbol,
  });
  if (!ft.fresh) {
    return await markPretradeBlocked(supabase, authRow.id, ft.code || "FRESH_TICK_UNAVAILABLE");
  }
  try {
    const settings = await loadRiskSettings(supabase, user.id);
    const usage = await loadDailyUsage(supabase, user.id);
    const breach = checkOpenRisk({ symbol, volume }, settings, usage);
    if (breach) {
      return await markPretradeBlocked(supabase, authRow.id, String(breach.reason || "RISK_BLOCKED"));
    }
  } catch { /* best-effort */ }

  // 3) Strict minimal Trading Layer DTO.
  const outboundDto = { side, symbol: brokerSymbol, volume };
  const endpointPath = `/api/v1/accounts/${routeAccountId}/trades/send`;
  const idempotencyKey = `controlled-retest-${authRow.id}`;

  if (previewOnly) {
    return json({
      success: true,
      step: "outbound_contract_preview",
      mutationSuppressed: true,
      liveOrderAttempted: false,
      liveOrderSent: false,
      authorisationId: authRow.id,
      outbound: {
        endpointPath,
        method: "POST",
        accountIdInUrl: routeAccountId,
        body: outboundDto,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer ***redacted***",
          "Idempotency-Key": idempotencyKey,
        },
        idempotencyKeyPresent: true,
        internalMetadataExcluded: true,
        fieldsInBody: Object.keys(outboundDto),
        deviationAbsent: true,
      },
      freshTick: { ageMs: ft.ageMs, bid: ft.bid, ask: ft.ask },
    });
  }

  // 4) ATOMIC single-use: set consumed_at BEFORE dispatch. If another
  // concurrent caller already consumed, this update returns 0 rows.
  const consumedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("controlled_retest_authorisations")
    .update({ consumed_at: consumedAt, outbound_dto: outboundDto })
    .eq("id", authRow.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (claimErr || !claimed) {
    return json({ success: false, step: "consume_authorisation", error: "AUTHORISATION_ALREADY_CONSUMED" }, 409);
  }

  // 5) Dispatch live.
  const tradeResp = await fetch(`${BASE_URL}${endpointPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TRADING_LAYER_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(outboundDto),
  });
  const tradeText = await tradeResp.text();
  let tradeJson: any; try { tradeJson = JSON.parse(tradeText); } catch { tradeJson = { raw: tradeText }; }
  const result = tradeJson?.data ?? tradeJson;
  const retcode = Number(result?.retcode ?? result?.result?.retcode ?? NaN);
  const orderId = String(result?.order ?? result?.orderId ?? result?.result?.order ?? "") || null;
  const placed = tradeResp.ok && (retcode === 10008 || retcode === 10009);

  const outcome = placed ? "placed" : "rejected";
  await supabase
    .from("controlled_retest_authorisations")
    .update({
      outcome,
      outcome_retcode: Number.isFinite(retcode) ? retcode : null,
      outcome_payload: tradeJson,
      consumed_order_id: orderId,
    })
    .eq("id", authRow.id);

  // 6) Update final_activation_blocker.
  if (placed) {
    await supabase.from("site_settings").upsert({
      key: "final_activation_blocker",
      value: {
        active: true,
        status: "controlled_retest_position_confirmed_close_only",
        block_reason_code: "MINIMAL_TL_DTO_FIX_REQUIRES_SINGLE_VALIDATION_TEST",
        general_buy_sell_disabled: true,
        client_live_execution_disabled: true,
        pending_orders_disabled: true,
        display_copy:
          "Controlled EURUSD SELL 0.01 was accepted by Trading Layer. Only Close on that exact confirmed position is permitted next.",
        controlled_retest_outcome: { outcome: "placed", retcode, orderId },
        updated_at: new Date().toISOString(),
      },
    }, { onConflict: "key" });
  } else if (retcode === 10017) {
    await supabase.from("site_settings").upsert({
      key: "final_activation_blocker",
      value: {
        active: true,
        status: "broker_rejected_minimal_dto_trade_disabled",
        block_reason_code: "BROKER_REJECTED_MINIMAL_DTO_TRADE_DISABLED",
        general_buy_sell_disabled: true,
        client_live_execution_disabled: true,
        pending_orders_disabled: true,
        display_copy:
          "Trading Layer rejected the controlled SELL with TRADE_DISABLED even on the documented minimal payload. Escalation to Trading Layer required. No retry permitted.",
        controlled_retest_outcome: { outcome: "rejected", retcode, response: tradeJson, outboundDto },
        updated_at: new Date().toISOString(),
      },
    }, { onConflict: "key" });
  }

  return json({
    success: true,
    step: "dispatched",
    authorisationId: authRow.id,
    outcome,
    httpStatus: tradeResp.status,
    retcode: Number.isFinite(retcode) ? retcode : null,
    orderId,
    outbound: { endpointPath, body: outboundDto },
    response: tradeJson,
  });
});

async function markPretradeBlocked(supabase: any, id: string, code: string) {
  await supabase
    .from("controlled_retest_authorisations")
    .update({ outcome: "pretrade_blocked", outcome_retcode: null, outcome_payload: { code } })
    .eq("id", id);
  return json({ success: false, step: "pretrade", outcome: "pretrade_blocked", code }, 200);
}
