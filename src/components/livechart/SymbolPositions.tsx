import { useMemo } from "react";
import { Briefcase, TrendingUp, TrendingDown, X, Loader2 } from "lucide-react";
import { useMTAccount, type MTPosition } from "@/hooks/useMTAccount";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  /** Pretty pair like "EUR/USD" — we strip the slash to match broker symbols. */
  symbolLabel: string;
}

const formatPrice = (label: string, value: number | null) => {
  if (value == null) return "—";
  const decimals = label.includes("JPY") ? 3 : label.includes("XAU") || label.includes("BTC") ? 2 : 5;
  return value.toFixed(decimals);
};

/**
 * Compact panel that shows the user's open EA positions for the active chart
 * symbol. Pulls from `mt_positions` via useMTAccount() (real-time subscribed).
 */
const SymbolPositions = ({ symbolLabel }: Props) => {
  const { account, positions, loading } = useMTAccount();

  const broker = symbolLabel.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const rows = useMemo<MTPosition[]>(
    () =>
      positions.filter(
        (p) => p.symbol?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() === broker,
      ),
    [positions, broker],
  );

  const totalPnl = rows.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);
  const totalVol = rows.reduce((sum, p) => sum + (Number(p.volume) || 0), 0);

  const closePosition = async (pos: MTPosition) => {
    if (!account) return;
    try {
      // Queue a counter-order. The EA picks it up, closes the matching ticket,
      // and reports back via mt-webhook.
      const { error } = await supabase.from("mt_pending_orders").insert({
        user_id: account.user_id,
        account_id: account.id,
        symbol: pos.symbol,
        side: pos.side === "buy" ? "sell" : "buy",
        order_type: "market",
        volume: Number(pos.volume),
        // ea_message acts as the close intent for this ticket
        ea_message: `close:${pos.ticket}`,
      });
      if (error) throw error;
      toast.success(`Close order queued for #${pos.ticket}`, {
        description: "Your EA will execute on the next poll (≤5 seconds).",
      });
    } catch (e: any) {
      toast.error("Could not queue close order", {
        description: e?.message ?? "Try again.",
      });
    }
  };

  return (
    <div className="rounded-2xl border border-border/30 bg-card/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Briefcase className="h-3.5 w-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-sm font-semibold text-foreground tracking-wide">
              My Positions
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {symbolLabel} · {rows.length} open
            </span>
          </div>
        </div>
        {rows.length > 0 && (
          <div className="text-right">
            <div
              className={`font-mono text-sm font-bold tabular-nums ${
                totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {totalPnl >= 0 ? "+" : ""}
              {totalPnl.toFixed(2)} {account?.currency ?? "USD"}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {totalVol.toFixed(2)} lots
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[260px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading positions…
          </div>
        ) : !account ? (
          <div className="px-4 py-5 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              No MT account connected.
            </p>
            <Link
              to="/connect-mt"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-heading font-semibold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
            >
              Connect MT
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-muted-foreground">
            No open positions on{" "}
            <span className="font-mono text-foreground">{symbolLabel}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {rows.map((p) => {
              const isBuy = p.side === "buy";
              const pnl = Number(p.profit) || 0;
              const pnlUp = pnl >= 0;
              return (
                <li
                  key={p.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ring-1 ${
                      isBuy
                        ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                        : "bg-red-500/10 text-red-400 ring-red-500/30"
                    }`}
                  >
                    {isBuy ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                          isBuy ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {p.side}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-foreground">
                        {Number(p.volume).toFixed(2)} lots
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{p.ticket}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Open
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-foreground">
                        {formatPrice(symbolLabel, p.open_price)}
                      </span>
                      {p.current_price != null && (
                        <>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            · Now
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-foreground">
                            {formatPrice(symbolLabel, p.current_price)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs font-bold tabular-nums ${
                        pnlUp ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pnlUp ? "+" : ""}
                      {pnl.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => closePosition(p)}
                      title="Queue close order"
                      aria-label="Close position"
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-border/50 bg-background/60 text-muted-foreground hover:border-red-500/40 hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
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

export default SymbolPositions;
