import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAutoRefreshAllowed, checkAndHandle429 } from "@/lib/tradingLayerControl";

interface Quote {
  symbol: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  spread: number | null;
  digits: number | null;
}

interface Props {
  symbols: string[];
  onSelect?: (label: string) => void;
  activeSymbol?: string;
}

const COLS = "grid-cols-[minmax(0,1fr)_64px_64px_64px_52px]";
const POLL_MS = 5000;

const BidAskBoard = ({ symbols, onSelect, activeSymbol }: Props) => {
  const [bidAskBoardData, setBidAskBoardData] = useState<Quote[]>([]);
  const lastGoodRef = useRef<Quote[]>([]);
  const [lastGoodBidAskBoardData, setLastGoodBidAskBoardData] = useState<Quote[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const selectedSymbol = activeSymbol || "";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setRefreshing(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-mt5-quotes", {
          body: { selectedSymbol, symbols, debug: true },
        });
        if (cancelled) return;
        if (error || !data?.success || !Array.isArray(data?.quotes) || data.quotes.length === 0) {
          // Rule 2 & 4: keep lastGood; never clear
          setFailed(true);
          return;
        }
        // Rule 1: update both
        setBidAskBoardData(data.quotes);
        lastGoodRef.current = data.quotes;
        setLastGoodBidAskBoardData(data.quotes);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          setHasFetched(true);
        }
      }
    };

    load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [selectedSymbol, symbols.join(",")]);

  // Render source: live if present, else lastGood. Never blank during refresh.
  const visible: Quote[] =
    bidAskBoardData.length > 0
      ? bidAskBoardData
      : lastGoodBidAskBoardData.length > 0
        ? lastGoodBidAskBoardData
        : [];

  const hasLastGood = lastGoodBidAskBoardData.length > 0;
  // "Data delayed" only when refresh failed AND we have nothing fresh; if we
  // have lastGood we still flag delayed so the user knows the feed is stale.
  const isDelayed = failed && hasLastGood;
  const statusLabel = !hasFetched
    ? null
    : isDelayed
      ? { text: "Data delayed", dot: "bg-amber-500", color: "text-amber-400" }
      : visible.length > 0
        ? { text: "Live", dot: "bg-emerald-500", color: "text-emerald-400" }
        : null;

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
          Bid / Ask Board
        </h3>
        {statusLabel ? (
          <span className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest ${statusLabel.color}`}>
            <span className={`inline-flex h-1.5 w-1.5 rounded-full ${statusLabel.dot}`} />
            {statusLabel.text}
          </span>
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
        )}
      </div>
      <div className={`grid ${COLS} items-center gap-1 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 shrink-0`}>
        <span>Symbol</span>
        <span className="text-right text-red-400/70">Bid</span>
        <span className="text-right">Last</span>
        <span className="text-right text-emerald-400/70">Ask</span>
        <span className="text-right">Sprd</span>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10px] font-mono text-neutral-500">
            {refreshing ? "Loading market data…" : "Waiting for tick data…"}
          </li>
        ) : visible.map((q) => {
          const digits = q.digits ?? 5;
          const symUpper = q.symbol.toUpperCase();
          const isActive = selectedSymbol.toUpperCase() === symUpper;
          const fmt = (v: number | null | undefined) =>
            v == null
              ? "—"
              : v.toLocaleString("en-US", {
                  minimumFractionDigits: digits,
                  maximumFractionDigits: digits,
                });
          const point = Math.pow(10, -digits);
          const spreadPts = q.spread != null ? q.spread / point : null;
          return (
            <li key={q.symbol}>
              <button
                type="button"
                onClick={() => onSelect?.(q.symbol)}
                className={`w-full grid ${COLS} items-center gap-1 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
                  isActive
                    ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
                    : "hover:bg-neutral-900/40 border-l-2 border-l-transparent"
                }`}
              >
                <span className={`font-mono text-[10.5px] font-semibold truncate ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}>
                  {q.symbol}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-red-400">
                  {fmt(q.bid)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {fmt(q.last)}
                </span>
                <span className="text-right font-mono text-[10px] tabular-nums text-emerald-400">
                  {fmt(q.ask)}
                </span>
                <span className="text-right font-mono text-[9.5px] tabular-nums text-neutral-400">
                  {q.spread == null ? "—" : spreadPts != null ? spreadPts.toFixed(1) : q.spread.toFixed(Math.min(digits, 5))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BidAskBoard;
