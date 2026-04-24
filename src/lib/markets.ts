/**
 * Shared market universe: crypto, forex, indices, and main US stocks.
 * Used by Watchlist, MarketMovers, ForexTickerBar and the chart selectors.
 *
 * Live prices are served by the `fetch-market-quotes` edge function.
 */
export type AssetClass = "crypto" | "forex" | "index" | "stock";

export interface MarketSymbol {
  /** Pretty label, e.g. "BTC/USDT", "EUR/USD", "S&P 500", "AAPL" */
  symbol: string;
  assetClass: AssetClass;
  /** TradingView symbol for charting widgets. */
  tv: string;
  /** Informational rough 24h volume label. */
  volume?: string;
}

export const MARKET_UNIVERSE: MarketSymbol[] = [
  // Crypto
  { symbol: "BTC/USDT",  assetClass: "crypto", tv: "BINANCE:BTCUSDT",  volume: "32B"  },
  { symbol: "ETH/USDT",  assetClass: "crypto", tv: "BINANCE:ETHUSDT",  volume: "18B"  },
  { symbol: "SOL/USDT",  assetClass: "crypto", tv: "BINANCE:SOLUSDT",  volume: "4.2B" },
  { symbol: "XRP/USDT",  assetClass: "crypto", tv: "BINANCE:XRPUSDT",  volume: "2.1B" },
  { symbol: "BNB/USDT",  assetClass: "crypto", tv: "BINANCE:BNBUSDT",  volume: "1.6B" },
  { symbol: "DOGE/USDT", assetClass: "crypto", tv: "BINANCE:DOGEUSDT", volume: "1.2B" },

  // Forex majors
  { symbol: "EUR/USD",   assetClass: "forex",  tv: "FX:EURUSD" },
  { symbol: "GBP/USD",   assetClass: "forex",  tv: "FX:GBPUSD" },
  { symbol: "USD/JPY",   assetClass: "forex",  tv: "FX:USDJPY" },
  { symbol: "AUD/USD",   assetClass: "forex",  tv: "FX:AUDUSD" },
  { symbol: "USD/CAD",   assetClass: "forex",  tv: "FX:USDCAD" },
  { symbol: "USD/CHF",   assetClass: "forex",  tv: "FX:USDCHF" },
  { symbol: "NZD/USD",   assetClass: "forex",  tv: "FX:NZDUSD" },
  { symbol: "EUR/GBP",   assetClass: "forex",  tv: "FX:EURGBP" },

  // Indices
  { symbol: "S&P 500",     assetClass: "index", tv: "TVC:SPX"     },
  { symbol: "Nasdaq 100",  assetClass: "index", tv: "TVC:NDX"     },
  { symbol: "Dow Jones",   assetClass: "index", tv: "TVC:DJI"     },
  { symbol: "DAX 40",      assetClass: "index", tv: "TVC:DAX"     },
  { symbol: "FTSE 100",    assetClass: "index", tv: "TVC:UKX"     },
  { symbol: "Nikkei 225",  assetClass: "index", tv: "TVC:NI225"   },

  // Major US stocks
  { symbol: "AAPL",  assetClass: "stock", tv: "NASDAQ:AAPL"  },
  { symbol: "MSFT",  assetClass: "stock", tv: "NASDAQ:MSFT"  },
  { symbol: "NVDA",  assetClass: "stock", tv: "NASDAQ:NVDA"  },
  { symbol: "TSLA",  assetClass: "stock", tv: "NASDAQ:TSLA"  },
  { symbol: "AMZN",  assetClass: "stock", tv: "NASDAQ:AMZN"  },
  { symbol: "META",  assetClass: "stock", tv: "NASDAQ:META"  },
  { symbol: "GOOGL", assetClass: "stock", tv: "NASDAQ:GOOGL" },
];

export const tvSymbolToLabel = (tv: string): string =>
  MARKET_UNIVERSE.find((s) => s.tv === tv)?.symbol ?? tv;

export const labelToTv = (label: string): string =>
  MARKET_UNIVERSE.find((s) => s.symbol === label)?.tv ?? label;

/** Decimals appropriate for the price magnitude / instrument. */
export const decimalsFor = (sym: MarketSymbol, price: number | null): number => {
  if (price == null) return 2;
  if (sym.assetClass === "forex") {
    return sym.symbol.includes("JPY") ? 3 : 5;
  }
  if (sym.assetClass === "crypto") {
    if (price >= 1000) return 2;
    if (price >= 1) return 3;
    if (price >= 0.01) return 5;
    return 8;
  }
  // index & stock
  return 2;
};

/** Formatter for display. */
export const formatPrice = (sym: MarketSymbol, price: number | null): string => {
  if (price == null || !Number.isFinite(price)) return "—";
  const d = decimalsFor(sym, price);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
};

// ── Live quotes via the edge function ──────────────────────────────
export interface LiveQuote {
  symbol: string;
  assetClass: AssetClass;
  price: number | null;
  changePct: number | null;
  volume?: string;
}

import { supabase } from "@/integrations/supabase/client";

export async function fetchMarketQuotes(): Promise<LiveQuote[]> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-market-quotes");
    if (error) throw error;
    return Array.isArray(data?.quotes) ? (data.quotes as LiveQuote[]) : [];
  } catch {
    return [];
  }
}
