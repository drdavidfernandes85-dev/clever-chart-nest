// get-live-account — returns live MT5 account snapshot for the logged-in user
//
// Cross-isolate last-known-good cache lives in Postgres (tl_account_cache).
// Module-scope is used only as a tiny per-isolate hot-cache to absorb
// burst polling. Execution / order / risk paths are NOT touched.
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

// TTLs — same as before. The Postgres cache stores the last successful
// snapshot; freshness windows decide whether we call Trading Layer.
const ACCOUNT_TTL_MS = 25_000;
const POSITIONS_TTL_MS = 15_000;
const RATE_LIMIT_DEFAULT_MS = 60_000;

// Tiny per-isolate hot cache (5s) to absorb extremely rapid bursts without
// hitting Postgres. Safe to be stale — Postgres is still the source of truth.
type HotEntry = { at: number; row: CacheRow };
const HOT_TTL_MS = 5_000;
const hot = new Map<string, HotEntry>();

interface CacheRow {
  account_data: any | null;
  account_updated_at: string | null;
  positions_data: any[] | null;
  positions_updated_at: string | null;
  cooldown_until: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { success: false, error: "Missing Authorization header." });
    }

    let body: any = {};
    try {
      if (req.method !== "GET") body = await req.json().catch(() => ({}));
    } catch { /* ignore */ }
    const forceRefresh = body?.refresh === true;
    const debug = body?.debug === true;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TRADING_LAYER_API_KEY = Deno.env.get("TRADING_LAYER_API_KEY");

    if (!TRADING_LAYER_API_KEY) {
      return json(200, {
        success: false,
        stage: "config",
        errorCode: "TL_CONFIG_MISSING",
        error: "Trading Layer configuration missing.",
      });
    }

    // User-scoped client for auth + reading user_mt_accounts under RLS.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    // Service-role client for the shared cache table (bypasses RLS).
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    // Self-heal: ask Trading Layer tenant endpoint if no DB row.
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
          if (!insErr && inserted) account = inserted;
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

    const hotKey = `${userId}:${traderId}`;
    const now = Date.now();

    // ---- Load cache row from Postgres (with tiny hot-cache shortcut) ----
    let cacheRow: CacheRow | null = null;
    const hotHit = hot.get(hotKey);
    if (hotHit && now - hotHit.at < HOT_TTL_MS) {
      cacheRow = hotHit.row;
    } else {
      const { data: row } = await svc
        .from("tl_account_cache")
        .select("account_data, account_updated_at, positions_data, positions_updated_at, cooldown_until")
        .eq("user_id", userId)
        .eq("trader_id", traderId)
        .maybeSingle();
      cacheRow = (row as CacheRow | null) ?? null;
      if (cacheRow) hot.set(hotKey, { at: now, row: cacheRow });
    }

    const accAt = cacheRow?.account_updated_at ? new Date(cacheRow.account_updated_at).getTime() : 0;
    const posAt = cacheRow?.positions_updated_at ? new Date(cacheRow.positions_updated_at).getTime() : 0;
    const cooldownUntil = cacheRow?.cooldown_until ? new Date(cacheRow.cooldown_until).getTime() : 0;
    const cooldownMs = Math.max(0, cooldownUntil - now);

    const hasAccData = !!cacheRow?.account_data;
    const hasPosData = Array.isArray(cacheRow?.positions_data);

    // ---- Cooldown active: never call upstream ----
    if (cooldownMs > 0) {
      if (hasAccData && hasPosData) {
        return json(200, buildSuccess({
          account, traderId,
          accData: cacheRow!.account_data,
          positions: cacheRow!.positions_data!,
          cache: "hit",
          cacheAgeMs: { account: now - accAt, positions: now - posAt },
          nextRefreshAllowedAt: new Date(cooldownUntil).toISOString(),
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

    // ---- Decide which upstream calls are actually needed ----
    const accountFresh = hasAccData && now - accAt < ACCOUNT_TTL_MS;
    const positionsFresh = hasPosData && now - posAt < POSITIONS_TTL_MS;
    const needAccount = forceRefresh || !accountFresh;
    const needPositions = forceRefresh || !positionsFresh;

    let upstreamCallsAvoided = 0;
    if (!needAccount) upstreamCallsAvoided += 1;
    if (!needPositions) upstreamCallsAvoided += 1;

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
      if (hasAccData && hasPosData) {
        return json(200, buildSuccess({
          account, traderId,
          accData: cacheRow!.account_data,
          positions: cacheRow!.positions_data!,
          cache: "hit",
          cacheAgeMs: { account: now - accAt, positions: now - posAt },
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

    // ---- Handle upstream errors ----
    let newCooldownMs = 0;
    const checkUpstream = (resp: Response | null): { ok: boolean; payload?: any } => {
      if (!resp) return { ok: true };
      const status = resp.status;
      if (status === 429) {
        const retryAfterHeader = Number(resp.headers.get("retry-after") ?? "0");
        const cd = retryAfterHeader > 0 ? retryAfterHeader * 1000 : RATE_LIMIT_DEFAULT_MS;
        newCooldownMs = Math.max(newCooldownMs, cd);
        return {
          ok: false,
          payload: {
            stage: "trading_layer_account_check",
            errorCode: "TL_RATE_LIMITED",
            error: "Rate limited — retrying shortly.",
            tradingLayerStatus: 429,
            retryAfter: Math.ceil(cd / 1000),
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

    // Persist cooldown to Postgres so other isolates honor it too.
    if (newCooldownMs > 0) {
      const cooldownIso = new Date(now + newCooldownMs).toISOString();
      await svc.from("tl_account_cache").upsert({
        user_id: userId,
        trader_id: traderId,
        cooldown_until: cooldownIso,
      }, { onConflict: "user_id,trader_id" });
      hot.delete(hotKey);
    }

    if (!accountCheck.ok || !positionsCheck.ok) {
      const failure = !accountCheck.ok ? accountCheck.payload : positionsCheck.payload;
      if (hasAccData && hasPosData) {
        return json(200, buildSuccess({
          account, traderId,
          accData: cacheRow!.account_data,
          positions: cacheRow!.positions_data!,
          cache: "hit",
          cacheAgeMs: { account: now - accAt, positions: now - posAt },
          usingLastKnownGood: true,
          rateLimited: failure?.errorCode === "TL_RATE_LIMITED",
          stale: true,
          retryAfter: failure?.retryAfter,
          debug,
        }));
      }
      return json(200, { success: false, cache: "miss", usingLastKnownGood: false, ...failure });
    }

    // ---- Parse fresh responses and persist to Postgres cache ----
    let finalAccData = cacheRow?.account_data ?? null;
    let finalPosData: any[] = cacheRow?.positions_data ?? [];
    let finalAccUpdatedAt = accAt;
    let finalPosUpdatedAt = posAt;

    const upsertPayload: any = {
      user_id: userId,
      trader_id: traderId,
    };

    if (traderRes) {
      const traderData = await traderRes.json().catch(() => ({}));
      finalAccData = traderData;
      finalAccUpdatedAt = now;
      upsertPayload.account_data = traderData;
      upsertPayload.account_updated_at = new Date(now).toISOString();
    }
    if (posRes) {
      const positionsData = await posRes.json().catch(() => ({}));
      const arr = Array.isArray(positionsData?.data) ? positionsData.data : [];
      finalPosData = arr;
      finalPosUpdatedAt = now;
      upsertPayload.positions_data = arr;
      upsertPayload.positions_updated_at = new Date(now).toISOString();
    }

    // Clear cooldown on a successful pass.
    if (traderRes || posRes) {
      upsertPayload.cooldown_until = null;
      const { error: upsertErr } = await svc
        .from("tl_account_cache")
        .upsert(upsertPayload, { onConflict: "user_id,trader_id" });
      if (!upsertErr) {
        hot.set(hotKey, {
          at: now,
          row: {
            account_data: finalAccData,
            account_updated_at: new Date(finalAccUpdatedAt).toISOString(),
            positions_data: finalPosData,
            positions_updated_at: new Date(finalPosUpdatedAt).toISOString(),
            cooldown_until: null,
          },
        });
      }
    }

    const cacheStatus: "hit" | "miss" | "partial" =
      !needAccount && !needPositions
        ? "hit"
        : needAccount && needPositions
        ? "miss"
        : "partial";

    return json(200, buildSuccess({
      account, traderId,
      accData: finalAccData,
      positions: finalPosData,
      cache: cacheStatus,
      cacheAgeMs: {
        account: now - finalAccUpdatedAt,
        positions: now - finalPosUpdatedAt,
      },
      upstreamCallsAvoided,
      cacheStore: "postgres",
      debug,
    }));
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : String(e) });
  }
});

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
  cacheStore?: string;
  debug?: boolean;
}) {
  const {
    account, traderId, accData, positions, cache, cacheAgeMs,
    nextRefreshAllowedAt, usingLastKnownGood, rateLimited, stale, retryAfter,
    upstreamCallsAvoided, cacheStore,
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
    cacheStore: cacheStore ?? "postgres",
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
