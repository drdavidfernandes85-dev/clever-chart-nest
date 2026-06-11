// ============================================================
// DISPLAY-ONLY ENDPOINT — NOT FOR EXECUTION.
// ------------------------------------------------------------
// Permitted uses ONLY:
//   - Market Watch list / Bid-Ask board
//   - Quotes / charts / terminal display
//   - Balance / equity / positions display
// MUST NEVER be imported or invoked by:
//   - execution instrument resolution
//   - order eligibility decisions
//   - full pre-trade validation
//   - server-side execution price-of-record
//   - any live mutation path (submit/close/modify/cancel)
// Authoritative execution resolver: get-terminal-execution-eligibility.
// Authoritative submission path:    submit-best-execution-order.
// ============================================================
// get-mt5-quotes
// Returns a small batch of live quotes (bid/ask/last/spread) for the
// Bid / Ask Board. Always includes the caller's `selectedSymbol` plus a
// default basket so the board stays populated even before the user picks
// a symbol.
//
// Body:
//   { selectedSymbol?: string, symbols?: string[], debug?: boolean }
//
// Response:
//   {
//     success: true,
//     accountId,
//     quotes: [{ symbol, bid, ask, last, spread, digits }],
//     timestamp
//   }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRADING_LAYER_KEY = Deno.env.get("TRADING_LAYER_API_KEY");
const BASE_URL = "https://api.trading-layer.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const normalize = (v: string) =>
  String(v || "").trim().replace("/", "").replace("-", "").replace(" ", "").toUpperCase();

const PER_REQUEST_TIMEOUT_MS = 3500;   // hard cap per upstream call
const WALL_BUDGET_MS = 20_000;          // total time budget for the whole function

async function tlGet(path: string, deadlineAt: number, retries = 1) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (Date.now() >= deadlineAt) {
      return { ok: false, status: 0, data: { error: "wall_budget_exceeded" } };
    }
    const ctrl = new AbortController();
    const remaining = Math.max(250, Math.min(PER_REQUEST_TIMEOUT_MS, deadlineAt - Date.now()));
    const timer = setTimeout(() => ctrl.abort(), remaining);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TRADING_LAYER_KEY}`,
          Accept: "application/json",
        },
        signal: ctrl.signal,
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      if (!res.ok && (res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries && Date.now() < deadlineAt) {
        continue;
      }
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      lastErr = err;
      if (attempt < retries && Date.now() < deadlineAt) continue;
      const aborted = (err as any)?.name === "AbortError";
      return { ok: false, status: 0, data: { error: aborted ? "upstream_timeout" : (err instanceof Error ? err.message : String(err)) } };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, data: { error: String(lastErr) } };
}


const DEFAULT_BATCH = [
  "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD",
  "US30", "NAS100", "SPX500", "GER40",
  "BTCUSD", "ETHUSD", "USOIL",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TRADING_LAYER_KEY) {
      return json({ success: false, step: "env", error: "Missing TRADING_LAYER_API_KEY" }, 500);
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({
        success: false,
        accountConnected: false,
        step: "auth",
        error: "Missing Authorization header.",
        quotes: [],
      }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      // Degrade gracefully — display-only endpoint should never blank the UI
      // just because the session token is stale/anon. Frontend will retry.
      return json({
        success: false,
        accountConnected: false,
        step: "auth",
        error: "Unauthorized.",
        quotes: [],
      }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const debug = body?.debug === true;
    const selectedSymbol = body?.selectedSymbol ? normalize(String(body.selectedSymbol)) : "";
    const requested: string[] = Array.isArray(body?.symbols)
      ? body.symbols.map((s: any) => normalize(String(s))).filter(Boolean)
      : [];

    let { data: account } = await supabase
      .from("user_mt_accounts")
      .select("id, login, trading_layer_trader_id, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Auto-heal removed: previously fell back to tenant `ownerAccount.accountId`,
    // which is NOT a valid Trading Layer trader ID. Only `connect-mt5-v2` writes
    // the correct mapping.

    if (!account?.trading_layer_trader_id) {
      return json({
        success: false,
        accountConnected: false,
        step: "account_lookup",
        error: "No connected MT5 account found.",
        quotes: [],
      }, 200);
    }
    const accountId = account.trading_layer_trader_id;
    const accountPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols`;

    // Build target list: requested + selected + defaults (deduped, capped).
    const seen = new Set<string>();
    const targetUpper: string[] = [];
    const push = (s: string) => {
      if (s && !seen.has(s)) { seen.add(s); targetUpper.push(s); }
    };
    requested.forEach(push);
    if (selectedSymbol) push(selectedSymbol);
    DEFAULT_BATCH.forEach(push);

    const limited = targetUpper.slice(0, 40);

    const deadlineAt = Date.now() + WALL_BUDGET_MS;
    const CONC = 4;
    const quotes: any[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < limited.length && Date.now() < deadlineAt) {
        const idx = cursor++;
        const sym = limited[idx];
        const tickRes = await tlGet(`${accountPath}/${encodeURIComponent(sym)}/tick`, deadlineAt);
        const tick = tickRes.ok ? tickRes.data?.data : null;
        const bid = tick?.bid != null ? Number(tick.bid) : null;
        const ask = tick?.ask != null ? Number(tick.ask) : null;
        const last = tick?.last != null
          ? Number(tick.last)
          : bid != null && ask != null ? (bid + ask) / 2 : null;
        const spread = bid != null && ask != null ? Math.max(0, ask - bid) : null;
        const digits = tick?.digits ?? null;
        if (bid != null || ask != null || last != null) {
          quotes.push({ symbol: sym, bid, ask, last, spread, digits });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, limited.length) }, () => worker()));

    quotes.sort(
      (a, b) =>
        limited.indexOf(String(a.symbol).toUpperCase()) -
        limited.indexOf(String(b.symbol).toUpperCase()),
    );

    // Build selectedQuote: tick + symbol specification.
    let selectedQuote: any = null;
    if (selectedSymbol && Date.now() < deadlineAt) {
      const baseQuote = quotes.find(
        (q) => String(q.symbol).toUpperCase() === selectedSymbol,
      ) || null;
      const specRes = await tlGet(`${accountPath}/${encodeURIComponent(selectedSymbol)}`, deadlineAt);
      const spec = specRes.ok ? specRes.data?.data : null;
      if (baseQuote || spec) {
        selectedQuote = {
          symbol: selectedSymbol,
          bid: baseQuote?.bid ?? null,
          ask: baseQuote?.ask ?? null,
          last: baseQuote?.last ?? null,
          spread: baseQuote?.spread ?? null,
          digits: spec?.digits ?? baseQuote?.digits ?? null,
          point: spec?.point ?? null,
          description: spec?.description ?? null,
          contractSize: spec?.trade_contract_size ?? null,
          tickValue: spec?.trade_tick_value ?? null,
          tickSize: spec?.trade_tick_size ?? null,
          volumeMin: spec?.volume_min ?? null,
          volumeMax: spec?.volume_max ?? null,
          volumeStep: spec?.volume_step ?? null,
          currencyBase: spec?.currency_base ?? null,
          currencyProfit: spec?.currency_profit ?? null,
          currencyMargin: spec?.currency_margin ?? null,
          valid: !!baseQuote || !!spec,
        };
      }
    }

    return json({
      success: true,
      accountConnected: true,
      accountId,
      quotes,
      count: quotes.length,
      selectedSymbol: selectedSymbol || null,
      selectedQuote,
      debug: debug ? { selectedSymbol, requested, limited } : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Degrade gracefully so the frontend keeps fallback polling without surfacing a 500.
    return json({
      success: false,
      step: "unhandled_exception",
      error: err instanceof Error ? err.message : String(err),
      quotes: [],
      accountConnected: true,
      timestamp: new Date().toISOString(),
    }, 200);
  }
});
