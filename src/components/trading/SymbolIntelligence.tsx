import { useEffect, useMemo, useState } from "react";
import { Newspaper, TrendingUp, TrendingDown, Activity, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface NewsItem {
  title: string;
  link: string;
  pubDate?: string;
  source?: string;
}

interface Signal {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  status: string;
  created_at: string;
}

interface Props {
  symbol?: string;
}

// Maps TradingView/internal symbols → currencies/keywords
const symbolKeywords = (sym: string): string[] => {
  const s = sym.toUpperCase().replace("FX:", "").replace("/", "");
  const map: Record<string, string[]> = {
    EURUSD: ["EUR", "USD", "Euro", "Dollar", "ECB", "Fed"],
    GBPUSD: ["GBP", "USD", "Pound", "Sterling", "BoE"],
    USDJPY: ["USD", "JPY", "Yen", "BoJ", "Japan"],
    AUDUSD: ["AUD", "Aussie", "RBA"],
    USDCHF: ["CHF", "Franc", "SNB"],
    NZDUSD: ["NZD", "Kiwi", "RBNZ"],
    USDCAD: ["CAD", "Loonie", "BoC"],
    XAUUSD: ["Gold", "XAU"],
    GBPJPY: ["GBP", "JPY", "Pound", "Yen"],
    EURGBP: ["EUR", "GBP", "Euro", "Pound"],
  };
  return map[s] || [s.slice(0, 3), s.slice(3, 6)];
};

const formatPair = (sym: string) => {
  const s = sym.toUpperCase().replace("FX:", "");
  if (s.includes("/")) return s;
  return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
};

const SymbolIntelligence = ({ symbol = "FX:EURUSD" }: Props) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const pair = formatPair(symbol);
  const keywords = useMemo(() => symbolKeywords(symbol), [symbol]);

  const load = async () => {
    setLoading(true);
    const [newsRes, sigRes] = await Promise.all([
      supabase.functions.invoke("fetch-rss-news"),
      supabase
        .from("trading_signals")
        .select("*")
        .eq("pair", pair)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (!newsRes.error && (newsRes.data as any)?.items) {
      const filtered = ((newsRes.data as any).items as NewsItem[])
        .filter((n) => keywords.some((k) => n.title?.toLowerCase().includes(k.toLowerCase())))
        .slice(0, 8);
      setNews(filtered);
    }

    if (!sigRes.error && sigRes.data) setSignals(sigRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [symbol]);

  const activeSignals = signals.filter((s) => s.status === "active");
  const buyCount = activeSignals.filter((s) => s.direction === "buy").length;
  const sellCount = activeSignals.filter((s) => s.direction === "sell").length;
  const bias = buyCount > sellCount ? "bullish" : sellCount > buyCount ? "bearish" : "neutral";

  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{pair} Intel</span>
        </div>
        <button
          onClick={load}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Sentiment bias */}
      <div className="grid grid-cols-3 border-b border-border/30">
        <div className="px-3 py-3 text-center border-r border-border/30">
          <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Active</div>
          <div className="font-mono text-lg font-bold text-foreground">{activeSignals.length}</div>
        </div>
        <div className="px-3 py-3 text-center border-r border-border/30">
          <div className="text-[9px] uppercase text-emerald-400/70 tracking-wider">Buy</div>
          <div className="font-mono text-lg font-bold text-emerald-400 flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3" /> {buyCount}
          </div>
        </div>
        <div className="px-3 py-3 text-center">
          <div className="text-[9px] uppercase text-red-400/70 tracking-wider">Sell</div>
          <div className="font-mono text-lg font-bold text-red-400 flex items-center justify-center gap-1">
            <TrendingDown className="h-3 w-3" /> {sellCount}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border/30 bg-muted/20">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bias: </span>
        <span className={`text-xs font-semibold ${
          bias === "bullish" ? "text-emerald-400" : bias === "bearish" ? "text-red-400" : "text-muted-foreground"
        }`}>{bias}</span>
      </div>

      {/* Recent signals */}
      {signals.length > 0 && (
        <div className="border-b border-border/30">
          <div className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Signals
          </div>
          <div className="divide-y divide-border/20">
            {signals.slice(0, 4).map((s) => {
              const buy = s.direction === "buy";
              return (
                <div key={s.id} className="flex items-center justify-between px-4 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    {buy
                      ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                      : <TrendingDown className="h-3 w-3 text-red-400" />}
                    <span className="font-mono text-foreground">{Number(s.entry_price).toFixed(5)}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-semibold ${
                    s.status === "active" ? "text-primary" :
                    s.status === "hit_tp" ? "text-emerald-400" :
                    s.status === "hit_sl" ? "text-red-400" : "text-muted-foreground"
                  }`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* News */}
      <div className="flex-1 min-h-0">
        <div className="px-4 pt-3 pb-1.5 flex items-center gap-2">
          <Newspaper className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Related News
          </span>
        </div>
        <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1.5 h-3 w-3/4" />
              </div>
            ))
          ) : news.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No recent {pair} news
            </div>
          ) : (
            news.map((n, i) => (
              <a
                key={i}
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2.5 hover:bg-muted/30 transition-colors"
              >
                <p className="text-xs text-foreground line-clamp-2 leading-snug">{n.title}</p>
                {n.source && (
                  <p className="mt-1 text-[10px] text-muted-foreground">{n.source}</p>
                )}
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SymbolIntelligence;
