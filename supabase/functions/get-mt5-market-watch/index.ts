// get-mt5-market-watch
// Single-call endpoint that returns a batch of broker instruments with live
// bid/ask/last/spread ticks. Powers both the Market Watch list and the
// Bid / Ask Board so the terminal makes one network round-trip per refresh.
//
// Body:
//   {
//     symbols?: string[]   // optional batch of symbols to fetch ticks for
//     debug?:   boolean    // include the full broker symbols catalog
//   }
//
// Response:
//   {
//     success: true,
//     accountId,
//     instruments: [{ symbol, displayName, description, digits, bid, ask, last, spread }],
//     symbols:     [{ name, symbol, description, digits, assetClass }],  // catalog (always)
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

async function tlGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TRADING_LAYER_KEY}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

function mapSymbolLite(item: any) {
  const name = item?.name || item?.symbol;
  if (!name || typeof name !== "string") return null;
  return {
    name,
    symbol: name,
    brokerSymbol: name,
    displayName: name,
    description: item?.description || "",
    digits: item?.digits ?? null,
    point: item?.point ?? null,
    contractSize: item?.trade_contract_size ?? null,
    assetClass: item?.path?.split?.("\\")?.[0] || item?.category || null,
  };
}

function extractList(data: any): any[] {
  const d = data?.data ?? data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.symbols)) return d.symbols;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

function dedupe(list: any[]) {
  const mapped = list.map(mapSymbolLite).filter(Boolean) as any[];
  const seen = new Map<string, any>();
  for (const item of mapped) {
    const key = String(item.name).toUpperCase();
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

// Default batch when client doesn't pass one (debug:true initial load).
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
      return json({ success: false, step: "auth", error: "Missing Authorization header." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const debug = body?.debug === true;
    const requested: string[] = Array.isArray(body?.symbols)
      ? body.symbols.map((s: any) => normalize(String(s))).filter(Boolean)
      : [];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, step: "auth", error: "Unauthorized." }, 401);
    }

    // Resolve connected MT5 account (self-heal via tenant if needed)
    let { data: account } = await supabase
      .from("user_mt_accounts")
      .select("id, login, metaapi_account_id, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Auto-heal removed: tenant `ownerAccount.accountId` is NOT a valid
    // Trading Layer trader ID. `connect-mt5-v2` is the only writer.

    if (!account?.metaapi_account_id) {
      return json({
        success: false,
        accountConnected: false,
        step: "account_lookup",
        error: "No connected MT5 account found.",
      }, 200);
    }
    const accountId = account.metaapi_account_id;

    // Catalog: always fetch (paginated). We need this to map favorites + UI list.
    const accountPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols`;
    let rawList: any[] = [];
    for (const p of [`${accountPath}?limit=10000`, accountPath]) {
      const r = await tlGet(p);
      const list = r.ok ? extractList(r.data) : [];
      if (list.length > rawList.length) rawList = list;
      if (rawList.length >= 200) break;
    }
    if (rawList.length < 200) {
      const PAGE = 500;
      const paged: any[] = [];
      for (let i = 0; i < 200; i++) {
        const r = await tlGet(`${accountPath}?limit=${PAGE}&offset=${i * PAGE}`);
        const list = r.ok ? extractList(r.data) : [];
        if (!r.ok || list.length === 0) break;
        paged.push(...list);
        if (list.length < PAGE) break;
      }
      if (paged.length > rawList.length) rawList = paged;
    }
    const catalog = dedupe(rawList);
    const catalogByUpper = new Map<string, any>();
    for (const s of catalog) catalogByUpper.set(s.name.toUpperCase(), s);

    // Determine which symbols to fetch ticks for.
    const targetUpper = (requested.length > 0 ? requested : DEFAULT_BATCH).slice(0, 40);

    // Concurrency-limited tick fetch
    const CONC = 8;
    const instruments: any[] = [];
    let cursor = 0;
    async function worker() {
      while (cursor < targetUpper.length) {
        const idx = cursor++;
        const sym = targetUpper[idx];
        const meta = catalogByUpper.get(sym);
        const symbolName = meta?.name || sym;
        const tickRes = await tlGet(`${accountPath}/${encodeURIComponent(symbolName)}/tick`);
        const tick = tickRes.ok ? tickRes.data?.data : null;
        const bid = tick?.bid != null ? Number(tick.bid) : null;
        const ask = tick?.ask != null ? Number(tick.ask) : null;
        const last = tick?.last != null
          ? Number(tick.last)
          : bid != null && ask != null ? (bid + ask) / 2 : null;
        const spread = bid != null && ask != null ? Math.max(0, ask - bid) : null;
        instruments.push({
          symbol: symbolName,
          displayName: meta?.displayName || symbolName,
          description: meta?.description || "",
          digits: meta?.digits ?? null,
          point: meta?.point ?? null,
          assetClass: meta?.assetClass ?? null,
          bid,
          ask,
          last,
          spread,
        });
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, targetUpper.length) }, () => worker()));

    // Preserve requested order
    instruments.sort(
      (a, b) =>
        targetUpper.indexOf(String(a.symbol).toUpperCase()) -
        targetUpper.indexOf(String(b.symbol).toUpperCase()),
    );

    return json({
      success: true,
      accountConnected: true,
      accountId,
      instruments,
      symbols: catalog,
      count: instruments.length,
      catalogCount: catalog.length,
      debug: debug ? { requested, targetUpper } : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return json({
      success: false,
      step: "unhandled_exception",
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
