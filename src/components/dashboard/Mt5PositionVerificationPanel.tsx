import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";

/**
 * Dev-only panel that shows the raw latest live MT5 positions returned by
 * Trading Layer / get-live-account. This panel is the source of truth for
 * whether a trade really exists in MetaTrader.
 *
 * It auto-refreshes after every open/close via the `mt:refresh-positions`
 * window event (already dispatched by the trade panel and position actions).
 */
export default function Mt5PositionVerificationPanel() {
  const { positions, refresh, refreshing, connected } = useLiveAccount();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    const handler = async () => {
      try { await refresh(); } catch { /* ignore */ }
      setLastRefreshedAt(new Date().toISOString());
    };
    window.addEventListener("mt:refresh-positions", handler);
    window.addEventListener("mt:refresh-terminal-data", handler);
    return () => {
      window.removeEventListener("mt:refresh-positions", handler);
      window.removeEventListener("mt:refresh-terminal-data", handler);
    };
  }, [refresh]);

  const fmt = (v: number | null | undefined, d = 5) =>
    v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);

  return (
    <div className="mt-3 rounded border border-[#FFCD05]/60 bg-[#0a0a0a] text-[10.5px] font-mono overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#050505] px-2 py-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-widest text-[#FFCD05]/80">
            MT5 Position Verification (Dev)
          </span>
          <span className="text-[9px] uppercase tracking-widest text-neutral-500">
            source: get-live-account
          </span>
          <span className={connected ? "text-emerald-300" : "text-red-300"}>
            ● {connected ? "live" : "offline"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshedAt && (
            <span className="text-neutral-500">
              {new Date(lastRefreshedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={async () => {
              try { await refresh(); } catch { /* ignore */ }
              setLastRefreshedAt(new Date().toISOString());
            }}
            className="inline-flex items-center gap-1 rounded border border-neutral-700 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-neutral-300 hover:border-[#FFCD05]/60 hover:text-[#FFCD05]"
          >
            <RotateCcw className={refreshing ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
            Refresh
          </button>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="px-2 py-3 text-neutral-500">
          No open positions in MT5. (This is the live truth — if your audit shows a
          recent open, the trade did NOT actually open in MetaTrader.)
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] uppercase tracking-widest text-neutral-500">
                <th className="px-2 py-1 text-left">Ticket</th>
                <th className="px-2 py-1 text-left">Symbol</th>
                <th className="px-2 py-1 text-left">Side</th>
                <th className="px-2 py-1 text-right">Volume</th>
                <th className="px-2 py-1 text-right">Entry</th>
                <th className="px-2 py-1 text-right">Current</th>
                <th className="px-2 py-1 text-right">Profit</th>
                <th className="px-2 py-1 text-right">SL</th>
                <th className="px-2 py-1 text-right">TP</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={String(p.ticket)} className="border-t border-neutral-900 text-neutral-100">
                  <td className="px-2 py-1">{String(p.ticket ?? "—")}</td>
                  <td className="px-2 py-1">{p.symbol}</td>
                  <td className={`px-2 py-1 uppercase ${p.side === "buy" ? "text-emerald-300" : "text-red-300"}`}>
                    {p.side}
                  </td>
                  <td className="px-2 py-1 text-right">{fmt(p.volume, 2)}</td>
                  <td className="px-2 py-1 text-right">{fmt(p.entry_price)}</td>
                  <td className="px-2 py-1 text-right">{fmt(p.current_price)}</td>
                  <td className={`px-2 py-1 text-right ${p.profit > 0 ? "text-emerald-300" : p.profit < 0 ? "text-red-300" : ""}`}>
                    {fmt(p.profit, 2)}
                  </td>
                  <td className="px-2 py-1 text-right">{fmt(p.stop_loss)}</td>
                  <td className="px-2 py-1 text-right">{fmt(p.take_profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
