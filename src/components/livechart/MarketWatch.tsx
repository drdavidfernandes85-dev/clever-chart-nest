import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RotateCcw, Search, Star } from "lucide-react";
import { fetchMarketQuotes, type LiveQuote } from "@/lib/markets";
import { isAutoRefreshAllowed } from "@/lib/tradingLayerControl";
import { useFavorites, inferCategory } from "@/hooks/useFavorites";

interface Props {
  symbols: string[]; // display labels e.g. "EUR/USD"
  active: string;
  onSelect: (label: string) => void;
}

type Category = "All" | "FX" | "Metals" | "Crypto" | "Indices" | "Stocks";

const classify = (label: string): Exclude<Category, "All"> => {
  const u = label.toUpperCase();
  if (/^XAU|XAG|GOLD|SILVER/.test(u)) return "Metals";
  if (/BTC|ETH|USDT|SOL|XRP|ADA|DOGE/.test(u)) return "Crypto";
  if (/(S&P|NASDAQ|DOW|DAX|FTSE|NIKKEI|US30|NAS100|SPX|GER40)/i.test(label)) return "Indices";
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(u) || /^[A-Z]{6}$/.test(u)) return "FX";
  return "Stocks";
};

const CATEGORIES: Category[] = ["All", "FX", "Metals", "Crypto", "Indices", "Stocks"];

/** Fixed-width grid template ensures perfectly aligned columns across all rows. */
const ROW_COLS = "grid-cols-[14px_minmax(0,1fr)_64px_48px]";
const MIN_ROWS = 12; // keep table height stable across filters/empty states

/** Compact Market Watch rail — favorites (per-user), search, category filters, live bid/ask. */
const MarketWatch = ({ symbols, active, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const { favorites, loading: favLoading, isFavorite, toggle, remove } = useFavorites();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await fetchMarketQuotes();
      if (cancelled) return;
      const map: Record<string, LiveQuote> = {};
      for (const q of list) map[q.symbol.toUpperCase()] = q;
      setQuotes(map);
      setQuotesLoading(false);
    };
    if (isAutoRefreshAllowed()) load();
    const onManualRefresh = () => load();
    window.addEventListener("mt:refresh-quotes", onManualRefresh);
    const id = window.setInterval(() => {
      if (isAutoRefreshAllowed()) load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("mt:refresh-quotes", onManualRefresh);
    };
  }, []);

  const toggleFav = (label: string) => {
    toggle({
      symbol: label,
      display_name: label,
      description: null,
      category: inferCategory(label),
    });
  };

  const resetFavorites = async () => {
    if (!favorites.length) return;
    if (!window.confirm("Reset all favorite symbols? This cannot be undone.")) return;
    for (const f of favorites) {
      // sequential to avoid hammering, list is small
      // eslint-disable-next-line no-await-in-loop
      await remove(f.symbol);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return symbols.filter((s) => {
      if (category !== "All" && classify(s) !== category) return false;
      if (q && !s.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [symbols, query, category]);

  const favList = useMemo(
    () => filtered.filter((s) => isFavorite(s)),
    [filtered, isFavorite],
  );
  const restList = useMemo(
    () => filtered.filter((s) => !isFavorite(s)),
    [filtered, isFavorite],
  );

  const renderRow = (label: string) => {
    const q = quotes[label.toUpperCase()];
    const price = q?.price ?? null;
    const chg = q?.changePct ?? null;
    const isUp = (chg ?? 0) >= 0;
    const isActive = active === label;
    const isFav = isFavorite(label);
    const hasQuote = q != null;
    return (
      <li key={label}>
        <div
          className={`group grid w-full ${ROW_COLS} items-center gap-2 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
            isActive
              ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
              : "border-l-2 border-l-transparent hover:bg-[#FFCD05]/[0.04] hover:border-l-[#FFCD05]/30"
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFav(label);
            }}
            title={isFav ? "Remove favorite" : "Add favorite"}
            className="flex h-3.5 w-3.5 items-center justify-center text-[#5d6168] hover:text-[#FFCD05]"
          >
            <Star className={`h-3 w-3 ${isFav ? "fill-[#FFCD05] text-[#FFCD05]" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onSelect(label)}
            className={`text-left font-mono text-[10.5px] font-semibold truncate ${
              isActive ? "text-[#FFCD05]" : "text-neutral-100"
            }`}
          >
            {label}
          </button>
          <button
            type="button"
            onClick={() => onSelect(label)}
            className="text-right font-mono text-[10px] tabular-nums text-neutral-200"
          >
            {hasQuote && price != null
              ? price.toLocaleString("en-US", { maximumFractionDigits: 5 })
              : quotesLoading
              ? <span className="inline-block h-2 w-10 rounded bg-neutral-800 animate-pulse align-middle" />
              : <span className="text-neutral-600">—</span>}
          </button>
          <button
            type="button"
            onClick={() => onSelect(label)}
            className={`text-right font-mono text-[9.5px] tabular-nums ${
              chg == null ? "text-neutral-500" : isUp ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {chg != null ? `${isUp ? "+" : ""}${chg.toFixed(2)}%` : quotesLoading ? (
              <span className="inline-block h-2 w-8 rounded bg-neutral-800 animate-pulse align-middle" />
            ) : (
              <span className="text-neutral-600">—</span>
            )}
          </button>
        </div>
      </li>
    );
  };

  // Render placeholder rows so the panel keeps a stable height when empty/filtered.
  const placeholderRows = () => {
    const totalShown = favList.length + restList.length + (favList.length > 0 ? 1 : 0) + (favList.length > 0 && restList.length > 0 ? 1 : 0);
    const need = Math.max(0, MIN_ROWS - totalShown);
    return Array.from({ length: need }).map((_, i) => (
      <li key={`ph-${i}`} aria-hidden="true">
        <div className={`grid w-full ${ROW_COLS} items-center gap-2 px-2 py-[3px] border-b border-neutral-900/40 border-l-2 border-l-transparent`}>
          <span />
          <span className="h-2 w-16 rounded bg-neutral-900/60" />
          <span className="ml-auto h-2 w-10 rounded bg-neutral-900/50" />
          <span className="ml-auto h-2 w-8 rounded bg-neutral-900/50" />
        </div>
      </li>
    ));
  };

  // Skeleton rows while favorites or first quote batch are loading
  const initialLoading = favLoading || (quotesLoading && Object.keys(quotes).length === 0);

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            {t("terminal.marketWatch" as never)}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={resetFavorites}
              title={t("terminal.resetFavorites" as never)}
              className="inline-flex items-center gap-0.5 rounded-sm px-1 py-[1px] text-[8.5px] font-mono uppercase tracking-widest text-neutral-500 hover:text-[#FFCD05] hover:bg-[#FFCD05]/5 transition-colors"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              {t("terminal.reset" as never)}
            </button>
          )}

          {quotesLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1.5 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 shrink-0">
        <Search className="h-3 w-3 text-neutral-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-full bg-transparent border-0 outline-none font-mono text-[10.5px] text-neutral-100 placeholder:text-neutral-600"
        />
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-0.5 border-b border-neutral-800 bg-[#0a0a0a] px-1 py-1 shrink-0 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.14em] transition-colors ${
              category === cat
                ? "bg-[#FFCD05]/15 text-[#FFCD05]"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Column header */}
      <div className={`grid ${ROW_COLS} items-center gap-2 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 shrink-0`}>
        <span />
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right">Chg%</span>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {initialLoading ? (
          Array.from({ length: MIN_ROWS }).map((_, i) => (
            <li key={`skel-${i}`}>
              <div className={`grid w-full ${ROW_COLS} items-center gap-2 px-2 py-[3px] border-b border-neutral-900/60 border-l-2 border-l-transparent`}>
                <span className="h-3 w-3 rounded bg-neutral-900/80" />
                <span className="h-2.5 w-20 rounded bg-neutral-900/80 animate-pulse" />
                <span className="ml-auto h-2.5 w-12 rounded bg-neutral-900/70 animate-pulse" />
                <span className="ml-auto h-2.5 w-8 rounded bg-neutral-900/70 animate-pulse" />
              </div>
            </li>
          ))
        ) : (
          <>
            {favList.length > 0 && (
              <>
                <li className="sticky top-0 z-10 bg-[#0a0a0a] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.22em] text-[#FFCD05]/80 border-b border-neutral-800/80">
                  ★ Favorites
                </li>
                {favList.map(renderRow)}
                {restList.length > 0 && (
                  <li className="sticky top-0 z-10 bg-[#0a0a0a] px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.22em] text-neutral-500 border-y border-neutral-800/80 mt-0.5">
                    All Markets
                  </li>
                )}
              </>
            )}
            {restList.map(renderRow)}
            {favList.length === 0 && restList.length === 0 && (
              <li className="px-3 py-3 text-center text-[10px] font-mono uppercase tracking-widest text-neutral-600 border-b border-neutral-900/60">
                {query || category !== "All"
                  ? "No symbols match filter"
                  : "Waiting for market data…"}
              </li>
            )}
            {placeholderRows()}
          </>
        )}
      </ul>
      <div className="shrink-0 border-t border-neutral-900 bg-[#070707] px-2 py-[3px] text-[8px] font-mono uppercase tracking-[0.22em] text-[#5d6168] text-center">
        Powered by Trading Layer
      </div>
    </div>
  );
};

export default MarketWatch;
