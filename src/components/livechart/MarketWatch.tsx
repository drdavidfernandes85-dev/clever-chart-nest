import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, Search, Star } from "lucide-react";
import { fetchMarketQuotes, type LiveQuote } from "@/lib/markets";
import { isAutoRefreshAllowed } from "@/lib/tradingLayerControl";

interface Props {
  symbols: string[]; // display labels e.g. "EUR/USD"
  active: string;
  onSelect: (label: string) => void;
}

type Category = "All" | "FX" | "Metals" | "Crypto" | "Indices" | "Stocks";

const FAV_KEY = "ltr.marketwatch.favorites";

const classify = (label: string): Exclude<Category, "All"> => {
  const u = label.toUpperCase();
  if (/^XAU|XAG|GOLD|SILVER/.test(u)) return "Metals";
  if (/BTC|ETH|USDT|SOL|XRP|ADA|DOGE/.test(u)) return "Crypto";
  if (/(S&P|NASDAQ|DOW|DAX|FTSE|NIKKEI|US30|NAS100|SPX|GER40)/i.test(label)) return "Indices";
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(u) || /^[A-Z]{6}$/.test(u)) return "FX";
  return "Stocks";
};

const CATEGORIES: Category[] = ["All", "FX", "Metals", "Crypto", "Indices", "Stocks"];

/** Compact Market Watch rail — favorites, search, category filters, live bid/ask. */
const MarketWatch = ({ symbols, active, onSelect }: Props) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    } catch { /* ignore */ }
  }, [favorites]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const list = await fetchMarketQuotes();
      if (cancelled) return;
      const map: Record<string, LiveQuote> = {};
      for (const q of list) map[q.symbol.toUpperCase()] = q;
      setQuotes(map);
      setLoading(false);
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

  const toggleFav = (label: string) =>
    setFavorites((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label],
    );

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return symbols.filter((s) => {
      if (category !== "All" && classify(s) !== category) return false;
      if (q && !s.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [symbols, query, category]);

  const favList = useMemo(
    () => filtered.filter((s) => favorites.includes(s)),
    [filtered, favorites],
  );
  const restList = useMemo(
    () => filtered.filter((s) => !favorites.includes(s)),
    [filtered, favorites],
  );

  const renderRow = (label: string) => {
    const q = quotes[label.toUpperCase()];
    const price = q?.price ?? null;
    const chg = q?.changePct ?? null;
    const isUp = (chg ?? 0) >= 0;
    const isActive = active === label;
    const isFav = favorites.includes(label);
    return (
      <li key={label}>
        <div
          className={`group grid w-full grid-cols-[14px_1fr_auto_auto] items-center gap-2 px-2 py-[3px] text-left border-b border-neutral-900/80 transition-colors ${
            isActive
              ? "bg-[#FFCD05]/12 border-l-2 border-l-[#FFCD05] pl-[6px]"
              : "hover:bg-neutral-900/40 border-l-2 border-l-transparent"
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
            <Star
              className={`h-3 w-3 ${isFav ? "fill-[#FFCD05] text-[#FFCD05]" : ""}`}
            />
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
            {price != null ? price.toLocaleString("en-US", { maximumFractionDigits: 5 }) : "—"}
          </button>
          <button
            type="button"
            onClick={() => onSelect(label)}
            className={`text-right font-mono text-[9.5px] tabular-nums w-12 ${
              chg == null ? "text-neutral-500" : isUp ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {chg != null ? `${isUp ? "+" : ""}${chg.toFixed(2)}%` : "—"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
            Market Watch
          </h3>
        </div>
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
        ) : (
          <span className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-emerald-400">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        )}
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
      <div className="grid grid-cols-[14px_1fr_auto_auto] items-center gap-2 border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 shrink-0">
        <span />
        <span>Symbol</span>
        <span className="text-right">Last</span>
        <span className="text-right w-12">Chg%</span>
      </div>

      <ul className="flex-1 overflow-y-auto">
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
        {restList.length > 0 ? (
          restList.map(renderRow)
        ) : favList.length === 0 ? (
          <li className="px-3 py-6 text-center text-[10px] font-mono uppercase tracking-widest text-neutral-600">
            {query || category !== "All"
              ? "No symbols match filter"
              : "Waiting for market data…"}
          </li>
        ) : null}
      </ul>
    </div>
  );
};

export default MarketWatch;
