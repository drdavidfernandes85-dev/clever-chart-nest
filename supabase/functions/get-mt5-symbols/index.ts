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
      .select("metaapi_account_id, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let accountId = linkedAccount?.metaapi_account_id || null;
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
    const candidatePaths = [
      `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols`,
      `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/all`,
      `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols?all=true`,
    ];

    let rawList: any[] = [];
    let usedPath: string | null = null;
    for (const p of candidatePaths) {
      const r = await tlGet(p);
      attempts.push({ path: p, status: r.status, ok: r.ok });
      if (r.ok) {
        const d = r.data?.data ?? r.data;
        if (Array.isArray(d)) { rawList = d; usedPath = p; break; }
        if (Array.isArray(d?.symbols)) { rawList = d.symbols; usedPath = p; break; }
        if (Array.isArray(d?.items)) { rawList = d.items; usedPath = p; break; }
      }
    }

    const symbols = rawList.map(mapSymbol).filter(Boolean);

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
