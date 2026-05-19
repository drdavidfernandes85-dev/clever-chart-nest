/**
 * liveMarketDataStore
 * --------------------
 * Single in-app source of truth for live market data (quotes, account,
 * positions, connection status). Framework-agnostic pub/sub store.
 *
 * Only ONE writer is allowed: src/services/MarketDataService.ts.
 * UI widgets MUST read via the hooks in src/hooks/useLiveMarketData.ts
 * (or subscribe() directly). Do NOT poll Trading Layer from widgets.
 */

export type MarketStatus =
  | "live_stream"
  | "live_polling"
  | "stale"
  | "rate_limited"
  | "disconnected";

export interface LiveQuote {
  symbol: string;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  last: number | null;
  digits: number | null;
  timestamp: number; // ms epoch when received
  source: "polling" | "stream" | "manual";
}

export interface LiveAccountSnapshot {
  login: string;
  server: string;
  status: string;
  currency: string;
  leverage: number | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  marginFree: number | null;
  profit: number | null;
  openPositionsCount: number;
  lastSynced: string | null;
}

export interface LivePositionRow {
  ticket: string | number | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
  open_time?: string | null;
}

export interface MarketDataDiagnostics {
  activeLoops: string[];
  lastTickAt: number | null;
  polledSymbols: string[];
  requestsLast60s: number;
  requestsPerMinute: number;
}

export interface RateLimitInfo {
  active: boolean;
  resumesAt: number | null;
  seconds: number;
}

export interface LiveMarketDataState {
  quotes: Record<string, LiveQuote>;
  account: LiveAccountSnapshot | null;
  positions: LivePositionRow[];
  status: MarketStatus;
  rateLimit: RateLimitInfo;
  diagnostics: MarketDataDiagnostics;
  lastError: string | null;
}

type Listener = (s: LiveMarketDataState) => void;

const STALE_AFTER_MS = 20_000;

const initial: LiveMarketDataState = {
  quotes: {},
  account: null,
  positions: [],
  status: "disconnected",
  rateLimit: { active: false, resumesAt: null, seconds: 0 },
  diagnostics: {
    activeLoops: [],
    lastTickAt: null,
    polledSymbols: [],
    requestsLast60s: 0,
    requestsPerMinute: 0,
  },
  lastError: null,
};

let state: LiveMarketDataState = initial;
const listeners = new Set<Listener>();
const requestTimestamps: number[] = []; // ms epochs of recent outbound requests

function emit() {
  for (const l of listeners) {
    try {
      l(state);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

function setState(patch: Partial<LiveMarketDataState>) {
  state = { ...state, ...patch };
  emit();
}

export const liveMarketDataStore = {
  getState(): LiveMarketDataState {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /* ---------- Writer API (service-only) ---------- */

  setQuote(q: LiveQuote) {
    state = {
      ...state,
      quotes: { ...state.quotes, [q.symbol.toUpperCase()]: q },
      diagnostics: { ...state.diagnostics, lastTickAt: q.timestamp },
    };
    emit();
  },

  setQuotes(qs: LiveQuote[]) {
    if (!qs.length) return;
    const next = { ...state.quotes };
    let lastTs = state.diagnostics.lastTickAt ?? 0;
    for (const q of qs) {
      next[q.symbol.toUpperCase()] = q;
      if (q.timestamp > lastTs) lastTs = q.timestamp;
    }
    state = {
      ...state,
      quotes: next,
      diagnostics: { ...state.diagnostics, lastTickAt: lastTs },
    };
    emit();
  },

  setAccount(account: LiveAccountSnapshot | null) {
    setState({ account });
  },

  setPositions(positions: LivePositionRow[]) {
    setState({ positions });
  },

  setStatus(status: MarketStatus) {
    if (state.status !== status) setState({ status });
  },

  setLastError(err: string | null) {
    if (state.lastError !== err) setState({ lastError: err });
  },

  setActiveLoops(loops: string[]) {
    setState({ diagnostics: { ...state.diagnostics, activeLoops: loops } });
  },

  setPolledSymbols(symbols: string[]) {
    setState({
      diagnostics: {
        ...state.diagnostics,
        polledSymbols: Array.from(new Set(symbols.map((s) => s.toUpperCase()))),
      },
    });
  },

  recordRequest() {
    const now = Date.now();
    requestTimestamps.push(now);
    // Drop entries older than 60s.
    const cutoff = now - 60_000;
    while (requestTimestamps.length && requestTimestamps[0] < cutoff) {
      requestTimestamps.shift();
    }
    setState({
      diagnostics: {
        ...state.diagnostics,
        requestsLast60s: requestTimestamps.length,
        requestsPerMinute: requestTimestamps.length,
      },
    });
  },

  setRateLimit(active: boolean, resumesAt: number | null, seconds = 0) {
    setState({
      rateLimit: { active, resumesAt, seconds },
      status: active ? "rate_limited" : state.status,
    });
  },

  /* ---------- Derived helpers ---------- */

  isStale(): boolean {
    const ts = state.diagnostics.lastTickAt;
    if (!ts) return true;
    return Date.now() - ts > STALE_AFTER_MS;
  },

  getQuote(symbol: string): LiveQuote | null {
    if (!symbol) return null;
    return state.quotes[symbol.toUpperCase()] ?? null;
  },
};

export type LiveMarketDataStore = typeof liveMarketDataStore;
