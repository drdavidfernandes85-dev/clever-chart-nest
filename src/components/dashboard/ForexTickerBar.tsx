import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ticker {
  pair: string;
  price: string;
  change: string;
  bias: "bullish" | "bearish" | "neutral";
}

const ForexTickerBar = () => {
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("fetch-forex-tickers");
        if (error) throw error;
        if (data?.tickers) setTickers(data.tickers);
      } catch {
        setTickers([
          { pair: "EUR/USD", price: "1.0842", change: "+0.12%", bias: "bullish" },
          { pair: "GBP/USD", price: "1.2651", change: "-0.08%", bias: "bearish" },
          { pair: "USD/JPY", price: "151.320", change: "+0.25%", bias: "bullish" },
          { pair: "XAU/USD", price: "2338.50", change: "+0.45%", bias: "bullish" },
          { pair: "USD/CHF", price: "0.9012", change: "-0.03%", bias: "bearish" },
          { pair: "AUD/USD", price: "0.6523", change: "+0.07%", bias: "bullish" },
        ]);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 60000);
    return () => clearInterval(interval);
  }, []);

  if (tickers.length === 0) return null;

  return (
    <div className="overflow-hidden border-b border-border/30 bg-card/50">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-8 px-4 py-2 whitespace-nowrap">
        {[...tickers, ...tickers].map((t, i) => {
          const changeNum = parseFloat(t.change);
          const isPositive = changeNum > 0;
          const isNegative = changeNum < 0;

          return (
            <div key={`${t.pair}-${i}`} className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{t.pair}</span>
              <span className="text-muted-foreground">{t.price}</span>
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3 text-red-400" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground" />
              )}
              <span className={isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted-foreground"}>
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
