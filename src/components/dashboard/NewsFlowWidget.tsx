import { useState, useEffect, useCallback } from "react";
import { Newspaper, Radio, Calendar, Clock, Wrench, Search, SlidersHorizontal, RefreshCw, Volume2, TrendingUp, TrendingDown, Minus, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const tagColors: Record<string, string> = {
  STOCKS: "bg-blue-600 text-white",
  TECH: "bg-teal-600 text-white",
  ECONOMICS: "bg-emerald-600 text-white",
  "US STOCKS": "bg-green-600 text-white",
  "BIG TECH": "bg-cyan-600 text-white",
  "GLOBAL ECONOMY": "bg-emerald-500 text-white",
  "ECONOMIC DATA": "bg-teal-500 text-white",
  ENERGY: "bg-orange-600 text-white",
  OIL: "bg-purple-600 text-white",
  "US ECONOMY": "bg-blue-500 text-white",
  FOREX: "bg-indigo-600 text-white",
  BONDS: "bg-rose-600 text-white",
  CRYPTO: "bg-amber-600 text-white",
  COMMODITIES: "bg-yellow-700 text-white",
};

interface RssNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category: string;
  description?: string;
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return dateStr;
  }
}

const squawkItems = [
  { time: "17:52:30", priority: "high" as const, category: "CENTRAL BANKS", headline: "FED'S WALLER: LABOR MARKET REMAINS SOLID, INFLATION PROGRESS HAS STALLED", impact: "USD", direction: "bullish" as const },
  { time: "17:48:12", priority: "breaking" as const, category: "GEOPOLITICS", headline: "BREAKING: US TREASURY SECRETARY SAYS NEW TARIFF FRAMEWORK TO BE ANNOUNCED NEXT WEEK", impact: "MULTI", direction: "neutral" as const },
  { time: "17:45:05", priority: "medium" as const, category: "DATA", headline: "US ISM SERVICES PMI 52.7 VS 51.4 EXPECTED — EXPANSION ACCELERATES", impact: "USD", direction: "bullish" as const },
  { time: "17:40:22", priority: "low" as const, category: "ENERGY", headline: "OPEC+ DELEGATES SAY NO EMERGENCY MEETING PLANNED DESPITE OIL PRICE DROP", impact: "OIL", direction: "bearish" as const },
  { time: "17:35:18", priority: "high" as const, category: "CENTRAL BANKS", headline: "ECB'S LAGARDE: WE ARE NOT PRE-COMMITTING TO ANY PARTICULAR RATE PATH", impact: "EUR", direction: "neutral" as const },
  { time: "17:30:44", priority: "medium" as const, category: "FIXED INCOME", headline: "US 10-YEAR YIELD RISES TO 4.38%, HIGHEST SINCE NOVEMBER", impact: "BONDS", direction: "bearish" as const },
  { time: "17:25:10", priority: "low" as const, category: "EQUITIES", headline: "NVIDIA SHARES UP 3.2% IN PRE-MARKET ON AI CHIP DEMAND FORECAST UPGRADE", impact: "NVDA", direction: "bullish" as const },
  { time: "17:20:55", priority: "medium" as const, category: "FX", headline: "USD/JPY BREAKS ABOVE 150.00 — BOJ INTERVENTION WATCH INTENSIFIES", impact: "JPY", direction: "bearish" as const },
  { time: "17:15:33", priority: "high" as const, category: "DATA", headline: "UK GDP M/M 0.1% VS 0.2% EXPECTED — ECONOMY BARELY GROWING", impact: "GBP", direction: "bearish" as const },
  { time: "17:10:08", priority: "low" as const, category: "COMMODITIES", headline: "GOLD CONSOLIDATES NEAR $2,340 AHEAD OF US CPI DATA TOMORROW", impact: "XAU", direction: "neutral" as const },
  { time: "17:05:42", priority: "breaking" as const, category: "GEOPOLITICS", headline: "REPORTS: CHINA TO IMPOSE RETALIATORY TARIFFS ON US AGRICULTURAL PRODUCTS", impact: "CNH", direction: "bearish" as const },
  { time: "17:00:15", priority: "medium" as const, category: "CENTRAL BANKS", headline: "BOC HOLDS RATES AT 5.0% AS EXPECTED — SIGNALS CUTS POSSIBLE IN H2", impact: "CAD", direction: "bearish" as const },
];

const priorityStyles = {
  breaking: "border-l-red-500 bg-red-500/5",
  high: "border-l-orange-500",
  medium: "border-l-yellow-500/50",
  low: "border-l-muted",
};

const priorityBadge = {
  breaking: "bg-red-600 text-white animate-pulse",
  high: "bg-orange-600 text-white",
  medium: "bg-yellow-600/80 text-white",
  low: "bg-muted text-muted-foreground",
};

const categoryColors: Record<string, string> = {
  "CENTRAL BANKS": "text-blue-400",
  GEOPOLITICS: "text-red-400",
  DATA: "text-emerald-400",
  ENERGY: "text-orange-400",
  "FIXED INCOME": "text-purple-400",
  EQUITIES: "text-cyan-400",
  FX: "text-indigo-400",
  COMMODITIES: "text-yellow-400",
};

// Economic calendar data
const calendarEvents = [
  { time: "08:30", currency: "USD", impact: "high", event: "Non-Farm Payrolls", forecast: "180K", previous: "175K", actual: "—" },
  { time: "08:30", currency: "USD", impact: "high", event: "Unemployment Rate", forecast: "3.8%", previous: "3.9%", actual: "—" },
  { time: "10:00", currency: "USD", impact: "medium", event: "ISM Services PMI", forecast: "52.0", previous: "51.4", actual: "52.7" },
  { time: "10:00", currency: "USD", impact: "low", event: "Factory Orders m/m", forecast: "0.8%", previous: "-1.6%", actual: "—" },
  { time: "12:00", currency: "EUR", impact: "high", event: "ECB President Lagarde Speaks", forecast: "—", previous: "—", actual: "—" },
  { time: "14:00", currency: "GBP", impact: "medium", event: "BOE Gov Bailey Speaks", forecast: "—", previous: "—", actual: "—" },
  { time: "19:00", currency: "NZD", impact: "high", event: "RBNZ Rate Statement", forecast: "5.50%", previous: "5.50%", actual: "—" },
  { time: "21:30", currency: "AUD", impact: "medium", event: "Trade Balance", forecast: "7.5B", previous: "7.3B", actual: "—" },
  { time: "23:00", currency: "JPY", impact: "low", event: "Leading Indicators", forecast: "111.8", previous: "111.4", actual: "—" },
];

const impactColor = {
  high: "bg-red-500",
  medium: "bg-orange-400",
  low: "bg-yellow-400",
};

const LiveSquawkFeed = () => {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full bg-red-500 ${pulse ? "opacity-100" : "opacity-40"} transition-opacity`} />
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Live</span>
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground">Auto-refresh: ON</span>
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2 overflow-x-auto scrollbar-hide">
        {["ALL", "BREAKING", "CENTRAL BANKS", "DATA", "FX", "GEOPOLITICS", "ENERGY"].map((f, i) => (
          <button
            key={f}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${i === 0 ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
        {squawkItems.map((item, i) => (
          <div key={i} className={`border-l-2 px-4 py-2.5 transition-colors hover:bg-muted/20 ${priorityStyles[item.priority]}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">{item.time}</span>
                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${priorityBadge[item.priority]}`}>
                  {item.priority === "breaking" ? "⚡ BREAKING" : item.priority.toUpperCase()}
                </span>
                <span className={`text-[10px] font-semibold ${categoryColors[item.category] || "text-muted-foreground"}`}>
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {item.impact}
                </Badge>
                {item.direction === "bullish" ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : item.direction === "bearish" ? (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                ) : (
                  <Minus className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
            <p className={`text-xs font-medium leading-snug ${item.priority === "breaking" ? "text-red-300" : "text-foreground"}`}>
              {item.headline}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EconomicCalendar = () => {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/20">
        <span className="text-xs font-semibold text-foreground">{dateStr}</span>
        <span className="text-[10px] text-muted-foreground">Times in EST</span>
      </div>

      {/* Impact legend */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-[10px] text-muted-foreground">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          <span className="text-[10px] text-muted-foreground">Low</span>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[50px_40px_20px_1fr_55px_55px_55px] gap-1 border-b border-border px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
        <span>Time</span>
        <span>Cur.</span>
        <span></span>
        <span>Event</span>
        <span className="text-right">Forecast</span>
        <span className="text-right">Previous</span>
        <span className="text-right">Actual</span>
      </div>

      {/* Events */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
        {calendarEvents.map((evt, i) => (
          <div key={i} className="grid grid-cols-[50px_40px_20px_1fr_55px_55px_55px] gap-1 items-center px-4 py-2 hover:bg-muted/20 transition-colors">
            <span className="text-[11px] font-mono text-muted-foreground">{evt.time}</span>
            <span className="text-[11px] font-semibold text-foreground">{evt.currency}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${impactColor[evt.impact as keyof typeof impactColor]}`} />
            <span className="text-xs text-foreground truncate">{evt.event}</span>
            <span className="text-[11px] text-right font-mono text-muted-foreground">{evt.forecast}</span>
            <span className="text-[11px] text-right font-mono text-muted-foreground">{evt.previous}</span>
            <span className={`text-[11px] text-right font-mono ${evt.actual !== "—" ? "text-foreground font-semibold" : "text-muted-foreground/50"}`}>{evt.actual}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const NewsFlowWidget = () => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [newsItems, setNewsItems] = useState<RssNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-rss-news");
      if (!error && data?.data) {
        setNewsItems(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch news:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const filteredNews = newsItems.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.category.toLowerCase().includes(activeFilter);
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const tabTriggerClass = "gap-1 rounded px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white/70 data-[state=active]:bg-[hsl(195,80%,35%)] data-[state=active]:text-white data-[state=active]:shadow-md";

  return (
    <div className="rounded-lg border border-border bg-card">
      <Tabs defaultValue="newsflow" className="w-full">
        {/* Tab bar */}
        <div className="flex flex-wrap items-center justify-between gap-1 bg-[hsl(200,30%,20%)] px-2 py-1.5 rounded-t-lg">
          <TabsList className="h-auto w-auto flex-wrap gap-1 rounded-none border-none bg-transparent p-0">
            <TabsTrigger value="newsflow" className={tabTriggerClass}>
              <Newspaper className="h-3 w-3" />
              NEWS FLOW
            </TabsTrigger>
            <TabsTrigger value="livesquawk" className={tabTriggerClass}>
              <Radio className="h-3 w-3" />
              LIVESQUAWK
            </TabsTrigger>
            <TabsTrigger value="calendar" className={tabTriggerClass}>
              <Calendar className="h-3 w-3" />
              CALENDAR
            </TabsTrigger>
            <TabsTrigger value="updates" className={tabTriggerClass}>
              <Clock className="h-3 w-3" />
              UPDATES
            </TabsTrigger>
            <TabsTrigger value="tools" className={tabTriggerClass}>
              <Wrench className="h-3 w-3" />
              TOOLS
            </TabsTrigger>
          </TabsList>
          <span className="text-[9px] text-white/40 hidden lg:inline">Powered by <span className="font-bold text-[hsl(30,100%,55%)]">LIVESQUAWK</span></span>
        </div>

        <TabsContent value="newsflow" className="mt-0">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Quick filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
            <div className="flex items-center gap-1">
              {["all", "markets", "top news", "forex", "commodities"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${activeFilter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={fetchNews} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto divide-y divide-border/30">
            {loading && newsItems.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredNews.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                No news found
              </div>
            ) : (
              filteredNews.map((item, i) => (
                <a
                  key={i}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 transition-colors hover:bg-muted/20"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{formatTime(item.pubDate)}</span>
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${tagColors[item.category] || "bg-muted text-muted-foreground"}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-foreground leading-snug">{item.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{item.source}</p>
                </a>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="livesquawk" className="mt-0">
          <LiveSquawkFeed />
        </TabsContent>
        <TabsContent value="calendar" className="mt-0">
          <EconomicCalendar />
        </TabsContent>
        <TabsContent value="updates" className="mt-0">
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Updates timeline coming soon
          </div>
        </TabsContent>
        <TabsContent value="tools" className="mt-0">
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            Extra tools coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewsFlowWidget;
