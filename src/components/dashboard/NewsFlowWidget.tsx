import { useState, useEffect, useCallback } from "react";
import { Newspaper, Radio, Calendar, Clock, Wrench, Search, SlidersHorizontal, Filter, RefreshCw, ChevronDown, Volume2, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
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

const newsItems = [
  {
    time: "Apr 6th, 17:50:15",
    tags: ["STOCKS", "TECH", "ECONOMICS", "US STOCKS", "BIG TECH"],
    extraTags: 5,
    headline: "Oracle hires Schneider Electric's Maxson as CFO amid AI spending boom",
    ticker: "ORCL",
    tickerChange: "-0.91%",
    tickerDown: true,
    source: "Reuters",
  },
  {
    time: "Apr 6th, 17:45:15",
    tags: ["ECONOMICS", "GLOBAL ECONOMY", "ECONOMIC DATA"],
    extraTags: 3,
    headline: "New Jersey cannot regulate Kalshi's prediction market, US appeals court rules",
    source: "Reuters",
  },
  {
    time: "Apr 6th, 17:44:45",
    tags: ["ENERGY", "ECONOMICS", "OIL", "US ECONOMY"],
    extraTags: 3,
    headline: "US Truck Rates at Highest Since 2022 Add to Inflation Pressures",
    description: "Skyrocketing fuel prices due to the Iran war are fanning the embers of transportation costs, which were alread...",
    source: "Bloomberg | Markets",
  },
  {
    time: "Apr 6th, 17:38:00",
    tags: ["FOREX", "ECONOMICS", "US ECONOMY"],
    extraTags: 2,
    headline: "Dollar slides as traders brace for FOMC minutes release",
    source: "Reuters",
  },
  {
    time: "Apr 6th, 17:30:10",
    tags: ["CRYPTO", "TECH"],
    extraTags: 1,
    headline: "Bitcoin surges past $72k as institutional inflows accelerate",
    ticker: "BTC",
    tickerChange: "+3.24%",
    tickerDown: false,
    source: "CoinDesk",
  },
  {
    time: "Apr 6th, 17:22:30",
    tags: ["COMMODITIES", "ENERGY"],
    extraTags: 2,
    headline: "Gold hits record high amid geopolitical tensions and rate cut expectations",
    source: "Bloomberg",
  },
];

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

const LiveSquawkFeed = () => {
  const [pulse, setPulse] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {/* Live indicator bar */}
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

      {/* Filter chips */}
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

      {/* Squawk items */}
      <div className="max-h-[500px] overflow-y-auto divide-y divide-border/20">
        {squawkItems.map((item, i) => (
          <div key={i} className={`border-l-2 px-4 py-3 transition-colors hover:bg-muted/20 ${priorityStyles[item.priority]}`}>
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

const NewsFlowWidget = () => {
  const [activeFilter, setActiveFilter] = useState("all");

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Top Tabs */}
      <div className="flex items-center border-b border-border bg-muted/30">
        <Tabs defaultValue="newsflow" className="w-full">
          <TabsList className="h-10 w-full justify-start rounded-none border-none bg-transparent p-0">
            <TabsTrigger value="newsflow" className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[hsl(45,100%,50%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(45,100%,50%)]">
              <Newspaper className="h-3.5 w-3.5" />
              NEWS FLOW
            </TabsTrigger>
            <TabsTrigger value="livesquawk" className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[hsl(45,100%,50%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(45,100%,50%)]">
              <Radio className="h-3.5 w-3.5" />
              LIVESQUAWK FEED
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[hsl(45,100%,50%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(45,100%,50%)]">
              <Calendar className="h-3.5 w-3.5" />
              CALENDAR
            </TabsTrigger>
            <TabsTrigger value="updates" className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[hsl(45,100%,50%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(45,100%,50%)]">
              <Clock className="h-3.5 w-3.5" />
              UPDATES TIMELINE
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-1.5 rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-[hsl(45,100%,50%)] data-[state=active]:bg-transparent data-[state=active]:text-[hsl(45,100%,50%)]">
              <Wrench className="h-3.5 w-3.5" />
              EXTRA TOOLS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="newsflow" className="mt-0">
            {/* Search Bar */}
            <div className="border-b border-border px-4 py-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Type word(s) for quick filter..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${activeFilter === "all" ? "bg-[hsl(45,100%,50%)]/20 text-[hsl(45,100%,50%)]" : "text-muted-foreground hover:text-foreground"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveFilter("fa")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${activeFilter === "fa" ? "bg-[hsl(45,100%,50%)]/20 text-[hsl(45,100%,50%)]" : "text-muted-foreground hover:text-foreground"}`}
                >
                  FA Test 1
                </button>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button className="text-muted-foreground hover:text-foreground">
                  <Filter className="h-4 w-4" />
                </button>
                <button className="text-muted-foreground hover:text-foreground">
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* News Items */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
              {newsItems.map((item, i) => (
                <div key={i} className="px-4 py-3 transition-colors hover:bg-muted/20">
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{item.time}</p>
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    {item.tags.map((tag) => (
                      <span key={tag} className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${tagColors[tag] || "bg-muted text-muted-foreground"}`}>
                        {tag}
                      </span>
                    ))}
                    {item.extraTags > 0 && (
                      <span className="text-[10px] text-primary font-medium">+{item.extraTags} more</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground leading-snug">{item.headline}</p>
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  )}
                  {item.ticker && (
                    <div className="mt-1.5">
                      <Badge variant="outline" className={`text-xs ${item.tickerDown ? "text-red-400 border-red-400/30" : "text-emerald-400 border-emerald-400/30"}`}>
                        {item.ticker} {item.tickerChange}
                      </Badge>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{item.source}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="livesquawk" className="mt-0">
            <LiveSquawkFeed />
          </TabsContent>
          <TabsContent value="calendar" className="mt-0">
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Economic calendar coming soon
            </div>
          </TabsContent>
          <TabsContent value="updates" className="mt-0">
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Updates timeline coming soon
            </div>
          </TabsContent>
          <TabsContent value="tools" className="mt-0">
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Extra tools coming soon
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NewsFlowWidget;
