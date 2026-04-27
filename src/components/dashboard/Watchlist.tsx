import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, GripVertical, Plus, X, ArrowUp, ArrowDown, Zap, Search } from "lucide-react";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  MARKET_UNIVERSE,
  fetchMarketQuotes,
  decimalsFor,
  type MarketSymbol,
  type AssetClass,
} from "@/lib/markets";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Default mix across all four asset classes — two of each.
const DEFAULT_LABELS = [
  "BTC/USDT", "ETH/USDT",
  "EUR/USD",  "USD/JPY",
  "S&P 500",  "Nasdaq 100",
  "AAPL",     "NVDA",
];

interface PriceState {
  price: number;
  prev: number;
  history: number[];
  /** Reference open used for intraday/24h % change. */
  open: number;
}

const Watchlist = () => {
  const { t } = useLanguage();
  const initial = useMemo(
    () =>
      DEFAULT_LABELS.map((l) => MARKET_UNIVERSE.find((m) => m.symbol === l)).filter(
        Boolean,
      ) as MarketSymbol[],
    [],
  );
  const [items, setItems] = useState<MarketSymbol[]>(initial);
  const [prices, setPrices] = useState<Record<string, PriceState>>({});
  const dragId = useRef<string | null>(null);
  const { openTrade } = useQuickTrade();

  // Restore order — versioned key so old layouts are dropped automatically.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("eltr.watchlist.order.v3");
      if (saved) {
        const labels: string[] = JSON.parse(saved);
        const map = new Map(MARKET_UNIVERSE.map((i) => [i.symbol, i]));
        const ordered = labels.map((l) => map.get(l)).filter(Boolean) as MarketSymbol[];
        if (ordered.length) setItems(ordered);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "eltr.watchlist.order.v3",
      JSON.stringify(items.map((i) => i.symbol)),
    );
  }, [items]);

  // Live polling — single edge function call returns every asset class.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const quotes = await fetchMarketQuotes();
      if (cancelled) return;
      setPrices((prev) => {
        const next: Record<string, PriceState> = { ...prev };
        for (const item of items) {
          const q = quotes.find((qq) => qq.symbol === item.symbol);
          if (!q || q.price == null || !Number.isFinite(q.price)) continue;
          const p = q.price;
          const existing = next[item.symbol];
          const previous = existing?.price ?? p;
          const chg = q.changePct ?? 0;
          const open = chg ? p / (1 + chg / 100) : existing?.open ?? p;
          const history = existing
            ? [...existing.history.slice(-23), p]
            : [p];
          next[item.symbol] = { price: p, prev: previous, history, open };
        }
        return next;
      });
    };
    refresh();
    const id = window.setInterval(refresh, 20_000);
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
      const sIdx = next.findIndex((i) => i.symbol === sourceId);
      const tIdx = next.findIndex((i) => i.symbol === targetId);
      if (sIdx < 0 || tIdx < 0) return prev;
      const [moved] = next.splice(sIdx, 1);
      next.splice(tIdx, 0, moved);
      return next;
    });
    dragId.current = null;
  };

  const removeItem = (label: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.symbol !== label) : prev));

  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");

  const addItem = (sym: MarketSymbol) => {
    setItems((prev) => (prev.find((i) => i.symbol === sym.symbol) ? prev : [...prev, sym]));
    setAddQuery("");
    setAddOpen(false);
  };

  const available = useMemo(() => {
    const owned = new Set(items.map((i) => i.symbol));
    const q = addQuery.trim().toLowerCase();
    return MARKET_UNIVERSE.filter((m) => !owned.has(m.symbol)).filter((m) =>
      q ? m.symbol.toLowerCase().includes(q) || m.assetClass.toLowerCase().includes(q) : true,
    );
  }, [items, addQuery]);

  const grouped = useMemo(() => {
    const groups: Record<AssetClass, MarketSymbol[]> = {
      crypto: [], forex: [], index: [], stock: [],
    };
    for (const m of available) groups[m.assetClass].push(m);
    return groups;
  }, [available]);

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
            {t("watch.title")}
          </h3>
          <span className="ml-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
            {items.length}
          </span>
        </div>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label={t("watch.add")}
              title={t("watch.add")}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder={t("watch.add")}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {available.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                  No matches
                </div>
              ) : (
                (["crypto", "forex", "index", "stock"] as AssetClass[]).map((cls) =>
                  grouped[cls].length === 0 ? null : (
                    <div key={cls} className="py-1">
                      <div className="px-3 pb-1 pt-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                        {cls}
                      </div>
                      {grouped[cls].map((m) => (
                        <button
                          key={m.symbol}
                          type="button"
                          onClick={() => addItem(m)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-foreground hover:bg-primary/10 transition-colors"
                        >
                          <span className="font-heading font-semibold">{m.symbol}</span>
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ),
                )
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <ul className="divide-y divide-border/30 max-h-[520px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const p = prices[item.symbol];
            const up = p ? p.price >= p.prev : true;
            const sessionPct = p && p.open ? ((p.price - p.open) / p.open) * 100 : 0;
            const sessionUp = sessionPct >= 0;
            const change = p ? p.price - p.prev : 0;
            const decimals = decimalsFor(item, p?.price ?? null);

            return (
              <li
                key={item.symbol}
                draggable
                onDragStart={onDragStart(item.symbol)}
                onDragOver={onDragOver}
                onDrop={onDrop(item.symbol)}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />

                {/* Symbol info */}
                <div className="min-w-0 w-[78px] shrink-0">
                  <div className="font-heading text-xs font-semibold text-foreground truncate">
                    {item.symbol}
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
                      {p ? p.price.toFixed(decimals) : "—"}
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
                    {p ? `${change >= 0 ? "+" : ""}${change.toFixed(decimals)}` : "—"}
                  </div>
                </div>

                {/* Trade button — opens global Quick Trade pre-filled */}
                <button
                  onClick={() => openTrade({ symbol: item.symbol })}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/30 transition-all"
                  title={`${t("watch.trade")} ${item.symbol}`}
                >
                  <Zap className="h-2.5 w-2.5" />
                  {t("watch.trade")}
                </button>

                <button
                  onClick={() => removeItem(item.symbol)}
                  aria-label={`${t("watch.remove")} ${item.symbol}`}
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
