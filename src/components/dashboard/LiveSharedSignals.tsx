import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CopyTradeModal, { CopyTradeRequest } from "@/components/copytrade/CopyTradeModal";
import { useCopiedSignals } from "@/hooks/useCopiedSignals";
import { computeMentorTier, MentorTier } from "@/lib/mentor-tier";
import MentorBadge from "@/components/social/MentorBadge";
import { AIScorePanel } from "@/components/ai/AIScoreBadge";

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
  author_tier: MentorTier | null;
};

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
        .limit(30);

      if (cancelled || !rawSignals) return;

      const authorIds = Array.from(
        new Set(rawSignals.map((s) => s.author_id).filter(Boolean) as string[]),
      );

      const [profilesRes, statsRes] = await Promise.all([
        authorIds.length
          ? supabase.from("profiles").select("user_id, display_name").in("user_id", authorIds)
          : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
        authorIds.length
          ? supabase
              .from("leaderboard_stats")
              .select("user_id, total_trades, win_rate, total_pnl, pnl_30d")
              .in("user_id", authorIds)
          : Promise.resolve({
              data: [] as Array<{
                user_id: string;
                total_trades: number | null;
                win_rate: number | null;
                total_pnl: number | null;
                pnl_30d: number | null;
              }>,
            }),
      ]);

      const nameMap = new Map<string, string>();
      profilesRes.data?.forEach((p) => nameMap.set(p.user_id, p.display_name));

      const tierMap = new Map<string, MentorTier | null>();
      statsRes.data?.forEach((row) => {
        if (!row.user_id) return;
        tierMap.set(
          row.user_id,
          computeMentorTier({
            totalTrades: row.total_trades,
            winRate: row.win_rate,
            totalPnl: row.total_pnl,
            pnl30d: row.pnl_30d,
          }),
        );
      });

      const enriched: SharedSignal[] = rawSignals.map((s) => ({
        ...s,
        author_name: (s.author_id && nameMap.get(s.author_id)) || "Trader",
        author_tier: (s.author_id && tierMap.get(s.author_id)) || null,
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

  const rows = signals;

  return (
    <>
      <div className="min-h-0 overflow-hidden">
        <ul
          className="max-h-[420px] overflow-y-auto divide-y divide-border/30 px-2 py-1.5 sm:px-2.5
                     [scrollbar-width:thin]
                     [&::-webkit-scrollbar]:w-1.5
                     [&::-webkit-scrollbar-track]:bg-transparent
                     [&::-webkit-scrollbar-thumb]:bg-primary/40
                     [&::-webkit-scrollbar-thumb]:rounded-full
                     hover:[&::-webkit-scrollbar-thumb]:bg-primary/60"
        >

          {rows.length === 0 && (
            <li className="px-3 py-10 text-center">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
              <p className="text-xs font-semibold text-foreground">No live signals yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Mentor signals will appear here in real-time.
              </p>
            </li>
          )}
          {rows.map((s) => {
            const isBuy = s.direction.toLowerCase() === "buy";
            const wasCopied = copied.has(s.id);
            const tier = s.author_tier;
            const isMentorTier = tier?.id === "mentor" || tier?.id === "elite_mentor";
            const avatarKey = s.author_id || s.author_name;

            // Highlight whole row if author is a verified mentor
            const rowAccent = isMentorTier
              ? "bg-gradient-to-r from-primary/5 via-transparent to-transparent"
              : "";

            return (
              <li
                key={s.id}
                className={`px-1 py-2 transition-colors hover:bg-primary/5 sm:px-1.5 ${rowAccent}`}
              >
                {/* Trader header */}
                <div className="mb-2 grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2">
                  <div
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-gradient-to-br text-[10px] font-bold ${colorFor(
                      avatarKey,
                    )}`}
                  >
                    {initialsOf(s.author_name)}
                    {tier && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <MentorBadge tier={tier} variant="icon" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="min-w-0 truncate text-xs font-semibold text-foreground">
                        {s.author_name}
                      </span>
                      {tier && <MentorBadge tier={tier} />}
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                      {tier ? tier.label : "Community trader"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
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
                </div>

                {/* Signal details */}
                <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-foreground">{s.pair}</p>
                    <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                      {s.status.replace("_", " ")}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-2 text-right">
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

                {/* AI Analysis */}
                <div className="mb-2">
                  <AIScorePanel
                    pair={s.pair}
                    direction={s.direction}
                    entry_price={Number(s.entry_price)}
                    stop_loss={s.stop_loss != null ? Number(s.stop_loss) : null}
                    take_profit={s.take_profit != null ? Number(s.take_profit) : null}
                  />
                </div>

                {/* CTA */}
                {["active", "open"].includes(s.status) && (
                  <button
                    onClick={() => {
                      setRequest({
                        signalId: s.id,
                        pair: s.pair,
                        side: isBuy ? "buy" : "sell",
                        entry: Number(s.entry_price),
                        sl: s.stop_loss != null ? Number(s.stop_loss) : null,
                        tp: s.take_profit != null ? Number(s.take_profit) : null,
                        authorName: s.author_name,
                        authorTierId: tier?.id ?? null,
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
