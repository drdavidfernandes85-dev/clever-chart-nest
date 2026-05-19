import { useMemo } from "react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import PositionActions from "./PositionActions";

interface Props {
  symbol: string;
}

const fmtPrice = (v: number | null | undefined) =>
  v == null || Number.isNaN(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 });

/**
 * Compact selected-symbol exposure summary for the right rail.
 * Aggregates positions on the active symbol and exposes per-position actions.
 * Does NOT duplicate the bottom blotter — only the focused symbol is shown.
 */
const SelectedSymbolExposure = ({ symbol }: Props) => {
  const { positions, refresh } = useLiveAccount();

  const norm = (symbol || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const matched = useMemo(
    () =>
      positions.filter(
        (p) => p.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") === norm,
      ),
    [positions, norm],
  );

  const totals = useMemo(() => {
    if (matched.length === 0) return null;
    let buyVol = 0;
    let sellVol = 0;
    let weightedEntry = 0;
    let totalVol = 0;
    let pnl = 0;
    let current = matched[0].current_price;
    for (const p of matched) {
      const v = Number(p.volume) || 0;
      if (p.side === "buy") buyVol += v;
      else sellVol += v;
      weightedEntry += (Number(p.entry_price) || 0) * v;
      totalVol += v;
      pnl += Number(p.profit) || 0;
      current = p.current_price;
    }
    const netVol = buyVol - sellVol;
    return {
      side: netVol === 0 ? "flat" : netVol > 0 ? "buy" : "sell",
      gross: totalVol,
      net: Math.abs(netVol),
      avgEntry: totalVol > 0 ? weightedEntry / totalVol : 0,
      current,
      pnl,
    };
  }, [matched]);

  return (
    <div className="rounded-sm border border-neutral-800/70 bg-[#0b0b0b]">
      <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-800/60">
        <span className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-neutral-500">
          Exposure · <span className="text-[#FFCD05]">{symbol || "—"}</span>
        </span>
        {totals && (
          <span
            className={`text-[8.5px] font-mono uppercase tracking-[0.18em] px-1 py-[1px] rounded-sm ${
              totals.side === "buy"
                ? "bg-emerald-500/15 text-emerald-400"
                : totals.side === "sell"
                  ? "bg-red-500/15 text-red-400"
                  : "bg-neutral-700/40 text-neutral-400"
            }`}
          >
            Net {totals.side}
          </span>
        )}
      </div>

      {matched.length === 0 ? (
        <div className="px-2 py-1.5 text-[9.5px] font-mono uppercase tracking-[0.18em] text-neutral-600 text-center">
          No open exposure.
        </div>
      ) : (
        <div className="p-2 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
            <div className="flex flex-col leading-tight">
              <span className="text-[8.5px] uppercase tracking-[0.16em] text-ltr-silver-500">Volume</span>
              <span className="text-ltr-silver-100 tabular-nums">{totals!.gross.toFixed(2)}</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[8.5px] uppercase tracking-[0.16em] text-ltr-silver-500">Avg Entry</span>
              <span className="text-ltr-silver-100 tabular-nums">{fmtPrice(totals!.avgEntry)}</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[8.5px] uppercase tracking-[0.16em] text-ltr-silver-500">Last</span>
              <span className="text-ltr-silver-100 tabular-nums">{fmtPrice(totals!.current)}</span>
            </div>
            <div className="flex flex-col leading-tight col-span-3">
              <span className="text-[8.5px] uppercase tracking-[0.16em] text-ltr-silver-500">Floating P&amp;L</span>
              <span
                className={`text-[13px] font-bold tabular-nums ${
                  totals!.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {totals!.pnl >= 0 ? "+" : ""}
                {totals!.pnl.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1 border-t border-[color:var(--ltr-gold-border)]/30">
            {matched.map((p, i) => (
              <div
                key={String(p.ticket ?? `${p.symbol}-${i}`)}
                className="flex items-center justify-between gap-2 text-[9.5px] font-mono"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`uppercase tracking-[0.14em] px-1 py-0.5 rounded-sm ${
                      p.side === "buy"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {p.side}
                  </span>
                  <span className="text-ltr-silver-300 tabular-nums">{Number(p.volume).toFixed(2)}</span>
                  <span className="text-ltr-silver-500 tabular-nums">@ {fmtPrice(p.entry_price)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`tabular-nums ${
                      Number(p.profit) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {Number(p.profit) >= 0 ? "+" : ""}
                    {Number(p.profit).toFixed(2)}
                  </span>
                  <PositionActions
                    position={p}
                    onAfter={() => refresh()}
                    cooling={false}
                    cooldownSec={0}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectedSymbolExposure;
