import { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, RefreshCw, BarChart3, Globe, ArrowUpRight, ArrowDownRight, Activity, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import NewsFlowWidget from "@/components/dashboard/NewsFlowWidget";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ForexTicker {
  pair: string;
  price: string;
  change: string;
  bias: "bullish" | "bearish" | "neutral";
  strength: number;
  timestamp: string | null;
}

interface ForexTickerResponse {
  tickers?: ForexTicker[];
  fetchedAt?: string;
  error?: string;
}

const StrengthBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-16 rounded-full bg-muted">
    <div
      className={`h-full rounded-full ${value > 65 ? "bg-emerald-500" : value > 45 ? "bg-yellow-500" : "bg-red-500"}`}
      style={{ width: `${value}%` }}
    />
  </div>
);

const TradingViewChart = ({ symbol = "FX:EURUSD", interval = "60" }: { symbol?: string; interval?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0, 0, 0, 0)",
      gridColor: "rgba(255, 255, 255, 0.06)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    containerRef.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container h-full min-h-[700px]" ref={containerRef} />
  );
};

const Dashboard = () => {
  const { toast } = useToast();
  const [tickers, setTickers] = useState<ForexTicker[]>([]);
  const [isLoadingTickers, setIsLoadingTickers] = useState(true);
  const [isRefreshingTickers, setIsRefreshingTickers] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchTickers = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setIsLoadingTickers(true);
    } else {
      setIsRefreshingTickers(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke<ForexTickerResponse>("fetch-forex-tickers");

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setTickers(data?.tickers ?? []);
      setLastUpdated(data?.fetchedAt ?? new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load live forex tickers";
      console.error("Failed to fetch forex tickers:", error);
      toast({
        title: "Ticker update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingTickers(false);
      setIsRefreshingTickers(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTickers(true);
    const interval = window.setInterval(() => fetchTickers(false), 30000);
    return () => window.clearInterval(interval);
  }, [fetchTickers]);

  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-[hsl(45,100%,50%)]" />
              <span className="font-heading text-lg font-bold text-foreground">
                Elite <span className="text-[hsl(45,100%,50%)]">Live Trading Room</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-xs">Dashboard</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={() => fetchTickers(false)}
              disabled={isLoadingTickers || isRefreshingTickers}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshingTickers ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chatroom</span>
              </Link>
            </Button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              DH
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col">
          <div className="flex min-h-[700px] flex-1 flex-col rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm font-semibold text-foreground">EUR/USD — Live Chart</h3>
              </div>
            </div>
            <div className="flex-1">
              <TradingViewChart />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <NewsFlowWidget />

          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  Tickers
                </h3>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Auto-refresh every 30s{formattedLastUpdated ? ` · Updated ${formattedLastUpdated}` : ""}
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">{tickers.length}</Badge>
            </div>
            <div className="max-h-[400px] divide-y divide-border/30 overflow-y-auto">
              {isLoadingTickers ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading live tickers...</div>
              ) : tickers.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No live ticker data available</div>
              ) : (
                tickers.map((ticker) => {
                  const isPositive = ticker.change.startsWith("+");
                  const isNeutral = ticker.bias === "neutral";

                  return (
                    <div key={ticker.pair} className="px-4 py-2.5 transition-colors hover:bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground">{ticker.pair}</span>
                        </div>
                        <span className="text-xs font-mono text-foreground">{ticker.price}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-red-400"}`}>
                          {isNeutral ? null : isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {ticker.change}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Strength</span>
                          <StrengthBar value={ticker.strength} />
                          <span className="text-[10px] text-muted-foreground">{ticker.strength}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
