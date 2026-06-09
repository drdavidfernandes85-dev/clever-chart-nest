// Public endpoint hit by user MT4/MT5 Expert Advisors.
// Authenticated via a per-user secret token sent in the Authorization header.
// Token is verified against the SHA-256 hash stored in `mt_webhook_tokens`.
//
// Accepted POST payloads:
//  { type: "account",   account, balance, equity, margin, free_margin, ... }
//  { type: "positions", account, positions: [...] }
//  { type: "poll_orders", account }                             → returns pending orders to execute
//  { type: "order_result", order_id, status, ticket?, message? } → EA reports back after execution
//
// `user_id` from the EA is informational only — the authenticated user is derived from the token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logSecurityEvent, ipFrom, verifyTimestamp, reserveNonce } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-mt-timestamp, x-mt-nonce",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIMESTAMP_SKEW_SECONDS = 300; // ±5 min

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Accept the EA webhook token ONLY via headers. Previously we also accepted
// it as `?token=` / `?secret=` / `?access_token=` query params, which leaks
// the credential into proxy/access logs and browser histories. Header-only
// matches industry practice for bearer credentials.
function tokenFromRequest(req: Request): string | null {
  const directHeader =
    req.headers.get("x-webhook-token") ?? req.headers.get("x-api-key");
  if (directHeader?.trim()) return directHeader.trim();

  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

function tokenFromBody(body: unknown): string | null {
  // deno-lint-ignore no-explicit-any
  const b = body as any;
  const value =
    b?.token ?? b?.secret_token ?? b?.SecretToken ?? b?.api_key;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mt5SideToJournalDirection(t: number | string): "long" | "short" {
  // MQL5 ENUM_POSITION_TYPE: 0 = BUY, 1 = SELL
  // trade_journal.direction expects 'long' | 'short'
  const n = typeof t === "string" ? parseInt(t, 10) : t;
  return n === 1 ? "short" : "long";
}

function normalizePositionSide(value: unknown): "buy" | "sell" | null {
  // mt_positions.side check constraint requires 'buy' | 'sell'.
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "buy" || raw === "long" || raw === "position_type_buy" || raw === "0") return "buy";
  if (raw === "sell" || raw === "short" || raw === "position_type_sell" || raw === "1") return "sell";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // Optional but recommended replay protection: when the EA sends
  // `x-mt-timestamp` (and ideally `x-mt-nonce`), we enforce a skew window
  // and reject reused nonces. Tokens-only requests still work for backward
  // compatibility, but new EA builds should send these headers.
  const tsHeader = req.headers.get("x-mt-timestamp");
  if (tsHeader) {
    const tsCheck = verifyTimestamp(tsHeader, TIMESTAMP_SKEW_SECONDS);
    if (!tsCheck.ok) {
      await logSecurityEvent({
        event_type: "mt_webhook_bad_timestamp",
        severity: "warn",
        source: "mt-webhook",
        ip: ipFrom(req),
        details: { reason: tsCheck.reason, ts: tsHeader },
      });
      return json(401, { error: `timestamp ${tsCheck.reason}` });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const rawToken = tokenFromBody(body) ?? tokenFromRequest(req);
  if (!rawToken) {
    await logSecurityEvent({
      event_type: "mt_webhook_missing_token",
      severity: "warn",
      source: "mt-webhook",
      ip: ipFrom(req),
    });
    return json(401, { error: "Missing webhook token" });
  }
  if (rawToken.length < 16) {
    await logSecurityEvent({
      event_type: "mt_webhook_bad_token",
      severity: "warn",
      source: "mt-webhook",
      ip: ipFrom(req),
      details: { reason: "too_short" },
    });
    return json(401, { error: "Invalid token" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tokenHash = await sha256Hex(rawToken);
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("mt_webhook_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    await logSecurityEvent({
      event_type: "mt_webhook_bad_token",
      severity: "error",
      source: "mt-webhook",
      ip: ipFrom(req),
      details: { reason: "not_found", db_error: tokenErr?.message },
    });
    return json(401, { error: "Invalid token" });
  }
  if (tokenRow.revoked_at) {
    await logSecurityEvent({
      event_type: "mt_webhook_revoked_token",
      severity: "error",
      source: "mt-webhook",
      ip: ipFrom(req),
      subject_user_id: tokenRow.user_id,
    });
    return json(401, { error: "Token revoked" });
  }

  // Nonce dedup (only enforced when EA sends x-mt-nonce + x-mt-timestamp)
  const nonceHeader = req.headers.get("x-mt-nonce");
  if (nonceHeader && tsHeader) {
    const fresh = await reserveNonce(
      `mt_webhook:${tokenRow.user_id}`,
      nonceHeader,
      TIMESTAMP_SKEW_SECONDS * 2,
    );
    if (!fresh) {
      await logSecurityEvent({
        event_type: "mt_webhook_replay",
        severity: "error",
        source: "mt-webhook",
        ip: ipFrom(req),
        subject_user_id: tokenRow.user_id,
        details: { nonce: nonceHeader },
      });
      return json(409, { error: "replay detected" });
    }
  }

  const userId: string = tokenRow.user_id;

  // Update last_used (fire-and-forget — don't block response)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ?? null;
  supabase
    .from("mt_webhook_tokens")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
    .eq("id", tokenRow.id)
    .then(() => {});

  const type = body?.type;
  const accountLogin = String(body?.account ?? "").trim();

  // --- order_result: EA reporting back after attempting an order ---
  // No account match required — the order_id is enough.
  if (type === "order_result") {
    const orderId = String(body?.order_id ?? "").trim();
    if (!orderId) return json(400, { error: "Missing order_id" });

    const status = String(body?.status ?? "executed").toLowerCase();
    const safeStatus = ["executed", "failed"].includes(status) ? status : "failed";
    const ticket = body?.ticket != null ? String(body.ticket) : null;
    const message = body?.message != null ? String(body.message).slice(0, 500) : null;

    const { error: updErr } = await supabase
      .from("mt_pending_orders")
      .update({
        status: safeStatus,
        ea_ticket: ticket,
        ea_message: message,
        executed_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("user_id", userId);

    if (updErr) {
      console.error("mt-webhook: order_result update error", updErr);
      return json(500, { error: "Could not update order" });
    }
    return json(200, { ok: true, type: "order_result" });
  }

  if (!accountLogin && type !== "poll_orders") {
    return json(400, { error: "Missing `account` (MT login number)" });
  }

  // Find or create the matching user_mt_accounts row (when we have a login).
  let accountRowId: string | undefined;
  if (accountLogin) {
    const { data: existingAcc } = await supabase
      .from("user_mt_accounts")
      .select("id, status")
      .eq("user_id", userId)
      .eq("login", accountLogin)
      .maybeSingle();

    accountRowId = existingAcc?.id;
    if (!accountRowId) {
      const { data: created, error: createErr } = await supabase
        .from("user_mt_accounts")
        .insert({
          user_id: userId,
          login: accountLogin,
          platform: body?.platform ?? "mt5",
          broker_name: body?.broker ?? "Connected via EA",
          server_name: body?.server ?? "EA Webhook",
          account_type: "live",
          status: "connected",
          status_message: "Receiving live data from EA",
          currency: body?.currency ?? "USD",
          leverage: body?.leverage ?? null,
        })
        .select("id")
        .single();
      if (createErr) {
        console.error("mt-webhook: create account error", createErr);
        return json(500, { error: "Could not create account record" });
      }
      accountRowId = created.id;
    }
  }

  // --- poll_orders: EA asks "do I have any trades to place right now?" ---
  if (type === "poll_orders") {
    const { data: pending, error: pendErr } = await supabase
      .from("mt_pending_orders")
      .select(
        "id, symbol, side, order_type, volume, entry_price, stop_loss, take_profit",
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(10);

    if (pendErr) {
      console.error("mt-webhook: poll_orders fetch error", pendErr);
      return json(500, { error: "Could not fetch pending orders" });
    }

    const orders = pending ?? [];
    if (orders.length > 0) {
      // Mark them as "sent" so we don't deliver them twice.
      const ids = orders.map((o) => o.id);
      await supabase
        .from("mt_pending_orders")
        .update({ status: "sent", fetched_at: new Date().toISOString() })
        .in("id", ids);
    }

    return json(200, { ok: true, type: "poll_orders", orders });
  }

  if (type === "account") {
    const balance = Number(body?.balance ?? 0);
    const equity = Number(body?.equity ?? 0);
    const margin = body?.margin != null ? Number(body.margin) : null;
    const freeMargin = body?.free_margin != null ? Number(body.free_margin) : null;

    const { error: updErr } = await supabase
      .from("user_mt_accounts")
      .update({
        balance,
        equity,
        margin,
        free_margin: freeMargin,
        currency: body?.currency ?? undefined,
        leverage: body?.leverage ?? undefined,
        status: "connected",
        status_message: "Live via EA webhook",
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", accountRowId);
    if (updErr) {
      console.error("mt-webhook: update account error", updErr);
      return json(500, { error: "Could not update account" });
    }

    await supabase.from("mt_account_snapshots").insert({
      user_id: userId,
      account_id: accountRowId,
      balance,
      equity,
      margin,
    });

    return json(200, { ok: true, type: "account" });
  }

  if (type === "positions") {
    // mt_positions writes have been removed. The EA still pushes open
    // positions but we no longer persist them — the UI reads live positions
    // from Trading Layer directly. We acknowledge the payload so the EA
    // doesn't retry.
    const incoming: any[] = Array.isArray(body?.positions) ? body.positions : [];
    return json(200, {
      ok: true,
      type: "positions",
      received: incoming.length,
      stored: 0,
      note: "mt_positions disabled; live data sourced from Trading Layer",
    });
  }


  // --- deals: EA pushes closed trade history (idempotent on ticket) ---
  // Payload: { type:"deals", account, deals: [
  //   { ticket, symbol, type (0=buy,1=sell), volume, entry, exit, profit,
  //     commission, swap, opened_at (unix sec), closed_at (unix sec) }
  // ]}
  if (type === "deals") {
    const incoming: any[] = Array.isArray(body?.deals) ? body.deals : [];
    if (incoming.length === 0) {
      return json(200, { ok: true, type: "deals", inserted: 0 });
    }

    const tickets = incoming
      .map((d) => (d?.ticket != null ? String(d.ticket) : null))
      .filter((t): t is string => !!t);

    // Find which tickets we already logged for this user (idempotency)
    const { data: existingRows } = await supabase
      .from("trade_journal")
      .select("notes")
      .eq("user_id", userId)
      .like("notes", "%Ticket #%");

    const existingTickets = new Set<string>();
    for (const r of existingRows ?? []) {
      const m = String(r.notes ?? "").match(/Ticket #(\d+)/);
      if (m) existingTickets.add(m[1]);
    }

    const rowsToInsert: any[] = [];
    for (const d of incoming) {
      const ticket = d?.ticket != null ? String(d.ticket) : null;
      if (!ticket || existingTickets.has(ticket)) continue;

      const side = mt5SideToJournalDirection(d?.type ?? 0);
      const volume = Number(d?.volume ?? 0);
      const entry = Number(d?.entry ?? d?.open_price ?? 0);
      const exit =
        d?.exit != null ? Number(d.exit) :
        d?.close_price != null ? Number(d.close_price) : null;
      const profit = d?.profit != null ? Number(d.profit) : 0;
      const commission = d?.commission != null ? Number(d.commission) : 0;
      const swap = d?.swap != null ? Number(d.swap) : 0;
      const pnl = profit + commission + swap;

      const openedAt =
        d?.opened_at && Number(d.opened_at) > 0
          ? new Date(Number(d.opened_at) * 1000).toISOString()
          : null;
      const closedAt =
        d?.closed_at && Number(d.closed_at) > 0
          ? new Date(Number(d.closed_at) * 1000).toISOString()
          : new Date().toISOString();

      rowsToInsert.push({
        user_id: userId,
        pair: String(d?.symbol ?? ""),
        direction: side,
        entry_price: entry,
        exit_price: exit,
        position_size: volume,
        pnl,
        status: "closed",
        opened_at: openedAt,
        closed_at: closedAt,
        setup_tag: "ea-webhook",
        notes: `Auto-logged from MT EA history. Ticket #${ticket}.`,
      });

      // mt_positions write removed.

    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from("trade_journal")
        .insert(rowsToInsert);
      if (insertErr) {
        console.error("mt-webhook: deals insert error", insertErr);
        return json(500, { error: "Could not log deals" });
      }
    }

    return json(200, {
      ok: true,
      type: "deals",
      received: incoming.length,
      inserted: rowsToInsert.length,
      skipped: incoming.length - rowsToInsert.length,
    });
  }

  return json(400, { error: `Unknown payload type: ${type}` });
});
