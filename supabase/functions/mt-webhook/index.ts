// Public endpoint hit by user MT4/MT5 Expert Advisors.
// Authenticated via a per-user secret token sent in the Authorization header.
// Token is verified against the SHA-256 hash stored in `mt_webhook_tokens`.
//
// Accepted payloads:
//  { type: "account",   user_id?, account, balance, equity, margin, free_margin, currency?, leverage?, broker?, server?, platform?, timestamp? }
//  { type: "positions", user_id?, account, positions: [{ ticket, symbol, type, volume, entry, sl, tp, profit, time }] }
//
// `user_id` from the EA is informational only — the authenticated user is derived from the token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function mt5SideToString(t: number | string): "buy" | "sell" {
  // MQL5 ENUM_POSITION_TYPE: 0 = BUY, 1 = SELL
  // MQL4 OP_BUY = 0, OP_SELL = 1
  const n = typeof t === "string" ? parseInt(t, 10) : t;
  return n === 1 ? "sell" : "buy";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "Missing bearer token" });
  }
  const rawToken = auth.slice(7).trim();
  if (rawToken.length < 16) {
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
    console.warn("mt-webhook: token not found", tokenErr?.message);
    return json(401, { error: "Invalid token" });
  }
  if (tokenRow.revoked_at) {
    return json(401, { error: "Token revoked" });
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const type = body?.type;
  const accountLogin = String(body?.account ?? "").trim();
  if (!accountLogin) {
    return json(400, { error: "Missing `account` (MT login number)" });
  }

  // Find or create the matching user_mt_accounts row
  const { data: existingAcc } = await supabase
    .from("user_mt_accounts")
    .select("id, status")
    .eq("user_id", userId)
    .eq("login", accountLogin)
    .maybeSingle();

  let accountRowId = existingAcc?.id;
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
    const incoming: any[] = Array.isArray(body?.positions) ? body.positions : [];

    // Snapshot of currently-stored open positions for this account
    const { data: previous } = await supabase
      .from("mt_positions")
      .select("ticket, symbol, side, volume, open_price, opened_at, profit")
      .eq("account_id", accountRowId);

    const incomingTickets = new Set(incoming.map((p) => String(p.ticket)));
    const previousByTicket = new Map(
      (previous ?? []).map((p) => [String(p.ticket), p]),
    );

    // Upsert each open position
    for (const p of incoming) {
      const ticket = String(p.ticket);
      const side = mt5SideToString(p.type);
      const openPrice = Number(p.entry ?? p.open_price ?? 0);
      const volume = Number(p.volume ?? 0);
      const symbol = String(p.symbol ?? "");
      const sl = p.sl != null ? Number(p.sl) : null;
      const tp = p.tp != null ? Number(p.tp) : null;
      const profit = p.profit != null ? Number(p.profit) : 0;
      const openedAt =
        p.time && Number(p.time) > 0
          ? new Date(Number(p.time) * 1000).toISOString()
          : new Date().toISOString();

      const existing = previousByTicket.get(ticket);
      if (existing) {
        await supabase
          .from("mt_positions")
          .update({
            symbol,
            side,
            volume,
            open_price: openPrice,
            stop_loss: sl,
            take_profit: tp,
            profit,
            updated_at: new Date().toISOString(),
          })
          .eq("account_id", accountRowId)
          .eq("ticket", ticket);
      } else {
        await supabase.from("mt_positions").insert({
          user_id: userId,
          account_id: accountRowId,
          ticket,
          symbol,
          side,
          volume,
          open_price: openPrice,
          stop_loss: sl,
          take_profit: tp,
          profit,
          opened_at: openedAt,
        });
      }
    }

    // Anything in `previous` but missing from `incoming` was closed → log to journal + delete
    const closed = (previous ?? []).filter(
      (p) => !incomingTickets.has(String(p.ticket)),
    );
    for (const c of closed) {
      await supabase.from("trade_journal").insert({
        user_id: userId,
        pair: c.symbol,
        direction: c.side,
        entry_price: Number(c.open_price),
        exit_price: null, // EA payload doesn't include closing price; left null
        position_size: Number(c.volume),
        pnl: c.profit != null ? Number(c.profit) : null,
        status: "closed",
        opened_at: c.opened_at,
        closed_at: new Date().toISOString(),
        setup_tag: "ea-webhook",
        notes: `Auto-logged from MT EA. Ticket #${c.ticket}.`,
      });

      await supabase
        .from("mt_positions")
        .delete()
        .eq("account_id", accountRowId)
        .eq("ticket", String(c.ticket));
    }

    return json(200, {
      ok: true,
      type: "positions",
      open: incoming.length,
      closed: closed.length,
    });
  }

  return json(400, { error: `Unknown payload type: ${type}` });
});
