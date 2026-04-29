import { useState, useEffect, useCallback, useMemo } from "react";
import { Newspaper, Radio, Wrench, Search, RefreshCw, Volume2, TrendingUp, TrendingDown, Minus, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

type SquawkPriority = "breaking" | "high" | "medium" | "low";
type SquawkDirection = "bullish" | "bearish" | "neutral";

interface SquawkItem {
  time: string;
  priority: SquawkPriority;
  category: string;
  headline: string;
  impact: string;
  direction: SquawkDirection;
  link: string;
  pubDate: string;
}

const BREAKING_KEYWORDS = ["breaking", "alert", "urgent", "just in", "flash"];
const HIGH_KEYWORDS = ["fed", "ecb", "boe", "boj", "rate", "cpi", "inflation", "gdp", "nfp", "payrolls", "fomc", "powell", "lagarde"];
const BEARISH_KEYWORDS = ["fall", "drop", "down", "decline", "slump", "loss", "miss", "weak", "cut", "bear", "sell", "tumble", "plunge"];
const BULLISH_KEYWORDS = ["rise", "gain", "up", "rally", "jump", "beat", "strong", "hike", "bull", "buy", "surge", "soar", "growth"];

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string; impact: string }> = [
  { keywords: ["fed", "ecb", "boe", "boj", "rate", "central bank", "fomc"], category: "CENTRAL BANKS", impact: "RATES" },
  { keywords: ["cpi", "inflation", "gdp", "pmi", "ism", "payrolls", "unemployment", "retail sales"], category: "DATA", impact: "MACRO" },
  { keywords: ["eur/usd", "usd/jpy", "gbp/usd", "forex", "fx", "dollar", "euro", "yen", "sterling"], category: "FX", impact: "FX" },
  { keywords: ["oil", "crude", "wti", "brent", "opec", "natural gas"], category: "ENERGY", impact: "OIL" },
  { keywords: ["gold", "silver", "copper", "commodity", "commodities"], category: "COMMODITIES", impact: "XAU" },
  { keywords: ["china", "russia", "ukraine", "war", "tariff", "sanctions", "geopolit", "election"], category: "GEOPOLITICS", impact: "MULTI" },
  { keywords: ["bitcoin", "btc", "ethereum", "crypto"], category: "CRYPTO", impact: "BTC" },
];

function classifyNews(item: RssNewsItem): SquawkItem {
  const text = `${item.title} ${item.description || ""}`.toLowerCase();

  let priority: SquawkPriority = "low";
  if (BREAKING_KEYWORDS.some((k) => text.includes(k))) priority = "breaking";
  else if (HIGH_KEYWORDS.some((k) => text.includes(k))) priority = "high";
  else if (item.category?.toUpperCase().includes("MARKETS") || item.category?.toUpperCase().includes("TOP")) priority = "medium";

  let direction: SquawkDirection = "neutral";
  const bullScore = BULLISH_KEYWORDS.filter((k) => text.includes(k)).length;
  const bearScore = BEARISH_KEYWORDS.filter((k) => text.includes(k)).length;
  if (bullScore > bearScore) direction = "bullish";
  else if (bearScore > bullScore) direction = "bearish";

  let category = item.category?.toUpperCase() || "MARKETS";
  let impact = "MULTI";
  for (const c of CATEGORY_KEYWORDS) {
    if (c.keywords.some((k) => text.includes(k))) {
      category = c.category;
      impact = c.impact;
      break;
    }
  }

  let time = "";
  try {
    time = new Date(item.pubDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    time = "--:--:--";
  }

  return {
    time,
    priority,
    category,
    headline: item.title.toUpperCase(),
    impact,
    direction,
    link: item.link,
    pubDate: item.pubDate,
  };
}

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


const SQUAWK_FILTERS = ["ALL", "BREAKING", "CENTRAL BANKS", "DATA", "FX", "GEOPOLITICS", "ENERGY"] as const;

const LiveSquawkFeed = () => {
  const [pulse, setPulse] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("ALL");

  useEffect(() => {
    const interval = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = squawkItems.filter((item) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "BREAKING") return item.priority === "breaking";
    return item.category === activeFilter;
  });

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
        {SQUAWK_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${activeFilter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="max-h-[400px] overflow-y-auto divide-y divide-border/20">
        {filteredItems.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            No items for this filter
          </div>
        ) : (
          filteredItems.map((item, i) => (
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
          ))
        )}
      </div>
    </div>
  );
};

const MARKET_SESSIONS = [
  { name: "Sydney", flag: "🇦🇺", openUTC: 22, closeUTC: 7, color: "bg-emerald-500" },
  { name: "Tokyo", flag: "🇯🇵", openUTC: 0, closeUTC: 9, color: "bg-red-500" },
  { name: "Shanghai", flag: "🇨🇳", openUTC: 1.5, closeUTC: 7, color: "bg-yellow-500" },
  { name: "London", flag: "🇬🇧", openUTC: 8, closeUTC: 16.5, color: "bg-blue-500" },
  { name: "New York", flag: "🇺🇸", openUTC: 13.5, closeUTC: 21, color: "bg-indigo-500" },
];

function isSessionOpen(openUTC: number, closeUTC: number, currentHour: number): boolean {
  if (openUTC < closeUTC) return currentHour >= openUTC && currentHour < closeUTC;
  return currentHour >= openUTC || currentHour < closeUTC;
}

const MarketTradingHours = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentHourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

  return (
    <div className="px-4 py-3">
      <h4 className="text-xs font-semibold text-foreground mb-2">Market Trading Hours</h4>
      <div className="text-center mb-2">
        <span className="text-[10px] text-muted-foreground">UTC </span>
        <span className="text-sm font-mono font-semibold text-primary">{timeStr}</span>
      </div>
      <div className="space-y-1.5">
        {MARKET_SESSIONS.map((s) => {
          const open = isSessionOpen(s.openUTC, s.closeUTC, currentHourUTC);
          // Calculate bar position (24h = 100%)
          const startPct = (s.openUTC / 24) * 100;
          const duration = s.closeUTC > s.openUTC ? s.closeUTC - s.openUTC : 24 - s.openUTC + s.closeUTC;
          const widthPct = (duration / 24) * 100;
          const nowPct = (currentHourUTC / 24) * 100;

          return (
            <div key={s.name} className="flex items-center gap-2">
              <span className="w-5 text-center text-sm">{s.flag}</span>
              <span className={`w-16 text-[10px] font-medium ${open ? "text-foreground" : "text-muted-foreground"}`}>{s.name}</span>
              <div className="relative flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
                <div
                  className={`absolute top-0 h-full rounded-sm ${s.color} ${open ? "opacity-80" : "opacity-30"}`}
                  style={{ left: `${startPct}%`, width: `${Math.min(widthPct, 100 - startPct)}%` }}
                />
                {/* Wrap-around part if session crosses midnight */}
                {s.openUTC > s.closeUTC && (
                  <div
                    className={`absolute top-0 left-0 h-full rounded-sm ${s.color} ${open ? "opacity-80" : "opacity-30"}`}
                    style={{ width: `${(s.closeUTC / 24) * 100}%` }}
                  />
                )}
                {/* Current time indicator */}
                <div className="absolute top-0 h-full w-px bg-primary" style={{ left: `${nowPct}%` }} />
              </div>
              <span className={`w-5 text-[9px] font-bold ${open ? "text-emerald-400" : "text-muted-foreground"}`}>
                {open ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RiskManagementCalc = () => {
  const [stopLoss, setStopLoss] = useState("");
  const [entry, setEntry] = useState("");
  const [target, setTarget] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [capitalAtRisk, setCapitalAtRisk] = useState("");

  const results = useMemo(() => {
    const sl = parseFloat(stopLoss);
    const en = parseFloat(entry);
    const tg = parseFloat(target);
    const ps = parseFloat(positionSize);
    const car = parseFloat(capitalAtRisk);

    if (isNaN(sl) || isNaN(en) || sl === en) return null;

    const lossPips = Math.abs(en - sl);
    const profitPips = isNaN(tg) ? 0 : Math.abs(tg - en);
    const rr = lossPips > 0 && profitPips > 0 ? (profitPips / lossPips) : 0;

    const effectiveSize = !isNaN(ps) && ps > 0 ? ps : (!isNaN(car) && car > 0 && lossPips > 0 ? car / lossPips : 0);
    const loss = effectiveSize * lossPips;
    const profit = effectiveSize * profitPips;

    return { loss: loss.toFixed(2), profit: profit.toFixed(2), rr: rr.toFixed(2) };
  }, [stopLoss, entry, target, positionSize, capitalAtRisk]);

  const clearAll = () => {
    setStopLoss(""); setEntry(""); setTarget("");
    setPositionSize(""); setCapitalAtRisk("");
  };

  const inputClass = "h-7 text-xs bg-background border-border w-20 text-center";

  return (
    <div className="px-4 py-3">
      <h4 className="text-xs font-semibold text-foreground mb-3">Risk Management Calculator</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-[10px] text-muted-foreground block mb-0.5">Input Levels</span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground">Stop-loss</span>
              <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground">Entry</span>
              <Input value={entry} onChange={(e) => setEntry(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground">Target</span>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground block mb-0.5">Results</span>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Loss:</span>
              <span className="text-[11px] font-mono text-red-400">{results ? results.loss : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">R:R Ratio:</span>
              <span className="text-[11px] font-mono text-foreground">{results ? results.rr : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Profit:</span>
              <span className="text-[11px] font-mono text-emerald-400">{results ? results.profit : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground">Position Size</span>
          <Input value={positionSize} onChange={(e) => setPositionSize(e.target.value)} className={inputClass} placeholder="Lots" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">OR</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground">Capital at Risk</span>
          <Input value={capitalAtRisk} onChange={(e) => setCapitalAtRisk(e.target.value)} className={inputClass} placeholder="$" />
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <Button variant="outline" size="sm" onClick={clearAll} className="text-[10px] h-7 gap-1">
          <RotateCcw className="h-3 w-3" />
          Clear Input Values
        </Button>
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">* Amounts are displayed in terms of the base currency (e.g. for GBP/USD, amounts are in GBP)</p>
    </div>
  );
};

const ToolsPanel = () => (
  <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
    <RiskManagementCalc />
    <MarketTradingHours />
  </div>
);

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

  const tabTriggerClass = "gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide text-foreground/70 data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-md transition-colors";

  return (
    <div className="rounded-2xl border border-border/50 bg-card">
      <Tabs defaultValue="newsflow" className="w-full">
        <div className="flex items-center justify-between bg-secondary/50 px-4 py-2 rounded-t-2xl">
          <TabsList className="h-auto w-auto gap-2 rounded-none border-none bg-transparent p-0">
            <TabsTrigger value="newsflow" className={tabTriggerClass}>
              <Newspaper className="h-3.5 w-3.5" />
              NEWS FLOW
            </TabsTrigger>
            <TabsTrigger value="livesquawk" className={tabTriggerClass}>
              <Radio className="h-3.5 w-3.5" />
              LIVESQUAWK
            </TabsTrigger>
            <TabsTrigger value="tools" className={tabTriggerClass}>
              <Wrench className="h-3.5 w-3.5" />
              TOOLS
            </TabsTrigger>
          </TabsList>
          <span className="text-[10px] text-muted-foreground">Powered by <span className="font-bold text-primary">LIVESQUAWK</span></span>
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
              <div className="space-y-0 divide-y divide-border/30">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                      <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-3 w-full rounded bg-muted animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-24 rounded bg-muted animate-pulse" />
                  </div>
                ))}
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
        <TabsContent value="tools" className="mt-0">
          <ToolsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewsFlowWidget;
