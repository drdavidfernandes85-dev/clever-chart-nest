import { useEffect, useRef, useState } from "react";
import { Layers, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  /** Broker symbol names (e.g. "EURUSD", "XAUUSD"). */
  symbols: string[];
  onSelect?: (label: string) => void;
}

interface TickRow {
  bid: number | null;
  ask: number | null;
  last: number | null;
  digits: number;
}

/**
 * Multi-pair Bid/Ask board powered by get-mt5-symbol-data.
 * Fetches a fresh tick per symbol every 5s from the connected MT5 account.
 */
const BidAskBoard = ({ symbols, onSelect }: Props) => {
  const [rows, setRows] = useState<Record<string, TickRow>>({});
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});
  const prevPrice = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!symbols.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const loadOne = async (sym: string) => {
      try {
        const { data } = await supabase.functions.invoke("get-mt5-terminal-data", {
          body: { selectedSymbol: sym },
        });
        if (cancelled) return;
        if (data?.success && data?.tick) {
          const tick = data.tick;
          const info = data.selectedSymbolInfo;
          const bid = tick.bid != null ? Number(tick.bid) : null;
          const ask = tick.ask != null ? Number(tick.ask) : null;
          const last = tick.last != null ? Number(tick.last) : bid != null && ask != null ? (bid + ask) / 2 : null;
          const digits = Number(info?.digits) || 5;
          setRows((r) => ({ ...r, [sym]: { bid, ask, last, digits } }));
          if (last != null) {
            const prev = prevPrice.current[sym];
            if (prev != null && prev !== last) {
              const dir = last > prev ? "up" : "down";
              setFlash((f) => ({ ...f, [sym]: dir }));
              window.setTimeout(
                () =>
                  setFlash((f) => {
                    const n = { ...f };
                    delete n[sym];
                    return n;
                  }),
                700,
              );
            }
            prevPrice.current[sym] = last;
          }
        }
      } catch {
        /* ignore individual symbol errors */
      }
    };

    const loadAll = async () => {
      // Sequential with a small gap to avoid hammering the broker API
      // (120 req/min limit). 10 symbols * 400ms ≈ 4s per cycle.
      for (const sym of symbols) {
        if (cancelled) return;
        await loadOne(sym);
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!cancelled) setLoading(false);
    };

    loadAll();
    const id = window.setInterval(loadAll, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbols.join(",")]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card/70 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-heading text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Bid / Ask Board
          </h3>
        </div>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            ● live
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-b border-border/30 bg-background/40 px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>Symbol</span>
        <span className="w-20 text-right text-red-400">Bid</span>
        <span className="w-20 text-center text-foreground">Last</span>
        <span className="w-20 text-right text-emerald-400">Ask</span>
      </div>
      <ul className="divide-y divide-border/20 max-h-[280px] overflow-y-auto">
        {symbols.length === 0 && (
          <li className="px-3 py-4 text-center text-[11px] font-mono text-muted-foreground">
            Loading broker symbols…
          </li>
        )}
        {symbols.map((sym) => {
          const r = rows[sym];
          const digits = r?.digits ?? 5;
          const fmt = (v: number | null | undefined) =>
            v == null
              ? "—"
              : v.toLocaleString("en-US", {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                });
          const f = flash[sym];
          return (
            <li
              key={sym}
              onClick={() => onSelect?.(sym)}
              className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors ${
                f === "up" ? "bg-emerald-500/10" : f === "down" ? "bg-red-500/10" : ""
              }`}
            >
              <span className="font-mono text-[11px] font-semibold text-foreground">
                {sym}
              </span>
              <span className="w-20 text-right font-mono text-[11px] tabular-nums text-red-400">
                {fmt(r?.bid)}
              </span>
              <span className="w-20 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
                {fmt(r?.last)}
              </span>
              <span className="w-20 text-right font-mono text-[11px] tabular-nums text-emerald-400">
                {fmt(r?.ask)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BidAskBoard;
