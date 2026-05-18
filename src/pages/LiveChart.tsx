import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  LayoutDashboard,
  User,
  ChevronDown,
  Settings2,
  Maximize2,
  Minimize2,
  Search,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useSearchParams } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import NotificationsBell from "@/components/notifications/NotificationsBell";
import { useLanguage } from "@/i18n/LanguageContext";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";
import BlackArrowTradePanel from "@/components/dashboard/BlackArrowTradePanel";
import AICopilot from "@/components/ai/AICopilot";
import MarketWatch from "@/components/livechart/MarketWatch";
import BidAskBoard from "@/components/livechart/BidAskBoard";
import OpenPositionsPanel from "@/components/livechart/OpenPositionsPanel";

import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { LiveAccountProvider, useLiveAccount, fmtMoney } from "@/contexts/LiveAccountContext";
import { BrokerSymbolsProvider, useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { MARKET_UNIVERSE } from "@/lib/markets";

const TIMEFRAMES: Array<{ label: string; value: string }> = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
];

const INDICATORS = [
  { id: "STD;RSI", label: "RSI" },
  { id: "STD;MACD", label: "MACD" },
  { id: "STD;EMA", label: "EMA" },
  { id: "STD;SMA", label: "SMA" },
  { id: "STD;Bollinger_Bands", label: "Bollinger Bands" },
  { id: "STD;Stochastic", label: "Stochastic" },
  { id: "STD;Volume", label: "Volume" },
  { id: "STD;ATR", label: "ATR" },
];

const WATCH_DEFAULT = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD",
  "XAUUSD", "BTC/USDT", "ETH/USDT",
  "S&P 500", "Nasdaq 100", "Dow Jones",
  "AAPL", "MSFT", "NVDA", "TSLA",
];

/** Map a broker symbol (e.g. "EURUSD", "XAUUSD", "AAPL") to a TradingView symbol. */
function brokerToTv(sym: string): string {
  const u = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // exact match in universe by tv root
  const direct = MARKET_UNIVERSE.find(
    (m) => m.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") === u,
  );
  if (direct) return direct.tv;
  // common variants
  if (u === "XAUUSD" || u === "GOLD") return "OANDA:XAUUSD";
  if (u === "XAGUSD" || u === "SILVER") return "OANDA:XAGUSD";
  if (u === "BTCUSD") return "BINANCE:BTCUSDT";
  if (u === "ETHUSD") return "BINANCE:ETHUSDT";
  if (u === "US30" || u === "DJ30") return "TVC:DJI";
  if (u === "NAS100" || u === "USTEC") return "TVC:NDX";
  if (u === "SPX500" || u === "US500") return "TVC:SPX";
  if (u === "GER40" || u === "DAX40") return "TVC:DAX";
  // forex 6 letters
  if (/^[A-Z]{6}$/.test(u)) return `FX:${u}`;
  // crypto with USDT
  if (u.endsWith("USDT")) return `BINANCE:${u}`;
  // single ticker → assume NASDAQ stock
  if (/^[A-Z]{1,5}$/.test(u)) return `NASDAQ:${u}`;
  return u;
}

/** Convert a broker symbol to a display label, e.g. "EURUSD" → "EUR/USD". */
function brokerToDisplay(sym: string): string {
  const u = sym.toUpperCase();
  if (/^[A-Z]{6}$/.test(u) && !/(XAU|XAG)/.test(u)) {
    return `${u.slice(0, 3)}/${u.slice(3)}`;
  }
  return u;
}

const LiveChartInner = () => {
  const { t } = useLanguage();
  const { symbols: brokerSymbols, loading: symbolsLoading } = useBrokerSymbols();
  const { liveAccount, connected } = useLiveAccount();
  const { setSymbol: setCtxSymbol, openTrade, prefillNonce } = useQuickTrade();
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightTicket, setHighlightTicket] = useState(false);

  // Symbols universe — every broker symbol from get-mt5-symbols.
  const allBrokerLabels = useMemo(
    () => brokerSymbols.map((s) => s.brokerSymbol || s.symbol).filter(Boolean),
    [brokerSymbols],
  );

  // Top 10 symbols for the Bid/Ask board — favour majors when present, else
  // fall back to the first 10 returned by the broker.
  const topBoardSymbols = useMemo(() => {
    if (!allBrokerLabels.length) return [];
    const preferred = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "XAUUSD", "BTCUSD", "ETHUSD"];
    const upper = allBrokerLabels.map((s) => s.toUpperCase());
    const picks: string[] = [];
    for (const p of preferred) {
      const idx = upper.indexOf(p);
      if (idx >= 0) picks.push(allBrokerLabels[idx]);
    }
    for (const s of allBrokerLabels) {
      if (picks.length >= 10) break;
      if (!picks.includes(s)) picks.push(s);
    }
    return picks.slice(0, 10);
  }, [allBrokerLabels]);


  // Default selection
  const [activeBroker, setActiveBroker] = useState<string>("EURUSD");
  useEffect(() => {
    if (!allBrokerLabels.length) return;
    // pick EURUSD if present, otherwise first
    const pick =
      allBrokerLabels.find((s) => s.toUpperCase() === "EURUSD") ?? allBrokerLabels[0];
    setActiveBroker(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerSymbols.length]);

  const tvSymbol = useMemo(() => brokerToTv(activeBroker), [activeBroker]);
  const displayLabel = useMemo(() => brokerToDisplay(activeBroker), [activeBroker]);

  const [interval, setIntervalState] = useState("15");
  const [studies, setStudies] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const chartShellRef = useRef<HTMLElement>(null);

  // Sync the QuickTrade context so the order ticket targets the chart symbol.
  useEffect(() => {
    setCtxSymbol(displayLabel);
  }, [displayLabel, setCtxSymbol]);

  // Read prefill from URL (?symbol=EURUSD&side=buy&sl=1.07&tp=1.09&lots=0.01&signalId=...)
  // Sent by "Take This Signal" buttons across the app.
  useEffect(() => {
    const sym = searchParams.get("symbol");
    if (!sym) return;
    const norm = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const match =
      allBrokerLabels.find((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "") === norm) ?? norm;
    setActiveBroker(match);
    const side = searchParams.get("side")?.toLowerCase() === "sell" ? "sell" : "buy";
    openTrade({
      symbol: brokerToDisplay(match),
      side,
      lots: searchParams.get("lots") ?? "0.01",
      sl: searchParams.get("sl") ?? undefined,
      tp: searchParams.get("tp") ?? undefined,
      entry: searchParams.get("entry") ?? undefined,
      signalId: searchParams.get("signalId"),
    });
    // Clear so a refresh doesn't re-trigger and we don't double-fire.
    const next = new URLSearchParams(searchParams);
    ["symbol", "side", "lots", "sl", "tp", "entry", "signalId"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allBrokerLabels.length]);

  // Pulse highlight on the Quick Trade ticket whenever it's prefilled.
  useEffect(() => {
    if (prefillNonce === 0) return;
    setHighlightTicket(true);
    const t = setTimeout(() => setHighlightTicket(false), 2400);
    return () => clearTimeout(t);
  }, [prefillNonce]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleStudy = (id: string) =>
    setStudies((p) => (p.includes(id) ? p.filter((s) => s !== id) : [...p, id]));

  const toggleFullscreen = async () => {
    const el = chartShellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  };

  const filteredSymbols = useMemo(() => {
    const q = symbolSearch.trim().toUpperCase();
    const list = allBrokerLabels;
    if (!q) return list.slice(0, 200);
    return list.filter((s) => s.toUpperCase().includes(q)).slice(0, 200);
  }, [allBrokerLabels, symbolSearch]);

  // When clicking a Market Watch / Bid-Ask row (display label), find broker symbol.
  const onSelectByLabel = (label: string) => {
    const norm = label.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const match = allBrokerLabels.find(
      (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "") === norm,
    );
    if (match) setActiveBroker(match);
    else setActiveBroker(norm); // still update chart, ticket will warn if unsupported
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={t("livechart.seo.title")}
        description={t("livechart.seo.desc")}
        keywords={t("livechart.seo.keywords")}
        canonical="https://elitelivetradingroom.com/live-chart"
      />

      {/* App header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-12 items-center justify-between px-3 sm:px-4 pl-14 lg:pl-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2">
              <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
                Terminal
              </span>
            </Link>
            <Badge variant="secondary" className="hidden md:inline-flex text-[10px] uppercase tracking-wider rounded-full">
              Pro
            </Badge>
            {connected && liveAccount && (
              <div className="hidden lg:flex items-center gap-3 ml-2 pl-3 border-l border-border/40 text-[11px] font-mono">
                <div>
                  <span className="text-muted-foreground">EQUITY </span>
                  <span className="text-foreground font-bold">{fmtMoney(liveAccount.equity, liveAccount.currency)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">MARGIN </span>
                  <span className="text-foreground">{fmtMoney(liveAccount.margin, liveAccount.currency)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">FREE </span>
                  <span className="text-emerald-400">{fmtMoney(liveAccount.marginFree, liveAccount.currency)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">P&L </span>
                  <span className={liveAccount.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {fmtMoney(liveAccount.profit, liveAccount.currency)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-muted-foreground hover:text-foreground">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden md:inline">Dashboard</span>
              </Link>
            </Button>
            <NotificationsBell />
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <User className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Workspace: left rail + chart + right rail */}
      <div className="p-2 lg:p-3">
        <div className="grid gap-2 lg:gap-3 lg:grid-cols-[260px_minmax(0,1fr)_340px] grid-cols-1">
          {/* LEFT: Market Watch + Bid/Ask Board */}
          <aside className="hidden lg:flex flex-col gap-2 lg:gap-3 h-[calc(100vh-4.5rem)] overflow-y-auto pr-0.5">
            <div className="shrink-0 max-h-[50%] overflow-hidden">
              <MarketWatch
                symbols={WATCH_DEFAULT}
                active={displayLabel}
                onSelect={onSelectByLabel}
              />
            </div>
            <BidAskBoard
              symbols={topBoardSymbols}
              onSelect={(sym) => setActiveBroker(sym)}
            />
          </aside>

          {/* CENTER: Chart */}
          <section
            ref={chartShellRef}
            className="relative flex flex-col rounded-2xl border border-border/30 bg-card overflow-hidden h-[70vh] lg:h-[calc(100vh-4.5rem)]"
          >
            {/* Top toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <BarChart3 className="h-4 w-4 text-primary" />

                {/* Symbol selector — searchable, broker-driven */}
                <Popover open={symbolsOpen} onOpenChange={setSymbolsOpen}>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-sm font-heading font-semibold text-foreground hover:bg-muted/50 transition-colors min-w-[120px]">
                      {displayLabel}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-0">
                    <div className="p-2 border-b border-border/40 flex items-center gap-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={symbolSearch}
                        onChange={(e) => setSymbolSearch(e.target.value)}
                        placeholder="Search broker symbols..."
                        className="h-8 text-xs"
                      />
                      {symbolsLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                      <span>{allBrokerLabels.length} symbols</span>
                      <span className="text-emerald-400">● live</span>
                    </div>
                    <ul className="max-h-72 overflow-y-auto">
                      {filteredSymbols.map((sym) => (
                        <li key={sym}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBroker(sym);
                              setSymbolsOpen(false);
                              setSymbolSearch("");
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-muted/40 transition-colors ${
                              activeBroker === sym ? "bg-primary/10 text-primary" : "text-foreground"
                            }`}
                          >
                            {sym}
                          </button>
                        </li>
                      ))}
                      {filteredSymbols.length === 0 && (
                        <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No matches.
                        </li>
                      )}
                    </ul>
                  </PopoverContent>
                </Popover>

                <Badge variant="outline" className="hidden md:inline-flex h-6 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                  ● Live
                </Badge>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Timeframes */}
                <div className="flex items-center gap-0.5 rounded-full border border-border/40 bg-muted/30 p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setIntervalState(tf.value)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider transition-colors ${
                        interval === tf.value
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>

                {/* Indicators */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors">
                      <Settings2 className="h-3.5 w-3.5 text-primary" />
                      Indicators
                      {studies.length > 0 && (
                        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[9px] font-mono text-primary">
                          {studies.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Studies
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {INDICATORS.map((ind) => (
                      <DropdownMenuCheckboxItem
                        key={ind.id}
                        checked={studies.includes(ind.id)}
                        onCheckedChange={() => toggleStudy(ind.id)}
                        className="text-sm"
                      >
                        {ind.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors"
                  title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="hidden lg:inline">{isFullscreen ? "Exit" : "Full"}</span>
                </button>
              </div>
            </div>

            {/* Chart canvas */}
            <div className="relative flex-1 min-h-0">
              <TradingViewAdvancedIframe
                key={`${tvSymbol}-${interval}-${studies.join(",")}`}
                symbol={tvSymbol}
                interval={interval}
                height="100%"
                allowSymbolChange={false}
                hideSideToolbar={false}
                withDateRanges={true}
                saveImage={true}
                studies={studies}
              />
            </div>
          </section>

          {/* RIGHT: Open Positions + Quick Trade ticket */}
          <aside className="flex flex-col gap-2 lg:gap-3 lg:h-[calc(100vh-4.5rem)] lg:overflow-y-auto pr-0.5">
            <OpenPositionsPanel />

            <div
              className={`rounded-2xl transition-all duration-500 ${
                highlightTicket
                  ? "ring-2 ring-primary/60 shadow-[0_0_0_6px_hsl(48_100%_51%/0.12)] animate-pulse"
                  : ""
              }`}
            >
              <QuickTradePanel />
            </div>
          </aside>
        </div>
      </div>
      <AICopilot />
    </div>
  );
};

const LiveChart = () => (
  <LiveAccountProvider>
    <BrokerSymbolsProvider>
      <LiveChartInner />
    </BrokerSymbolsProvider>
  </LiveAccountProvider>
);

export default LiveChart;
