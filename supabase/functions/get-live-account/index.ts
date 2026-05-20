// get-live-account — returns live MT5 account snapshot for the logged-in user
//
// Adds server-side caching + split account/positions cadence and a global
// retry-after-aware 429 cooldown to dramatically reduce Trading Layer calls.
// Execution / order / risk paths are NOT touched by this function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TL_BASE = "https://api.trading-layer.com/api/v1";

// ---------- Cache (module-scoped, per isolate) ----------
// TTLs are intentionally short — just enough to absorb burst polling from
// dashboard tabs without ever returning stale-feeling data.
const ACCOUNT_TTL_MS = 25_000; // trader/account snapshot
const POSITIONS_TTL_MS = 15_000; // positions snapshot
const RATE_LIMIT_DEFAULT_MS = 60_000; // when retry-after header missing

type AccountEntry = { at: number; data: any };
type PositionsEntry = { at: number; data: any[] };

const accountCache = new Map<string, AccountEntry>();
const positionsCache = new Map<string, PositionsEntry>();
// Global per-trader cooldown (covers both endpoints) when upstream returns 429.
const cooldownUntil = new Map<string, number>();

function getCooldownRemaining(traderId: string): number {
  const until = cooldownUntil.get(traderId) ?? 0;
  return Math.max(0, until - Date.now());
}
function setCooldown(traderId: string, ms: number) {
  cooldownUntil.set(traderId, Date.now() + Math.max(1_000, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Missing Authorization header." });
    }

    // Optional body — `{ refresh, debug }`. `refresh: true` bypasses cache
    // ONLY when no cooldown is active; cooldown is always respected.
    let body: any = {};
    try {
      if (req.method !== "GET") body = await req.json().catch(() => ({}));
    } catch { /* ignore */ }
    const forceRefresh = body?.refresh === true;
    const debug = body?.debug === true;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const TRADING_LAYER_API_KEY = Deno.env.get("TRADING_LAYER_API_KEY");

    if (!TRADING_LAYER_API_KEY) {
      return json(200, {
        success: false,
        stage: "config",
        errorCode: "TL_CONFIG_MISSING",
        error: "Trading Layer configuration missing.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { success: false, error: "Not authenticated." });
    }
    const userId = userData.user.id;

    const tlHeaders = {
      "Authorization": `Bearer ${TRADING_LAYER_API_KEY}`,
      "Content-Type": "application/json",
    };

    let { data: account, error: accErr } = await supabase
      .from("user_mt_accounts")
      .select("id, login, server_name, status, last_synced_at, metaapi_account_id, created_at")
      .eq("user_id", userId)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accErr) return json(500, { success: false, error: accErr.message });

    // Fallback: if no DB row, ask Trading Layer's tenant endpoint whether the
    // owner account is already connected and self-heal the missing row.
    if (!account) {
      try {
        const tenantRes = await fetch(`${TL_BASE}/tenant`, { headers: tlHeaders });
        const tenantData = await tenantRes.json().catch(() => ({}));
        const owner = tenantData?.data?.ownerAccount ?? {};
        const ownerMt5 = owner?.mt5 ?? {};
        if (tenantRes.ok && ownerMt5?.status === "connected" && owner?.accountId) {
          const nowIso = new Date().toISOString();
          const insertRow = {
            user_id: userId,
            metaapi_account_id: String(owner.accountId),
            login: String(ownerMt5.login ?? ""),
            server_name: String(ownerMt5.server ?? ""),
            platform: "mt5",
            broker_name: "Infinox",
            status: "connected",
            last_synced_at: nowIso,
            updated_at: nowIso,
          };
          const { data: inserted, error: insErr } = await supabase
            .from("user_mt_accounts")
            .insert(insertRow)
            .select("id, login, server_name, status, last_synced_at, metaapi_account_id, created_at")
            .single();
          if (!insErr && inserted) {
            account = inserted;
          }
        }
      } catch (_) { /* fall through */ }
    }

    if (!account) {
      return json(200, {
        success: false,
        stage: "account_lookup",
        errorCode: "NO_MT5_ACCOUNT",
        error: "No connected trading account found.",
      });
    }

    const traderId = account.metaapi_account_id;
    if (!traderId) {
      return json(200, {
        success: false,
        stage: "account_lookup",
        errorCode: "MISSING_TRADER_ID",
        error: "Connected account is missing a Trading Layer trader id.",
      });
    }

    const cacheKey = `${userId}:${traderId}:${account.login ?? ""}`;
    const now = Date.now();

    // Cooldown check — return last-known-good if available, never call upstream.
    const cooldownMs = getCooldownRemaining(traderId);
    const accCached = accountCache.get(cacheKey);
    const posCached = positionsCache.get(cacheKey);

    if (cooldownMs > 0) {
      if (accCached && posCached) {
        return json(200, buildSuccess({
          account, traderId, accData: accCached.data, positions: posCached.data,
          cache: "hit",
          cacheAgeMs: { account: now - accCached.at, positions: now - posCached.at },
          nextRefreshAllowedAt: new Date(now + cooldownMs).toISOString(),
          usingLastKnownGood: true,
          rateLimited: true,
          debug,
        }));
      }
      return json(200, {
        success: false,
        stage: "trading_layer_account_check",
        errorCode: "TL_RATE_LIMITED",
        error: "Rate limited — retrying shortly.",
        retryAfter: Math.ceil(cooldownMs / 1000),
        usingLastKnownGood: false,
        cache: "miss",
        retryable: true,
      });
    }

    // Decide which upstream calls are actually needed.
    const accountFresh = !!accCached && now - accCached.at < ACCOUNT_TTL_MS;
    const positionsFresh = !!posCached && now - posCached.at < POSITIONS_TTL_MS;

    const needAccount = forceRefresh || !accountFresh;
    const needPositions = forceRefresh || !positionsFresh;

    let upstreamCallsAvoided = 0;
    if (!needAccount) upstreamCallsAvoided += 1;
    if (!needPositions) upstreamCallsAvoided += 1;

    // 12s timeout per upstream request.
    const withTimeout = (url: string) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 12_000);
      return fetch(url, { headers: tlHeaders, signal: ctl.signal }).finally(() =>
        clearTimeout(t),
      );
    };

    let traderRes: Response | null = null;
    let posRes: Response | null = null;
    try {
      const calls: Promise<Response>[] = [];
      if (needAccount) calls.push(withTimeout(`${TL_BASE}/traders/${encodeURIComponent(traderId)}`));
      if (needPositions) calls.push(withTimeout(`${TL_BASE}/accounts/${encodeURIComponent(traderId)}/positions`));
      const results = calls.length ? await Promise.all(calls) : [];
      let idx = 0;
      if (needAccount) traderRes = results[idx++];
      if (needPositions) posRes = results[idx++];
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      // If we still have cached data, fall back to it rather than failing.
      if (accCached && posCached) {
        return json(200, buildSuccess({
          account, traderId, accData: accCached.data, positions: posCached.data,
          cache: "hit",
          cacheAgeMs: { account: now - accCached.at, positions: now - posCached.at },
          usingLastKnownGood: true,
          stale: true,
          debug,
        }));
      }
      return json(200, {
        success: false,
        stage: "trading_layer_fetch",
        errorCode: aborted ? "TL_TIMEOUT" : "TL_NETWORK",
        error: aborted
          ? "Connection to Trading Layer timed out."
          : "Network error reaching Trading Layer.",
        retryable: true,
        cache: "miss",
      });
    }

    // Handle upstream errors (account leg drives the primary failure mode).
    const checkUpstream = (resp: Response | null): { ok: boolean; payload?: any } => {
      if (!resp) return { ok: true };
      const status = resp.status;
      if (status === 429) {
        const retryAfterHeader = Number(resp.headers.get("retry-after") ?? "0");
        const cooldown = retryAfterHeader > 0 ? retryAfterHeader * 1000 : RATE_LIMIT_DEFAULT_MS;
        setCooldown(traderId, cooldown);
        return {
          ok: false,
          payload: {
            stage: "trading_layer_account_check",
            errorCode: "TL_RATE_LIMITED",
            error: "Rate limited — retrying shortly.",
            tradingLayerStatus: 429,
            retryAfter: Math.ceil(cooldown / 1000),
            retryable: true,
          },
        };
      }
      if (!resp.ok) {
        let errorCode = "TL_UPSTREAM_ERROR";
        let message = "Live trading services are temporarily unavailable.";
        if (status === 401 || status === 403) {
          errorCode = "TL_AUTH_FAILED"; message = "Trading Layer authorization failed.";
        } else if (status === 404) {
          errorCode = "TL_ACCOUNT_NOT_FOUND"; message = "Trading Layer account not found.";
        } else if (status >= 500) {
          errorCode = "TL_SERVICE_DOWN";
        }
        return {
          ok: false,
          payload: {
            stage: "trading_layer_account_check",
            errorCode,
            error: message,
            tradingLayerStatus: status,
            retryable: status >= 500,
          },
        };
      }
      return { ok: true };
    };

    const accountCheck = checkUpstream(traderRes);
    const positionsCheck = checkUpstream(posRes);

    // If either leg got 429 / failed, fall back to last-known-good if present.
    if (!accountCheck.ok || !positionsCheck.ok) {
      const failure = !accountCheck.ok ? accountCheck.payload : positionsCheck.payload;
      if (accCached && posCached) {
        return json(200, buildSuccess({
          account, traderId, accData: accCached.data, positions: posCached.data,
          cache: "hit",
          cacheAgeMs: { account: now - accCached.at, positions: now - posCached.at },
          usingLastKnownGood: true,
          rateLimited: failure?.errorCode === "TL_RATE_LIMITED",
          stale: true,
          retryAfter: failure?.retryAfter,
          debug,
        }));
      }
      return json(200, { success: false, cache: "miss", usingLastKnownGood: false, ...failure });
    }

    // Parse & update caches.
    if (traderRes) {
      const traderData = await traderRes.json().catch(() => ({}));
      accountCache.set(cacheKey, { at: now, data: traderData });
    }
    if (posRes) {
      const positionsData = await posRes.json().catch(() => ({}));
      const arr = Array.isArray(positionsData?.data) ? positionsData.data : [];
      positionsCache.set(cacheKey, { at: now, data: arr });
    }

    const finalAcc = accountCache.get(cacheKey)!;
    const finalPos = positionsCache.get(cacheKey)!;

    const cacheStatus: "hit" | "miss" | "partial" =
      !needAccount && !needPositions
        ? "hit"
        : needAccount && needPositions
        ? "miss"
        : "partial";

    return json(200, buildSuccess({
      account, traderId,
      accData: finalAcc.data,
      positions: finalPos.data,
      cache: cacheStatus,
      cacheAgeMs: { account: now - finalAcc.at, positions: now - finalPos.at },
      upstreamCallsAvoided,
      debug,
    }));
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Build a normalized success response from cached/fresh upstream payloads.
function buildSuccess(opts: {
  account: any;
  traderId: string;
  accData: any;
  positions: any[];
  cache: "hit" | "miss" | "partial";
  cacheAgeMs?: { account: number; positions: number };
  nextRefreshAllowedAt?: string;
  usingLastKnownGood?: boolean;
  rateLimited?: boolean;
  stale?: boolean;
  retryAfter?: number;
  upstreamCallsAvoided?: number;
  debug?: boolean;
}) {
  const {
    account, traderId, accData, positions, cache, cacheAgeMs,
    nextRefreshAllowedAt, usingLastKnownGood, rateLimited, stale, retryAfter,
    upstreamCallsAvoided,
  } = opts;

  const acc = accData?.data?.account ?? {};
  const mt5 = accData?.data?.mt5 ?? {};

  const floatingPnl = (positions || []).reduce(
    (sum: number, p: any) => sum + (Number(p?.profit ?? p?.pnl ?? 0) || 0),
    0,
  );
  const balance = Number(acc.balance ?? mt5.balance ?? 0);
  const equity = Number(acc.equity ?? mt5.equity ?? 0);
  const margin = Number(acc.margin ?? mt5.margin ?? 0);
  const marginFree = Number(
    acc.free_margin ?? acc.freeMargin ?? mt5.free_margin ?? mt5.freeMargin ?? 0,
  );
  const currency = acc.currency ?? mt5.currency ?? "USD";
  const leverage = acc.leverage ?? mt5.leverage ?? null;

  const mappedPositions = (positions || []).map((p: any) => ({
    ticket: p?.ticket ?? p?.id ?? null,
    symbol: p?.symbol ?? "",
    side: (p?.side ?? p?.action ?? p?.type ?? "").toString().toLowerCase().includes("sell")
      ? "sell" : "buy",
    volume: Number(p?.volume ?? p?.lots ?? 0),
    entry_price: Number(p?.open_price ?? p?.openPrice ?? p?.entry_price ?? p?.price ?? 0),
    current_price: Number(p?.current_price ?? p?.currentPrice ?? p?.price ?? 0),
    stop_loss: p?.stop_loss ?? p?.sl ?? null,
    take_profit: p?.take_profit ?? p?.tp ?? null,
    profit: Number(p?.profit ?? p?.pnl ?? 0),
  }));

  const accountOut = {
    traderId,
    login: account.login,
    server: account.server_name,
    status: account.status,
    currency, leverage, balance, equity, margin, marginFree,
    profit: floatingPnl,
    openPositionsCount: mappedPositions.length,
    lastSynced: account.last_synced_at,
  };

  return {
    success: true,
    step: "live_account_loaded",
    accountConnected: true,
    account: accountOut,
    positions: mappedPositions,
    timestamp: new Date().toISOString(),
    cache,
    cacheAgeMs,
    nextRefreshAllowedAt,
    usingLastKnownGood: !!usingLastKnownGood,
    rateLimited: !!rateLimited,
    stale: !!stale,
    retryAfter,
    upstreamCallsAvoided: upstreamCallsAvoided ?? 0,
    data: {
      balance, equity, margin, free_margin: marginFree,
      currency, leverage,
      floating_pnl: floatingPnl,
      open_positions: mappedPositions.length,
      positions: mappedPositions,
      account_number: account.login,
      server: account.server_name,
      status: account.status,
      last_synced: account.last_synced_at,
    },
  };
}
