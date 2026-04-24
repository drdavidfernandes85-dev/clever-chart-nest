import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Ticker {
  pair: string;
  price: string;
  change: string;
  bias: "bullish" | "bearish" | "neutral";
}

const ForexTickerBar = () => {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  // Live crypto tickers from CoinGecko (free, no API key, CORS-enabled).
  // Falls back to the legacy edge function only if the public API is blocked.
  useEffect(() => {
    const PAIRS = [
      { pair: "BTC/USDT",  id: "bitcoin"     },
      { pair: "ETH/USDT",  id: "ethereum"    },
      { pair: "SOL/USDT",  id: "solana"      },
      { pair: "SUI/USDT",  id: "sui"         },
      { pair: "TON/USDT",  id: "toncoin"     },
      { pair: "PEPE/USDT", id: "pepe"        },
      { pair: "WIF/USDT",  id: "dogwifcoin"  },
      { pair: "HYPE/USDT", id: "hyperliquid" },
      { pair: "XRP/USDT",  id: "ripple"      },
    ];
    const fmt = (n: number) =>
      n >= 1000 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n >= 0.01 ? n.toFixed(5) : n.toFixed(8);

    const fetchTickers = async () => {
      try {
        const ids = PAIRS.map((p) => p.id).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("price feed");
        const json = await res.json();
        setTickers(
          PAIRS.map((p) => {
            const row = json?.[p.id];
            const price = Number(row?.usd ?? NaN);
            const chg = Number(row?.usd_24h_change ?? 0);
            return {
              pair: p.pair,
              price: Number.isFinite(price) ? fmt(price) : "--",
              change: `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`,
              bias: chg > 0.05 ? "bullish" : chg < -0.05 ? "bearish" : "neutral",
            } as Ticker;
          })
        );
      } catch {
        // Last-resort placeholder so the bar isn't empty
        setTickers([
          { pair: "BTC/USDT", price: "65,420.00", change: "+1.42%", bias: "bullish" },
          { pair: "ETH/USDT", price: "3,180.00",  change: "+0.86%", bias: "bullish" },
          { pair: "SOL/USDT", price: "152.40",    change: "-0.32%", bias: "bearish" },
          { pair: "SUI/USDT", price: "1.81",      change: "+2.10%", bias: "bullish" },
          { pair: "TON/USDT", price: "5.92",      change: "-0.45%", bias: "bearish" },
        ]);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 60000);
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

export default ForexTickerBar;
