import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  MARKET_UNIVERSE,
  fetchMarketQuotes,
  decimalsFor,
  type MarketSymbol,
} from "@/lib/markets";

interface Ticker {
  pair: string;
  price: string;
  change: string;
  bias: "bullish" | "bearish" | "neutral";
}

// Curated mix that scrolls in the top bar — two of each asset class
// so users always see something familiar.
const TICKER_LABELS = [
  "BTC/USDT", "ETH/USDT",
  "EUR/USD",  "GBP/USD",  "USD/JPY",
  "S&P 500",  "Nasdaq 100",
  "AAPL",     "NVDA",     "TSLA",
];

const TickerBar = () => {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    const assets = TICKER_LABELS.map(
      (l) => MARKET_UNIVERSE.find((m) => m.symbol === l)!,
    ).filter(Boolean) as MarketSymbol[];

    const fmt = (asset: MarketSymbol, n: number) => {
      const d = decimalsFor(asset, n);
      return n.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
    };

    const refresh = async () => {
      const quotes = await fetchMarketQuotes();
      if (!quotes.length) return;
      setTickers(
        assets.map((a) => {
          const q = quotes.find((qq) => qq.symbol === a.symbol);
          const price = q?.price ?? null;
          const chg = q?.changePct ?? 0;
          return {
            pair: a.symbol,
            price: price != null && Number.isFinite(price) ? fmt(a, price) : "--",
            change: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`,
            bias: chg > 0.05 ? "bullish" : chg < -0.05 ? "bearish" : "neutral",
          };
        }),
      );
    };
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (tickers.length === 0) {
    return (
      <div className="overflow-hidden border-b border-border/30 bg-card/50">
        <div className="flex gap-8 px-4 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 w-14 rounded bg-muted animate-pulse" />
              <div className="h-3 w-12 rounded bg-muted animate-pulse" />
              <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-10 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-y border-primary/20 bg-card/60 backdrop-blur-md">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-8 px-4 py-2 whitespace-nowrap">
        {[...tickers, ...tickers].map((t, i) => {
          const changeNum = parseFloat(t.change);
          const isPositive = changeNum > 0;
          const isNegative = changeNum < 0;

          return (
            <div key={`${t.pair}-${i}`} className="flex items-center gap-2 text-xs font-mono tabular-nums">
              <span className="font-bold text-foreground tracking-wide">{t.pair}</span>
              <span className="text-foreground/80">{t.price}</span>
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-primary" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3 text-destructive" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={isPositive ? "text-primary font-semibold" : isNegative ? "text-destructive font-semibold" : "text-muted-foreground"}>
                {t.change}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TickerBar;
