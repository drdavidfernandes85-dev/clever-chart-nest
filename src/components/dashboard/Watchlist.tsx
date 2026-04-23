import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, GripVertical, Plus, X } from "lucide-react";

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
];

interface PriceState {
  price: number;
  prev: number;
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

  // Live polling — exchangerate.host (free, no key) for FX, fallback for XAU
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
              const prev = next[item.id]?.price ?? p;
              next[item.id] = { price: p, prev };
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
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Eye className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Watchlist
          </h3>
        </div>
        <button
          aria-label="Add symbol"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="divide-y divide-border/30">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const p = prices[item.id];
            const up = p ? p.price >= p.prev : true;
            const change = p ? p.price - p.prev : 0;
            const pipMul = item.symbol.includes("JPY") ? 100 : item.symbol.includes("XAU") ? 10 : 10000;
            const pips = change * pipMul;
            return (
              <li
                key={item.id}
                draggable
                onDragStart={onDragStart(item.id)}
                onDragOver={onDragOver}
                onDrop={onDrop(item.id)}
                className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-xs font-semibold text-foreground">
                    {item.label}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {item.base}/{item.quote}
                  </div>
                </div>
                <div className="text-right">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={p?.price ?? "—"}
                      initial={{ y: -4, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 4, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="font-mono text-xs font-semibold tabular-nums text-foreground"
                    >
                      {p ? p.price.toFixed(item.symbol.includes("JPY") ? 3 : item.symbol.includes("XAU") ? 2 : 5) : "—"}
                    </motion.div>
                  </AnimatePresence>
                  <div
                    className={`font-mono text-[10px] tabular-nums ${
                      up ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {p ? `${up ? "+" : ""}${pips.toFixed(1)} pips` : "—"}
                  </div>
                </div>
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

export default Watchlist;
