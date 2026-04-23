import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, GripVertical, Plus, X, ArrowUp, ArrowDown, Zap } from "lucide-react";
import { Link } from "react-router-dom";

interface WatchItem {
  id: string;
  symbol: string;
  label: string;
  base: string;
  quote: string;
}

const DEFAULT_WATCHLIST: WatchItem[] = [
  { id: "eurusd", symbol: "EUR/USD", label: "EUR/USD", base: "EUR", quote: "USD" },
  { id: "gbpusd", symbol: "GBP/USD", label: "GBP/USD", base: "GBP", quote: "USD" },
  { id: "usdjpy", symbol: "USD/JPY", label: "USD/JPY", base: "USD", quote: "JPY" },
  { id: "audusd", symbol: "AUD/USD", label: "AUD/USD", base: "AUD", quote: "USD" },
  { id: "xauusd", symbol: "XAU/USD", label: "XAU/USD", base: "XAU", quote: "USD" },
  { id: "usdcad", symbol: "USD/CAD", label: "USD/CAD", base: "USD", quote: "CAD" },
  { id: "nzdusd", symbol: "NZD/USD", label: "NZD/USD", base: "NZD", quote: "USD" },
];

interface PriceState {
  price: number;
  prev: number;
  history: number[]; // small history for sparkline
  open: number; // session open for % change
}

const Watchlist = () => {
  const [items, setItems] = useState<WatchItem[]>(DEFAULT_WATCHLIST);
  const [prices, setPrices] = useState<Record<string, PriceState>>({});
  const dragId = useRef<string | null>(null);

  // Restore order
  useEffect(() => {
    try {
      const saved = localStorage.getItem("eltr.watchlist.order");
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        const map = new Map(DEFAULT_WATCHLIST.map((i) => [i.id, i]));
        const ordered = ids.map((id) => map.get(id)).filter(Boolean) as WatchItem[];
        const missing = DEFAULT_WATCHLIST.filter((i) => !ids.includes(i.id));
        if (ordered.length) setItems([...ordered, ...missing]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist order
  useEffect(() => {
    localStorage.setItem(
      "eltr.watchlist.order",
      JSON.stringify(items.map((i) => i.id))
    );
  }, [items]);

  // Live polling — exchangerate.host (free, no key)
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const next: Record<string, PriceState> = { ...prices };
      await Promise.all(
        items.map(async (item) => {
          try {
            const res = await fetch(
              `https://api.exchangerate.host/latest?base=${item.base}&symbols=${item.quote}`,
              { cache: "no-store" }
            );
            if (!res.ok) return;
            const json = await res.json();
            const p = json?.rates?.[item.quote];
            if (typeof p === "number") {
              const existing = next[item.id];
              const prev = existing?.price ?? p;
              const open = existing?.open ?? p;
              const history = existing
                ? [...existing.history.slice(-23), p]
                : [p];
              next[item.id] = { price: p, prev, history, open };
            }
          } catch {
            /* swallow */
          }
        })
      );
      if (!cancelled) setPrices(next);
    };
    fetchAll();
    const id = window.setInterval(fetchAll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) return;
    setItems((prev) => {
      const next = [...prev];
      const sIdx = next.findIndex((i) => i.id === sourceId);
      const tIdx = next.findIndex((i) => i.id === targetId);
      if (sIdx < 0 || tIdx < 0) return prev;
      const [moved] = next.splice(sIdx, 1);
      next.splice(tIdx, 0, moved);
      return next;
    });
    dragId.current = null;
  };

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Eye className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Watchlist
          </h3>
          <span className="ml-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {items.length}
          </span>
        </div>
        <button
          aria-label="Add symbol"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="divide-y divide-border/30 max-h-[520px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const p = prices[item.id];
            const up = p ? p.price >= p.prev : true;
            const change = p ? p.price - p.prev : 0;
            const pipMul = item.symbol.includes("JPY")
              ? 100
              : item.symbol.includes("XAU")
              ? 10
              : 10000;
            const pips = change * pipMul;
            const sessionPct = p ? ((p.price - p.open) / p.open) * 100 : 0;
            const sessionUp = sessionPct >= 0;

            return (
              <li
                key={item.id}
                draggable
                onDragStart={onDragStart(item.id)}
                onDragOver={onDragOver}
                onDrop={onDrop(item.id)}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />

                {/* Symbol info */}
                <div className="min-w-0 w-[68px] shrink-0">
                  <div className="font-heading text-xs font-semibold text-foreground truncate">
                    {item.label}
                  </div>
                  <div
                    className={`flex items-center gap-0.5 font-mono text-[10px] font-semibold tabular-nums ${
                      sessionUp ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {sessionUp ? (
                      <ArrowUp className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowDown className="h-2.5 w-2.5" />
                    )}
                    {Math.abs(sessionPct).toFixed(2)}%
                  </div>
                </div>

                {/* Sparkline */}
                <Sparkline history={p?.history ?? []} up={sessionUp} />

                {/* Price */}
                <div className="text-right ml-auto">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={p?.price ?? "—"}
                      initial={{ y: -4, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 4, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="font-mono text-xs font-semibold tabular-nums text-foreground"
                    >
                      {p
                        ? p.price.toFixed(
                            item.symbol.includes("JPY")
                              ? 3
                              : item.symbol.includes("XAU")
                              ? 2
                              : 5
                          )
                        : "—"}
                    </motion.div>
                  </AnimatePresence>
                  <div
                    className={`flex items-center justify-end gap-0.5 font-mono text-[10px] tabular-nums ${
                      up ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {up ? (
                      <ArrowUp className="h-2 w-2" />
                    ) : (
                      <ArrowDown className="h-2 w-2" />
                    )}
                    {p ? `${Math.abs(pips).toFixed(1)}p` : "—"}
                  </div>
                </div>

                {/* Trade button */}
                <Link
                  to={`/live-chart?symbol=FX:${item.base}${item.quote}`}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/30 transition-all"
                  title={`Trade ${item.label}`}
                >
                  <Zap className="h-2.5 w-2.5" />
                  Trade
                </Link>

                <button
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.label}`}
                  className="opacity-0 group-hover:opacity-100 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-red-400 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  );
};

const Sparkline = ({ history, up }: { history: number[]; up: boolean }) => {
  const path = useMemo(() => {
    if (history.length < 2) return null;
    const w = 56;
    const h = 22;
    const max = Math.max(...history);
    const min = Math.min(...history);
    const range = max - min || 1;
    const step = w / (history.length - 1);
    const pts = history.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return { d: `M ${pts.join(" L ")}`, w, h };
  }, [history]);

  if (!path) {
    return <div className="w-14 h-[22px] shrink-0" aria-hidden />;
  }

  const color = up ? "hsl(160 84% 50%)" : "hsl(0 84% 60%)";

  return (
    <svg
      width={path.w}
      height={path.h}
      viewBox={`0 0 ${path.w} ${path.h}`}
      className="shrink-0"
      aria-hidden
    >
      <path
        d={path.d}
        fill="none"
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
};

export default Watchlist;
