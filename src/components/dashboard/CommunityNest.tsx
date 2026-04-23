import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Radio, TrendingUp, TrendingDown, Users, Zap, Flame, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuickTrade } from "@/contexts/QuickTradeContext";

/**
 * Community Nest — right-sidebar showing online traders, live shared signals,
 * a "Hot Right Now" pulse, and a mini chat preview. INFINOX-themed.
 */

type Trader = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

type SharedSignal = {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  status: string;
  created_at: string;
};

type ChatPreview = {
  id: string;
  content: string;
  created_at: string;
  display_name: string;
};

const STATUS_COLORS = [
  { label: "Live", dot: "bg-emerald-400" },
  { label: "Trading", dot: "bg-emerald-400" },
  { label: "Watching", dot: "bg-amber-400" },
  { label: "Idle", dot: "bg-zinc-400" },
  { label: "Online", dot: "bg-emerald-400" },
];

const HOT_PAIRS = [
  { pair: "EUR/USD", mentions: 42, change: "+0.34%", up: true },
  { pair: "XAU/USD", mentions: 31, change: "+1.12%", up: true },
  { pair: "GBP/JPY", mentions: 24, change: "-0.42%", up: false },
  { pair: "BTC/USD", mentions: 19, change: "+2.18%", up: true },
];

const initialsOf = (n: string) =>
  n.split(/[\s.]+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "TR";

const CommunityNest = () => {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [signals, setSignals] = useState<SharedSignal[]>([]);
  const [messages, setMessages] = useState<ChatPreview[]>([]);
  const [onlineCount, setOnlineCount] = useState(184);
  const { openTrade } = useQuickTrade();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [{ data: profiles }, { data: sigs }, { data: msgs }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").limit(8),
        supabase
          .from("trading_signals")
          .select("id, pair, direction, entry_price, status, created_at")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("messages")
          .select("id, content, created_at, user_id")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      if (cancelled) return;
      if (profiles) setTraders(profiles as Trader[]);
      if (sigs) setSignals(sigs as SharedSignal[]);

      if (msgs && msgs.length) {
        const ids = Array.from(new Set(msgs.map((m: any) => m.user_id)));
        const { data: profMap } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", ids);
        const nameMap = new Map((profMap || []).map((p: any) => [p.user_id, p.display_name]));
        setMessages(
          msgs.map((m: any) => ({
            id: m.id,
            content: m.content,
            created_at: m.created_at,
            display_name: nameMap.get(m.user_id) || "Trader",
          })),
        );
      }
    })();

    const tick = setInterval(() => {
      setOnlineCount((n) => Math.max(120, Math.min(420, n + Math.floor((Math.random() - 0.5) * 6))));
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  const traderList =
    traders.length > 0
      ? traders
      : (["IX_Mentor", "df23fx", "EUR_King", "desk-trader", "pip_hunter", "alpha-rat"].map((name, i) => ({
          user_id: `placeholder-${i}`,
          display_name: name,
          avatar_url: null,
        })) as Trader[]);

  return (
    <aside className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl border border-primary/25 bg-card/80 backdrop-blur-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Community Nest
            </h3>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-mono text-[10px] tabular-nums text-foreground">{onlineCount}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">online</span>
          </div>
        </div>
      </div>

      {/* Online traders — bigger avatars with status colors */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <span className="font-proxima text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Online traders
          </span>
          <Link to="/leaderboard" className="text-[10px] text-primary hover:underline">
            View all
          </Link>
        </div>

        {/* Avatar strip */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/30">
          {traderList.slice(0, 6).map((t, i) => {
            const status = STATUS_COLORS[i % STATUS_COLORS.length];
            return (
              <div key={`avatar-${t.user_id}`} className="relative" title={`${t.display_name} · ${status.label}`}>
                {t.avatar_url ? (
                  <img
                    src={t.avatar_url}
                    alt={t.display_name}
                    className="h-9 w-9 rounded-full object-cover border-2 border-card hover:border-primary transition-colors"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary border-2 border-card hover:border-primary transition-colors">
                    {initialsOf(t.display_name)}
                  </div>
                )}
                <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${status.dot}`} />
              </div>
            );
          })}
          {traderList.length > 6 && (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/60 text-[10px] font-bold text-muted-foreground border-2 border-card">
              +{Math.max(0, onlineCount - 6)}
            </div>
          )}
        </div>

        <ul className="divide-y divide-border/30">
          {traderList.slice(0, 4).map((t, i) => {
            const status = STATUS_COLORS[i % STATUS_COLORS.length];
            return (
              <li key={t.user_id} className="flex items-center gap-3 px-3 py-2">
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {initialsOf(t.display_name)}
                  </div>
                  <span className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-card ${status.dot}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-xs font-semibold text-foreground">{t.display_name}</p>
                    {i < 2 && <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{status.label}</p>
                </div>
                {i < 2 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                    Mentor
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Hot Right Now */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Flame className="h-3 w-3 text-primary" />
            <span className="font-proxima text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Hot Right Now
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70">last 1h</span>
        </div>
        <ul className="divide-y divide-border/30">
          {HOT_PAIRS.map((h) => (
            <li key={h.pair} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{h.pair}</span>
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
                  {h.mentions} mentions
                </span>
              </div>
              <span className={`font-mono text-[11px] font-semibold ${h.up ? "text-emerald-400" : "text-red-400"}`}>
                {h.change}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Live shared signals */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-primary" />
            <span className="font-proxima text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Live shared signals
            </span>
          </div>
          <Link to="/signals" className="text-[10px] text-primary hover:underline">
            All
          </Link>
        </div>
        <ul className="divide-y divide-border/30">
          {(signals.length
            ? signals
            : [
                { id: "p1", pair: "EUR/USD", direction: "buy", entry_price: 1.0845, status: "open", created_at: "" },
                { id: "p2", pair: "GBP/JPY", direction: "sell", entry_price: 192.34, status: "open", created_at: "" },
                { id: "p3", pair: "XAU/USD", direction: "buy", entry_price: 2412.5, status: "open", created_at: "" },
              ]).slice(0, 4).map((s) => {
            const isBuy = s.direction.toLowerCase() === "buy";
            return (
              <li key={s.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isBuy ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                    )}
                    <div>
                      <p className="font-mono text-xs font-bold text-foreground">{s.pair}</p>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {s.direction}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs tabular-nums text-foreground">{Number(s.entry_price).toFixed(4)}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-primary">{s.status}</p>
                  </div>
                </div>
                <button
                  onClick={() => openTrade(s.pair, isBuy ? "buy" : "sell")}
                  className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  Take This Signal
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Mini chat preview */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3 w-3 text-primary" />
            <span className="font-proxima text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Room chat
            </span>
          </div>
          <Link to="/chatroom" className="text-[10px] text-primary hover:underline">
            Open
          </Link>
        </div>
        <ul className="divide-y divide-border/30 max-h-44 overflow-hidden">
          {(messages.length ? messages : [
            { id: "m1", display_name: "María G.", content: "EU breaking the 1.0850 zone — eyes on retest.", created_at: "" },
            { id: "m2", display_name: "Jonas K.", content: "Took partials on GU short, runner active.", created_at: "" },
            { id: "m3", display_name: "Alex T.", content: "Gold liquidity sweep printed. Nice setup.", created_at: "" },
          ]).slice(0, 4).map((m) => (
            <li key={m.id} className="px-3 py-2">
              <p className="text-[10px] font-semibold text-primary">{m.display_name}</p>
              <p className="line-clamp-2 text-[11px] text-foreground/85">{m.content}</p>
            </li>
          ))}
        </ul>
        <Link
          to="/chatroom"
          className="block border-t border-border/40 bg-primary/5 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-primary hover:bg-primary/10"
        >
          Join the conversation →
        </Link>
      </div>
    </aside>
  );
};

export default CommunityNest;
