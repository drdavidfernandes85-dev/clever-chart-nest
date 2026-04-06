import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Bell, RefreshCw, BarChart3, Globe, Clock, ChevronDown, Star, ArrowUpRight, ArrowDownRight, Activity, Zap, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

const tickersData = [
  { pair: "EUR/USD", price: "1.0842", change: "+0.12%", bias: "bullish", signal: "Candlestick", timeframe: "1H", lastUpdate: "5 min ago", strength: 78 },
  { pair: "GBP/USD", price: "1.2651", change: "-0.08%", bias: "bearish", signal: "Basic Technical", timeframe: "4H", lastUpdate: "12 min ago", strength: 42 },
  { pair: "USD/JPY", price: "149.32", change: "+0.25%", bias: "bullish", signal: "Attention Level", timeframe: "1D", lastUpdate: "3 min ago", strength: 85 },
  { pair: "AUD/USD", price: "0.6534", change: "-0.15%", bias: "bearish", signal: "Candlestick", timeframe: "1H", lastUpdate: "8 min ago", strength: 35 },
  { pair: "NZD/USD", price: "0.5987", change: "+0.03%", bias: "neutral", signal: "Basic Technical", timeframe: "4H", lastUpdate: "15 min ago", strength: 52 },
  { pair: "USD/CAD", price: "1.3612", change: "-0.10%", bias: "bearish", signal: "Candlestick", timeframe: "1H", lastUpdate: "6 min ago", strength: 38 },
  { pair: "USD/CHF", price: "0.8821", change: "+0.18%", bias: "bullish", signal: "Basic Technical", timeframe: "4H", lastUpdate: "10 min ago", strength: 72 },
  { pair: "EUR/GBP", price: "0.8573", change: "+0.05%", bias: "neutral", signal: "Attention Level", timeframe: "1D", lastUpdate: "20 min ago", strength: 55 },
];

const updatesData = [
  { time: "2 min ago", pair: "EUR/USD", type: "Candlestick", message: "Bullish engulfing pattern on H1 chart" },
  { time: "5 min ago", pair: "USD/JPY", type: "Attention Level", message: "Price approaching key resistance at 149.50" },
  { time: "12 min ago", pair: "GBP/USD", type: "Basic Technical", message: "RSI divergence detected on 4H timeframe" },
  { time: "18 min ago", pair: "AUD/USD", type: "Candlestick", message: "Evening star formation near 0.6550" },
  { time: "25 min ago", pair: "USD/CAD", type: "Basic Technical", message: "MACD crossover signal on daily chart" },
  { time: "30 min ago", pair: "EUR/GBP", type: "F.A. Comment", message: "ECB rate decision impact analysis" },
  { time: "45 min ago", pair: "NZD/USD", type: "Basic Technical", message: "Support level holding at 0.5970" },
  { time: "1 hr ago", pair: "USD/CHF", type: "Candlestick", message: "Hammer candle on H4 suggests reversal" },
];

const alertsData = [
  { pair: "EUR/USD", type: "Price Alert", message: "Reached 1.0850 target", priority: "high" },
  { pair: "USD/JPY", type: "Volatility", message: "Unusual volume spike detected", priority: "medium" },
  { pair: "GBP/USD", type: "News", message: "UK CPI data release in 30 min", priority: "high" },
  { pair: "AUD/USD", type: "Technical", message: "50/200 MA death cross forming", priority: "low" },
];

const BiasIndicator = ({ bias }: { bias: string }) => {
  const colors: Record<string, string> = {
    bullish: "bg-emerald-500",
    bearish: "bg-red-500",
    neutral: "bg-yellow-500",
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[bias]}`} />
      <span className="text-xs capitalize text-muted-foreground">{bias}</span>
    </div>
  );
};

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
    <div className="tradingview-widget-container h-[400px]" ref={containerRef} />
  );
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="font-heading text-lg font-bold text-foreground">
                Forex<span className="text-primary">Analytix</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-xs">Dashboard</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
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

        {/* Scrolling ticker bar */}
        <div className="flex h-8 items-center gap-6 overflow-x-auto border-t border-border bg-card/50 px-4 text-xs scrollbar-hide">
          {tickersData.map((t) => (
            <div key={t.pair} className="flex shrink-0 items-center gap-2">
              <span className="font-medium text-foreground">{t.pair}</span>
              <span className="text-muted-foreground">{t.price}</span>
              <span className={t.change.startsWith("+") ? "text-emerald-400" : "text-red-400"}>
                {t.change}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        {/* Left: Tickers Table */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList className="bg-card">
                <TabsTrigger value="active">Active Tickers</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
                <TabsTrigger value="forex">Forex</TabsTrigger>
                <TabsTrigger value="tab_bias">Tab Bias</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Star className="h-3 w-3" /> Watchlist
                </Button>
              </div>
            </div>

            <TabsContent value="active" className="mt-3">
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Pair</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Change</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Bias</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Signal</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Strength</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">TF</th>
                      <th className="px-4 py-3 font-medium hidden lg:table-cell">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickersData.map((ticker) => (
                      <tr key={ticker.pair} className="border-b border-border/50 transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">{ticker.pair}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">{ticker.price}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 font-medium ${ticker.change.startsWith("+") ? "text-emerald-400" : "text-red-400"}`}>
                            {ticker.change.startsWith("+") ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {ticker.change}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell"><BiasIndicator bias={ticker.bias} /></td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <Badge variant="outline" className="text-xs">{ticker.signal}</Badge>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell"><StrengthBar value={ticker.strength} /></td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground">{ticker.timeframe}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{ticker.lastUpdate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="inactive" className="mt-3">
              <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                No inactive tickers
              </div>
            </TabsContent>
            <TabsContent value="forex" className="mt-3">
              <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                Forex pairs view
              </div>
            </TabsContent>
            <TabsContent value="tab_bias" className="mt-3">
              <div className="flex h-40 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
                Bias analysis view
              </div>
            </TabsContent>
          </Tabs>

          {/* Chart Area */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm font-semibold text-foreground">EUR/USD — Live Chart</h3>
              </div>
            </div>
            <TradingViewChart />
          </div>

          {/* Bottom commentary */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm italic text-muted-foreground">
              "The FED/ECB policy divergence could be in doubt following the hiking cycle. Watch for key levels on EUR/USD as we approach the FOMC meeting next week."
            </p>
            <p className="mt-2 text-xs text-muted-foreground">— Stelios, Head Analyst</p>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Updates Panel */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Updates
              </h3>
              <Badge variant="secondary" className="text-xs">{updatesData.length}</Badge>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {updatesData.map((update, i) => (
                <div key={i} className="border-b border-border/30 px-4 py-3 transition-colors hover:bg-muted/20">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{update.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{update.time}</span>
                  </div>
                  <p className="text-xs text-foreground">
                    <span className="font-medium text-primary">{update.pair}</span> — {update.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts Panel */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell className="h-4 w-4 text-primary" />
                Alerts
              </h3>
              <Badge variant="destructive" className="text-xs">{alertsData.filter(a => a.priority === "high").length}</Badge>
            </div>
            <div className="divide-y divide-border/30">
              {alertsData.map((alert, i) => (
                <div key={i} className="px-4 py-3 transition-colors hover:bg-muted/20">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${alert.priority === "high" ? "bg-red-500" : alert.priority === "medium" ? "bg-yellow-500" : "bg-muted-foreground"}`} />
                    <span className="text-xs font-medium text-foreground">{alert.pair}</span>
                    <Badge variant="outline" className="text-[10px]">{alert.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* F.A. Comments */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Eye className="h-4 w-4 text-primary" />
                F.A. Comments
              </h3>
            </div>
            <div className="p-4 text-xs text-muted-foreground">
              <p className="mb-2">European news headlines point to softening inflation which may change ECB trajectory.</p>
              <p>Keep an eye on upcoming NFP data for USD direction next week.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
