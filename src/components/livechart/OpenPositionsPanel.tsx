import { useState } from "react";
import { X, Loader2, RefreshCw } from "lucide-react";
import { useLiveAccount, type LivePosition } from "@/contexts/LiveAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtPrice = (sym: string, v: number | null | undefined) => {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const u = (sym || "").toUpperCase();
  const d = u.includes("JPY")
    ? 3
    : u.includes("XAU") || u.includes("BTC") || u.includes("ETH")
      ? 2
      : 5;
  return Number(v).toFixed(d);
};

const OpenPositionsPanel = () => {
  const { liveAccount, positions, connected, loading, refreshing, refresh } =
    useLiveAccount();
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
        throw new Error(
          (data as any).error || "Broker rejected the close order",
        );
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
    <div className="bg-[#0f0f0f] text-neutral-100">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 bg-[#0a0a0a] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            Open Positions
          </span>
          <span className="font-mono text-[10px] tabular-nums text-neutral-500">
            {positions.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {positions.length > 0 && (
            <div className="text-right leading-tight">
              <div
                className={`font-mono text-[11px] font-bold tabular-nums ${
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}
                {totalPnl.toFixed(2)} {currency}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-500">
                Floating P&L
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            title="Refresh"
            className="flex h-6 w-6 items-center justify-center rounded border border-neutral-800 text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 px-3 py-8 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading positions…
        </div>
      ) : !connected ? (
        <div className="px-3 py-8 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
          Connect your MT5 account to see positions.
        </div>
      ) : positions.length === 0 ? (
        <div className="px-3 py-8 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
          No open positions
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[760px] text-[11px] font-mono">
            <thead className="sticky top-0 z-10 bg-[#0a0a0a]">
              <tr className="text-left text-[9px] uppercase tracking-widest text-neutral-500">
                <th className="px-3 py-2 font-normal">Symbol</th>
                <th className="px-2 py-2 font-normal">Side</th>
                <th className="px-2 py-2 font-normal text-right">Volume</th>
                <th className="px-2 py-2 font-normal text-right">Entry</th>
                <th className="px-2 py-2 font-normal text-right">Current</th>
                <th className="px-2 py-2 font-normal text-right">P&L</th>
                <th className="px-2 py-2 font-normal text-right">SL</th>
                <th className="px-2 py-2 font-normal text-right">TP</th>
                <th className="px-3 py-2 font-normal text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {positions.map((p, i) => {
                const isBuy = p.side === "buy";
                const pnl = Number(p.profit) || 0;
                const key = String(p.ticket ?? `${p.symbol}-${i}`);
                return (
                  <tr
                    key={key}
                    className="tabular-nums hover:bg-neutral-900/60 transition-colors"
                  >
                    <td className="px-3 py-1.5 font-bold text-neutral-100">
                      {p.symbol}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          isBuy
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {p.side}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-200">
                      {Number(p.volume).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-300">
                      {fmtPrice(p.symbol, p.entry_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-100">
                      {fmtPrice(p.symbol, p.current_price)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right font-bold ${
                        pnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right ${
                        p.stop_loss ? "text-red-400/80" : "text-neutral-600"
                      }`}
                    >
                      {fmtPrice(p.symbol, p.stop_loss)}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right ${
                        p.take_profit ? "text-emerald-400/80" : "text-neutral-600"
                      }`}
                    >
                      {fmtPrice(p.symbol, p.take_profit)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => closePosition(p)}
                        disabled={closing === key}
                        title="Close position"
                        aria-label="Close position"
                        className="inline-flex h-6 items-center gap-1 rounded border border-neutral-800 bg-[#050505] px-2 text-[9px] font-bold uppercase tracking-widest text-neutral-300 hover:border-red-500/50 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        {closing === key ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            Close
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OpenPositionsPanel;
