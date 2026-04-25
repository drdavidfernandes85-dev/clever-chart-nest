import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flame,
  Trophy,
  Users,
  Radio,
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LiveSharedSignals from "@/components/dashboard/LiveSharedSignals";

type Mover = { pair: string; mentions: number; change: string; up: boolean };

const HOT_PAIRS_FALLBACK: Mover[] = [
  { pair: "EUR/USD", mentions: 42, change: "+0.34%", up: true },
  { pair: "XAU/USD", mentions: 31, change: "+1.12%", up: true },
  { pair: "GBP/JPY", mentions: 24, change: "-0.42%", up: false },
  { pair: "BTC/USD", mentions: 19, change: "+2.18%", up: true },
  { pair: "USD/JPY", mentions: 14, change: "-0.18%", up: false },
];

type Mentor = { name: string; pnl: string; winrate: string };
const MENTOR_FALLBACK: Mentor[] = [
  { name: "IX_Mentor", pnl: "+18.4%", winrate: "72%" },
  { name: "EUR_King", pnl: "+12.1%", winrate: "68%" },
  { name: "alpha-rat", pnl: "+9.8%", winrate: "61%" },
];

const initialsOf = (n: string) =>
  n
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "TR";

/**
 * Right-rail content for the Community Hub (Chatroom page).
 * Combines: Community Stats · Hot Right Now · Live Shared Signals · Top Mentors.
 */
const CommunityHubRail = () => {
  const [onlineCount, setOnlineCount] = useState(184);
  const [activeSignals, setActiveSignals] = useState<number>(0);
  const [todayTrades, setTodayTrades] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: sigs }, { count: trades }] = await Promise.all([
        supabase
          .from("trading_signals")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "active"]),
        supabase
          .from("mt_pending_orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);
      if (cancelled) return;
      setActiveSignals(sigs ?? 0);
      setTodayTrades(trades ?? 0);
    })();

    const tick = setInterval(() => {
      setOnlineCount((n) =>
        Math.max(120, Math.min(420, n + Math.floor((Math.random() - 0.5) * 6))),
      );
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Community stats */}
      <div className="rounded-2xl border border-primary/25 bg-card/80 backdrop-blur-md p-3 shadow-[0_8px_30px_-12px_hsl(48_100%_51%/0.25)]">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Community Pulse
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/40 bg-background/40 px-2 py-2 text-center">
            <p className="font-mono text-base font-bold tabular-nums text-primary leading-none">
              {onlineCount}
            </p>
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Online
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 px-2 py-2 text-center">
            <p className="font-mono text-base font-bold tabular-nums text-foreground leading-none">
              {activeSignals}
            </p>
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Signals
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 px-2 py-2 text-center">
            <p className="font-mono text-base font-bold tabular-nums text-foreground leading-none">
              {todayTrades}
            </p>
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Trades 24h
            </p>
          </div>
        </div>
      </div>

      {/* Hot Right Now */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
              Hot Right Now
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
            last 1h
          </span>
        </div>
        <ul className="divide-y divide-border/30">
          {HOT_PAIRS_FALLBACK.map((h) => (
            <li
              key={h.pair}
              className="flex items-center justify-between px-3 py-2 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{h.pair}</span>
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                  {h.mentions}
                </span>
              </div>
              <span
                className={`font-mono text-[11px] font-semibold ${
                  h.up ? "text-[hsl(145_65%_50%)]" : "text-[hsl(0_70%_55%)]"
                }`}
              >
                {h.up ? (
                  <TrendingUp className="inline h-3 w-3 mr-0.5" />
                ) : (
                  <TrendingDown className="inline h-3 w-3 mr-0.5" />
                )}
                {h.change}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Live Shared Signals — full component, includes "Take This Signal" → Quick Trade */}
      <LiveSharedSignals />

      {/* Top Mentors */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
              Top Mentors
            </span>
          </div>
          <Link
            to="/leaderboard"
            className="font-proxima text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            All
          </Link>
        </div>
        <ul className="divide-y divide-border/30">
          {MENTOR_FALLBACK.map((m, i) => (
            <li key={m.name} className="flex items-center gap-2.5 px-3 py-2">
              <span className="font-mono text-[10px] font-bold text-primary w-4 text-center">
                {i + 1}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary border border-primary/30">
                {initialsOf(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-xs font-semibold text-foreground">{m.name}</p>
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                </div>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  WR {m.winrate}
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold text-[hsl(145_65%_50%)] tabular-nums">
                {m.pnl}
              </span>
            </li>
          ))}
        </ul>
        <Link
          to="/leaderboard"
          className="block border-t border-border/40 bg-primary/5 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors"
        >
          View leaderboard →
        </Link>
      </div>

      {/* Footer mini-tag */}
      <div className="mt-auto rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm px-3 py-2 flex items-center gap-2">
        <Users className="h-3 w-3 text-primary" />
        <span className="text-[10px] text-muted-foreground">
          Real-time community feed · Elite Live Trading Room
        </span>
      </div>
    </div>
  );
};

export default CommunityHubRail;
