import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Share2,
  Heart,
  Bell,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Layers,
  Activity,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import LightweightCandlestickChart from "@/components/dashboard/LightweightCandlestickChart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// ────────────────────────────────────────────────────────────────────────────────
// Mocked but realistic-feeling data — wire to real Supabase queries in iteration 2
// ────────────────────────────────────────────────────────────────────────────────

const WATCHLIST = [
  { sym: "EUR/USD", price: 1.0942, chg: +0.14, dir: "up" as const },
  { sym: "XAU/USD", price: 2412.5, chg: +0.51, dir: "up" as const },
  { sym: "GBP/JPY", price: 192.45, chg: -0.08, dir: "down" as const },
  { sym: "BTC/USD", price: 64210, chg: +1.32, dir: "up" as const },
  { sym: "US30", price: 39820, chg: +0.32, dir: "up" as const },
  { sym: "DXY", price: 104.2, chg: -0.05, dir: "down" as const },
  { sym: "WTI", price: 78.42, chg: -0.28, dir: "down" as const },
  { sym: "NAS100", price: 18540, chg: +0.5, dir: "up" as const },
];

const COMMUNITY = [
  { name: "Marco D.", role: "Mentor", status: "Live now", color: "yellow" },
  { name: "Lina K.", role: "Pro", status: "Online", color: "yellow" },
  { name: "Theo S.", role: "Mentor", status: "Online", color: "yellow" },
  { name: "Ana R.", role: "Member", status: "Online", color: "gray" },
  { name: "Diego F.", role: "Member", status: "Online", color: "gray" },
  { name: "Sofia M.", role: "Member", status: "Idle", color: "gray" },
  { name: "Owen B.", role: "Pro", status: "Online", color: "yellow" },
];

const RECENT_TRADES = [
  { time: "14:42", sym: "EUR/USD", side: "BUY", size: 0.5, price: 1.0938, pnl: +96 },
  { time: "14:31", sym: "XAU/USD", side: "SELL", size: 0.2, price: 2410.2, pnl: -42 },
  { time: "14:18", sym: "GBP/JPY", side: "BUY", size: 0.3, price: 192.3, pnl: +148 },
  { time: "13:57", sym: "NAS100", side: "BUY", size: 0.1, price: 18510, pnl: +220 },
  { time: "13:40", sym: "BTC/USD", side: "SELL", size: 0.05, price: 64340, pnl: +85 },
];

const MARKET_MONITOR = [
  { sym: "EUR/USD", bid: 1.0941, ask: 1.0943, hi: 1.0958, lo: 1.0902, vol: "12.4k" },
  { sym: "GBP/USD", bid: 1.2710, ask: 1.2712, hi: 1.2738, lo: 1.2682, vol: "8.1k" },
  { sym: "USD/JPY", bid: 154.32, ask: 154.34, hi: 154.78, lo: 153.91, vol: "10.7k" },
  { sym: "AUD/USD", bid: 0.6604, ask: 0.6606, hi: 0.6628, lo: 0.6588, vol: "5.9k" },
  { sym: "USD/CAD", bid: 1.3680, ask: 1.3682, hi: 1.3705, lo: 1.3651, vol: "6.4k" },
  { sym: "XAU/USD", bid: 2412.0, ask: 2412.5, hi: 2418.4, lo: 2398.1, vol: "18.2k" },
  { sym: "BTC/USD", bid: 64205, ask: 64215, hi: 64480, lo: 63520, vol: "22.6k" },
];

// ────────────────────────────────────────────────────────────────────────────────
// Reusable terminal panel
// ────────────────────────────────────────────────────────────────────────────────

const Panel = ({
  title,
  icon: Icon,
  action,
  children,
  className = "",
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={`relative overflow-hidden rounded-xl border border-primary/15 bg-card/70 backdrop-blur-md
      shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5),inset_0_0_0_1px_hsl(48_100%_51%/0.04)]
      transition-shadow duration-500 hover:shadow-[0_8px_30px_-10px_rgba(255,205,5,0.18)] ${className}`}
  >
    {/* subtle yellow corner glow */}
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-px rounded-xl"
      style={{
        background:
          "radial-gradient(120% 60% at 0% 0%, hsl(48 100% 51% / 0.06) 0%, transparent 60%)",
      }}
    />
    <header className="relative flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
        <h2 className="font-proxima text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
          {title}
        </h2>
      </div>
      {action ? <div className="flex items-center gap-1">{action}</div> : null}
    </header>
    <div className="relative">{children}</div>
  </section>
);

// ────────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────────

const CommandBar = () => {
  const [value, setValue] = useState("");
  return (
    <div className="relative flex h-12 w-full items-center gap-2 rounded-xl border border-primary/20 bg-card/80 px-2 backdrop-blur-md
      shadow-[inset_0_0_0_1px_hsl(48_100%_51%/0.05),0_10px_40px_-20px_rgba(255,205,5,0.25)]">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type ticker or command…  e.g. EURUSD LIVE,  XAUUSD CHART,  /SIGNALS BUY"
        className="h-9 flex-1 border-0 bg-transparent font-mono text-[13px] tracking-tight text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-0"
        aria-label="Command bar"
      />
      <div className="flex items-center gap-1">
        {[Search, Share2, Heart].map((Icon, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-md bg-primary px-3 font-mono text-[11px] font-bold tracking-widest text-primary-foreground hover:bg-primary/90"
        >
          IX
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary"
        >
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const WatchlistRow = ({ row }: { row: (typeof WATCHLIST)[number] }) => {
  const positive = row.dir === "up";
  return (
    <button
      type="button"
      className="group flex w-full items-center justify-between gap-3 border-b border-border/30 px-3 py-2 text-left
        transition-colors hover:bg-primary/5"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            positive ? "bg-primary shadow-[0_0_8px_hsl(48_100%_51%)]" : "bg-muted-foreground"
          }`}
        />
        <span className="font-proxima text-[12px] font-semibold tracking-wide text-foreground">
          {row.sym}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[12px] tabular-nums text-foreground/85">
          {row.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        </span>
        <span
          className={`flex items-center gap-0.5 font-mono text-[11px] tabular-nums ${
            positive ? "text-primary" : "text-destructive"
          }`}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {row.chg.toFixed(2)}%
        </span>
      </div>
    </button>
  );
};

// Mini candlestick sparkline panel
const MiniCandles = () => {
  const candles = useMemo(() => {
    const r = (() => {
      let s = 41;
      return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    })();
    return Array.from({ length: 26 }, (_, i) => {
      const bullish = r() > 0.45;
      const bodyH = 8 + r() * 26;
      const wickH = bodyH + 6 + r() * 14;
      const cy = 50 + (r() - 0.5) * 30;
      return { i, bullish, bodyH, wickH, cy, accent: r() > 0.78 };
    });
  }, []);
  return (
    <svg viewBox="0 0 260 120" className="block h-32 w-full" preserveAspectRatio="none">
      {candles.map((c) => {
        const x = 10 + c.i * 9.5;
        const color = c.accent
          ? "hsl(48 100% 51%)"
          : c.bullish
            ? "hsl(0 0% 78%)"
            : "hsl(0 0% 50%)";
        return (
          <g key={c.i} stroke={color} fill={color}>
            <line x1={x} x2={x} y1={c.cy - c.wickH / 2} y2={c.cy + c.wickH / 2} strokeWidth="1" />
            <rect
              x={x - 3}
              y={c.cy - c.bodyH / 2}
              width="6"
              height={c.bodyH}
              fillOpacity={c.accent ? 1 : 0.85}
            />
          </g>
        );
      })}
    </svg>
  );
};

const CommunityNest = () => (
  <ul className="divide-y divide-border/30">
    {COMMUNITY.map((m) => (
      <li
        key={m.name}
        className="flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-primary/5"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar className="h-7 w-7 ring-1 ring-primary/30">
              <AvatarFallback className="bg-secondary text-[10px] font-semibold text-foreground">
                {m.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-card ${
                m.color === "yellow" ? "bg-primary shadow-[0_0_6px_hsl(48_100%_51%)]" : "bg-muted-foreground"
              }`}
            />
          </div>
          <div className="leading-tight">
            <div className="font-proxima text-[12px] font-semibold text-foreground">{m.name}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {m.role}
            </div>
          </div>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
            m.color === "yellow"
              ? "bg-primary/15 text-primary ring-1 ring-primary/30"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {m.status}
        </span>
      </li>
    ))}
  </ul>
);

// ────────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────────

const CommandDeck = () => {
  // Flicker the page title slightly to feel "live"
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen">
      <SEO
        title="Command Deck | IX Live Trading Room"
        description="Bloomberg-grade live trading terminal — yellow candlesticks, dense panels, signals, community nest."
        canonical="https://elitelivetradingroom.com/command"
      />
      <Navbar />

      <main className="container relative z-10 mx-auto pt-20 pb-10">
        {/* Title */}
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                Live · {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <h1 className="font-proxima text-2xl font-light tracking-tight text-foreground md:text-3xl">
              Clever Chart Nest <span className="text-primary">·</span>{" "}
              <span className="heading-semibold">IX Live Trading Room</span>
            </h1>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Powered by
            </span>
            <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-primary-foreground">
              INFINOX
            </span>
          </div>
        </div>

        {/* Command bar */}
        <CommandBar />

        {/* Main grid */}
        <div className="mt-4 grid grid-cols-12 gap-3">
          {/* LEFT column — Live Forex Signals + Mini Chart */}
          <div className="col-span-12 flex flex-col gap-3 lg:col-span-3">
            <Panel
              title="Live Forex Signals"
              icon={Activity}
              action={
                <button className="text-muted-foreground hover:text-primary">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="max-h-[280px] overflow-auto">
                {WATCHLIST.map((row) => (
                  <WatchlistRow key={row.sym} row={row} />
                ))}
              </div>
            </Panel>

            <Panel title="Mini Chart · EUR/USD" icon={BarChart3}>
              <div className="px-2 pt-2">
                <MiniCandles />
                <div className="flex justify-between border-t border-border/30 px-1 pt-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  <span>1H</span>
                  <span>4H</span>
                  <span>1D</span>
                  <span>1W</span>
                </div>
              </div>
            </Panel>
          </div>

          {/* CENTER column — Live Chart */}
          <div className="col-span-12 lg:col-span-6">
            <Panel
              title="Live Charts"
              icon={Layers}
              action={
                <>
                  <button className="text-muted-foreground hover:text-primary">
                    <Search className="h-3.5 w-3.5" />
                  </button>
                  <button className="text-muted-foreground hover:text-primary">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                </>
              }
            >
              <LightweightCandlestickChart symbol="EUR/USD" height={420} className="rounded-none border-0 shadow-none bg-transparent" />
            </Panel>
          </div>

          {/* RIGHT column — Community Nest */}
          <div className="col-span-12 lg:col-span-3">
            <Panel
              title="Community Nest"
              icon={Users}
              action={
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary ring-1 ring-primary/30">
                  {COMMUNITY.filter((c) => c.color === "yellow").length} live
                </span>
              }
            >
              <div className="max-h-[480px] overflow-auto">
                <CommunityNest />
              </div>
            </Panel>
          </div>

          {/* BOTTOM row — Recent Trades + Community Stats + Market Monitor */}
          <div className="col-span-12 md:col-span-4">
            <Panel title="Recent Trades" icon={Activity}>
              <div className="overflow-x-auto">
                <Table className="font-mono text-[11px]">
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="h-8 text-[10px] uppercase tracking-widest text-muted-foreground">Time</TableHead>
                      <TableHead className="h-8 text-[10px] uppercase tracking-widest text-muted-foreground">Pair</TableHead>
                      <TableHead className="h-8 text-right text-[10px] uppercase tracking-widest text-muted-foreground">Size</TableHead>
                      <TableHead className="h-8 text-right text-[10px] uppercase tracking-widest text-muted-foreground">PnL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {RECENT_TRADES.map((t) => {
                      const pos = t.pnl >= 0;
                      return (
                        <TableRow key={t.time + t.sym} className="border-border/20 hover:bg-primary/5">
                          <TableCell className="py-1.5 text-foreground/70">{t.time}</TableCell>
                          <TableCell className="py-1.5">
                            <span className="text-foreground">{t.sym}</span>{" "}
                            <span className={t.side === "BUY" ? "text-primary" : "text-destructive"}>
                              {t.side}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-foreground/80 tabular-nums">
                            {t.size.toFixed(2)}
                          </TableCell>
                          <TableCell
                            className={`py-1.5 text-right tabular-nums font-semibold ${
                              pos ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {pos ? "+" : ""}
                            {t.pnl}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>

          <div className="col-span-12 md:col-span-4">
            <Panel
              title="Community Stats"
              icon={Users}
              action={
                <span className="rounded-md bg-primary/15 px-2 py-0.5 font-proxima text-[12px] font-bold text-primary">
                  $200h
                </span>
              }
            >
              <div className="grid grid-cols-3 gap-px bg-border/30">
                {[
                  { label: "Members", value: "5,184" },
                  { label: "Online", value: "412" },
                  { label: "Win Rate", value: "75%" },
                  { label: "Signals 24h", value: "38" },
                  { label: "Avg R:R", value: "1.9" },
                  { label: "Trades 24h", value: "624" },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-card/80 p-3 transition-colors hover:bg-primary/5"
                  >
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {kpi.label}
                    </div>
                    <div className="mt-1 font-proxima text-lg font-semibold tabular-nums text-foreground">
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>
              {/* Highlighted streak row, mirrors mockup */}
              <div className="flex items-center justify-between gap-2 border-t border-border/30 bg-primary/15 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(48_100%_51%)]" />
                  <span className="font-proxima text-[12px] font-semibold text-foreground">
                    Streak Leader · Marco D.
                  </span>
                </div>
                <span className="font-mono text-[12px] font-bold tabular-nums text-primary-foreground">
                  +312.7%
                </span>
              </div>
            </Panel>
          </div>

          <div className="col-span-12 md:col-span-4">
            <Panel
              title="Market Monitor"
              icon={BarChart3}
              action={
                <button className="text-muted-foreground hover:text-primary">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="overflow-x-auto">
                <Table className="font-mono text-[10.5px]">
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="h-8 text-[9px] uppercase tracking-widest text-muted-foreground">Sym</TableHead>
                      <TableHead className="h-8 text-right text-[9px] uppercase tracking-widest text-muted-foreground">Bid</TableHead>
                      <TableHead className="h-8 text-right text-[9px] uppercase tracking-widest text-muted-foreground">Ask</TableHead>
                      <TableHead className="h-8 text-right text-[9px] uppercase tracking-widest text-muted-foreground">Hi</TableHead>
                      <TableHead className="h-8 text-right text-[9px] uppercase tracking-widest text-muted-foreground">Lo</TableHead>
                      <TableHead className="h-8 text-right text-[9px] uppercase tracking-widest text-muted-foreground">Vol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MARKET_MONITOR.map((row) => (
                      <TableRow key={row.sym} className="border-border/20 hover:bg-primary/5">
                        <TableCell className="py-1 font-semibold text-foreground">{row.sym}</TableCell>
                        <TableCell className="py-1 text-right text-primary tabular-nums">
                          {row.bid.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="py-1 text-right text-foreground/80 tabular-nums">
                          {row.ask.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="py-1 text-right text-foreground/70 tabular-nums">
                          {row.hi.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="py-1 text-right text-foreground/70 tabular-nums">
                          {row.lo.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </TableCell>
                        <TableCell className="py-1 text-right text-muted-foreground tabular-nums">
                          {row.vol}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          </div>
        </div>

        {/* Footer ticker hint */}
        <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Tick #{tick.toString().padStart(4, "0")} · Streaming · INFINOX Liquidity
        </div>
      </main>
    </div>
  );
};

export default CommandDeck;
