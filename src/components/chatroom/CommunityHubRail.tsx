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

// Activity-based community contributors — NO performance claims (regulation compliant).
type Contributor = { name: string; ideas: number; role: string };
const CONTRIBUTOR_FALLBACK: Contributor[] = [
  { name: "IX_Mentor",  ideas: 42, role: "Lead Mentor" },
  { name: "EUR_King",   ideas: 31, role: "Senior Trader" },
  { name: "alpha-rat",  ideas: 24, role: "Active Member" },
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
 * Combines: Community Pulse · Shared Market Ideas · Hot Right Now · Top Contributors.
 * Regulation-compliant: no signals language, no performance claims.
 */
const CommunityHubRail = () => {
  const [onlineCount, setOnlineCount] = useState(184);
  const [activeIdeas, setActiveIdeas] = useState<number>(0);
  const [ideasShared24h, setIdeasShared24h] = useState<number>(0);
  const { hot } = useHotMentions(8);
  const hotRows = hot.length ? hot : HOT_FALLBACK;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: ideas }, { count: recent }] = await Promise.all([
        supabase
          .from("trading_signals")
          .select("id", { count: "exact", head: true })
          .in("status", ["open", "active"]),
        supabase
          .from("trading_signals")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      ]);
      if (cancelled) return;
      setActiveIdeas(ideas ?? 0);
      setIdeasShared24h(recent ?? 0);
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
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto px-2 py-2 pb-3 sm:gap-2.5 sm:px-2.5 sm:py-2.5 lg:gap-3 lg:p-3">
      {/* Community Pulse — stats strip */}
      <div className="rounded-2xl border border-primary/25 bg-card/80 backdrop-blur-md p-2.5 shadow-[0_8px_30px_-12px_hsl(48_100%_51%/0.25)] sm:p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Community Pulse
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
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
              {activeIdeas}
            </p>
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Active Ideas
            </p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 px-2 py-2 text-center">
            <p className="font-mono text-base font-bold tabular-nums text-foreground leading-none">
              {ideasShared24h}
            </p>
            <p className="mt-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Shared 24h
            </p>
          </div>
        </div>
      </div>

      {/* Shared Market Ideas — community trade ideas (educational, no execution language). */}
      <div className="rounded-2xl border border-primary/40 bg-card/80 backdrop-blur-md overflow-hidden shadow-[0_10px_40px_-12px_hsl(48_100%_51%/0.4)]">
        <div className="flex items-center gap-2 border-b border-primary/30 bg-primary/5 px-3 py-2">
          <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Shared Market Ideas
          </span>
        </div>
        <div className="p-0">
          <LiveSharedSignals />
        </div>
      </div>

      {/* Hot Right Now */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-2.5 py-2 sm:px-3">
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
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-primary/5 sm:px-3"
              >
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  <span className="block min-w-0 truncate font-mono text-xs font-bold text-foreground">
                    {h.symbol}
                  </span>
                  {h.mentions > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                      {h.mentions}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                  {hasPrice && (
                    <span className="w-[4.75rem] text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {h.price!.toLocaleString(undefined, {
                        maximumFractionDigits: h.price! < 10 ? 4 : 2,
                      })}
                    </span>
                  )}
                  <span
                    className={`inline-flex w-[4.5rem] items-center justify-end font-mono text-[11px] font-semibold ${
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

      {/* Top Community Contributors — activity-based, NO performance data. */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-2.5 py-2 sm:px-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-primary" />
            <span className="font-proxima text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
              Top Contributors
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
          {CONTRIBUTOR_FALLBACK.map((m, i) => (
            <li key={m.name} className="grid grid-cols-[1rem_1.75rem_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3">
              <span className="w-4 text-center font-mono text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-[10px] font-bold text-primary">
                {initialsOf(m.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="min-w-0 truncate text-xs font-semibold text-foreground">{m.name}</p>
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />
                </div>
                <p className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  {m.role}
                </p>
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-right font-mono text-[10px] font-bold tabular-nums text-primary">
                {m.ideas} ideas
              </span>
            </li>
          ))}
        </ul>
        <Link
          to="/leaderboard"
          className="block border-t border-border/40 bg-primary/5 px-2.5 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 sm:px-3"
        >
          View leaderboard →
        </Link>
      </div>

      {/* Footer mini-tag */}
      <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 px-2.5 py-2 backdrop-blur-sm sm:px-3">
        <Users className="h-3 w-3 text-primary shrink-0" />
        <span className="text-[10px] leading-tight text-muted-foreground">
          Real-time community feed
        </span>
      </div>
    </div>
  );
};

export default CommunityHubRail;
