import { supabase } from "@/integrations/supabase/client";

export type Tick = {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  changePct: number;
  spread: number;
  digits: number;
  time: string;
};

export type AccountInfo = {
  id: string;
  login?: string | number;
  server?: string;
  name: string;
  status?: string;
  balance?: number;
  equity?: number;
  profit?: number;
  margin?: number;
  marginFree?: number;
  currency?: string;
  raw?: any;
};

const DEFAULT_SYMBOLS = [
  "EURUSD", "GBPUSD", "XAUUSD", "BTCUSD",
  "USATEC", "BRENT", "AAPL", "AMZN",
];

function normalizeSymbol(v: string) {
  return String(v || "").trim().replace(/[\/\- ]/g, "").toUpperCase();
}

async function invoke<T = any>(fn: string, body: any = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    throw new Error("Please sign in before using the MT5 terminal.");
  }
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message || `${fn} failed`);
  if (data && data.success === false) {
    throw new Error(data.error || data.message || `${fn} failed`);
  }
  return data as T;
}

export class Mt5TerminalApi {
  public symbols: string[] = DEFAULT_SYMBOLS;
  public lastError = "";

  async status() {
    try { return await invoke("trading-layer-health", {}); }
    catch (e: any) { this.lastError = e.message; throw e; }
  }

  async accounts(): Promise<{ accounts: AccountInfo[] }> {
    try {
      const data: any = await invoke("get-live-account", {});
      const acc = data.account || {};
      const linked = data.linkedAccount || {};
      return {
        accounts: [{
          id: linked.id || acc.traderId || acc.login || "connected",
          login: acc.login || linked.account_number,
          server: acc.server || linked.server,
          name: `${acc.server || linked.server || "INFINOX"} - ${acc.login || linked.account_number || "MT5"}`,
          status: acc.status || "connected",
          balance: acc.balance,
          equity: acc.equity,
          profit: acc.profit,
          margin: acc.margin,
          marginFree: acc.marginFree,
          currency: acc.currency || "USD",
          raw: data,
        }],
      };
    } catch (e: any) { this.lastError = e.message; throw e; }
  }

  async symbolsList(): Promise<string[]> {
    try {
      const data: any = await invoke("get-mt5-symbols", {});
      const list: string[] = (data.symbols || [])
        .map((it: any) => typeof it === "string" ? it : (it.name || it.brokerSymbol || it.displayName))
        .filter(Boolean);
      if (list.length) this.symbols = Array.from(new Set(list)).slice(0, 24);
      return this.symbols;
    } catch (e: any) {
      this.lastError = e.message;
      return this.symbols;
    }
  }

  async ticks(symbols: string[] = this.symbols): Promise<{ ticks: Tick[] }> {
    const selected = symbols.slice(0, 6);
    const results = await Promise.allSettled(
      selected.map(sym => invoke("get-mt5-symbol-data", { symbol: sym }))
    );
    const ticks: Tick[] = results.flatMap((r, i) => {
      if (r.status !== "fulfilled") return [];
      return [this.mapSymbolData(selected[i], r.value)];
    });
    if (!ticks.length) {
      try {
        const terminal: any = await invoke("get-mt5-terminal-data", { selectedSymbol: selected[0] || "EURUSD" });
        ticks.push(this.mapTerminalData(selected[0] || "EURUSD", terminal));
      } catch { /* ignore */ }
    }
    return { ticks };
  }

  async order(payload: { symbol: string; side: "buy" | "sell"; orderType: string; volume: number; stopLoss?: number | null; takeProfit?: number | null; signalId?: string; }) {
    if (payload.orderType !== "market") {
      throw new Error("Pending orders backend function not deployed yet.");
    }
    return invoke("execute-trade", {
      symbol: normalizeSymbol(payload.symbol),
      side: payload.side,
      volume: Number(payload.volume),
      stopLoss: payload.stopLoss ?? null,
      takeProfit: payload.takeProfit ?? null,
      signalId: payload.signalId || `terminal-${Date.now()}`,
    });
  }

  cancel(): never { throw new Error("Cancel-order backend function not deployed yet."); }
  close(): never { throw new Error("Close-position backend function not deployed yet."); }
  invert(): never { throw new Error("Invert-position backend function not deployed yet."); }
  cancelAndClose(): never { throw new Error("Cancel-and-close backend function not deployed yet."); }

  private mapSymbolData(symbol: string, data: any): Tick {
    const price = data?.price || {};
    const info = data?.selectedSymbolInfo || {};
    const bid = Number(price.bid ?? data?.tick?.bid ?? data?.tick?.Bid ?? 0);
    const ask = Number(price.ask ?? data?.tick?.ask ?? data?.tick?.Ask ?? bid);
    return {
      symbol: info.name || info.brokerSymbol || normalizeSymbol(symbol),
      bid, ask,
      last: Number(price.current ?? ask ?? bid),
      changePct: Number(data?.changePct ?? 0),
      spread: Math.abs(ask - bid),
      digits: Number(data?.specs?.digits ?? info.digits ?? (String(symbol).length > 5 ? 5 : 2)),
      time: data?.timestamp || new Date().toISOString(),
    };
  }

  private mapTerminalData(symbol: string, data: any): Tick {
    const bid = Number(data?.price?.bid ?? data?.tick?.bid ?? data?.tick?.Bid ?? 0);
    const ask = Number(data?.price?.ask ?? data?.tick?.ask ?? data?.tick?.Ask ?? bid);
    return {
      symbol: normalizeSymbol(symbol),
      bid, ask, last: ask || bid, changePct: 0,
      spread: Math.abs(ask - bid),
      digits: String(symbol).length > 5 ? 5 : 2,
      time: data?.timestamp || new Date().toISOString(),
    };
  }
}

export const mt5Api = new Mt5TerminalApi();
