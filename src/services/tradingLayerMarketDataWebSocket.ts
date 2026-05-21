/**
 * tradingLayerMarketDataWebSocket
 * -------------------------------
 * Centralized client for the Trading Layer market-data WebSocket.
 *
 * Connects via the Supabase edge-function proxy `tl-market-data-stream`
 * (which holds the Trading Layer API key server-side). Subscribes to
 * the union of: selected symbol, visible right-rail quotes, chart
 * symbol, favorites.
 *
 * Updates two stores:
 *   - terminalRealtimeStore  (new — full WS lifecycle + ticks)
 *   - liveMarketDataStore    (existing — so existing widgets keep working
 *                              without component changes)
 *
 * Display only. Execution must still validate fresh ticks server-side.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  liveMarketDataStore,
  type LiveQuote,
} from "@/lib/liveMarketDataStore";
import {
  terminalRealtimeStore,
  type RealtimeTick,
} from "@/stores/terminalRealtimeStore";

const STALE_THRESHOLD_MS = 8000;
const STALE_CHECK_MS = 2500;
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1000;

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const maskAccountId = (id: string) =>
  !id ? "" : id.length <= 6 ? "***" : `${id.slice(0, 3)}…${id.slice(-3)}`;

const maskUrl = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname.replace(/[a-f0-9-]{8,}/gi, "***")}`;
  } catch {
    return "***";
  }
};

interface SubscriptionSources {
  [source: string]: Set<string>;
}

class TradingLayerMarketDataWebSocketImpl {
  private accountId: string | null = null;
  private ws: WebSocket | null = null;
  private connecting = false;
  private shouldRun = false;
  private reconnectTimer: number | null = null;
  private staleTimer: number | null = null;
  private backoff = BASE_BACKOFF_MS;
  private subSources: SubscriptionSources = {};
  private selectedSymbol = "";
  private currentSubscribed: string[] = [];
  private instanceCount = 0;

  /* ---------- Public API ---------- */

  start(accountId: string | null | undefined) {
    const id = (accountId || "").trim();
    if (!id) {
      this.stop();
      terminalRealtimeStore.setStatus("disabled");
      return;
    }
    if (this.shouldRun && this.accountId === id) return;
    this.shouldRun = true;
    this.accountId = id;
    terminalRealtimeStore.setMeta({ accountIdMasked: maskAccountId(id) });
    this.connect();
  }

  stop() {
    this.shouldRun = false;
    this.accountId = null;
    this.clearReconnect();
    this.clearStaleMonitor();
    this.closeSocket("client_stop");
    terminalRealtimeStore.setStatus("disabled");
    terminalRealtimeStore.setFallbackPolling(true);
    terminalRealtimeStore.setMeta({ accountIdMasked: null, wsUrlMasked: null });
  }

  setSelectedSymbol(sym: string) {
    const s = (sym || "").trim().toUpperCase();
    this.selectedSymbol = s;
    terminalRealtimeStore.setSelectedSymbol(s);
    this.recomputeSubscriptions();
  }

  subscribe(source: string, symbols: string[]) {
    const cleaned = new Set(
      symbols.map((x) => (x || "").trim().toUpperCase()).filter(Boolean),
    );
    if (cleaned.size === 0) {
      delete this.subSources[source];
    } else {
      this.subSources[source] = cleaned;
    }
    this.recomputeSubscriptions();
  }

  /* ---------- Internal: connection lifecycle ---------- */

  private async connect() {
    if (!this.shouldRun || !this.accountId) return;
    if (this.connecting) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      terminalRealtimeStore.setDuplicateSocket(true);
      return;
    }

    this.connecting = true;
    this.instanceCount++;
    const myInstance = this.instanceCount;
    terminalRealtimeStore.setStatus(
      this.ws ? "reconnecting" : "connecting",
    );

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      if (!token) {
        throw new Error("No auth session for WebSocket");
      }
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string;
      if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL");
      const wsBase = supabaseUrl.replace(/^http/i, "ws");
      const url =
        `${wsBase}/functions/v1/tl-market-data-stream` +
        `?accountId=${encodeURIComponent(this.accountId!)}` +
        `&token=${encodeURIComponent(token)}`;
      terminalRealtimeStore.setMeta({ wsUrlMasked: maskUrl(url) });

      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.instanceCount !== myInstance) {
          try { ws.close(); } catch { /* */ }
          return;
        }
        this.connecting = false;
        this.backoff = BASE_BACKOFF_MS;
        terminalRealtimeStore.setStatus("connected");
        terminalRealtimeStore.resetReconnectAttempts();
        terminalRealtimeStore.setLastError(null);
        terminalRealtimeStore.setDuplicateSocket(false);
        terminalRealtimeStore.setFallbackPolling(false);
        this.startStaleMonitor();
        // (Re)send current subscriptions.
        this.sendSubscribe(this.currentSubscribed);
      };

      ws.onmessage = (ev) => this.handleMessage(ev.data);

      ws.onerror = () => {
        terminalRealtimeStore.setLastError("WebSocket error");
        terminalRealtimeStore.setStatus("error");
      };

      ws.onclose = () => {
        this.connecting = false;
        this.ws = null;
        this.clearStaleMonitor();
        if (!this.shouldRun) {
          terminalRealtimeStore.setStatus("disconnected");
          terminalRealtimeStore.setFallbackPolling(true);
          return;
        }
        terminalRealtimeStore.setStatus("reconnecting");
        terminalRealtimeStore.setFallbackPolling(true);
        terminalRealtimeStore.incReconnectAttempts();
        this.scheduleReconnect();
      };
    } catch (e: any) {
      this.connecting = false;
      terminalRealtimeStore.setLastError(e?.message || "connect failed");
      terminalRealtimeStore.setStatus("error");
      terminalRealtimeStore.setFallbackPolling(true);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldRun) return;
    this.clearReconnect();
    const delay = Math.min(this.backoff, MAX_BACKOFF_MS);
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private closeSocket(_reason: string) {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
  }

  /* ---------- Internal: subscriptions ---------- */

  private recomputeSubscriptions() {
    const union = new Set<string>();
    if (this.selectedSymbol) union.add(this.selectedSymbol);
    for (const set of Object.values(this.subSources)) {
      for (const s of set) union.add(s);
    }
    const arr = Array.from(union).sort();
    const same =
      arr.length === this.currentSubscribed.length &&
      arr.every((s, i) => s === this.currentSubscribed[i]);
    if (same) return;
    this.currentSubscribed = arr;
    terminalRealtimeStore.setSubscribedSymbols(arr);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(arr);
    }
  }

  private sendSubscribe(symbols: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      // Generic subscribe envelope; proxy forwards to Trading Layer.
      this.ws.send(
        JSON.stringify({ type: "subscribe", symbols }),
      );
    } catch {
      /* ignore send errors — reconnect path will re-send */
    }
  }

  /* ---------- Internal: message handling ---------- */

  private handleMessage(raw: any) {
    let msg: any;
    try {
      msg = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      terminalRealtimeStore.incMalformed();
      return;
    }
    if (!msg || typeof msg !== "object") {
      terminalRealtimeStore.incMalformed();
      return;
    }

    // Tolerate multiple TL payload shapes — pull the first one we recognise.
    const ticks = this.extractTicks(msg);
    if (!ticks.length) {
      // Non-tick frames (ack, ping, error) are ignored silently.
      if (msg.type === "error" || msg.error) {
        terminalRealtimeStore.setLastError(
          String(msg.error?.message || msg.error || msg.message || "WS error"),
        );
      }
      return;
    }

    const liveQuotes: LiveQuote[] = [];
    const now = Date.now();
    for (const t of ticks) {
      const brokerSymbol = String(
        t.brokerSymbol || t.symbol || t.s || "",
      ).toUpperCase();
      if (!brokerSymbol) {
        terminalRealtimeStore.incMalformed();
        continue;
      }
      const displaySymbol = String(
        t.displaySymbol || t.display || brokerSymbol,
      ).toUpperCase();
      const bid = num(t.bid ?? t.b);
      const ask = num(t.ask ?? t.a);
      const last =
        num(t.last ?? t.l) ??
        (bid != null && ask != null ? (bid + ask) / 2 : null);
      const spread =
        num(t.spread) ??
        (bid != null && ask != null ? Math.max(0, ask - bid) : null);
      const volume = num(t.volume ?? t.v);
      const ts = num(t.timestamp ?? t.ts ?? t.time) ?? now;

      const tick: RealtimeTick = {
        brokerSymbol,
        displaySymbol,
        bid,
        ask,
        last,
        spread,
        volume,
        timestamp: ts,
        source: "trading_layer_ws",
      };
      terminalRealtimeStore.applyTick(tick);

      // Mirror into existing liveMarketDataStore so every legacy widget
      // (Order Ticket, Quotes Board, Chart header) updates immediately.
      liveQuotes.push({
        symbol: brokerSymbol,
        bid,
        ask,
        last,
        spread,
        digits: null,
        timestamp: ts,
        source: "stream",
      });
    }
    if (liveQuotes.length) {
      liveMarketDataStore.setQuotes(liveQuotes);
    }
  }

  private extractTicks(msg: any): any[] {
    if (Array.isArray(msg.ticks)) return msg.ticks;
    if (Array.isArray(msg.quotes)) return msg.quotes;
    if (Array.isArray(msg.data)) return msg.data;
    if (msg.type === "tick" || msg.type === "quote") return [msg.payload ?? msg];
    if (msg.symbol && (msg.bid != null || msg.ask != null)) return [msg];
    return [];
  }

  /* ---------- Internal: stale monitor ---------- */

  private startStaleMonitor() {
    this.clearStaleMonitor();
    this.staleTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const stale = terminalRealtimeStore.isSelectedStale(STALE_THRESHOLD_MS);
      const s = terminalRealtimeStore.getState().wsMarketDataStatus;
      if (stale) {
        if (s === "connected") terminalRealtimeStore.setStatus("stale");
        terminalRealtimeStore.setFallbackPolling(true);
      } else if (s === "stale") {
        terminalRealtimeStore.setStatus("connected");
        terminalRealtimeStore.setFallbackPolling(false);
      }
    }, STALE_CHECK_MS);
  }

  private clearStaleMonitor() {
    if (this.staleTimer != null) {
      window.clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
  }
}

export const tradingLayerMarketDataWebSocket =
  new TradingLayerMarketDataWebSocketImpl();
export type TradingLayerMarketDataWebSocket =
  typeof tradingLayerMarketDataWebSocket;
