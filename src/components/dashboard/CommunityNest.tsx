import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Radio, TrendingUp, TrendingDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Community Nest — right-sidebar showing online traders, live shared signals,
 * and a mini chat preview. INFINOX-themed.
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

const ONLINE_LABELS = ["Online", "Trading", "Live", "Watching", "Idle"];

const CommunityNest = () => {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [signals, setSignals] = useState<SharedSignal[]>([]);
  const [messages, setMessages] = useState<ChatPreview[]>([]);
  const [onlineCount, setOnlineCount] = useState(184);

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

      // Hydrate message author names
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

    // Light pulse on online count to feel "live"
    const tick = setInterval(() => {
      setOnlineCount((n) => Math.max(120, Math.min(420, n + Math.floor((Math.random() - 0.5) * 6))));
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

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

      {/* Online traders */}
      <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <span className="font-proxima text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Online traders
          </span>
          <Link to="/leaderboard" className="text-[10px] text-primary hover:underline">
            View all
          </Link>
        </div>
        <ul className="divide-y divide-border/30">
          {(traders.length ? traders : Array.from({ length: 5 }).map((_, i) => ({
            user_id: `placeholder-${i}`,
            display_name: ["Alex T.", "María G.", "Jonas K.", "Priya R.", "Sam W."][i],
            avatar_url: null,
          } as Trader))).slice(0, 6).map((t, i) => {
            const status = ONLINE_LABELS[i % ONLINE_LABELS.length];
            const initials = t.display_name?.slice(0, 2).toUpperCase() || "TR";
            return (
              <li key={t.user_id} className="flex items-center gap-3 px-3 py-2">
                <div className="relative">
                  {t.avatar_url ? (
                    <img src={t.avatar_url} alt={t.display_name} className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {initials}
                    </div>
                  )}
                  <span className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-card bg-[hsl(145_65%_50%)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{t.display_name}</p>
                  <p className="text-[10px] text-muted-foreground">{status}</p>
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
          {(signals.length ? signals : [
            { id: "p1", pair: "EUR/USD", direction: "buy", entry_price: 1.0845, status: "open", created_at: "" },
            { id: "p2", pair: "GBP/JPY", direction: "sell", entry_price: 192.34, status: "open", created_at: "" },
            { id: "p3", pair: "XAU/USD", direction: "buy", entry_price: 2412.5, status: "open", created_at: "" },
          ]).slice(0, 4).map((s) => {
            const isBuy = s.direction.toLowerCase() === "buy";
            return (
              <li key={s.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  {isBuy ? (
                    <TrendingUp className="h-3.5 w-3.5 text-[hsl(145_65%_50%)]" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-[hsl(0_70%_55%)]" />
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
