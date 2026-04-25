import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HotMention = {
  symbol: string;       // canonical, e.g. "EUR/USD", "BTC/USDT", "AAPL"
  mentions: number;
  price: number | null;
  changePct: number | null;
  up: boolean;
};

// Symbols we look for. Order matters when the same root could match multiple
// canonical forms — we prefer forex/crypto pairs over bare tickers.
const FOREX_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "USD/CHF", "NZD/USD", "EUR/GBP",
  "GBP/JPY", "EUR/JPY", "AUD/JPY", "XAU/USD",
];

const CRYPTO_PAIRS = [
  "BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT",
  "BNB/USDT", "DOGE/USDT",
];

const INDICES = ["S&P 500", "Nasdaq 100", "Dow Jones", "DAX 40", "FTSE 100", "Nikkei 225"];

const STOCKS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL"];

// Aliases users commonly type → canonical symbol
const ALIASES: Record<string, string> = {
  "BTC": "BTC/USDT", "BITCOIN": "BTC/USDT",
  "ETH": "ETH/USDT", "ETHEREUM": "ETH/USDT",
  "SOL": "SOL/USDT", "SOLANA": "SOL/USDT",
  "XRP": "XRP/USDT", "RIPPLE": "XRP/USDT",
  "BNB": "BNB/USDT",
  "DOGE": "DOGE/USDT",
  "GOLD": "XAU/USD", "XAUUSD": "XAU/USD",
  "SPX": "S&P 500", "SP500": "S&P 500", "SPY": "S&P 500",
  "NDX": "Nasdaq 100", "NDQ": "Nasdaq 100", "NASDAQ": "Nasdaq 100",
  "DJI": "Dow Jones", "DOW": "Dow Jones",
  "DAX": "DAX 40",
  "FTSE": "FTSE 100",
  "NIKKEI": "Nikkei 225",
};

const ALL_PAIRS = [...FOREX_PAIRS, ...CRYPTO_PAIRS];
const ALL_TICKERS = [...STOCKS, ...INDICES];

const PAIR_REGEX = /\b([A-Z]{3,4})[\/\-]?([A-Z]{3,4})\b/g;
const WORD_REGEX = /\b[A-Z0-9&]{2,12}\b/g;

const canonicalizePair = (a: string, b: string): string | null => {
  const joined = `${a}/${b}`;
  if (ALL_PAIRS.includes(joined)) return joined;
  // Try crypto without quote currency
  if (b === "USD" || b === "USDT") {
    const c = `${a}/USDT`;
    if (CRYPTO_PAIRS.includes(c)) return c;
  }
  return null;
};

/** Extract canonical symbol mentions from a message body. */
const extractSymbols = (text: string): string[] => {
  if (!text) return [];
  const upper = text.toUpperCase();
  const found = new Set<string>();

  // 1) Pair patterns like EUR/USD, BTCUSDT, GBP-JPY
  let m: RegExpExecArray | null;
  PAIR_REGEX.lastIndex = 0;
  while ((m = PAIR_REGEX.exec(upper)) !== null) {
    const canonical = canonicalizePair(m[1], m[2]);
    if (canonical) found.add(canonical);
  }

  // 2) Aliases & bare tickers (avoid double-counting roots already in pairs)
  WORD_REGEX.lastIndex = 0;
  while ((m = WORD_REGEX.exec(upper)) !== null) {
    const word = m[0];
    const aliased = ALIASES[word];
    if (aliased) {
      found.add(aliased);
      continue;
    }
    if (ALL_TICKERS.includes(word)) found.add(word);
  }

  return Array.from(found);
};

const matchQuote = (
  symbol: string,
  quotes: Array<{ symbol: string; price: number | null; changePct: number | null }>,
) => quotes.find((q) => q.symbol === symbol) ?? null;

/**
 * Counts symbol mentions across recent chat messages and pairs them with live
 * prices. Re-extracts on new INSERTs via realtime subscription.
 */
export function useHotMentions(limit = 8, lookbackMs = 60 * 60 * 1000) {
  const [hot, setHot] = useState<HotMention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const counts = new Map<string, number>();

    const tally = (text: string) => {
      extractSymbols(text).forEach((s) =>
        counts.set(s, (counts.get(s) ?? 0) + 1),
      );
    };

    const refresh = async () => {
      // Fetch live quotes (best-effort, fall back to nulls if it fails)
      let quotes: Array<{ symbol: string; price: number | null; changePct: number | null }> = [];
      try {
        const { data } = await supabase.functions.invoke("fetch-market-quotes");
        if (data?.quotes) quotes = data.quotes;
      } catch {
        // ignore — we'll show mentions without prices
      }

      const ranked: HotMention[] = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([symbol, mentions]) => {
          const q = matchQuote(symbol, quotes);
          return {
            symbol,
            mentions,
            price: q?.price ?? null,
            changePct: q?.changePct ?? null,
            up: (q?.changePct ?? 0) >= 0,
          };
        });

      if (!cancelled) {
        setHot(ranked);
        setLoading(false);
      }
    };

    (async () => {
      const since = new Date(Date.now() - lookbackMs).toISOString();
      const { data } = await supabase
        .from("messages")
        .select("content")
        .gte("created_at", since)
        .is("deleted_at", null)
        .limit(500);

      data?.forEach((m) => tally(m.content));
      await refresh();
    })();

    // Live updates
    const channel = supabase
      .channel("hot-mentions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const content = (payload.new as { content?: string })?.content ?? "";
          tally(content);
          await refresh();
        },
      )
      .subscribe();

    // Periodic price refresh (every 60s) — counts unchanged
    const tick = setInterval(refresh, 60_000);

    return () => {
      cancelled = true;
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [limit, lookbackMs]);

  return { hot, loading };
}
