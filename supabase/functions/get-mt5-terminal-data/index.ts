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
// get-mt5-terminal-data
// Unified Trading Terminal endpoint. Returns in a single call:
//   - account          : live MT5 account snapshot (balance, equity, margin…)
//   - positions        : open positions for the account
//   - selectedSymbolInfo + tick + specs + price : details for `selectedSymbol`
//   - symbols          : full broker symbols universe (only when includeSymbols=true)
//
// This consolidates get-live-account + get-mt5-symbol-data + get-mt5-symbols
// so the Live Charts / Trading Terminal page only needs one network call per
// poll cycle.

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

const normalizeSymbol = (v: string) =>
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

function mapSymbolInfo(item: any) {
  if (!item?.name) return null;
  return {
    name: item.name,
    brokerSymbol: item.name,
    displayName: item.name,
    description: item.description || "",
    digits: item.digits ?? null,
    point: item.point ?? null,
    contractSize: item.trade_contract_size ?? null,
    tickValue: item.trade_tick_value ?? null,
    // Side-correct per-tick values. Profit-side drives TP projection,
    // loss-side drives SL projection. Often equal on majors; can differ on CFDs.
    tickValueProfit: item.trade_tick_value_profit ?? null,
    tickValueLoss: item.trade_tick_value_loss ?? null,
    tickSize: item.trade_tick_size ?? null,
    volumeMin: item.volume_min ?? null,
    volumeMax: item.volume_max ?? null,
    volumeStep: item.volume_step ?? null,
    currencyBase: item.currency_base ?? null,
    currencyProfit: item.currency_profit ?? null,
    currencyMargin: item.currency_margin ?? null,
    // Surfaced for diagnostics only — explicitly NOT a green-light to synthesise
    // margin client-side. Per-group rates + hedged-exposure rules are still absent.
    tradeCalcMode: item.trade_calc_mode ?? null,
  };
}

function mapSymbolLite(item: any) {
  const name = item?.name || item?.symbol || item;
  if (!name || typeof name !== "string") return null;
  return {
    name,
    brokerSymbol: name,
    symbol: name,
    displayName: name,
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
  const mapped = list.map(mapSymbolLite).filter(Boolean) as any[];
  const seen = new Map<string, any>();
  for (const item of mapped) {
    const key = String(item?.brokerSymbol || item?.name || "").toUpperCase();
    if (key && !seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
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

    const body = await req.json().catch(() => ({}));
    const selectedSymbol = normalizeSymbol(body.selectedSymbol || "EURUSD");
    const includeSymbols = body.includeSymbols === true;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ success: false, step: "auth", error: "Unauthorized." }, 401);
    }

    // Resolve linked account (self-heal from tenant if needed)
    let { data: account } = await supabase
      .from("user_mt_accounts")
      .select("id, login, server_name, status, last_synced_at, metaapi_account_id, created_at")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Auto-heal removed: see get-live-account. Only `connect-mt5-v2` is
    // allowed to write Trading Layer IDs into `user_mt_accounts`.


    if (!account?.metaapi_account_id) {
      return json({
        success: false,
        accountConnected: false,
        step: "account_lookup",
        error: "No connected MT5 account found.",
      }, 200);
    }

    const accountId = account.metaapi_account_id;

    // Parallel: trader summary, positions, exact symbol info, pending orders
    const symbolPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols/${encodeURIComponent(selectedSymbol)}`;
    const [traderRes, posRes, symRes, ordRes] = await Promise.all([
      tlGet(`/api/v1/traders/${encodeURIComponent(accountId)}`),
      tlGet(`/api/v1/accounts/${encodeURIComponent(accountId)}/positions`),
      tlGet(symbolPath),
      tlGet(`/api/v1/accounts/${encodeURIComponent(accountId)}/orders?limit=200`),
    ]);

    // ---- Account + positions ----
    const traderData = traderRes.data ?? {};
    const acc = traderData?.data?.account ?? {};
    const mt5 = traderData?.data?.mt5 ?? {};
    const positionsRaw = Array.isArray(posRes.data?.data) ? posRes.data.data : [];
    const positions = positionsRaw.map((p: any) => {
      const baseProfit = Number(p?.profit ?? p?.pnl ?? 0);
      const swap = Number(p?.swap ?? 0);
      const commission = Number(p?.commission ?? 0);
      return {
        ticket: p?.ticket ?? p?.id ?? null,
        symbol: p?.symbol ?? "",
        side: (p?.side ?? p?.action ?? p?.type ?? "").toString().toLowerCase().includes("sell") ? "sell" : "buy",
        volume: Number(p?.volume ?? p?.lots ?? 0),
        entry_price: Number(p?.open_price ?? p?.openPrice ?? p?.entry_price ?? p?.price_open ?? 0),
        current_price: Number(p?.current_price ?? p?.currentPrice ?? p?.price_current ?? 0),
        stop_loss: p?.stop_loss ?? p?.sl ?? null,
        take_profit: p?.take_profit ?? p?.tp ?? null,
        profit: baseProfit,
        swap,
        commission,
        // Net floating P&L for this position INCLUDING swap+commission, so the
        // sum reconciles with broker-side (equity - balance - credit).
        net_profit: baseProfit + swap + commission,
        time_open: p?.time ?? p?.time_open ?? p?.open_time ?? null,
        time_open_msc: p?.time_msc ?? p?.time_open_msc ?? null,
      };
    });

    // ---- Pending orders ----
    // MT5 order type ints: 0=BUY, 1=SELL, 2=BUY_LIMIT, 3=SELL_LIMIT,
    // 4=BUY_STOP, 5=SELL_STOP, 6=BUY_STOP_LIMIT, 7=SELL_STOP_LIMIT
    // type_time ints: 0=GTC, 1=DAY, 2=SPECIFIED (GTD), 3=SPECIFIED_DAY
    const ordersRaw = Array.isArray(ordRes.data?.data) ? ordRes.data.data : [];
    const orderTypeMap: Record<number, { kind: string; side: "buy" | "sell" }> = {
      0: { kind: "market", side: "buy" },
      1: { kind: "market", side: "sell" },
      2: { kind: "limit",  side: "buy" },
      3: { kind: "limit",  side: "sell" },
      4: { kind: "stop",   side: "buy" },
      5: { kind: "stop",   side: "sell" },
      6: { kind: "stop_limit", side: "buy" },
      7: { kind: "stop_limit", side: "sell" },
    };
    const durationMap: Record<number, string> = { 0: "GTC", 1: "DAY", 2: "GTD", 3: "SPECIFIED_DAY" };
    const pendingOrders = ordersRaw
      .filter((o: any) => {
        // state 1=PLACED is the live pending state; others (filled/cancelled/expired) are history.
        const st = Number(o?.state ?? 0);
        return st === 1 || st === 2 || st === 3 || st === 6; // PLACED/PARTIAL/STARTED/REQUEST_ADD
      })
      .map((o: any) => {
        const typeInt = Number(o?.type ?? -1);
        const map = orderTypeMap[typeInt] || { kind: "unknown", side: "buy" as const };
        const ttime = Number(o?.type_time ?? 0);
        return {
          ticket: o?.ticket ?? null,
          symbol: o?.symbol ?? "",
          orderType: map.kind,
          side: map.side,
          volume: Number(o?.volume_current ?? o?.volume_initial ?? 0),
          volume_initial: Number(o?.volume_initial ?? 0),
          price_open: Number(o?.price_open ?? 0),
          price_stoplimit: Number(o?.price_stoplimit ?? 0) || null,
          price_current: Number(o?.price_current ?? 0),
          stop_loss: o?.sl ?? null,
          take_profit: o?.tp ?? null,
          duration: durationMap[ttime] ?? "GTC",
          time_setup: o?.time_setup ?? null,
          time_setup_msc: o?.time_setup_msc ?? null,
          time_expiration: o?.time_expiration ?? null,
          position_id: o?.position_id ?? null,
          comment: o?.comment ?? "",
          state: Number(o?.state ?? 0),
          rawType: typeInt,
          rawTypeTime: ttime,
        };
      });

    const num = (v: any): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const balance = num(acc.balance ?? mt5.balance);
    const equity = num(acc.equity ?? mt5.equity);
    // Trading Layer's /traders/{id} does NOT return margin or free_margin.
    // Surface as null so the UI shows "—" rather than a misleading 0.
    const margin = num(acc.margin ?? mt5.margin);
    const marginFree = num(
      acc.free_margin ?? acc.freeMargin ?? mt5.free_margin ?? mt5.freeMargin,
    );
    // AUTHORITATIVE floating P&L: broker's own value from the same trader
    // snapshot as `equity`. Includes swap/commission. Guarantees
    // equity == balance + profit + credit (modulo broker rounding).
    // Sum-of-positions[].profit is intentionally NOT used here because the
    // positions endpoint is a separate read at a later tick, and individual
    // `position.profit` excludes swap (returned in a separate field).
    const profit = num(acc.profit ?? mt5.profit);
    const credit = num(acc.credit ?? mt5.credit) ?? 0;
    const currency = acc.currency ?? mt5.currency ?? "USD";
    const leverage = acc.leverage ?? mt5.leverage ?? null;

    const accountOut = {
      traderId: accountId,
      login: account.login,
      server: account.server_name,
      status: account.status,
      currency,
      leverage,
      balance,
      equity,
      margin,
      marginFree,
      profit,
      credit,
      openPositionsCount: positions.length,
      lastSynced: account.last_synced_at,
    };

    // ---- Selected symbol info + tick ----
    let selectedSymbolInfo: any = null;
    let selectedSymbolValid = false;
    let tick: any = null;

    if (symRes.ok && symRes.data?.data) {
      selectedSymbolInfo = mapSymbolInfo(symRes.data.data);
      selectedSymbolValid = !!selectedSymbolInfo;
    }
    if (selectedSymbolValid) {
      const tickRes = await tlGet(`${symbolPath}/tick`);
      if (tickRes.ok && tickRes.data?.data) tick = tickRes.data.data;
    }

    const bid = tick?.bid != null ? Number(tick.bid) : null;
    const ask = tick?.ask != null ? Number(tick.ask) : null;
    const last = tick?.last != null
      ? Number(tick.last)
      : bid != null && ask != null ? (bid + ask) / 2 : null;
    const price = { bid, ask, last, spread: bid != null && ask != null ? Math.max(0, ask - bid) : null };

    const specs = selectedSymbolInfo
      ? {
          digits: selectedSymbolInfo.digits,
          point: selectedSymbolInfo.point,
          contractSize: selectedSymbolInfo.contractSize,
          tickValue: selectedSymbolInfo.tickValue,
          tickValueProfit: selectedSymbolInfo.tickValueProfit,
          tickValueLoss: selectedSymbolInfo.tickValueLoss,
          tickSize: selectedSymbolInfo.tickSize,
          volumeMin: selectedSymbolInfo.volumeMin,
          volumeMax: selectedSymbolInfo.volumeMax,
          volumeStep: selectedSymbolInfo.volumeStep,
          currencyBase: selectedSymbolInfo.currencyBase,
          currencyProfit: selectedSymbolInfo.currencyProfit,
          currencyMargin: selectedSymbolInfo.currencyMargin,
          tradeCalcMode: selectedSymbolInfo.tradeCalcMode,
        }
      : null;

    // ---- Optional: full symbols universe (heavy, only on demand) ----
    let symbols: any[] = [];
    let symbolsLoaded = false;
    if (includeSymbols) {
      const accountPath = `/api/v1/accounts/${encodeURIComponent(accountId)}/symbols`;
      let rawList: any[] = [];

      // Try big-pull variants first
      for (const p of [
        `${accountPath}?limit=10000`,
        `${accountPath}?limit=5000`,
        accountPath,
      ]) {
        const r = await tlGet(p);
        const list = r.ok ? extractList(r.data) : [];
        if (list.length > rawList.length) rawList = list;
        if (rawList.length >= 200) break;
      }

      // Plus offset pagination as a safety net
      const PAGE = 500;
      const MAX_PAGES = 200;
      const paged: any[] = [];
      for (let i = 0; i < MAX_PAGES; i++) {
        const r = await tlGet(`${accountPath}?limit=${PAGE}&offset=${i * PAGE}`);
        const list = r.ok ? extractList(r.data) : [];
        if (!r.ok || list.length === 0) break;
        paged.push(...list);
        if (list.length < PAGE) break;
      }
      if (paged.length > rawList.length) rawList = paged;
      else if (paged.length) rawList = [...rawList, ...paged];

      symbols = dedupeSymbols(rawList);
      symbolsLoaded = symbols.length > 0;
    }

    return json({
      success: true,
      accountConnected: true,
      account: accountOut,
      positions,
      pendingOrders,
      selectedSymbol,
      selectedSymbolValid,
      selectedSymbolInfo,
      tick,
      price,
      specs,
      symbols,
      symbolsLoaded,
      count: symbols.length,
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
