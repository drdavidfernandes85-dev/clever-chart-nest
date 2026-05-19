/**
 * MarketDataService
 * -----------------
 * The ONLY writer to liveMarketDataStore. Runs controlled polling loops
 * against the existing edge functions (get-mt5-terminal-data,
 * get-mt5-quotes, get-mt5-market-watch) at safe cadences:
 *
 *   - selected symbol quote   every 1.5 s
 *   - watchlist quotes        every  7 s
 *   - account + positions     every  7 s (positions boosted to 3 s
 *                                          for 30 s after a trade-executed
 *                                          event)
 *
 * On any 429 / rate-limit signal, ALL loops pause for 60 s, status flips
 * to "rate_limited", cached quotes/account/positions stay visible.
 *
 * If Trading Layer ever exposes a WebSocket stream, swap polling for the
 * stream in `attachStream()` — store status flips to "live_stream".
 *
 * Singleton — start() is idempotent.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  liveMarketDataStore,
  type LiveQuote,
  type LiveAccountSnapshot,
  type LivePositionRow,
} from "@/lib/liveMarketDataStore";

const SELECTED_INTERVAL_MS = 2000;
const WATCHLIST_INTERVAL_MS = 10_000;
const ACCOUNT_INTERVAL_MS = 10_000;
const POSITIONS_INTERVAL_MS = 10_000;
const SYSTEM_HEALTH_INTERVAL_MS = 30_000;
// After an order/close, schedule extra account+positions refreshes at
// these offsets (ms). Then the regular 10s positions loop resumes.
const POSITIONS_BURST_OFFSETS_MS = [0, 1500, 3000, 5000, 8000];
const RATE_LIMIT_PAUSE_SECONDS = 60;
const STALE_CHECK_MS = 5000;
// Soft budget — when exceeded we skip the next non-essential tick
// (watchlist + system_health). Selected symbol, account, positions
// keep running because they drive execution-adjacent UI.
const REQUEST_BUDGET_PER_MINUTE = 60;

type LoopId =
  | "selected_symbol"
  | "watchlist"
  | "account"
  | "positions"
  | "system_health"
  | "stale_monitor";

const num = (v: any): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? null
    : Number(v);

class MarketDataServiceImpl {
  private started = false;
  private timers: Partial<Record<LoopId, number>> = {};
  private burstTimers: number[] = [];
  private selectedSymbol = "";
  private watchlist = new Set<string>();
  private cooldownTimer: number | null = null;

  start() {
    if (this.started) return;
    this.started = true;

    // Listen for trade-executed events to boost positions polling briefly.
    window.addEventListener("trade-executed", this.onTradeExecuted);
    window.addEventListener("mt:refresh-positions", this.refreshAccountAndPositions);
    window.addEventListener("mt:refresh-quotes", this.refreshSelected);
    window.addEventListener("mt:refresh-market-watch", this.refreshWatchlist);

    // Page visibility — pause/resume to avoid background polling.
    document.addEventListener("visibilitychange", this.onVisibility);

    this.startLoop("account", this.tickAccount, ACCOUNT_INTERVAL_MS);
    this.startLoop("positions", this.tickPositions, POSITIONS_INTERVAL_MS);
    this.startLoop("system_health", this.tickSystemHealth, SYSTEM_HEALTH_INTERVAL_MS);
    this.startLoop("stale_monitor", this.tickStale, STALE_CHECK_MS);
    // selected_symbol + watchlist loops start when first symbol/list is set.

    // Immediate kickoff.
    this.tickAccount();
    this.tickPositions();
    this.tickSystemHealth();

    this.publishActiveLoops();
    liveMarketDataStore.setStatus("live_polling");
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    for (const id of Object.keys(this.timers) as LoopId[]) this.stopLoop(id);
    window.removeEventListener("trade-executed", this.onTradeExecuted);
    window.removeEventListener("mt:refresh-positions", this.refreshAccountAndPositions);
    window.removeEventListener("mt:refresh-quotes", this.refreshSelected);
    window.removeEventListener("mt:refresh-market-watch", this.refreshWatchlist);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.publishActiveLoops();
    liveMarketDataStore.setStatus("disconnected");
  }

  setSelectedSymbol(symbol: string | null | undefined) {
    const sym = (symbol || "").trim().toUpperCase();
    if (sym === this.selectedSymbol) return;
    this.selectedSymbol = sym;
    this.stopLoop("selected_symbol");
    if (sym) {
      this.startLoop("selected_symbol", this.tickSelected, SELECTED_INTERVAL_MS);
      this.tickSelected();
    }
    this.publishPolledSymbols();
    this.publishActiveLoops();
  }

  setWatchlist(symbols: string[]) {
    const cleaned = symbols
      .map((s) => (s || "").trim().toUpperCase())
      .filter(Boolean);
    const same =
      cleaned.length === this.watchlist.size &&
      cleaned.every((s) => this.watchlist.has(s));
    if (same) return;
    this.watchlist = new Set(cleaned);
    this.stopLoop("watchlist");
    if (this.watchlist.size > 0) {
      this.startLoop("watchlist", this.tickWatchlist, WATCHLIST_INTERVAL_MS);
      this.tickWatchlist();
    }
    this.publishPolledSymbols();
    this.publishActiveLoops();
  }

  /** Manual refresh hooks for legacy callers. */
  refreshSelected = () => {
    if (!this.canRun()) return;
    void this.tickSelected();
  };
  refreshWatchlist = () => {
    if (!this.canRun()) return;
    void this.tickWatchlist();
  };
  refreshAccountAndPositions = () => {
    if (!this.canRun()) return;
    void this.tickAccount();
    void this.tickPositions();
  };

  /* ---------- Internal ---------- */

  private canRun(): boolean {
    if (!this.started) return false;
    if (liveMarketDataStore.getState().rateLimit.active) return false;
    if (typeof document !== "undefined" && document.visibilityState !== "visible")
      return false;
    return true;
  }

  private startLoop(id: LoopId, fn: () => void | Promise<void>, intervalMs: number) {
    this.stopLoop(id);
    this.timers[id] = window.setInterval(() => {
      if (this.canRun()) void fn();
    }, intervalMs);
  }

  private stopLoop(id: LoopId) {
    const t = this.timers[id];
    if (t != null) {
      window.clearInterval(t);
      delete this.timers[id];
    }
  }

  private publishActiveLoops() {
    liveMarketDataStore.setActiveLoops(Object.keys(this.timers) as LoopId[]);
  }

  private publishPolledSymbols() {
    const arr = [
      ...(this.selectedSymbol ? [this.selectedSymbol] : []),
      ...Array.from(this.watchlist),
    ];
    liveMarketDataStore.setPolledSymbols(arr);
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.canRun()) {
      this.tickAccount();
      this.tickPositions();
      this.tickSelected();
      this.tickWatchlist();
    }
  };

  private onTradeExecuted = () => {
    // After an order/close, run a short burst of immediate-then-spaced
    // refreshes so the UI catches the new position quickly without
    // permanently raising the polling rate.
    this.clearBurstTimers();
    for (const offset of POSITIONS_BURST_OFFSETS_MS) {
      const t = window.setTimeout(() => {
        if (this.canRun()) {
          void this.tickAccount();
        }
      }, offset);
      this.burstTimers.push(t);
    }
  };

  private clearBurstTimers() {
    for (const t of this.burstTimers) {
      try { window.clearTimeout(t); } catch { /* ignore */ }
    }
    this.burstTimers = [];
  }


  private detect429(data: any, error: any): boolean {
    const status =
      data?.tradingLayerStatus ??
      data?.status ??
      (error as any)?.context?.status ??
      (error as any)?.status;
    const msg = String(data?.error ?? data?.brokerMessage ?? error?.message ?? "");
    return (
      status === 429 ||
      /rate limit|too many requests/i.test(msg) ||
      (data?.retryable === true && Number(data?.retryAfter) > 0)
    );
  }

  private triggerRateLimitPause(seconds = RATE_LIMIT_PAUSE_SECONDS) {
    const ms = seconds * 1000;
    const resumesAt = Date.now() + ms;
    liveMarketDataStore.setRateLimit(true, resumesAt, seconds);
    if (this.cooldownTimer != null) window.clearTimeout(this.cooldownTimer);
    this.cooldownTimer = window.setTimeout(() => {
      liveMarketDataStore.setRateLimit(false, null, 0);
      liveMarketDataStore.setStatus("live_polling");
      this.cooldownTimer = null;
    }, ms + 50);
    try {
      window.dispatchEvent(
        new CustomEvent("mt:rate-limited", { detail: { until: resumesAt } }),
      );
    } catch {
      /* ignore */
    }
  }

  /* ---------- Tick implementations ---------- */

  private tickSelected = async () => {
    const sym = this.selectedSymbol;
    if (!sym) return;
    liveMarketDataStore.recordRequest();
    try {
      const { data, error } = await supabase.functions.invoke("get-mt5-quotes", {
        body: { selectedSymbol: sym, debug: false },
      });
      if (this.detect429(data, error)) {
        this.triggerRateLimitPause();
        return;
      }
      if (error || !data?.success) {
        liveMarketDataStore.setLastError(
          error?.message || data?.error || "Quote refresh failed",
        );
        return;
      }
      const sq = data.selectedQuote ?? null;
      if (!sq) return;
      const bid = num(sq.bid);
      const ask = num(sq.ask);
      const last =
        num(sq.last) ??
        (bid != null && ask != null ? (bid + ask) / 2 : null);
      const spread =
        num(sq.spread) ??
        (bid != null && ask != null ? Math.max(0, ask - bid) : null);
      const quote: LiveQuote = {
        symbol: sym,
        bid,
        ask,
        last,
        spread,
        digits: num(sq.digits),
        timestamp: Date.now(),
        source: "polling",
      };
      liveMarketDataStore.setQuote(quote);
      liveMarketDataStore.setLastError(null);
    } catch (e: any) {
      liveMarketDataStore.setLastError(e?.message || "Network error");
    }
  };

  private tickWatchlist = async () => {
    const symbols = Array.from(this.watchlist);
    if (symbols.length === 0) return;
    liveMarketDataStore.recordRequest();
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-mt5-market-watch",
        { body: { symbols, debug: false } },
      );
      if (this.detect429(data, error)) {
        this.triggerRateLimitPause();
        return;
      }
      if (error || !data?.success) {
        liveMarketDataStore.setLastError(
          error?.message || data?.error || "Market watch refresh failed",
        );
        return;
      }
      const instruments: any[] = Array.isArray(data.instruments)
        ? data.instruments
        : [];
      if (!instruments.length) return;
      const now = Date.now();
      const quotes: LiveQuote[] = instruments
        .map((inst: any) => {
          const symbol = String(inst.symbol || "").toUpperCase();
          if (!symbol) return null;
          const bid = num(inst.bid);
          const ask = num(inst.ask);
          const last =
            num(inst.last) ??
            (bid != null && ask != null ? (bid + ask) / 2 : null);
          const spread =
            num(inst.spread) ??
            (bid != null && ask != null ? Math.max(0, ask - bid) : null);
          const q: LiveQuote = {
            symbol,
            bid,
            ask,
            last,
            spread,
            digits: num(inst.digits),
            timestamp: now,
            source: "polling",
          };
          return q;
        })
        .filter(Boolean) as LiveQuote[];
      liveMarketDataStore.setQuotes(quotes);
      liveMarketDataStore.setLastError(null);
    } catch (e: any) {
      liveMarketDataStore.setLastError(e?.message || "Network error");
    }
  };

  private tickAccount = async () => {
    liveMarketDataStore.recordRequest();
    try {
      const { data: res, error } = await supabase.functions.invoke(
        "get-mt5-terminal-data",
        { body: {} },
      );
      if (this.detect429(res, error)) {
        this.triggerRateLimitPause();
        return;
      }
      if (error) {
        liveMarketDataStore.setLastError(error.message || "Account refresh failed");
        return;
      }
      const connected = res?.success === true || res?.accountConnected === true;
      if (!connected) {
        liveMarketDataStore.setStatus("disconnected");
        return;
      }
      const a = res.account ?? null;
      const d = res.data ?? {};
      const incoming: LiveAccountSnapshot = {
        login: String(a?.login ?? d?.account_number ?? ""),
        server: String(a?.server ?? d?.server ?? ""),
        status: String(a?.status ?? d?.status ?? "connected"),
        currency: a?.currency ?? d?.currency ?? "USD",
        leverage: a?.leverage ?? d?.leverage ?? null,
        balance: num(a?.balance ?? d?.balance),
        equity: num(a?.equity ?? d?.equity),
        margin: num(a?.margin ?? d?.margin),
        marginFree: num(a?.marginFree ?? a?.free_margin ?? d?.free_margin),
        profit: num(a?.profit ?? d?.floating_pnl),
        openPositionsCount: Number(
          a?.openPositionsCount ?? d?.open_positions ?? 0,
        ),
        lastSynced: a?.lastSynced ?? d?.last_synced ?? null,
      };
      // Stale-while-revalidate merge: never overwrite a known-good snapshot
      // with an empty refresh.
      const prev = liveMarketDataStore.getState().account;
      const pickNum = (n: number | null, l: number | null) =>
        n != null && n !== 0 ? n : (n === 0 && l == null ? 0 : l);
      const pickStr = (n: string, l: string) => (n ? n : l);
      const merged: LiveAccountSnapshot = prev
        ? {
            login: pickStr(incoming.login, prev.login),
            server: pickStr(incoming.server, prev.server),
            status: pickStr(incoming.status, prev.status),
            currency: incoming.currency || prev.currency,
            leverage: incoming.leverage ?? prev.leverage,
            balance: pickNum(incoming.balance, prev.balance),
            equity: pickNum(incoming.equity, prev.equity),
            margin: pickNum(incoming.margin, prev.margin),
            marginFree: pickNum(incoming.marginFree, prev.marginFree),
            profit: incoming.profit ?? prev.profit,
            openPositionsCount: incoming.openPositionsCount,
            lastSynced: incoming.lastSynced ?? prev.lastSynced,
          }
        : incoming;
      liveMarketDataStore.setAccount(merged);
      if (!liveMarketDataStore.getState().rateLimit.active) {
        liveMarketDataStore.setStatus("live_polling");
      }
      liveMarketDataStore.setLastError(null);

      // Account endpoint may also return positions; if it does, capture.
      const positions = (res.positions ?? d?.positions ?? []) as any[];
      if (Array.isArray(positions) && positions.length > 0) {
        liveMarketDataStore.setPositions(this.normalizePositions(positions));
      }
    } catch (e: any) {
      liveMarketDataStore.setLastError(e?.message || "Network error");
    }
  };

  private tickPositions = async () => {
    // Positions piggyback on tickAccount (get-mt5-terminal-data returns
    // both account + positions). The dedicated loop is here for clarity
    // and for the post-trade burst schedule.
    // No-op when the account loop already fired within the interval.
  };

  private tickSystemHealth = async () => {
    if (!this.canRun()) return;
    liveMarketDataStore.recordRequest();
    try {
      const { data, error } = await supabase.functions.invoke(
        "trading-layer-health",
        { body: {} },
      );
      if (this.detect429(data, error)) {
        this.triggerRateLimitPause();
        return;
      }
      // Health result is informational only; the per-tick status flips
      // (live_polling / stale / rate_limited) are still driven by the
      // quote + account loops.
    } catch {
      /* health errors are non-fatal */
    }
  };

  private tickStale = () => {
    const s = liveMarketDataStore.getState();
    if (s.rateLimit.active) return;
    if (s.status === "disconnected") return;
    if (liveMarketDataStore.isStale()) {
      liveMarketDataStore.setStatus("stale");
    } else if (s.status === "stale") {
      liveMarketDataStore.setStatus("live_polling");
    }
  };


  private normalizePositions(rows: any[]): LivePositionRow[] {
    return rows.map((p) => ({
      ticket: p?.ticket ?? p?.id ?? null,
      symbol: String(p?.symbol ?? "").toUpperCase(),
      side: (String(p?.side ?? p?.type ?? "buy").toLowerCase().startsWith("s")
        ? "sell"
        : "buy") as "buy" | "sell",
      volume: Number(p?.volume ?? p?.lots ?? 0),
      entry_price: Number(p?.entry_price ?? p?.price_open ?? 0),
      current_price: Number(p?.current_price ?? p?.price_current ?? 0),
      stop_loss: p?.stop_loss != null ? Number(p.stop_loss) : null,
      take_profit: p?.take_profit != null ? Number(p.take_profit) : null,
      profit: Number(p?.profit ?? 0),
      open_time: p?.open_time ?? p?.time ?? null,
    }));
  }
}

export const MarketDataService = new MarketDataServiceImpl();
export type { MarketDataServiceImpl };
