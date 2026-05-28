// Final lifecycle validation — controlled entry dispatcher.
// Atomically consumes the single permitted entry dispatch from
// `lifecycle_validation_authorisations` BEFORE calling Trading Layer.
// Posts the strict minimal DTO {side,symbol,volume} to
// /api/v1/accounts/{routeAccountId}/trades/send. No retry. No reuse.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveActiveMtMapping } from "../_shared/mtMapping.ts";
import { assertLiveExecutionAllowed } from "../_shared/executionMode.ts";
import { resolveVerifiedExecutionInstrument } from "../_shared/executionInstrument.ts";
import { resolveFreshExecutionTick } from "../_shared/freshTick.ts";
import { loadRiskSettings, loadDailyUsage, checkOpenRisk } from "../_shared/risk.ts";
import { sideToOperation } from "../_shared/tradingLayerTradeMode.ts";

const VERSION = "LIFECYCLE_ENTRY_DISPATCH_V1_2026_05_27";
const BASE_URL = "https://api.trading-layer.com";
const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const pick = (obj: any, paths: string[]) => {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => acc && typeof acc === "object" ? acc[key] : undefined, obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const mask = (value: string) => value.length <= 8 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;

async function markPretradeBlocked(supabase: any, authorisationId: string, details: Record<string, unknown>) {
  const blockedAt = new Date().toISOString();
  const evidence = {
    outcome: "pretrade_blocked",
    brokerMutationDispatched: false,
    mutationDispatched: false,
    blockedAt,
    ...details,
  };
  await supabase.from("lifecycle_validation_authorisations").update({
    status: "review_required_pretrade_block",
    classification: "lifecycle_entry_pretrade_blocked_non_reusable",
    failure_reason: String(details.blockedCode ?? details.error ?? "PRETRADE_BLOCKED"),
    entry_evidence: evidence,
    maximum_entry_dispatches: 0,
    maximum_close_dispatches: 0,
    updated_at: blockedAt,
  }).eq("id", authorisationId);
  return json({ success: false, version: VERSION, outcome: "pretrade_blocked", ...evidence }, 200);
}

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
  const { data: roleRow } = await supabase.from("user_roles")
    .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ success: false, error: "ADMIN_REQUIRED" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const authorisationId = String(body?.authorisationId ?? "");
  if (!authorisationId) return json({ success: false, version: VERSION, error: "authorisationId required" }, 400);

  // Load authorisation row
  const { data: row, error: rowErr } = await supabase
    .from("lifecycle_validation_authorisations").select("*").eq("id", authorisationId).maybeSingle();
  if (rowErr || !row) return json({ success: false, version: VERSION, error: "AUTHORISATION_NOT_FOUND" }, 404);
  if (row.status !== "armed") {
    return json({ success: false, version: VERSION, error: "AUTHORISATION_NOT_ARMED", status: row.status }, 409);
  }
  if (row.entry_dispatches_consumed >= row.maximum_entry_dispatches) {
    return json({ success: false, version: VERSION, error: "ENTRY_DISPATCH_EXHAUSTED" }, 409);
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from("lifecycle_validation_authorisations")
      .update({ status: "expired", failure_reason: "EXPIRED_BEFORE_DISPATCH" }).eq("id", authorisationId);
    return json({ success: false, version: VERSION, error: "AUTHORISATION_EXPIRED" }, 409);
  }

  // Rerun all checks independently — use the SAME authoritative resolver
  // contract ("valid" | "stale" | "missing") used by the successful
  // controlled-retest entry path. Do NOT invent a separate vocabulary.
  const mapping = await resolveActiveMtMapping(supabase, user.id);
  if (mapping.status !== "valid" || !mapping.traderId) {
    return await markPretradeBlocked(supabase, authorisationId, {
      blockedStage: "mapping_validation",
      blockedCode: mapping.status === "missing" ? "MAPPING_NOT_FOUND" : "MAPPING_NOT_VALID",
      mappingStatus: mapping.status,
    });
  }
  if (mapping.tradingLayerAccountId !== row.route_account_id) {
    return json({
      success: false,
      version: VERSION,
      error: "ROUTE_ACCOUNT_MISMATCH",
      expectedRouteAccountId: row.route_account_id,
      actualRouteAccountId: mapping.tradingLayerAccountId,
    }, 409);
  }
  const gate = await assertLiveExecutionAllowed(supabase, user.id, { traderId: mapping.traderId, login: mapping.login });
  if (!gate.allowed) return await markPretradeBlocked(supabase, authorisationId, { blockedStage: "execution_mode_gate", blockedCode: gate.code || "EXECUTION_MODE_BLOCKED" });

  const op = sideToOperation(row.entry_side, "market");
  const v = await resolveVerifiedExecutionInstrument(supabase, {
    userId: user.id, displaySymbol: row.display_symbol, operation: op, expectedBrokerSymbol: row.broker_symbol,
  });
  if (!v.success || !v.brokerSymbol || v.tradeAllowed !== true || !v.operationEligible) {
    return await markPretradeBlocked(supabase, authorisationId, { blockedStage: "pretrade_resolution", blockedCode: v.errorCode || "PRETRADE_BLOCKED" });
  }

  try {
    const settings = await loadRiskSettings(supabase, user.id);
    const usage = await loadDailyUsage(supabase, user.id);
    const breach = checkOpenRisk({ symbol: row.display_symbol, volume: Number(row.entry_volume) }, settings, usage);
    if (breach) return await markPretradeBlocked(supabase, authorisationId, { blockedStage: "risk_validation", blockedCode: String(breach.reason || "RISK_BLOCKED") });
  } catch { /* best effort */ }

  const ft = await resolveFreshExecutionTick({
    routeAccountId: v.routeAccountId, brokerSymbol: v.brokerSymbol, displaySymbol: row.display_symbol,
  });
  if (!ft.fresh) return await markPretradeBlocked(supabase, authorisationId, { blockedStage: "fresh_tick", blockedCode: ft.code || "FRESH_TICK_UNAVAILABLE", freshTickAgeMs: ft.ageMs });

  // Atomically consume the entry dispatch BEFORE mutation
  const { data: consumed, error: consumeErr } = await supabase
    .from("lifecycle_validation_authorisations")
    .update({
      status: "entry_dispatch_consumed",
      entry_consumed_at: new Date().toISOString(),
      entry_dispatches_consumed: row.entry_dispatches_consumed + 1,
    })
    .eq("id", authorisationId)
    .eq("status", "armed")
    .eq("entry_dispatches_consumed", row.entry_dispatches_consumed)
    .select()
    .maybeSingle();
  if (consumeErr || !consumed) {
    return json({ success: false, version: VERSION, error: "DISPATCH_LOCK_FAILED" }, 409);
  }

  // Dispatch
  const dto = { side: row.entry_side, symbol: row.broker_symbol, volume: Number(row.entry_volume) };
  const idempotencyKey = `lifecycle-entry-${authorisationId}`;
  const startedAt = Date.now();
  let httpStatus = 0, res: any = null, networkError: string | null = null;
  try {
    const r = await fetch(`${BASE_URL}/api/v1/accounts/${row.route_account_id}/trades/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRADING_LAYER_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(dto),
    });
    httpStatus = r.status;
    const t = await r.text();
    try { res = JSON.parse(t); } catch { res = { rawText: t }; }
  } catch (e) { networkError = e instanceof Error ? e.message : String(e); }
  const latencyMs = Date.now() - startedAt;

  const result = res?.data ?? res?.result ?? res;
  const retcodeRaw = pick(result, ["retcode", "result.retcode", "trade.retcode", "order.retcode"]);
  const retcode = retcodeRaw != null ? Number(retcodeRaw) : null;
  const retcodeName = pick(result, ["retcode_name", "retcodeName", "result.retcode_name", "trade.retcode_name", "order.retcode_name"]);
  const retcodeDescription = pick(result, ["retcode_description", "retcodeDescription", "comment", "message", "result.retcode_description", "trade.retcode_description", "order.retcode_description"]);
  const classification = String(pick(result, ["classification", "result.classification", "trade.classification", "order.classification"]) ?? "").toLowerCase() || null;
  const accepted = !networkError && httpStatus >= 200 && httpStatus < 300
    && (retcode === 10008 || retcode === 10009 || res?.success === true || classification === "placed" || classification === "done");

  const orderId = pick(result, ["orderId", "order_id", "order", "result.order", "trade.order", "order.ticket"]);
  const dealId = pick(result, ["dealId", "deal_id", "deal", "result.deal", "trade.deal", "deal.ticket"]);
  const positionTicket = pick(result, ["positionTicket", "position_ticket", "position.id", "position.ticket", "result.positionTicket"]);
  const requestId = res?.requestId ?? res?.request_id ?? null;
  const evidenceMissing = !networkError && httpStatus >= 200 && httpStatus < 300 && !accepted && retcode == null && !classification;
  const finalStatus = accepted
    ? "awaiting_position_confirmation"
    : evidenceMissing
      ? "execution_evidence_missing_under_investigation"
      : "failed_entry_rejected";

  await supabase.from("lifecycle_validation_authorisations").update({
    status: finalStatus,
    entry_order_id: orderId ? String(orderId) : null,
    entry_request_id: requestId ? String(requestId) : null,
    entry_retcode: retcode,
    classification: accepted ? "lifecycle_entry_accepted_awaiting_reconciliation" : evidenceMissing ? "execution_evidence_missing_under_investigation" : (classification || "lifecycle_entry_rejected"),
    entry_evidence: {
      httpStatus, latencyMs, request: dto, response: res, networkError,
      brokerMutationDispatched: true,
      mutationDispatched: true,
      endpointPath: `/api/v1/accounts/${row.route_account_id}/trades/send`,
      method: "POST",
      routeAccountId: row.route_account_id,
      idempotencyKeyPresent: true,
      idempotencyKeyMasked: mask(idempotencyKey),
      retcode,
      retcodeName,
      retcodeDescription,
      classification,
      orderId: orderId ? String(orderId) : null,
      dealId: dealId ? String(dealId) : null,
      positionTicket: positionTicket ? String(positionTicket) : null,
      requestId: requestId ? String(requestId) : null,
      dispatchedAt: new Date().toISOString(),
    },
    failure_reason: accepted ? null : evidenceMissing ? "EXECUTION_EVIDENCE_MISSING_UNDER_INVESTIGATION" : (networkError || String(retcodeDescription || retcodeName || res?.brokerMessage || res?.message || "ENTRY_REJECTED")),
  }).eq("id", authorisationId);

  return json({
    success: accepted, version: VERSION, authorisationId,
    orderId, dealId, positionTicket, requestId, retcode, retcodeName, retcodeDescription, classification, latencyMs,
    brokerMutationDispatched: true,
    outboundBody: dto,
    status: finalStatus,
    error: accepted ? null : evidenceMissing ? "EXECUTION_EVIDENCE_MISSING_UNDER_INVESTIGATION" : (String(retcodeDescription || retcodeName || networkError || "ENTRY_REJECTED")),
  });
});
