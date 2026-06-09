// Trading Layer webhook receiver.
//
// IMPORTANT: Webhooks are for EVENT/LIFECYCLE updates only.
// Never treat webhook payloads as live price ticks. Price/quote data must
// come from the centralized polling service (MarketDataService) until
// Trading Layer confirms a real WebSocket/SSE quote stream.
//
// Handled event types (best-effort — store raw for everything):
//   trader.mt5_connected
//   trader.mt5_disconnected
//   trader.mt5_failed
//   signal.action.executed
//   signal.action.failed
//   order.* / position.* (stored, lightly reconciled)
//
// Optional HMAC verification: if TRADING_LAYER_WEBHOOK_SECRET is set,
// the request body is verified against the `x-tl-signature` header
// (sha256=hex). Requests with a bad signature are rejected with 401.
// If no secret is configured we accept and flag signature_provided=false.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { logSecurityEvent, ipFrom, verifyTimestamp, reserveNonce } from "../_shared/security.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-tl-signature, x-tl-event, x-tl-event-id, x-tl-timestamp",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VERSION = "trading-layer-webhook@1.1.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("TRADING_LAYER_WEBHOOK_SECRET") || "";
const TIMESTAMP_SKEW_SECONDS = 300; // ±5 min

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHmac(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false; // no secret configured → not verified
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare
  if (hex.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hex.length; i++) mismatch |= hex.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}

function pick(obj: any, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((acc, part) => (acc == null ? acc : acc[part]), obj);
    if (v != null && v !== "") return String(v);
  }
  return null;
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (k.toLowerCase() === "authorization" || k.toLowerCase() === "cookie") return;
    out[k] = v;
  });
  return out;
}

async function processEvent(
  eventId: string,
  eventType: string,
  payload: any,
): Promise<{ ok: boolean; note?: string; error?: string }> {
  try {
    // ── Trader / MT5 lifecycle events ──────────────────────────────────────
    if (eventType.startsWith("trader.mt5_")) {
      const traderId = pick(payload, "trader_id", "traderId", "trader.id", "data.trader_id");
      const login = pick(payload, "mt5_login", "login", "data.login", "trader.login");

      let nextStatus: string | null = null;
      let statusMessage: string | null = null;
      if (eventType === "trader.mt5_connected") nextStatus = "connected";
      else if (eventType === "trader.mt5_disconnected") nextStatus = "disconnected";
      else if (eventType === "trader.mt5_failed") {
        nextStatus = "failed";
        statusMessage =
          pick(payload, "error", "message", "reason", "data.error") || "MT5 connection failed";
      }

      if (nextStatus && login) {
        const update: Record<string, unknown> = {
          status: nextStatus,
          last_synced_at: new Date().toISOString(),
        };
        if (statusMessage) update.status_message = statusMessage;
        const { error } = await supabase
          .from("user_mt_accounts")
          .update(update)
          .eq("login", login);
        if (error) return { ok: false, error: `account update failed: ${error.message}` };
        return { ok: true, note: `account login=${login} → ${nextStatus}` };
      }
      return { ok: true, note: "trader event stored (no matching account)" };
    }

    // ── Signal execution events ────────────────────────────────────────────
    if (eventType === "signal.action.executed" || eventType === "signal.action.failed") {
      const signalId = pick(payload, "signal_id", "signalId", "data.signal_id", "signal.id");
      const ticket = pick(payload, "ticket", "position_id", "data.ticket", "result.position");
      const retcode = Number(pick(payload, "retcode", "data.retcode", "result.retcode")) || null;

      // Only update audit if we can match an existing log row.
      if (signalId) {
        const { data: matches } = await supabase
          .from("trade_execution_logs")
          .select("id, status")
          .eq("signal_id", signalId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (matches && matches.length > 0) {
          const update: Record<string, unknown> = {};
          if (ticket) update.ticket = ticket;
          if (retcode != null) update.retcode = retcode;
          if (eventType === "signal.action.executed") update.status = "executed";
          else update.status = "failed";
          if (Object.keys(update).length > 0) {
            await supabase
              .from("trade_execution_logs")
              .update(update)
              .eq("id", matches[0].id);
          }
          return { ok: true, note: `reconciled execution log ${matches[0].id}` };
        }
      }
      return { ok: true, note: "signal event stored (no matching execution log)" };
    }

    // ── Anything else: store only, never treat as a price tick ─────────────
    return { ok: true, note: "stored (no automated reconciliation)" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, version: VERSION, error: "POST only" }, 405);

  // 🚨 HARD-FAIL when secret is unset. Previously this silently accepted
  // unsigned webhooks, allowing anyone to POST forged trading events.
  if (!WEBHOOK_SECRET) {
    await logSecurityEvent({
      event_type: "tl_webhook_missing_secret",
      severity: "critical",
      source: "trading-layer-webhook",
      ip: ipFrom(req),
      user_agent: req.headers.get("user-agent"),
      details: { reason: "TRADING_LAYER_WEBHOOK_SECRET not configured" },
    });
    return json(
      { ok: false, version: VERSION, error: "webhook secret not configured" },
      503,
    );
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-tl-signature");
  const tsHeader = req.headers.get("x-tl-timestamp");
  const signatureProvided = Boolean(signatureHeader);

  // Timestamp skew check (replay defense, coarse window).
  const tsCheck = verifyTimestamp(tsHeader, TIMESTAMP_SKEW_SECONDS);
  if (!tsCheck.ok) {
    await logSecurityEvent({
      event_type: "tl_webhook_bad_timestamp",
      severity: "warn",
      source: "trading-layer-webhook",
      ip: ipFrom(req),
      details: { reason: tsCheck.reason, ts: tsHeader },
    });
    return json({ ok: false, version: VERSION, error: `timestamp ${tsCheck.reason}` }, 401);
  }

  // HMAC over `<timestamp>.<body>` (binds signature to timestamp so an
  // attacker can't replay an old body with a new timestamp).
  const signedPayload = `${tsHeader}.${rawBody}`;
  const signatureValid = await verifyHmac(signedPayload, signatureHeader);
  if (!signatureValid) {
    await supabase.from("trading_layer_webhook_events").insert({
      event_type: req.headers.get("x-tl-event") || "unknown",
      event_id: req.headers.get("x-tl-event-id"),
      signature_provided: signatureProvided,
      signature_valid: false,
      processing_status: "rejected_invalid_signature",
      processing_error: "HMAC signature mismatch",
      raw_payload: safeJsonParse(rawBody),
      raw_headers: headersToObject(req.headers),
    });
    await logSecurityEvent({
      event_type: "tl_webhook_bad_signature",
      severity: "error",
      source: "trading-layer-webhook",
      ip: ipFrom(req),
      details: {
        event_id: req.headers.get("x-tl-event-id"),
        event_type: req.headers.get("x-tl-event"),
      },
    });
    return json({ ok: false, version: VERSION, error: "invalid signature" }, 401);
  }

  // Replay defense: reject reused event_id within the timestamp window.
  const eventIdHeader = req.headers.get("x-tl-event-id");
  if (eventIdHeader) {
    const fresh = await reserveNonce(
      "trading_layer",
      eventIdHeader,
      TIMESTAMP_SKEW_SECONDS * 2,
    );
    if (!fresh) {
      await logSecurityEvent({
        event_type: "tl_webhook_replay",
        severity: "error",
        source: "trading-layer-webhook",
        ip: ipFrom(req),
        details: { event_id: eventIdHeader },
      });
      return json({ ok: false, version: VERSION, error: "replay detected" }, 409);
    }
  }

  const payload = safeJsonParse(rawBody);
  const eventType =
    pick(payload, "event", "type", "event_type") ||
    req.headers.get("x-tl-event") ||
    "unknown";
  const eventId =
    pick(payload, "id", "event_id") || req.headers.get("x-tl-event-id") || crypto.randomUUID();

  const { data: inserted, error: insertErr } = await supabase
    .from("trading_layer_webhook_events")
    .insert({
      event_type: eventType,
      event_id: eventId,
      trader_id: pick(payload, "trader_id", "traderId", "data.trader_id", "trader.id"),
      account_id: pick(payload, "account_id", "accountId", "data.account_id"),
      signal_id: pick(payload, "signal_id", "signalId", "data.signal_id"),
      ticket: pick(payload, "ticket", "position_id", "data.ticket"),
      signature_provided: signatureProvided,
      signature_valid: signatureValid,
      processing_status: "received",
      raw_payload: payload,
      raw_headers: headersToObject(req.headers),
    })
    .select("id")
    .single();

  if (insertErr) {
    return json({ ok: false, version: VERSION, error: insertErr.message }, 500);
  }

  const result = await processEvent(eventId, eventType, payload);

  await supabase
    .from("trading_layer_webhook_events")
    .update({
      processing_status: result.ok ? "processed" : "error",
      processing_error: result.error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", inserted!.id);

  return json({
    ok: true,
    version: VERSION,
    eventType,
    eventId,
    stored: inserted!.id,
    processed: result.ok,
    note: result.note,
    error: result.error,
  });
});

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return { _unparsed: s };
  }
}
