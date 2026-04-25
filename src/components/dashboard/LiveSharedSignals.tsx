import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Radio,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Crown,
  Flame,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CopyTradeModal, { CopyTradeRequest } from "@/components/copytrade/CopyTradeModal";
import { useCopiedSignals } from "@/hooks/useCopiedSignals";

type SharedSignal = {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_role: "admin" | "moderator" | null;
  author_winrate: number | null;
};

const PLACEHOLDERS: SharedSignal[] = [
  { id: "p1", pair: "EUR/USD", direction: "buy", entry_price: 1.1699, stop_loss: 1.165, take_profit: 1.18, status: "hit_tp", created_at: "", author_id: null, author_name: "IX_Mentor", author_role: "admin", author_winrate: 72 },
  { id: "p2", pair: "GBP/JPY", direction: "sell", entry_price: 192.34, stop_loss: 193.0, take_profit: 191.0, status: "open", created_at: "", author_id: null, author_name: "EUR_King", author_role: "moderator", author_winrate: 68 },
  { id: "p3", pair: "XAU/USD", direction: "buy", entry_price: 2412.5, stop_loss: 2400, take_profit: 2440, status: "open", created_at: "", author_id: null, author_name: "df23fx", author_role: null, author_winrate: 61 },
  { id: "p4", pair: "USD/JPY", direction: "sell", entry_price: 154.82, stop_loss: 155.5, take_profit: 153.5, status: "open", created_at: "", author_id: null, author_name: "alpha-rat", author_role: null, author_winrate: 54 },
];

const initialsOf = (n?: string | null) =>
  (n || "TR")
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "TR";

const colorFor = (id?: string | null) => {
  const palette = [
    "from-teal-500/40 to-teal-700/40 text-teal-200 border-teal-400/40",
    "from-blue-500/40 to-blue-700/40 text-blue-200 border-blue-400/40",
    "from-indigo-500/40 to-indigo-700/40 text-indigo-200 border-indigo-400/40",
    "from-purple-500/40 to-purple-700/40 text-purple-200 border-purple-400/40",
    "from-orange-500/40 to-orange-700/40 text-orange-200 border-orange-400/40",
    "from-pink-500/40 to-pink-700/40 text-pink-200 border-pink-400/40",
    "from-cyan-500/40 to-cyan-700/40 text-cyan-200 border-cyan-400/40",
  ];
  const safe = id || "trader";
  let h = 0;
  for (let i = 0; i < safe.length; i++) h = safe.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

const formatPrice = (n: number, pair: string) =>
  Number(n).toFixed(pair.includes("JPY") ? 2 : pair.includes("XAU") ? 2 : 4);

const LiveSharedSignals = () => {
  const [signals, setSignals] = useState<SharedSignal[]>([]);
  const [request, setRequest] = useState<CopyTradeRequest | null>(null);
  const copied = useCopiedSignals();

  useEffect(() => {
    let cancelled = false;
    const fetchSignals = async () => {
      const { data: rawSignals } = await supabase
        .from("trading_signals")
        .select("id, pair, direction, entry_price, stop_loss, take_profit, status, created_at, author_id")
        .order("created_at", { ascending: false })
        .limit(6);

      if (cancelled || !rawSignals) return;

      const authorIds = Array.from(
        new Set(rawSignals.map((s) => s.author_id).filter(Boolean) as string[]),
      );

      const [profilesRes, rolesRes] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("user_id, display_name").in("user_id", authorIds)
          : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
        authorIds.length
          ? supabase.from("user_roles").select("user_id, role").in("user_id", authorIds)
          : Promise.resolve({ data: [] as { user_id: string; role: string }[] }),
      ]);

      const nameMap = new Map<string, string>();
      profilesRes.data?.forEach((p) => nameMap.set(p.user_id, p.display_name));

      const roleMap = new Map<string, "admin" | "moderator">();
      rolesRes.data?.forEach((r) => {
        if (r.role === "admin" || r.role === "moderator")
          roleMap.set(r.user_id, r.role);
      });

      const enriched: SharedSignal[] = rawSignals.map((s) => ({
        ...s,
        author_name: (s.author_id && nameMap.get(s.author_id)) || "Trader",
        author_role: (s.author_id && roleMap.get(s.author_id)) || null,
        author_winrate: null,
      }));

      if (!cancelled) setSignals(enriched);
    };
    fetchSignals();

    const channel = supabase
      .channel("dashboard-shared-signals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trading_signals" },
        fetchSignals,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const rows = (signals.length ? signals : PLACEHOLDERS).slice(0, 6);

  return (
    <>
      <div className="rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Live Shared Signals
            </h3>
          </div>
          <Link
            to="/signals"
            className="font-proxima text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            All
          </Link>
        </div>
        <ul className="divide-y divide-border/30">
          {rows.map((s) => {
            const isBuy = s.direction.toLowerCase() === "buy";
            const isPlaceholder = s.id.startsWith("p");
            const wasCopied = !isPlaceholder && copied.has(s.id);
            const isMentor = s.author_role === "admin";
            const isMod = s.author_role === "moderator";
            const isVerified = isMentor || isMod;
            const isTopPerformer = (s.author_winrate ?? 0) >= 70;
            const avatarKey = s.author_id || s.author_name;

            // Highlight whole row if author is a verified mentor
            const rowAccent = isMentor
              ? "bg-gradient-to-r from-primary/5 via-transparent to-transparent"
              : "";

            return (
              <li
                key={s.id}
                className={`px-3 py-2.5 transition-colors hover:bg-primary/5 ${rowAccent}`}
              >
                {/* Trader header */}
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-gradient-to-br text-[10px] font-bold ${colorFor(
                      avatarKey,
                    )}`}
                  >
                    {initialsOf(s.author_name)}
                    {isVerified && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-background">
                        <ShieldCheck className="h-2 w-2" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {s.author_name}
                      </span>
                      {isMentor && (
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-primary/20 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-primary">
                          <Crown className="h-2 w-2" /> Mentor
                        </span>
                      )}
                      {isMod && !isMentor && (
                        <span className="rounded-sm bg-primary/15 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-primary/80">
                          MOD
                        </span>
                      )}
                      {isTopPerformer && !isMentor && (
                        <span className="inline-flex items-center gap-0.5 rounded-sm bg-orange-500/15 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-orange-400">
                          <Flame className="h-2 w-2" /> Top
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                      {s.author_winrate != null
                        ? `WR ${s.author_winrate}%`
                        : "Community trader"}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                      isBuy
                        ? "bg-[hsl(145_65%_50%/0.15)] text-[hsl(145_65%_55%)] border border-[hsl(145_65%_50%/0.3)]"
                        : "bg-[hsl(0_70%_55%/0.15)] text-[hsl(0_70%_60%)] border border-[hsl(0_70%_55%/0.3)]"
                    }`}
                  >
                    {isBuy ? (
                      <TrendingUp className="inline h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <TrendingDown className="inline h-2.5 w-2.5 mr-0.5" />
                    )}
                    {s.direction.toUpperCase()}
                  </span>
                </div>

                {/* Signal details */}
                <div className="mb-2 flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5">
                  <div>
                    <p className="font-mono text-sm font-bold text-foreground">{s.pair}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                      {s.status.replace("_", " ")}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <div>
                      <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground/70">
                        Entry
                      </p>
                      <p className="font-mono text-[11px] font-bold tabular-nums text-foreground">
                        {formatPrice(s.entry_price, s.pair)}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground/70">
                        SL
                      </p>
                      <p className="font-mono text-[11px] font-semibold tabular-nums text-[hsl(0_70%_60%)]">
                        {s.stop_loss != null ? formatPrice(Number(s.stop_loss), s.pair) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground/70">
                        TP
                      </p>
                      <p className="font-mono text-[11px] font-semibold tabular-nums text-[hsl(145_65%_55%)]">
                        {s.take_profit != null ? formatPrice(Number(s.take_profit), s.pair) : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                {(!isPlaceholder ? ["active", "open"].includes(s.status) : true) && (
                  <button
                    onClick={() => {
                      setRequest({
                        signalId: isPlaceholder ? null : s.id,
                        pair: s.pair,
                        side: isBuy ? "buy" : "sell",
                        entry: Number(s.entry_price),
                        sl: s.stop_loss != null ? Number(s.stop_loss) : null,
                        tp: s.take_profit != null ? Number(s.take_profit) : null,
                      });
                    }}
                    className={`group/btn relative w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all overflow-hidden ${
                      wasCopied
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
                        : "bg-primary text-background hover:bg-primary/90 shadow-[0_4px_18px_-4px_hsl(48_100%_51%/0.6)] hover:shadow-[0_6px_22px_-2px_hsl(48_100%_51%/0.8)]"
                    }`}
                  >
                    {wasCopied ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Copied · Take Again
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        Take This Signal
                      </>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <CopyTradeModal request={request} onClose={() => setRequest(null)} />
    </>
  );
};

export default LiveSharedSignals;
