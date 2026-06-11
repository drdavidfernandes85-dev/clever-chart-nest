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
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapSymbol(item: any) {
  const name = item?.name || item?.symbol || item;
  if (!name || typeof name !== "string") return null;
  return {
    name,
    brokerSymbol: name,
    symbol: name,
    displayName: item?.description ? `${name}` : name,
    description: item?.description || "",
    digits: item?.digits ?? null,
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

function dedupeSymbols(list: any[]) {
  const mapped = list.map(mapSymbol).filter(Boolean) as ReturnType<typeof mapSymbol>[];
  const seen = new Map<string, any>();
  for (const item of mapped) {
    const key = String(item?.brokerSymbol || item?.name || item?.symbol || "").toUpperCase();
    if (key && !seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, step: "auth", error: "Unauthorized." }, 401);
    }

    const { data: linkedAccount } = await supabase
      .from("user_mt_accounts")
      .select("trading_layer_trader_id, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let accountId = linkedAccount?.trading_layer_trader_id || null;
    let accountSource = "database";

    if (!accountId) {
      const tenantRes = await tlGet("/api/v1/tenant");
      const ownerAccount = tenantRes.data?.data?.ownerAccount;
      const mt5 = ownerAccount?.mt5;
      if (tenantRes.ok && ownerAccount?.accountId && mt5?.status === "connected") {
        accountId = ownerAccount.accountId;
        accountSource = "tenant_fallback";
      }
    }

    if (!accountId) {
      return json({ success: false, step: "account_lookup", error: "No connected MT5 account found." }, 404);
    }

    const attempts: any[] = [];
    const accountPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols`;

    // 1. Try a single big-pull first.
    const candidatePaths = [
      `${accountPath}?limit=10000`,
      `${accountPath}?limit=5000`,
      `${accountPath}?all=true&limit=10000`,
      `${accountPath}/all`,
      accountPath,
    ];

    let rawList: any[] = [];
    let usedPath: string | null = null;
    for (const p of candidatePaths) {
      const r = await tlGet(p);
      const list = r.ok ? extractList(r.data) : [];
      attempts.push({ path: p, status: r.status, ok: r.ok, count: list.length });
      if (r.ok && list.length > rawList.length) {
        rawList = list;
        usedPath = p;
      }
    }

    // 2. Always also iterate offset-pagination until exhausted, since some
    //    brokers cap a single response regardless of `limit`.
    const PAGE = 500;
    const MAX_PAGES = 200; // hard cap = 100k symbols
    const paged: any[] = [];
    for (let i = 0; i < MAX_PAGES; i++) {
      const offset = i * PAGE;
      const p = `${accountPath}?limit=${PAGE}&offset=${offset}`;
      const r = await tlGet(p);
      const list = r.ok ? extractList(r.data) : [];
      attempts.push({ path: p, status: r.status, ok: r.ok, count: list.length, pagination: "offset" });
      if (!r.ok) break;
      if (list.length === 0) break;
      paged.push(...list);
      if (list.length < PAGE) break;
    }
    if (paged.length > rawList.length) {
      rawList = paged;
      usedPath = `${accountPath}?limit=${PAGE}&offset=*`;
    } else if (paged.length > 0) {
      // Merge for safety: union of single-pull + paginated.
      rawList = [...rawList, ...paged];
    }

    const symbols = dedupeSymbols(rawList);

    return json({
      success: true,
      step: "symbols_loaded",
      accountId,
      accountSource,
      usedPath,
      symbolsLoaded: symbols.length > 0,
      count: symbols.length,
      symbols,
      attempts,
      timestamp: new Date().toISOString(),
    }, 200);
  } catch (err) {
    return json({
      success: false,
      step: "unhandled_exception",
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
