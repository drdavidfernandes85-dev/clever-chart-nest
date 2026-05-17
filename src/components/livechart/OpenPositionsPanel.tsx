import { useEffect, useRef, useState } from "react";
import { Briefcase, TrendingUp, TrendingDown, X, Loader2, RefreshCw } from "lucide-react";
import { useLiveAccount, type LivePosition } from "@/contexts/LiveAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtPrice = (sym: string, v: number | null | undefined) => {
  if (v == null || Number.isNaN(v)) return "—";
  const u = (sym || "").toUpperCase();
  const d = u.includes("JPY") ? 3 : u.includes("XAU") || u.includes("BTC") || u.includes("ETH") ? 2 : 5;
  return v.toFixed(d);
};

/** Tiny cell that briefly flashes when its value changes. */
const FlashCell = ({ value, positive }: { value: number; positive: boolean }) => {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (prev.current !== value) {
      setFlash(value > prev.current ? "up" : "down");
      prev.current = value;
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span
      className={`font-mono text-xs font-bold tabular-nums transition-colors duration-500 ${
        positive ? "text-emerald-400" : "text-red-400"
      } ${flash === "up" ? "bg-emerald-500/20" : flash === "down" ? "bg-red-500/20" : ""} px-1 rounded`}
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}
    </span>
  );
};

const OpenPositionsPanel = () => {
  const { liveAccount, positions, connected, loading, refreshing, refresh } = useLiveAccount();
  const [closing, setClosing] = useState<string | null>(null);

  const totalPnl = positions.reduce((s, p) => s + (Number(p.profit) || 0), 0);
  const currency = liveAccount?.currency ?? "USD";

  const closePosition = async (pos: LivePosition) => {
    const key = String(pos.ticket ?? `${pos.symbol}-${pos.entry_price}`);
    setClosing(key);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: {
          symbol: pos.symbol,
          side: pos.side === "buy" ? "sell" : "buy",
          volume: Number(pos.volume),
          tradeId: `close-${pos.ticket ?? key}-${Date.now()}`,
          comment: `Close #${pos.ticket ?? ""}`.trim(),
          positionId: pos.ticket ?? undefined,
        },
      });
      if (error) throw error;
      if (data && (data as any).success === false) {
        throw new Error((data as any).error || "Broker rejected the close order");
      }
      toast.success(`Close order sent for ${pos.symbol} #${pos.ticket ?? ""}`);
      window.dispatchEvent(new Event("trade-executed"));
      refresh();
    } catch (e: any) {
      toast.error("Could not close position", { description: e?.message });
    } finally {
      setClosing(null);
    }
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <Briefcase className="h-3 w-3" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-heading text-xs font-semibold text-foreground tracking-wide">
              Open Positions
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {positions.length} open · live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {positions.length > 0 && (
            <div className="text-right leading-tight">
              <div
                className={`font-mono text-xs font-bold tabular-nums ${
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}
                {totalPnl.toFixed(2)} {currency}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Total P&L
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            title="Refresh"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading positions…
          </div>
        ) : !connected ? (
          <div className="px-3 py-5 text-center text-xs text-muted-foreground">
            Connect your MT5 account to see positions.
          </div>
        ) : positions.length === 0 ? (
          <div className="px-3 py-5 text-center text-xs text-muted-foreground">
            No open positions
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {positions.map((p, i) => {
              const isBuy = p.side === "buy";
              const pnl = Number(p.profit) || 0;
              const key = String(p.ticket ?? `${p.symbol}-${i}`);
              return (
                <li
                  key={key}
                  className="px-3 py-2 hover:bg-muted/20 transition-colors animate-fade-in"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ring-1 ${
                          isBuy
                            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                            : "bg-red-500/10 text-red-400 ring-red-500/30"
                        }`}
                      >
                        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      </span>
                      <span className="font-mono text-xs font-bold text-foreground truncate">{p.symbol}</span>
                      <span
                        className={`font-mono text-[9px] font-bold uppercase tracking-wider px-1 rounded ${
                          isBuy ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {p.side}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {Number(p.volume).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FlashCell value={pnl} positive={pnl >= 0} />
                      <button
                        type="button"
                        onClick={() => closePosition(p)}
                        disabled={closing === key}
                        title="Close position"
                        aria-label="Close position"
                        className="flex h-5 w-5 items-center justify-center rounded border border-border/50 bg-background/60 text-muted-foreground hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {closing === key ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <X className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px] font-mono tabular-nums pl-6">
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Entry</div>
                      <div className="text-foreground">{fmtPrice(p.symbol, p.entry_price)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Now</div>
                      <div className="text-foreground">{fmtPrice(p.symbol, p.current_price)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[8px]">SL</div>
                      <div className={p.stop_loss ? "text-red-400/80" : "text-muted-foreground"}>
                        {fmtPrice(p.symbol, p.stop_loss)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[8px]">TP</div>
                      <div className={p.take_profit ? "text-emerald-400/80" : "text-muted-foreground"}>
                        {fmtPrice(p.symbol, p.take_profit)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default OpenPositionsPanel;
