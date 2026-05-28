// Final lifecycle validation — controlled close dispatcher.
// Atomically consumes the single permitted close dispatch from
// `lifecycle_validation_authorisations` BEFORE invoking
// `close-position-controlled` for the exact confirmed position ticket.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "LIFECYCLE_CLOSE_DISPATCH_V1_2026_05_27";

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
  const { data: roleRow } = await supabase.from("user_roles")
    .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ success: false, error: "ADMIN_REQUIRED" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const authorisationId = String(body?.authorisationId ?? "");
  const requestedTicket = body?.ticket != null ? String(body.ticket) : null;
  if (!authorisationId || !requestedTicket) {
    return json({ success: false, version: VERSION, error: "authorisationId and ticket required" }, 400);
  }

  const { data: row } = await supabase
    .from("lifecycle_validation_authorisations").select("*").eq("id", authorisationId).maybeSingle();
  if (!row) return json({ success: false, version: VERSION, error: "AUTHORISATION_NOT_FOUND" }, 404);
  if (row.status !== "position_confirmed_close_only") {
    return json({ success: false, version: VERSION, error: "NOT_IN_CLOSE_ONLY_STATE", status: row.status }, 409);
  }
  if (row.close_dispatches_consumed >= row.maximum_close_dispatches) {
    return json({ success: false, version: VERSION, error: "CLOSE_DISPATCH_EXHAUSTED" }, 409);
  }
  if (!row.confirmed_position_ticket || row.confirmed_position_ticket !== requestedTicket) {
    return json({ success: false, version: VERSION, error: "TICKET_MISMATCH" }, 409);
  }

  // Atomically consume the close dispatch BEFORE mutation
  const { data: consumed } = await supabase
    .from("lifecycle_validation_authorisations")
    .update({
      status: "close_dispatch_consumed",
      close_consumed_at: new Date().toISOString(),
      close_dispatches_consumed: row.close_dispatches_consumed + 1,
    })
    .eq("id", authorisationId)
    .eq("status", "position_confirmed_close_only")
    .eq("close_dispatches_consumed", row.close_dispatches_consumed)
    .select()
    .maybeSingle();
  if (!consumed) return json({ success: false, version: VERSION, error: "DISPATCH_LOCK_FAILED" }, 409);

  // Call close-position-controlled (authoritative close path)
  const closePayload = {
    closeId: `lifecycle-close-${authorisationId}`,
    ticket: row.confirmed_position_ticket,
    symbol: row.display_symbol,
    brokerSymbol: row.broker_symbol,
    openSide: row.entry_side,
    volume: Number(row.entry_volume),
    liveCloseConfirmed: true,
    clientClickAt: new Date().toISOString(),
  };

  let resBody: any = null;
  let httpStatus = 0;
  let networkError: string | null = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/close-position-controlled`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(closePayload),
    });
    httpStatus = r.status;
    const t = await r.text();
    try { resBody = JSON.parse(t); } catch { resBody = { rawText: t }; }
  } catch (e) { networkError = e instanceof Error ? e.message : String(e); }

  const brokerCloseMutationDispatched = resBody?.brokerCloseMutationDispatched === true;
  const accepted = !networkError && resBody?.success === true && brokerCloseMutationDispatched && !!resBody?.requestId;

  await supabase.from("lifecycle_validation_authorisations").update({
    status: accepted ? "awaiting_close_confirmation" : "failed_close_rejected",
    close_order_id: resBody?.orderId ? String(resBody.orderId) : null,
    close_deal_id: resBody?.dealId ? String(resBody.dealId) : null,
    close_retcode: resBody?.retcode ?? null,
    close_evidence: { httpStatus, request: closePayload, response: resBody, networkError, brokerCloseMutationDispatched, dispatchedAt: new Date().toISOString() },
    failure_reason: accepted ? null : (networkError || resBody?.retcodeDescription || resBody?.error || "CLOSE_REJECTED_OR_UNCONFIRMED"),
  }).eq("id", authorisationId);

  return json({
    success: accepted, version: VERSION, authorisationId,
    closeResult: resBody,
    status: accepted ? "awaiting_close_confirmation" : "failed_close_rejected",
    warning: accepted ? null : "Platform close is not confirmed. Close this exact test position manually in native MT5 immediately if it remains open.",
  });
});
