import { useEffect, useState } from "react";
import { Briefcase, Loader2, RefreshCw } from "lucide-react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { getCooldownRemainingMs } from "@/lib/tradingLayerControl";
import PositionActions from "./PositionActions";

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
  const [cooldownMs, setCooldownMs] = useState(getCooldownRemainingMs());

  useEffect(() => {
    const id = window.setInterval(() => setCooldownMs(getCooldownRemainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);

  const totalPnl = positions.reduce((s, p) => s + (Number(p.profit) || 0), 0);
  const currency = liveAccount?.currency ?? "USD";



  return (
    <div className="flex flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden text-neutral-100">
      {/* Header strip — matches Market Watch / Bid-Ask Board */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            Open Positions
          </h3>
          <span className="font-mono text-[9px] tabular-nums text-neutral-500 border-l border-neutral-800 pl-1.5 ml-0.5">
            {positions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {positions.length > 0 && (
            <div className="text-right leading-tight">
              <div
                className={`font-mono text-[10.5px] font-bold tabular-nums ${
                  totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}
                {totalPnl.toFixed(2)} {currency}
              </div>
              <div className="font-mono text-[7.5px] uppercase tracking-[0.22em] text-neutral-500">
                Floating P&amp;L
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            title="Refresh"
            className="flex h-5 w-5 items-center justify-center rounded-sm border border-neutral-800 text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
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
                      <PositionActions
                        position={p}
                        onAfter={async () => { try { await refresh(); } catch { /* ignore */ } }}
                        cooling={cooling}
                        cooldownSec={cooldownSec}
                      />
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
