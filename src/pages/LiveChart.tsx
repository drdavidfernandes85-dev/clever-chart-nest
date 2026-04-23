import { useState } from "react";
import {
  BarChart3,
  MessageSquare,
  LayoutDashboard,
  User,
  ChevronDown,
  Settings2,
  Check,
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
import RiskCalculator from "@/components/trading/RiskCalculator";

import SmartAlerts from "@/components/dashboard/SmartAlerts";
import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";

const SYMBOL_OPTIONS = [
  { label: "EUR/USD", value: "FX:EURUSD" },
  { label: "GBP/USD", value: "FX:GBPUSD" },
  { label: "USD/JPY", value: "FX:USDJPY" },
  { label: "AUD/USD", value: "FX:AUDUSD" },
  { label: "USD/CAD", value: "FX:USDCAD" },
  { label: "USD/CHF", value: "FX:USDCHF" },
  { label: "NZD/USD", value: "FX:NZDUSD" },
  { label: "XAU/USD", value: "OANDA:XAUUSD" },
  { label: "GBP/JPY", value: "FX:GBPJPY" },
  { label: "BTC/USD", value: "BITSTAMP:BTCUSD" },
  { label: "ETH/USD", value: "BITSTAMP:ETHUSD" },
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

const LiveChart = () => {
  const [symbol, setSymbol] = useState("FX:EURUSD");
  const [interval, setInterval] = useState("15");
  const [studies, setStudies] = useState<string[]>(["STD;RSI", "STD;MACD"]);

  const currentLabel = SYMBOL_OPTIONS.find((s) => s.value === symbol)?.label ?? symbol;

  const toggleStudy = (id: string) => {
    setStudies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <SEO
        title="Live Chart | Elite Live Trading Room"
        description="Pro multi-timeframe charts with timeframes, indicators and live signals."
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
              Live Chart
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
      <div className="p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Chart hero */}
          <section className="flex flex-col rounded-2xl border border-border/30 bg-card overflow-hidden h-[calc(100vh-6.5rem)] min-h-[640px]">
            {/* Chart top toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 px-4 py-2.5">
              {/* Left: symbol selector */}
              <div className="flex items-center gap-2">
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
              </div>

              {/* Right: timeframes + indicators */}
              <div className="flex items-center gap-2">
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
              </div>
            </div>

            {/* Chart canvas — fills the rest */}
            <div className="flex-1 min-h-0">
              <TradingViewAdvancedIframe
                key={`${symbol}-${interval}-${studies.join(",")}`}
                symbol={symbol}
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

          {/* Right rail */}
          <aside className="flex flex-col gap-4 lg:h-[calc(100vh-6.5rem)] lg:min-h-[640px] lg:overflow-y-auto pr-1">
            <LiveSharedSignals />
            <SmartAlerts />
          </aside>
        </div>
      </div>

      <RiskCalculator />
    </div>
  );
};

export default LiveChart;
