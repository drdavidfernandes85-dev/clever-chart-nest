// _shared/marketHistory.ts
// Provider-agnostic read seam for OHLC candles.
// Per-request routing: try Trading Layer first (short timeout); on 5xx / timeout
// / shape-error, fall back to MetaAPI. Routing decision is per-call, never sticky
// — TL recovering means TL serves the very next request, no redeploy.
//
// METAAPI_TOKEN lives in Edge Function secrets only; it is never returned.
// Callers receive { bars, source } only — `source` is a display label.

export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export interface Bar {
  /** ms since UNIX epoch — bar OPEN time, UTC */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Tick volume only (no real volume on this broker). May be 0. */
  tickVolume: number;
}

export interface CandlesResult {
  bars: Bar[];
  source: "trading_layer" | "metaapi";
  /** ms server-side latency for the call that ultimately served. */
  served_ms: number;
  /** Whether the seam attempted TL first and fell back. */
  fellBackFromTradingLayer: boolean;
  /** Reason for TL miss when fellBackFromTradingLayer === true. */
  fallbackReason?: string;
}

export interface CandlesQuery {
  symbol: string;            // Broker symbol (e.g. "XAUUSD")
  timeframe: Timeframe;
  /** UNIX ms. Optional. If omitted: most-recent N bars. */
  startTime?: number;
  /** Bars to return (cap-enforced per provider). */
  limit: number;
}

const TL_BASE = "https://api.trading-layer.com";
const TL_TIMEOUT_MS = 1500;
const METAAPI_TOKEN = () => Deno.env.get("METAAPI_TOKEN") ?? "";
const METAAPI_REGION = "london"; // probe-confirmed for account 077d6ed8-…

/** Provider-published limits (report in admin pill / docs). */
export const PROVIDER_LIMITS = {
  trading_layer: { maxBarsPerRequest: 1000, observedAvailability: "intermittent" },
  metaapi:       { maxBarsPerRequest: 1000, observedAvailability: "deployed-connected" },
} as const;

const TF_TO_METAAPI: Record<Timeframe, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
  "1h": "1h", "4h": "4h", "1d": "1d",
};

function withTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, cancel: () => clearTimeout(t) };
}

/* ---------- Trading Layer attempt ---------- */
async function tryTradingLayer(
  q: CandlesQuery,
  tradingLayerAccountId: string,
): Promise<{ ok: true; bars: Bar[]; ms: number } | { ok: false; reason: string }> {
  const key = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!key) return { ok: false, reason: "TL_KEY_MISSING" };
  if (!tradingLayerAccountId) return { ok: false, reason: "TL_ACCOUNT_ID_MISSING" };
  const url = `${TL_BASE}/api/v1/accounts/${tradingLayerAccountId}/rates`
    + `?symbol=${encodeURIComponent(q.symbol)}`
    + `&timeframe=${q.timeframe}`
    + `&limit=${q.limit}`
    + (q.startTime ? `&from=${Math.floor(q.startTime / 1000)}` : "");
  const t0 = Date.now();
  const { signal, cancel } = withTimeout(TL_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal,
    });
    cancel();
    const ms = Date.now() - t0;
    if (r.status >= 500) return { ok: false, reason: `TL_${r.status}` };
    if (!r.ok)            return { ok: false, reason: `TL_${r.status}` };
    const txt = await r.text();
    let body: any; try { body = JSON.parse(txt); } catch { return { ok: false, reason: "TL_BAD_JSON" }; }
    const rows: any[] = Array.isArray(body) ? body : (body?.data ?? body?.rates ?? body?.candles ?? []);
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: "TL_EMPTY" };
    const bars: Bar[] = [];
    for (const r0 of rows) {
      const tRaw = r0.time ?? r0.timestamp ?? r0.t ?? r0.openTime;
      const time = typeof tRaw === "number"
        ? (tRaw > 10_000_000_000 ? tRaw : tRaw * 1000)
        : Date.parse(String(tRaw));
      const o = Number(r0.open ?? r0.o); const h = Number(r0.high ?? r0.h);
      const l = Number(r0.low  ?? r0.l); const c = Number(r0.close ?? r0.c);
      const v = Number(r0.tickVolume ?? r0.tick_volume ?? r0.volume ?? r0.v ?? 0);
      if (!Number.isFinite(time) || !Number.isFinite(o)) continue;
      bars.push({ time, open: o, high: h, low: l, close: c, tickVolume: v });
    }
    if (bars.length === 0) return { ok: false, reason: "TL_UNPARSEABLE" };
    return { ok: true, bars, ms };
  } catch (e) {
    cancel();
    return { ok: false, reason: (e as Error).name === "AbortError" ? "TL_TIMEOUT" : "TL_NETWORK" };
  }
}

/* ---------- MetaAPI attempt ---------- */
async function tryMetaApi(q: CandlesQuery, metaapiAccountId: string):
  Promise<{ ok: true; bars: Bar[]; ms: number } | { ok: false; reason: string }>
{
  const tok = METAAPI_TOKEN();
  if (!tok) return { ok: false, reason: "METAAPI_TOKEN_MISSING" };
  if (!metaapiAccountId) return { ok: false, reason: "METAAPI_ACCOUNT_ID_MISSING" };
  const tf = TF_TO_METAAPI[q.timeframe];
  if (!tf) return { ok: false, reason: "TIMEFRAME_UNSUPPORTED" };
  const base = `https://mt-market-data-client-api-v1.${METAAPI_REGION}.agiliumtrade.ai`
             + `/users/current/accounts/${metaapiAccountId}`
             + `/historical-market-data/symbols/${encodeURIComponent(q.symbol)}`
             + `/timeframes/${tf}/candles`;
  const params = new URLSearchParams();
  params.set("limit", String(Math.min(q.limit, PROVIDER_LIMITS.metaapi.maxBarsPerRequest)));
  if (q.startTime) params.set("startTime", new Date(q.startTime).toISOString());
  const url = `${base}?${params.toString()}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "auth-token": tok, "Content-Type": "application/json" } });
    const ms = Date.now() - t0;
    if (!r.ok) {
      const snippet = (await r.text()).slice(0, 200);
      return { ok: false, reason: `META_${r.status}:${snippet}` };
    }
    const rows: any[] = await r.json();
    if (!Array.isArray(rows)) return { ok: false, reason: "META_BAD_SHAPE" };
    const bars: Bar[] = rows.map((c: any) => ({
      time: Date.parse(c.time),                  // ISO UTC string per A3 capture
      open: Number(c.open), high: Number(c.high),
      low:  Number(c.low),  close: Number(c.close),
      tickVolume: Number(c.tickVolume ?? 0),
    })).filter((b) => Number.isFinite(b.time) && Number.isFinite(b.open));
    if (bars.length === 0) return { ok: false, reason: "META_EMPTY" };
    return { ok: true, bars, ms };
  } catch (e) {
    return { ok: false, reason: `META_NETWORK:${String((e as Error).message)}` };
  }
}

/* ---------- Public seam ---------- */
export interface SeamRouteCtx {
  tradingLayerAccountId: string | null;
  metaapiAccountId: string | null;
}

export async function getCandles(q: CandlesQuery, ctx: SeamRouteCtx): Promise<CandlesResult> {
  // TL-first per request (not sticky)
  if (ctx.tradingLayerAccountId) {
    const tl = await tryTradingLayer(q, ctx.tradingLayerAccountId);
    if (tl.ok) {
      return { bars: tl.bars, source: "trading_layer", served_ms: tl.ms, fellBackFromTradingLayer: false };
    }
    const meta = await tryMetaApi(q, ctx.metaapiAccountId ?? "");
    if (meta.ok) {
      return {
        bars: meta.bars, source: "metaapi", served_ms: meta.ms,
        fellBackFromTradingLayer: true, fallbackReason: tl.reason,
      };
    }
    throw new Error(`BOTH_PROVIDERS_FAILED: tl=${tl.reason}; meta=${meta.reason}`);
  }
  // No TL account → MetaAPI only
  const meta = await tryMetaApi(q, ctx.metaapiAccountId ?? "");
  if (meta.ok) {
    return {
      bars: meta.bars, source: "metaapi", served_ms: meta.ms,
      fellBackFromTradingLayer: false,
    };
  }
  throw new Error(`METAAPI_FAILED: ${meta.reason}`);
}

/* ---------- Deals history seam (Item 3) ---------- */
export interface DealRow {
  ticket: string;
  positionId: string | null;
  symbol: string;
  type: string;
  entry: "in" | "out" | "inout" | "out_by" | string;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: number; // ms UTC
  raw: any;
}

export interface DealsResult {
  deals: DealRow[];
  source: "trading_layer" | "metaapi";
  served_ms: number;
  fellBackFromTradingLayer: boolean;
  fallbackReason?: string;
}

export async function getDealsHistory(
  range: { startTime: number; endTime: number },
  ctx: SeamRouteCtx,
): Promise<DealsResult> {
  // TL deals endpoint (history/deals) — try first, short timeout.
  if (ctx.tradingLayerAccountId) {
    const tl = await tryTradingLayerDeals(range, ctx.tradingLayerAccountId);
    if (tl.ok) {
      return { deals: tl.deals, source: "trading_layer", served_ms: tl.ms, fellBackFromTradingLayer: false };
    }
    const meta = await tryMetaApiDeals(range, ctx.metaapiAccountId ?? "");
    if (meta.ok) {
      return { deals: meta.deals, source: "metaapi", served_ms: meta.ms,
               fellBackFromTradingLayer: true, fallbackReason: tl.reason };
    }
    throw new Error(`DEALS_BOTH_FAILED: tl=${tl.reason}; meta=${meta.reason}`);
  }
  const meta = await tryMetaApiDeals(range, ctx.metaapiAccountId ?? "");
  if (meta.ok) {
    return { deals: meta.deals, source: "metaapi", served_ms: meta.ms, fellBackFromTradingLayer: false };
  }
  throw new Error(`DEALS_METAAPI_FAILED: ${meta.reason}`);
}

async function tryTradingLayerDeals(
  range: { startTime: number; endTime: number },
  tradingLayerAccountId: string,
): Promise<{ ok: true; deals: DealRow[]; ms: number } | { ok: false; reason: string }> {
  const key = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!key) return { ok: false, reason: "TL_KEY_MISSING" };
  const url = `${TL_BASE}/api/v1/accounts/${tradingLayerAccountId}/history/deals`
    + `?from=${Math.floor(range.startTime / 1000)}&to=${Math.floor(range.endTime / 1000)}`;
  const t0 = Date.now();
  const { signal, cancel } = withTimeout(2500);
  try {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal,
    });
    cancel();
    const ms = Date.now() - t0;
    if (!r.ok) return { ok: false, reason: `TL_${r.status}` };
    const body: any = await r.json();
    const rows: any[] = Array.isArray(body) ? body : (body?.data ?? body?.deals ?? []);
    if (!Array.isArray(rows)) return { ok: false, reason: "TL_BAD_SHAPE" };
    const deals = rows.map(normalizeTLDeal).filter(Boolean) as DealRow[];
    return { ok: true, deals, ms };
  } catch (e) {
    cancel();
    return { ok: false, reason: (e as Error).name === "AbortError" ? "TL_TIMEOUT" : "TL_NETWORK" };
  }
}

function normalizeTLDeal(r: any): DealRow | null {
  const tRaw = r.time ?? r.timestamp ?? r.closeTime;
  const time = typeof tRaw === "number" ? (tRaw > 1e10 ? tRaw : tRaw * 1000) : Date.parse(String(tRaw));
  if (!Number.isFinite(time)) return null;
  return {
    ticket: String(r.ticket ?? r.id ?? ""),
    positionId: r.positionId ? String(r.positionId) : null,
    symbol: String(r.symbol ?? ""),
    type: String(r.type ?? ""),
    entry: String(r.entry ?? ""),
    volume: Number(r.volume ?? r.lots ?? 0),
    price: Number(r.price ?? 0),
    profit: Number(r.profit ?? 0),
    commission: Number(r.commission ?? 0),
    swap: Number(r.swap ?? 0),
    time,
    raw: r,
  };
}

async function tryMetaApiDeals(
  range: { startTime: number; endTime: number },
  metaapiAccountId: string,
): Promise<{ ok: true; deals: DealRow[]; ms: number } | { ok: false; reason: string }> {
  const tok = METAAPI_TOKEN();
  if (!tok) return { ok: false, reason: "METAAPI_TOKEN_MISSING" };
  if (!metaapiAccountId) return { ok: false, reason: "METAAPI_ACCOUNT_ID_MISSING" };
  const url = `https://mt-client-api-v1.${METAAPI_REGION}.agiliumtrade.ai`
    + `/users/current/accounts/${metaapiAccountId}/history-deals/time/`
    + `${new Date(range.startTime).toISOString()}/${new Date(range.endTime).toISOString()}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { "auth-token": tok } });
    const ms = Date.now() - t0;
    if (!r.ok) {
      const snippet = (await r.text()).slice(0, 200);
      return { ok: false, reason: `META_${r.status}:${snippet}` };
    }
    const rows: any[] = await r.json();
    if (!Array.isArray(rows)) return { ok: false, reason: "META_BAD_SHAPE" };
    const deals: DealRow[] = rows.map((d: any) => ({
      ticket: String(d.id ?? d.ticket ?? ""),
      positionId: d.positionId ? String(d.positionId) : null,
      symbol: String(d.symbol ?? ""),
      type: String(d.type ?? ""),
      entry: String(d.entryType ?? d.entry ?? ""),
      volume: Number(d.volume ?? 0),
      price: Number(d.price ?? 0),
      profit: Number(d.profit ?? 0),
      commission: Number(d.commission ?? 0),
      swap: Number(d.swap ?? 0),
      time: Date.parse(d.time),
      raw: d,
    })).filter((d) => Number.isFinite(d.time));
    return { ok: true, deals, ms };
  } catch (e) {
    return { ok: false, reason: `META_NETWORK:${String((e as Error).message)}` };
  }
}
