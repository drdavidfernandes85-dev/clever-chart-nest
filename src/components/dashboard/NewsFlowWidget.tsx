import { useState } from "react";
import { Newspaper, Radio, Calendar, Clock, Wrench, Search, SlidersHorizontal, Filter, RefreshCw, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
