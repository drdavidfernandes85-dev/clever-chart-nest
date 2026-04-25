import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  MessageSquare,
  LayoutDashboard,
  User,
  ChevronDown,
  Settings2,
  Check,
  Maximize2,
  Minimize2,
  GitCompare,
  Pencil,
  X,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";


import NotificationsBell from "@/components/notifications/NotificationsBell";


import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";
import ChartHeaderStats from "@/components/livechart/ChartHeaderStats";
import MiniWatchlist from "@/components/livechart/MiniWatchlist";
import SymbolPositions from "@/components/livechart/SymbolPositions";
import FloatingQuickTrade from "@/components/livechart/FloatingQuickTrade";
import { useQuickTrade } from "@/contexts/QuickTradeContext";

// Mixed-asset chart selector — crypto, forex, indices, main stocks.
const SYMBOL_OPTIONS = [
  // Crypto
  { label: "BTC/USDT",   value: "BINANCE:BTCUSDT" },
  { label: "ETH/USDT",   value: "BINANCE:ETHUSDT" },
  { label: "SOL/USDT",   value: "BINANCE:SOLUSDT" },
  { label: "XRP/USDT",   value: "BINANCE:XRPUSDT" },
  // Forex majors
  { label: "EUR/USD",    value: "FX:EURUSD" },
  { label: "GBP/USD",    value: "FX:GBPUSD" },
  { label: "USD/JPY",    value: "FX:USDJPY" },
  { label: "AUD/USD",    value: "FX:AUDUSD" },
  // Indices
  { label: "S&P 500",    value: "TVC:SPX" },
  { label: "Nasdaq 100", value: "TVC:NDX" },
  { label: "Dow Jones",  value: "TVC:DJI" },
  { label: "DAX 40",     value: "TVC:DAX" },
  // Major US stocks
  { label: "AAPL",       value: "NASDAQ:AAPL" },
  { label: "MSFT",       value: "NASDAQ:MSFT" },
  { label: "NVDA",       value: "NASDAQ:NVDA" },
  { label: "TSLA",       value: "NASDAQ:TSLA" },
  { label: "META",       value: "NASDAQ:META" },
];

const TIMEFRAMES: Array<{ label: string; value: string }> = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1h", value: "60" },
  { label: "4h", value: "240" },
  { label: "1D", value: "D" },
];

const INDICATORS: Array<{ id: string; label: string }> = [
  { id: "STD;RSI", label: "RSI" },
  { id: "STD;MACD", label: "MACD" },
  { id: "STD;EMA", label: "EMA" },
  { id: "STD;SMA", label: "SMA" },
  { id: "STD;Bollinger_Bands", label: "Bollinger Bands" },
  { id: "STD;Stochastic", label: "Stochastic" },
  { id: "STD;Volume", label: "Volume" },
  { id: "STD;ATR", label: "ATR" },
];

// "BINANCE:BTCUSDT" → "BTC/USDT" for the QuickTradePanel context.
const tvSymbolToPair = (tv: string) => {
  const opt = SYMBOL_OPTIONS.find((o) => o.value === tv);
  if (opt) return opt.label;
  const clean = tv.replace(/^[A-Z]+:/, "");
  if (clean.endsWith("USDT")) return `${clean.slice(0, -4)}/USDT`;
  if (clean.length >= 6) return `${clean.slice(0, 3)}/${clean.slice(3, 6)}`;
  return clean;
};

const LiveChart = () => {
  const [symbol, setSymbol] = useState("BINANCE:BTCUSDT");
  const [interval, setInterval] = useState("15");
  const [studies, setStudies] = useState<string[]>([]);
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  
  const chartShellRef = useRef<HTMLElement>(null);
  const { setSymbol: setCtxSymbol } = useQuickTrade();

  const currentLabel = SYMBOL_OPTIONS.find((s) => s.value === symbol)?.label ?? symbol;

  // Keep the QuickTrade context symbol in sync with the chart symbol so
  // one-click trading from the floating panel always targets what the user sees.
  useEffect(() => {
    setCtxSymbol(tvSymbolToPair(symbol));
  }, [symbol, setCtxSymbol]);

  // Track real fullscreen state (covers Esc key)
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Persist rail open/closed
  useEffect(() => {
    const saved = window.localStorage.getItem("eltr.liveChart.rail");
    if (saved !== null) setRailOpen(saved === "1");
  }, []);
  useEffect(() => {
    window.localStorage.setItem("eltr.liveChart.rail", railOpen ? "1" : "0");
  }, [railOpen]);

  const toggleStudy = (id: string) => {
    setStudies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const toggleCompare = (val: string) => {
    setCompareSymbols((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val].slice(0, 3),
    );
  };

  const toggleFullscreen = async () => {
    const el = chartShellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  // Combine main + compare studies for the TradingView widget.
  // TradingView's free widget only renders one symbol natively, so we add
  // overlays via the "Compare" study when compareSymbols are set.
  const effectiveStudies = [
    ...studies,
    ...compareSymbols.map((s) => `Compare@tv-basicstudies||${s}`),
  ];

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SEO
        title="Live Chart Terminal | Elite Live Trading Room"
        description="High-end live trading terminal with real-time charts, quick trade execution and pro indicators."
        canonical="https://elitelivetradingroom.com/live-chart"
      />

      {/* App header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img src={infinoxLogo} alt="INFINOX" className="h-5" />
              <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
              <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
                Elite <span className="text-primary">Live Trading Room</span>
              </span>
            </Link>
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wider rounded-full">
              Live Terminal
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
              <Link to="/chatroom">
                <MessageSquare className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Chatroom</span>
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

      {/* Workspace */}
      <div className="p-3 lg:p-4">
        <div
          className={`grid gap-3 lg:gap-4 ${
            railOpen
              ? "lg:grid-cols-[minmax(0,1fr)_340px]"
              : "lg:grid-cols-[minmax(0,1fr)]"
          }`}
        >
          {/* Chart hero — bigger, dominant */}
          <section
            ref={chartShellRef}
            className="relative flex flex-col rounded-2xl border border-border/30 bg-card overflow-hidden h-[calc(100vh-5.5rem)] min-h-[680px]"
          >
            {/* Top toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-2.5">
              {/* Left: symbol selector + indicator badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <BarChart3 className="h-4 w-4 text-primary" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-sm font-heading font-semibold text-foreground hover:bg-muted/50 transition-colors">
                      {currentLabel}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Symbols
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SYMBOL_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setSymbol(opt.value)}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{opt.label}</span>
                        {symbol === opt.value && <Check className="h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge
                  variant="outline"
                  className="hidden md:inline-flex h-6 rounded-full border-emerald-500/30 bg-emerald-500/10 text-[10px] font-mono uppercase tracking-widest text-emerald-400"
                >
                  ● Live
                </Badge>

                {/* Compare chip(s) */}
                {compareSymbols.length > 0 && (
                  <div className="flex items-center gap-1">
                    {compareSymbols.map((cs) => {
                      const lbl = SYMBOL_OPTIONS.find((o) => o.value === cs)?.label ?? cs;
                      return (
                        <span
                          key={cs}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary"
                        >
                          {lbl}
                          <button
                            onClick={() => toggleCompare(cs)}
                            className="hover:text-foreground"
                            aria-label={`Remove ${lbl}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: tools */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-0.5 rounded-full border border-border/40 bg-muted/30 p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setInterval(tf.value)}
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

                {/* Compare */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors">
                      <GitCompare className="h-3.5 w-3.5 text-primary" />
                      Compare
                      {compareSymbols.length > 0 && (
                        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/20 px-1 text-[9px] font-mono text-primary">
                          {compareSymbols.length}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Overlay symbol
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {SYMBOL_OPTIONS.filter((o) => o.value !== symbol).map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        checked={compareSymbols.includes(opt.value)}
                        onCheckedChange={() => toggleCompare(opt.value)}
                        className="text-sm"
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Drawing tools hint — TradingView side toolbar handles the actual tools */}
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors"
                  title="Drawing tools are available on the chart's left toolbar"
                >
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                  Draw
                </button>

                {/* Quick Trade now lives in the right sidebar below Smart Alerts */}

                {/* Rail toggle */}
                <button
                  type="button"
                  onClick={() => setRailOpen((v) => !v)}
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-[11px] font-heading font-semibold uppercase tracking-wider text-foreground hover:bg-muted/50 transition-colors"
                  title={railOpen ? "Hide right panel" : "Show right panel"}
                  aria-expanded={railOpen}
                >
                  {railOpen ? (
                    <PanelRightClose className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <PanelRightOpen className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="hidden xl:inline">{railOpen ? "Hide Panel" : "Show Panel"}</span>
                </button>

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

            {/* Premium price/stats header */}
            <ChartHeaderStats symbol={symbol} displayLabel={currentLabel} />

            {/* Mini watchlist — fast switching between favorites */}
            <MiniWatchlist
              symbols={SYMBOL_OPTIONS}
              active={symbol}
              onSelect={setSymbol}
            />

            {/* Chart canvas — fills the rest */}
            <div className="relative flex-1 min-h-0">
              <TradingViewAdvancedIframe
                key={`${symbol}-${interval}-${studies.join(",")}-${compareSymbols.join(",")}`}
                symbol={symbol}
                interval={interval}
                height="100%"
                allowSymbolChange={false}
                hideSideToolbar={false}
                withDateRanges={true}
                saveImage={true}
                studies={effectiveStudies}
              />
            </div>
          </section>

          {/* Right rail */}
          {railOpen && (
            <aside className="flex flex-col gap-3 lg:h-[calc(100vh-5.5rem)] lg:min-h-[680px] lg:overflow-y-auto pr-1">
              {/* My positions for the active chart symbol — pulled from EA */}
              <SymbolPositions symbolLabel={currentLabel} />
              <LiveSharedSignals />
            </aside>
          )}
        </div>
      </div>
      {/* Floating, draggable Quick Trade — minimized by default */}
      <FloatingQuickTrade />
    </div>
  );
};

export default LiveChart;
