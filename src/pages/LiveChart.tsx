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
  RefreshCw,
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
import LiveExecutionBanner from "@/components/dashboard/LiveExecutionBanner";
import SystemHealthWidget from "@/components/dashboard/SystemHealthWidget";
import MarketWatch from "@/components/livechart/MarketWatch";
import BidAskBoard from "@/components/livechart/BidAskBoard";
import OpenPositionsPanel from "@/components/livechart/OpenPositionsPanel";
import CompactQuoteHeader from "@/components/livechart/CompactQuoteHeader";
import TerminalStatusChips from "@/components/livechart/TerminalStatusChips";
import TerminalStatusBar from "@/components/livechart/TerminalStatusBar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronRight } from "lucide-react";

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

/**
 * Static last-resort list used only when broker symbols haven't arrived yet.
 * The live Market Watch is fed by `useBrokerSymbols()` below — see
 * `marketWatchLabels` in `LiveChartInner`.
 */
const WATCH_DEFAULT = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
  "XAUUSD", "XAGUSD",
  "US30", "NAS100", "SPX500",
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

  /**
   * Market Watch labels — derived strictly from the broker symbol source.
   * We render the broker symbol mapped to a friendly display label
   * (e.g. EURUSD → EUR/USD) so users still see familiar names, but the
   * underlying list is always broker-approved. Falls back to the curated
   * static list only while the broker list hasn't arrived.
   */
  const marketWatchLabels = useMemo(() => {
    if (allBrokerLabels.length === 0) return WATCH_DEFAULT;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of allBrokerLabels) {
      const d = brokerToDisplay(s);
      if (seen.has(d)) continue;
      seen.add(d);
      out.push(d);
    }
    return out;
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

  // Read prefill from URL (?symbol=EURUSD&side=buy&sl=1.07&tp=1.09&lots=0.01&ideaId=...)
  // Sent by "Review This Idea" buttons across the app. Accepts legacy `signalId`
  // for back-compat with older links.
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
      signalId: searchParams.get("ideaId") ?? searchParams.get("signalId"),
    });
    // Clear so a refresh doesn't re-trigger and we don't double-fire.
    const next = new URLSearchParams(searchParams);
    ["symbol", "side", "lots", "sl", "tp", "entry", "ideaId", "signalId"].forEach((k) => next.delete(k));
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

      {/* App header — LTR Terminal Pro */}
      <header className="sticky top-0 z-50 border-b border-[#FFCD05]/10 bg-[#050505]/95 backdrop-blur-2xl">
        <div className="flex h-12 items-center justify-between px-3 sm:px-4 pl-14 lg:pl-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2.5 group shrink-0" aria-label="INFINOX — Home">
              <img src={infinoxLogo} alt="INFINOX" className="h-7 sm:h-8 w-auto object-contain" />
            </Link>

            <span className="hidden md:inline-flex items-center h-5 rounded-sm border border-[#FFCD05]/25 bg-[#FFCD05]/5 px-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-[#FFCD05]">
              IX LTR
            </span>

            {/* Consolidated status chips replace multiple loud bars */}
            <div className="hidden md:flex">
              <TerminalStatusChips />
            </div>

            {/* Essential account metrics only: Balance · Equity · P&L
                Server / leverage / margin / free moved into the "more" popover. */}
            {connected && liveAccount && (
              <div className="hidden lg:flex items-center gap-4 ml-1 pl-3 border-l border-[#1c1f23] text-[10.5px] font-mono uppercase tracking-[0.08em]">
                <div className="flex flex-col leading-tight">
                  <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Balance</span>
                  <span className="text-[#C9CDD2] tabular-nums">{fmtMoney(liveAccount.balance, liveAccount.currency)}</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Equity</span>
                  <span className="text-[#E8E8EA] font-bold tabular-nums">{fmtMoney(liveAccount.equity, liveAccount.currency)}</span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">P&amp;L</span>
                  <span className={`tabular-nums font-bold ${liveAccount.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {fmtMoney(liveAccount.profit, liveAccount.currency)}
                  </span>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="ml-1 inline-flex items-center h-6 px-2 rounded-sm border border-[#1c1f23] bg-[#0A0B0D] text-[9px] font-mono uppercase tracking-[0.16em] text-[#8E949C] hover:text-[#FFCD05] hover:border-[#FFCD05]/30 transition-colors"
                    >
                      More
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-60 p-3 bg-[#0A0B0D] border-[#1c1f23]">
                    <div className="grid grid-cols-2 gap-3 text-[10.5px] font-mono uppercase tracking-[0.08em]">
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Server</span>
                        <span className="text-[#C9CDD2] truncate">{liveAccount.server || "—"}</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Login</span>
                        <span className="text-[#C9CDD2] tabular-nums">#{liveAccount.login || "—"}</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Leverage</span>
                        <span className="text-[#C9CDD2] tabular-nums">{(liveAccount as any).leverage ? `1:${(liveAccount as any).leverage}` : "—"}</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Margin</span>
                        <span className="text-[#C9CDD2] tabular-nums">{fmtMoney(liveAccount.margin, liveAccount.currency)}</span>
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[8.5px] tracking-[0.18em] text-[#5d6168]">Free Margin</span>
                        <span className="text-emerald-400 tabular-nums">{fmtMoney(liveAccount.marginFree, liveAccount.currency)}</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("mt:refresh-quotes"))}
              title="Refresh quotes"
              className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-md border border-[#1c1f23] bg-[#0A0B0D] text-[#8E949C] hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-[#8E949C] hover:text-[#FFCD05] hover:bg-[#FFCD05]/5">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden md:inline font-heading text-[11px] uppercase tracking-[0.14em]">Dashboard</span>
              </Link>
            </Button>
            <NotificationsBell />
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[#FFCD05] hover:bg-[#FFCD05]/20 transition-colors"
            >
              <User className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Workspace: left rail + chart + right rail */}
      <div className="p-2 lg:p-3">
        <div className="grid gap-2 lg:gap-3 lg:grid-cols-[minmax(0,1fr)_360px] grid-cols-1">
          {/* Market Watch removed — symbol selection happens via the chart header and right-rail Quotes tab. */}



          {/* CENTER: Instrument quote strip + Chart */}
          <section
            ref={chartShellRef}
            className="relative flex flex-col rounded-2xl border border-border/20 bg-card overflow-hidden h-[70vh] lg:h-[calc(100vh-4.5rem)]"
          >
            {/* Prominent instrument quote header — Sell | Spread | Buy */}
            <div className="border-b border-border/15 px-2 pt-2">
              <CompactQuoteHeader
                symbol={activeBroker}
                displayLabel={displayLabel}
                variant="prominent"
              />
            </div>

            {/* Top toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/15 px-3 py-2">
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

          {/* RIGHT RAIL — institutional execution flow:
              1. Compact quote snapshot
              2. Order Ticket (always visible, primary)
              3. Open positions
              4. Secondary tabs: Quotes / Risk / System
          */}
          <aside className="flex flex-col gap-2.5 lg:gap-3 lg:h-[calc(100vh-4.5rem)] lg:overflow-y-auto pr-0.5">
            {/* 1. Compact quote */}
            <CompactQuoteHeader symbol={activeBroker} displayLabel={displayLabel} />

            {/* 2. Order ticket — primary action area, always above the fold */}
            <div
              className={`rounded-2xl transition-all duration-500 ${
                highlightTicket
                  ? "ring-2 ring-primary/60 shadow-[0_0_0_6px_hsl(48_100%_51%/0.12)] animate-pulse"
                  : ""
              }`}
            >
              <BlackArrowTradePanel />
            </div>

            {/* 3. Open positions — exposure on selected/all symbols */}
            <OpenPositionsPanel />

            {/* 4. Secondary tabs — Quotes / Risk / System
                Risk and System are tucked away so they never compete with the ticket. */}
            <Tabs defaultValue="quotes" className="rounded-xl bg-[#0A0B0D]/60 p-1">
              <TabsList className="grid w-full grid-cols-3 bg-transparent h-8 p-0 gap-1">
                <TabsTrigger
                  value="quotes"
                  className="h-7 text-[9.5px] font-mono uppercase tracking-[0.18em] data-[state=active]:bg-[#FFCD05]/10 data-[state=active]:text-[#FFCD05] data-[state=active]:shadow-none text-[#8E949C]"
                >
                  Quotes
                </TabsTrigger>
                <TabsTrigger
                  value="risk"
                  className="h-7 text-[9.5px] font-mono uppercase tracking-[0.18em] data-[state=active]:bg-[#FFCD05]/10 data-[state=active]:text-[#FFCD05] data-[state=active]:shadow-none text-[#8E949C]"
                >
                  Risk
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="h-7 text-[9.5px] font-mono uppercase tracking-[0.18em] data-[state=active]:bg-[#FFCD05]/10 data-[state=active]:text-[#FFCD05] data-[state=active]:shadow-none text-[#8E949C]"
                >
                  System
                </TabsTrigger>
              </TabsList>

              <TabsContent value="quotes" className="mt-2 h-[280px]">
                <BidAskBoard
                  symbols={topBoardSymbols.slice(0, 8)}
                  activeSymbol={activeBroker}
                  onSelect={(sym) => setActiveBroker(sym)}
                />
              </TabsContent>

              <TabsContent value="risk" className="mt-2 px-2 py-3">
                <div className="space-y-2 text-[10.5px] font-mono uppercase tracking-[0.12em] text-[#8E949C]">
                  <div className="flex items-center justify-between">
                    <span>Live Trading</span>
                    <span className="text-emerald-400">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Kill Switch</span>
                    <span className="text-[#C9CDD2]">Off</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max Order Vol</span>
                    <span className="text-[#C9CDD2] tabular-nums">0.01</span>
                  </div>
                  <p className="pt-2 text-[9px] normal-case tracking-normal text-[#5d6168]">
                    Advanced risk controls available in Admin → Risk.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="system" className="mt-2 flex flex-col gap-2">
                <LiveExecutionBanner />
                <SystemHealthWidget />
              </TabsContent>
            </Tabs>
          </aside>
        </div>


        {/* Bottom status bar — bank-terminal style data strip */}
        <TerminalStatusBar selectedSymbol={activeBroker} displayLabel={displayLabel} />

        {/* Compliance disclaimer — small print, single line */}
        <p className="mt-1.5 px-1 text-[9.5px] leading-snug text-[#5d6168]">
          Educational tools and market ideas are provided for informational purposes only and do
          not constitute investment advice. Users are solely responsible for all trading decisions.
        </p>
      </div>
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
