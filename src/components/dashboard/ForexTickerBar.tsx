import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Ticker {
  symbol: string;
  price: number;
  change: number;
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
        // Fallback static data
        setTickers([
          { symbol: "EUR/USD", price: 1.0842, change: 0.12 },
          { symbol: "GBP/USD", price: 1.2651, change: -0.08 },
          { symbol: "USD/JPY", price: 151.32, change: 0.25 },
          { symbol: "XAU/USD", price: 2338.50, change: 0.45 },
          { symbol: "USD/CHF", price: 0.9012, change: -0.03 },
          { symbol: "AUD/USD", price: 0.6523, change: 0.07 },
        ]);
      }
    };
    fetchTickers();
    const interval = setInterval(fetchTickers, 30000);
    return () => clearInterval(interval);
  }, []);

  if (tickers.length === 0) return null;

  const Icon = ({ change }: { change: number }) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="overflow-hidden border-b border-border/30 bg-card/50">
      <div className="flex animate-[scroll_30s_linear_infinite] gap-8 px-4 py-2 whitespace-nowrap">
        {[...tickers, ...tickers].map((t, i) => (
          <div key={`${t.symbol}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{t.symbol}</span>
            <span className="text-muted-foreground">{t.price.toFixed(t.price > 100 ? 2 : 4)}</span>
            <Icon change={t.change} />
            <span className={t.change > 0 ? "text-emerald-400" : t.change < 0 ? "text-red-400" : "text-muted-foreground"}>
              {t.change > 0 ? "+" : ""}{t.change.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ForexTickerBar;
