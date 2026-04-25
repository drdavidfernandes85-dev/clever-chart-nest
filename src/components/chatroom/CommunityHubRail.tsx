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
import { useHotMentions, HotMention } from "@/hooks/useHotMentions";

const HOT_FALLBACK: HotMention[] = [
  { symbol: "EUR/USD", mentions: 0, price: null, changePct: null, up: true },
  { symbol: "XAU/USD", mentions: 0, price: null, changePct: null, up: true },
  { symbol: "GBP/JPY", mentions: 0, price: null, changePct: null, up: false },
  { symbol: "BTC/USDT", mentions: 0, price: null, changePct: null, up: true },
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
  const { hot } = useHotMentions(8);
  const hotRows = hot.length ? hot : HOT_FALLBACK;

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
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5">
      {/* Community Pulse — stats strip */}
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

      {/* Live Shared Signals — MOST PROMINENT, includes "Take This Signal" → Quick Trade */}
      <div className="rounded-2xl border border-primary/40 bg-card/80 backdrop-blur-md overflow-hidden shadow-[0_10px_40px_-12px_hsl(48_100%_51%/0.4)]">
        <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/5 px-3 py-2">
          <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Live Shared Signals
          </span>
        </div>
        <div className="p-1">
          <LiveSharedSignals />
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
          {hotRows.map((h) => {
            const hasPrice = h.price != null;
            const hasChange = h.changePct != null;
            return (
              <li
                key={h.symbol}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-foreground truncate">
                    {h.symbol}
                  </span>
                  {h.mentions > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                      {h.mentions}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasPrice && (
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      {h.price!.toLocaleString(undefined, {
                        maximumFractionDigits: h.price! < 10 ? 4 : 2,
                      })}
                    </span>
                  )}
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
                    {hasChange ? `${h.up ? "+" : ""}${h.changePct!.toFixed(2)}%` : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Top Mentors */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
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
            <li key={m.name} className="flex items-center gap-2.5 px-3 py-2.5">
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
      <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm px-3 py-2 flex items-center gap-2">
        <Users className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] leading-tight text-muted-foreground">
          Real-time community feed
        </span>
      </div>
    </div>
  );
};

export default CommunityHubRail;
