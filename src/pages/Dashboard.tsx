import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Loader2,
  Activity,
  User,
  Star,
} from "lucide-react";

import { useFavorites, inferCategory } from "@/hooks/useFavorites";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/SEO";
import NotificationsBell from "@/components/notifications/NotificationsBell";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";
import BlackArrowTradePanel from "@/components/dashboard/BlackArrowTradePanel";
import LiveExecutionBanner from "@/components/dashboard/LiveExecutionBanner";
import SystemHealthWidget from "@/components/dashboard/SystemHealthWidget";
import BidAskBoard from "@/components/livechart/BidAskBoard";
import OpenPositionsPanel from "@/components/livechart/OpenPositionsPanel";
import TerminalExecutionLog from "@/components/dashboard/TerminalExecutionLog";
import TradingLayerPauseBanner from "@/components/dashboard/TradingLayerPauseBanner";
import TradeJournal from "@/components/dashboard/TradeJournal";
import BestExecutionTab from "@/components/dashboard/BestExecutionTab";
import {
  LiveAccountProvider,
  useLiveAccount,
  fmtMoney,
} from "@/contexts/LiveAccountContext";
import {
  BrokerSymbolsProvider,
  useBrokerSymbols,
} from "@/contexts/BrokerSymbolsContext";
import { TerminalStateProvider } from "@/contexts/TerminalStateContext";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useSelectedQuote } from "@/hooks/useSelectedQuote";
import { MARKET_UNIVERSE } from "@/lib/markets";
import { useLanguage } from "@/i18n/LanguageContext";


const TIMEFRAMES = [
  { label: "1m", value: "1" },
  { label: "5m", value: "5" },
  { label: "15m", value: "15" },
  { label: "1H", value: "60" },
  { label: "4H", value: "240" },
  { label: "1D", value: "D" },
];

/** Map broker symbol → TradingView symbol. */
function brokerToTv(sym: string): string {
  const u = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const direct = MARKET_UNIVERSE.find(
    (m) => m.symbol.toUpperCase().replace(/[^A-Z0-9]/g, "") === u,
  );
  if (direct) return direct.tv;
  if (u === "XAUUSD" || u === "GOLD") return "OANDA:XAUUSD";
  if (u === "XAGUSD" || u === "SILVER") return "OANDA:XAGUSD";
  if (u === "BTCUSD") return "BINANCE:BTCUSDT";
  if (u === "ETHUSD") return "BINANCE:ETHUSDT";
  if (u === "US30" || u === "DJ30") return "TVC:DJI";
  if (u === "NAS100" || u === "USTEC") return "TVC:NDX";
  if (u === "SPX500" || u === "US500") return "TVC:SPX";
  if (u === "GER40" || u === "DAX40") return "TVC:DAX";
  if (/^[A-Z]{6}$/.test(u)) return `FX:${u}`;
  if (u.endsWith("USDT")) return `BINANCE:${u}`;
  if (/^[A-Z]{1,5}$/.test(u)) return `NASDAQ:${u}`;
  return u;
}

const HeaderStat = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "primary";
}) => (
  <div className="flex flex-col leading-tight">
    <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">
      {label}
    </span>
    <span
      className={`font-mono text-[12px] font-bold tabular-nums ${
        tone === "positive"
          ? "text-emerald-400"
          : tone === "negative"
            ? "text-red-400"
            : tone === "primary"
              ? "text-[#FFCD05]"
              : "text-neutral-100"
      }`}
    >
      {value}
    </span>
  </div>
);

const TerminalHeader = () => {
  const { liveAccount, connected, refreshing, refresh, error } = useLiveAccount();
  const c = liveAccount?.currency ?? "USD";
  // Never fake 0 — keep null so fmtMoney renders "—".
  const pnl = liveAccount?.profit ?? null;
  const pnlTone =
    pnl == null ? "default" : pnl >= 0 ? "positive" : "negative";

  // "Ever connected" = we have a lastGood account snapshot to keep on screen
  // even if a refresh momentarily failed.
  const hasEverLoaded = !!liveAccount;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-[#0a0a0a]/95 backdrop-blur-xl">
      <div className="flex h-11 items-center gap-3 px-3 sm:px-4 pl-14 lg:pl-4">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#FFCD05] text-black">
            <Activity className="h-3.5 w-3.5" strokeWidth={3} />
          </div>
          <span className="font-heading text-[13px] font-bold tracking-[0.14em] text-neutral-100">
            INFINOX <span className="text-[#FFCD05]">IX</span> TERMINAL
          </span>
        </div>

        {hasEverLoaded ? (
          <div className="flex items-center gap-4 ml-2 pl-3 border-l border-neutral-800 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`inline-flex h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className={`font-mono text-[10px] uppercase tracking-widest ${connected ? "text-emerald-400" : "text-amber-400"}`}>
                {connected ? "MT5 LIVE" : "DATA DELAYED"}
              </span>
            </div>
            <HeaderStat label="Account" value={liveAccount.login ? `#${liveAccount.login}` : "—"} />
            <HeaderStat label="Server" value={liveAccount.server || "—"} />
            <HeaderStat label="Status" value={liveAccount.status || "—"} />
            <HeaderStat
              label="Leverage"
              value={liveAccount.leverage ? `1:${liveAccount.leverage}` : "—"}
            />
            <HeaderStat label="Balance" value={fmtMoney(liveAccount.balance, c)} />
            <HeaderStat
              label="Equity"
              value={fmtMoney(liveAccount.equity, c)}
              tone="primary"
            />
            <HeaderStat
              label="Floating P&L"
              value={fmtMoney(pnl, c)}
              tone={pnlTone}
            />
            <HeaderStat label="Margin" value={fmtMoney(liveAccount.margin, c)} />
            <HeaderStat
              label="Free Margin"
              value={fmtMoney(liveAccount.marginFree, c)}
              tone="positive"
            />
          </div>
        ) : (
          <Link
            to="/connect-mt"
            className="ml-2 pl-3 border-l border-neutral-800 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#FFCD05] hover:text-[#FFCD05]/80"
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            Connect MT5 Account
          </Link>
        )}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => refresh()}
            disabled={refreshing}
            title="Refresh account"
            className="flex h-7 w-7 items-center justify-center rounded border border-neutral-800 bg-[#0f0f0f] text-neutral-400 hover:text-[#FFCD05] hover:border-[#FFCD05]/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <NotificationsBell />
          <Link
            to="/profile"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFCD05] text-[11px] font-bold text-black hover:bg-[#FFCD05]/85 transition-colors"
            aria-label="Profile"
          >
            <User className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
};

const CATEGORIES = ["All", "Forex", "Commodities", "Indices", "Crypto"] as const;
type Category = (typeof CATEGORIES)[number];

const MarketRow = ({
  sym,
  description,
  digits,
  tick,
  isActive,
  isFav,
  onSelect,
  onToggleFav,
}: {
  sym: string;
  description?: string | null;
  digits: number;
  tick?: { bid: number | null; ask: number | null; spread: number | null };
  isActive: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}) => {
  // Guard: never render a row without a real symbol.
  if (!sym || !sym.trim()) return null;
  const bid = tick?.bid ?? null;
  const ask = tick?.ask ?? null;
  const spread = tick?.spread ?? (bid != null && ask != null ? Math.max(0, ask - bid) : null);
  // Always render the symbol name/description; show "—" for prices that haven't ticked yet.
  const fmt = (v: number | null | undefined) =>
    v == null
      ? "—"
      : v.toLocaleString("en-US", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  const spreadDigits = Math.max(digits, 1);
  return (
    <li
      className={`grid grid-cols-[16px_1fr_56px_56px_48px] items-center gap-1 pr-1.5 py-[3px] border-b border-neutral-900/80 border-l-2 transition-colors ${
        isActive ? "bg-[#FFCD05]/12 border-l-[#FFCD05] pl-[6px]" : "border-l-transparent pl-1.5 hover:bg-neutral-900/40"
      }`}
    >
      <button
        type="button"
        onClick={onToggleFav}
        className="flex h-4 w-4 items-center justify-center"
        aria-label={isFav ? "Remove favorite" : "Add favorite"}
      >
        <Star
          className={`h-3 w-3 ${isFav ? "fill-[#FFCD05] text-[#FFCD05]" : "text-neutral-700 hover:text-neutral-400"}`}
        />
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 text-left flex flex-col leading-tight">
        <span
          className={`font-mono text-[10.5px] font-semibold truncate ${isActive ? "text-[#FFCD05]" : "text-neutral-100"}`}
          title={description ?? sym}
        >
          {sym}
        </span>
        {description ? (
          <span className="font-mono text-[8.5px] text-neutral-500 truncate" title={description}>
            {description}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="text-right font-mono text-[10px] tabular-nums text-red-400"
      >
        {fmt(bid)}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="text-right font-mono text-[10px] tabular-nums text-emerald-400"
      >
        {fmt(ask)}
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="text-right font-mono text-[9.5px] tabular-nums text-neutral-300"
        title="Spread"
      >
        {spread == null
          ? "—"
          : spread.toLocaleString("en-US", {
              minimumFractionDigits: spreadDigits,
              maximumFractionDigits: spreadDigits,
            })}
      </button>
    </li>
  );
};

const MarketWatchPanel = ({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (sym: string) => void;
}) => {
  const { symbols, loading, isLive } = useBrokerSymbols();
  const { favorites, isFavorite, toggle } = useFavorites();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Category>("All");

  // Build category map (memoized)
  const categorized = useMemo(() => {
    // Drop any malformed broker entries (no symbol) so the list never renders
    // blank rows with just a star + dashes.
    return symbols
      .filter((s) => {
        const sym = (s.brokerSymbol || s.symbol || "").trim();
        return sym.length > 0;
      })
      .map((s) => ({
        ...s,
        _cat: inferCategory(s.brokerSymbol || s.symbol, s.assetClass),
      }));
  }, [symbols]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return categorized
      .filter((s) => (tab === "All" ? true : s._cat === tab))
      .filter((s) => {
        if (!q) return true;
        return (
          (s.brokerSymbol || s.symbol).toUpperCase().includes(q) ||
          (s.description || "").toUpperCase().includes(q)
        );
      })
      .slice(0, 500);
  }, [categorized, query, tab]);

  const favoriteSymbols = useMemo(() => favorites.map((f) => f.symbol), [favorites]);

  // Subscribe to live ticks for everything currently visible (cap at 40 to
  // match the get-mt5-quotes batch endpoint).
  const visibleTopSymbols = useMemo(
    () =>
      filtered
        .slice(0, 40)
        .map((s) => (s.brokerSymbol || s.symbol))
        .filter(Boolean),
    [filtered],
  );
  const tickRequest = useMemo(() => {
    const set = new Set<string>();
    favoriteSymbols.forEach((s) => set.add(s.toUpperCase()));
    if (active) set.add(active.toUpperCase());
    visibleTopSymbols.forEach((s) => set.add(s.toUpperCase()));
    return Array.from(set).slice(0, 40);
  }, [favoriteSymbols, active, visibleTopSymbols]);

  // --- Bid/Ask via get-mt5-quotes (stale-while-revalidate) ---
  type QuoteRow = { bid: number | null; ask: number | null; spread: number | null; last?: number | null };
  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});
  const lastGoodQuotesRef = useRef<Record<string, QuoteRow>>({});
  const [lastGoodQuotes, setLastGoodQuotes] = useState<Record<string, QuoteRow>>({});
  const [dataDelayed, setDataDelayed] = useState(false);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);

  useEffect(() => {
    if (tickRequest.length === 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { checkAndHandle429 } = await import("@/lib/tradingLayerControl");
        const { data, error } = await supabase.functions.invoke("get-mt5-quotes", {
          body: { selectedSymbol: active, symbols: tickRequest, debug: false },
        });
        if (cancelled) return;
        checkAndHandle429(data, error);
        if (error || !data?.success || !Array.isArray(data?.quotes) || data.quotes.length === 0) {
          // Keep lastGoodQuotes; flag delayed.
          setDataDelayed(true);
          return;
        }
        const next: Record<string, QuoteRow> = {};
        for (const q of data.quotes) {
          const sym = String(q?.symbol || "").toUpperCase();
          if (!sym) continue;
          const bid = q?.bid != null ? Number(q.bid) : null;
          const ask = q?.ask != null ? Number(q.ask) : null;
          const spread =
            q?.spread != null
              ? Number(q.spread)
              : bid != null && ask != null
                ? Math.max(0, ask - bid)
                : null;
          if (bid == null && ask == null && spread == null) continue;
          next[sym] = { bid, ask, spread, last: q?.last != null ? Number(q.last) : null };
        }
        if (Object.keys(next).length === 0) {
          setDataDelayed(true);
          return;
        }
        // Merge into lastGood so previously-known symbols persist across batches.
        const merged = { ...lastGoodQuotesRef.current, ...next };
        lastGoodQuotesRef.current = merged;
        setLastGoodQuotes(merged);
        setQuotes(next);
        setDataDelayed(false);
        setHasEverLoaded(true);
      } catch {
        if (!cancelled) setDataDelayed(true);
      }
    };
    // Initial load only if auto-refresh allowed; manual refresh event always reloads.
    import("@/lib/tradingLayerControl").then(({ isAutoRefreshAllowed }) => {
      if (!cancelled && isAutoRefreshAllowed()) load();
    });
    const onManualRefresh = () => load();
    window.addEventListener("mt:refresh-quotes", onManualRefresh);
    const id = window.setInterval(() => {
      import("@/lib/tradingLayerControl").then(({ isAutoRefreshAllowed }) => {
        if (!cancelled && isAutoRefreshAllowed()) load();
      });
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("mt:refresh-quotes", onManualRefresh);
    };
  }, [tickRequest, active]);



  // Hydrate favorites with broker metadata when available
  const favRows = useMemo(() => {
    const byUpper = new Map<string, (typeof categorized)[number]>();
    for (const s of categorized) byUpper.set((s.brokerSymbol || s.symbol).toUpperCase(), s);
    return favorites.map((f) => {
      const broker = byUpper.get(f.symbol.toUpperCase());
      return {
        sym: f.symbol,
        description: broker?.description ?? f.description ?? null,
        digits: Number(broker?.digits) || 5,
        category: broker?._cat || f.category || inferCategory(f.symbol),
      };
    });
  }, [favorites, categorized]);

  const getTick = (sym: string) => {
    const u = sym.toUpperCase();
    return quotes[u] || lastGoodQuotes[u];
  };

  // Order non-favorites by category: Forex → Commodities → Indices → Crypto → others
  const CATEGORY_ORDER: Record<string, number> = {
    Forex: 0,
    Commodities: 1,
    Indices: 2,
    Crypto: 3,
    Stocks: 4,
  };
  const sortedByCategory = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ao = CATEGORY_ORDER[a._cat] ?? 99;
      const bo = CATEGORY_ORDER[b._cat] ?? 99;
      if (ao !== bo) return ao - bo;
      return (a.brokerSymbol || a.symbol).localeCompare(b.brokerSymbol || b.symbol);
    });
  }, [filtered]);

  // Group rows by category for section headers (only when tab is "All" and not searching)
  const grouped = useMemo(() => {
    const map = new Map<string, typeof sortedByCategory>();
    for (const s of sortedByCategory) {
      const c = s._cat;
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(s);
    }
    // Order keys
    const ordered: Array<[string, typeof sortedByCategory]> = [];
    ["Forex", "Commodities", "Indices", "Crypto", "Stocks"].forEach((k) => {
      if (map.has(k)) ordered.push([k, map.get(k)!]);
    });
    for (const [k, v] of map.entries()) if (!ordered.find((e) => e[0] === k)) ordered.push([k, v]);
    return ordered;
  }, [sortedByCategory]);

  const showGroupHeaders = tab === "All" && !query;

  const toggleFromBroker = (s: (typeof categorized)[number] | { brokerSymbol?: string; symbol: string; description?: string | null; displayName?: string; _cat?: string }) => {
    const sym = (s as any).brokerSymbol || s.symbol;
    toggle({
      symbol: sym,
      display_name: (s as any).displayName || sym,
      description: s.description ?? null,
      category: (s as any)._cat || inferCategory(sym),
    });
  };

  return (
    <aside className="hidden lg:flex flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden h-[calc(100vh-6.5rem)]">
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3 py-2">
        <h2 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">
          Market Watch
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          {dataDelayed && (
            <span className="px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[8.5px]">
              Data delayed
            </span>
          )}
          {isLive ? (
            <span className="text-emerald-400">● {symbols.length}</span>
          ) : loading ? (
            <Loader2 className="h-3 w-3 animate-spin text-[#FFCD05]" />
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </span>
      </div>
      <div className="px-2 py-2 border-b border-neutral-800/80 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols…"
            className="h-7 pl-7 pr-8 bg-[#050505] border-neutral-800 text-[11px] font-mono placeholder:text-neutral-600 focus-visible:ring-[#FFCD05]/40 rounded"
          />
          <Star className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 fill-[#FFCD05] text-[#FFCD05]" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border transition-colors ${
                tab === c
                  ? "bg-[#FFCD05]/15 border-[#FFCD05]/40 text-[#FFCD05]"
                  : "border-neutral-800 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[16px_1fr_56px_56px_48px] items-center gap-1 border-b border-neutral-800 bg-[#0a0a0a] px-1.5 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500">
        <span />
        <span>Symbol</span>
        <span className="text-right text-red-400/80">Bid</span>
        <span className="text-right text-emerald-400/80">Ask</span>
        <span className="text-right">Spread</span>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {/* Favorites — always shown at the top when not actively filtering by another tab */}
        {tab === "All" && !query && (
          <>
            <li className="px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-[#FFCD05]/80 bg-[#0a0a0a]/60 border-b border-neutral-800/60 flex items-center gap-1.5">
              <Star className="h-2.5 w-2.5 fill-[#FFCD05] text-[#FFCD05]" /> Favorites
            </li>
            {favRows.length === 0 ? (
              <li className="px-3 py-3 text-[10px] text-neutral-500 italic">
                No favorites yet. Star an instrument to add it here.
              </li>
            ) : (
              favRows.map((f) => {
                const broker = categorized.find(
                  (s) => (s.brokerSymbol || s.symbol).toUpperCase() === f.sym.toUpperCase(),
                );
                return (
                  <MarketRow
                    key={`fav-${f.sym}`}
                    sym={f.sym}
                    description={f.description}
                    digits={f.digits}
                    tick={getTick(f.sym)}
                    isActive={f.sym.toUpperCase() === active.toUpperCase()}
                    isFav
                    onSelect={() => onSelect(f.sym)}
                    onToggleFav={() =>
                      toggle({
                        symbol: f.sym,
                        display_name: broker?.displayName || f.sym,
                        description: f.description ?? null,
                        category: f.category,
                      })
                    }
                  />
                );
              })
            )}
          </>
        )}

        {loading && sortedByCategory.length === 0 && (
          <li className="px-3 py-5 text-center text-[11px] text-neutral-500 flex items-center justify-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading broker symbols…
          </li>
        )}
        {!loading && sortedByCategory.length === 0 && (
          <li className="px-3 py-5 text-center text-[11px] text-neutral-500">
            {query
              ? "No matches."
              : !hasEverLoaded
                ? "No MT5 symbols loaded. Refresh Market Watch."
                : "No MT5 symbols loaded. Refresh Market Watch."}
          </li>
        )}

        {showGroupHeaders
          ? grouped.map(([cat, rows]) => (
              <Fragment key={cat}>
                <li className="px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-neutral-500 bg-[#0a0a0a]/60 border-y border-neutral-800/60">
                  {cat}
                </li>
                {rows.map((s) => {
                  const sym = s.brokerSymbol || s.symbol;
                  return (
                    <MarketRow
                      key={sym}
                      sym={sym}
                      description={s.description}
                      digits={Number(s.digits) || 5}
                      tick={getTick(sym)}
                      isActive={sym.toUpperCase() === active.toUpperCase()}
                      isFav={isFavorite(sym)}
                      onSelect={() => onSelect(sym)}
                      onToggleFav={() => toggleFromBroker(s)}
                    />
                  );
                })}
              </Fragment>
            ))
          : sortedByCategory.map((s) => {
              const sym = s.brokerSymbol || s.symbol;
              return (
                <MarketRow
                  key={sym}
                  sym={sym}
                  description={s.description}
                  digits={Number(s.digits) || 5}
                  tick={getTick(sym)}
                  isActive={sym.toUpperCase() === active.toUpperCase()}
                  isFav={isFavorite(sym)}
                  onSelect={() => onSelect(sym)}
                  onToggleFav={() => toggleFromBroker(s)}
                />
              );
            })}
      </ul>
    </aside>
  );
};

const ChartBidAskHeader = () => {
  const { tick, selectedSymbolInfo, selectedBrokerSymbol } = useBrokerSymbols();
  const { selectedQuote, lastGoodSelectedSymbolData, dataDelayed } =
    useSelectedQuote(selectedBrokerSymbol);
  const eff = selectedQuote ?? lastGoodSelectedSymbolData;
  const digits = Number(eff?.digits ?? selectedSymbolInfo?.digits) || 5;
  const fmt = (v: number | null | undefined) =>
    v == null || !Number.isFinite(Number(v))
      ? "—"
      : Number(v).toLocaleString("en-US", {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  // Trading Layer bid/ask (selectedQuote) is the source of truth.
  const bid =
    eff?.bid != null ? Number(eff.bid) : tick?.bid != null ? Number(tick.bid) : null;
  const ask =
    eff?.ask != null ? Number(eff.ask) : tick?.ask != null ? Number(tick.ask) : null;
  const spread =
    eff?.spread != null
      ? Number(eff.spread)
      : bid != null && ask != null
        ? Math.max(0, ask - bid)
        : null;
  const point = Number(eff?.point ?? selectedSymbolInfo?.point) || Math.pow(10, -digits);
  const spreadPts = spread != null && point ? spread / point : null;
  const high = tick?.high != null ? Number(tick.high) : null;
  const low = tick?.low != null ? Number(tick.low) : null;
  const open = tick?.open != null ? Number(tick.open) : null;
  const last =
    eff?.last != null
      ? Number(eff.last)
      : tick?.last != null
        ? Number(tick.last)
        : bid != null && ask != null
          ? (bid + ask) / 2
          : null;
  const change = open != null && last != null ? last - open : null;
  const changePct = open != null && last != null && open !== 0 ? ((last - open) / open) * 100 : null;
  const changeColor =
    change == null ? "text-neutral-400" : change >= 0 ? "text-emerald-400" : "text-red-400";

  // Last MT5 tick time — bumps whenever the live quote refreshes.
  const [tickTime, setTickTime] = useState<string>("—");
  useEffect(() => {
    if (selectedQuote && (selectedQuote.bid != null || selectedQuote.ask != null)) {
      const d = new Date();
      setTickTime(
        d.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
  }, [selectedQuote?.bid, selectedQuote?.ask, selectedQuote?.last]);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center rounded border border-red-500/40 bg-red-500/15 px-3 py-1.5 leading-tight">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[14px] font-bold tabular-nums text-red-300">
            {fmt(bid)}
          </span>
          <span className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-red-300/80">
            Sell · MT5
          </span>
        </div>
      </div>
      <div className="rounded border border-neutral-800 bg-[#0a0a0a] px-2 py-1 text-center">
        <div className="font-mono text-[10px] tabular-nums text-neutral-300">
          {spreadPts != null ? spreadPts.toFixed(2) : "—"}
        </div>
      </div>
      <div className="flex items-center rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 leading-tight">
        <div className="flex flex-col items-center">
          <span className="font-mono text-[14px] font-bold tabular-nums text-emerald-300">
            {fmt(ask)}
          </span>
          <span className="text-[8.5px] font-mono uppercase tracking-[0.22em] text-emerald-300/80">
            Buy · MT5
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5 pl-2 ml-1 border-l border-neutral-800">
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            24H Change
          </span>
          <span className={`font-mono text-[12px] font-bold tabular-nums ${changeColor}`}>
            {change == null ? "—" : `${change >= 0 ? "+" : ""}${change.toFixed(digits)}`}
            {changePct != null && (
              <span className="ml-1 text-[10px]">
                ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            High
          </span>
          <span className="font-mono text-[12px] font-bold tabular-nums text-neutral-200">
            {fmt(high)}
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            Low
          </span>
          <span className="font-mono text-[12px] font-bold tabular-nums text-neutral-200">
            {fmt(low)}
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-500">
            Last MT5 tick
          </span>
          <span
            className={`font-mono text-[11px] tabular-nums ${
              dataDelayed ? "text-amber-400" : "text-emerald-400"
            }`}
            title="Trading Layer / MT5"
          >
            {tickTime}
            {dataDelayed ? " · delayed" : ""}
          </span>
        </div>
      </div>
      {selectedBrokerSymbol ? <span className="sr-only">{selectedBrokerSymbol}</span> : null}
    </div>
  );
};

const BottomTabs = () => {
  const { liveAccount, connected } = useLiveAccount();
  const c = liveAccount?.currency ?? "USD";

  return (
    <div className="rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden">
      <Tabs defaultValue="positions" className="w-full">
        <TabsList className="w-full justify-start rounded-none border-b border-neutral-800/80 bg-[#0a0a0a] h-9 p-0">
          {[
            { v: "positions", l: "Positions" },
            { v: "orders", l: "Orders" },
            { v: "executions", l: "Execution Log" },
            { v: "best-exec", l: "Best Execution" },
            { v: "account", l: "Account" },
            { v: "journal", l: "Journal" },
          ].map((t) => (
            <TabsTrigger
              key={t.v}
              value={t.v}
              className="rounded-none border-r border-neutral-800/80 h-9 px-4 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-neutral-400 data-[state=active]:bg-[#0f0f0f] data-[state=active]:text-[#FFCD05] data-[state=active]:border-b-2 data-[state=active]:border-b-[#FFCD05]"
            >
              {t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="positions" className="m-0 p-0">
          <OpenPositionsPanel />
        </TabsContent>

        <TabsContent value="orders" className="m-0 p-6">
          <div className="text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            No pending orders.
          </div>
        </TabsContent>

        <TabsContent value="executions" className="m-0 p-0">
          <TerminalExecutionLog />
        </TabsContent>

        <TabsContent value="best-exec" className="m-0 p-0">
          <BestExecutionTab />
        </TabsContent>


        <TabsContent value="account" className="m-0 p-4">
          {!connected || !liveAccount ? (
            <div className="text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
              MT5 account not connected.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Login", `#${liveAccount.login}`],
                ["Server", liveAccount.server || "—"],
                ["Currency", liveAccount.currency || "USD"],
                ["Leverage", liveAccount.leverage ? `1:${liveAccount.leverage}` : "—"],
                ["Balance", fmtMoney(liveAccount.balance, c)],
                ["Equity", fmtMoney(liveAccount.equity, c)],
                ["Margin", fmtMoney(liveAccount.margin, c)],
                ["Free Margin", fmtMoney(liveAccount.marginFree, c)],
                ["Floating P&L", fmtMoney(liveAccount.profit, c)],
                ["Open Positions", String(liveAccount.openPositionsCount)],
                ["Status", liveAccount.status],
                [
                  "Last Sync",
                  liveAccount.lastSynced
                    ? new Date(liveAccount.lastSynced).toLocaleTimeString()
                    : "—",
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="rounded border border-neutral-800/80 bg-[#0a0a0a] px-3 py-2"
                >
                  <div className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
                    {k}
                  </div>
                  <div className="font-mono text-[12px] font-bold tabular-nums text-neutral-100 mt-0.5">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>



        <TabsContent value="journal" className="m-0 p-3">
          <TradeJournal />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DashboardInner = () => {
  const { t } = useLanguage();
  const { symbols, setSelectedBrokerSymbol } = useBrokerSymbols();
  const { symbol: ctxSymbol, setSymbol: setCtxSymbol, openTrade } = useQuickTrade();
  const [active, setActive] = useState<string>(ctxSymbol || "EURUSD");
  const [interval, setInterval] = useState("15");
  const [searchParams, setSearchParams] = useSearchParams();
  const consumedPrefillRef = useRef(false);

  // Default to first available broker symbol once loaded (only if user hasn't picked one yet)
  const userPickedRef = useRef(false);
  useEffect(() => {
    if (!symbols.length || userPickedRef.current) return;
    const pick =
      symbols.find((s) => (s.brokerSymbol || s.symbol).toUpperCase() === active.toUpperCase())
        ?.brokerSymbol ||
      symbols.find((s) => (s.brokerSymbol || s.symbol).toUpperCase() === "EURUSD")?.brokerSymbol ||
      symbols[0].brokerSymbol ||
      symbols[0].symbol;
    setActive(pick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.length]);

  const selectSymbol = (sym: string) => {
    if (!sym) return;
    userPickedRef.current = true;
    setActive(sym);
    setCtxSymbol(sym);
    setSelectedBrokerSymbol(sym);
  };

  // Apply "Take This Signal" URL params: ?symbol=&side=&lots=&entry=&sl=&tp=&signalId=
  useEffect(() => {
    if (consumedPrefillRef.current) return;
    const symbol = searchParams.get("symbol");
    if (!symbol) return;
    consumedPrefillRef.current = true;
    const sideParam = (searchParams.get("side") || "buy").toLowerCase();
    const side: "buy" | "sell" = sideParam === "sell" ? "sell" : "buy";
    const upper = symbol.toUpperCase();
    selectSymbol(upper);
    openTrade({
      symbol: upper,
      side,
      lots: searchParams.get("lots") || undefined,
      entry: searchParams.get("entry") || undefined,
      sl: searchParams.get("sl") || undefined,
      tp: searchParams.get("tp") || undefined,
      signalId: searchParams.get("signalId"),
      mentor: searchParams.get("mentor"),
      riskPct: searchParams.get("riskPct") ? Number(searchParams.get("riskPct")) : undefined,
    });
    const next = new URLSearchParams(searchParams);
    ["symbol", "side", "lots", "entry", "sl", "tp", "signalId", "mentor", "riskPct"].forEach((k) => next.delete(k));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const tvSymbol = useMemo(() => brokerToTv(active), [active]);

  // Curated Bid/Ask Board symbols: pull from broker catalog so we never show
  // a hard-coded list that doesn't exist on the connected account.
  const watchBoardSymbols = useMemo(() => {
    if (!symbols.length) return [];
    const preferred = [
      "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
      "XAUUSD", "XAGUSD",
      "US30", "NAS100", "SPX500",
      "BTCUSD", "ETHUSD",
    ];
    const upperMap = new Map(symbols.map((s) => [(s.brokerSymbol || s.symbol).toUpperCase(), s.brokerSymbol || s.symbol]));
    const out: string[] = [];
    if (active && upperMap.has(active.toUpperCase())) out.push(upperMap.get(active.toUpperCase())!);
    for (const p of preferred) {
      const match = upperMap.get(p);
      if (match && !out.includes(match)) out.push(match);
      if (out.length >= 10) break;
    }
    return out;
  }, [symbols, active]);

  // Sync active → contexts (chart + broker data fetch).
  useEffect(() => {
    setCtxSymbol(active);
    setSelectedBrokerSymbol(active);
  }, [active, setCtxSymbol, setSelectedBrokerSymbol]);

  // Mirror ctxSymbol changes (e.g. from Order Ticket dropdown) back into active.
  useEffect(() => {
    if (ctxSymbol && ctxSymbol.toUpperCase() !== active.toUpperCase()) {
      userPickedRef.current = true;
      setActive(ctxSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxSymbol]);

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-100">
      <SEO
        title={t("dash.seo.title")}
        description={t("dash.seo.desc")}
        keywords={t("dash.seo.keywords")}
        canonical="https://www.salatradingelite.com/dashboard"
      />

      <TerminalHeader />
      <TradingLayerPauseBanner />

      <div className="p-2 lg:p-3">
        <div className="grid gap-1.5 lg:gap-2 grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_310px]">
          {/* LEFT — Market Watch */}
          <MarketWatchPanel active={active} onSelect={selectSymbol} />

          {/* CENTER — Chart + Tabs */}
          <section className="flex flex-col gap-2 lg:gap-3 min-w-0">
            <div className="rounded-md border border-neutral-800/80 bg-[#0f0f0f] overflow-hidden">
              {/* Chart toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 px-3 py-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-heading text-[14px] font-bold tracking-wide text-neutral-100">
                    {active}
                  </span>
                  <span className="flex items-center gap-1.5 rounded border border-[#FFCD05]/30 bg-[#FFCD05]/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-[#FFCD05]">
                    <Activity className="h-2.5 w-2.5" /> Infinox MT5
                  </span>
                  <ChartBidAskHeader />
                </div>
                <div className="flex items-center gap-0.5 rounded border border-neutral-800 bg-[#050505] p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setInterval(tf.value)}
                      className={`rounded px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                        interval === tf.value
                          ? "bg-[#FFCD05] text-black"
                          : "text-neutral-400 hover:text-neutral-100"
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Chart canvas */}
              <div className="relative h-[60vh] lg:h-[calc(100vh-22rem)]">
                <TradingViewAdvancedIframe
                  key={`${tvSymbol}-${interval}`}
                  symbol={tvSymbol}
                  interval={interval}
                  height="100%"
                  allowSymbolChange={false}
                  hideSideToolbar={false}
                  withDateRanges={true}
                  saveImage={true}
                />
                <div className="pointer-events-none absolute top-2 left-2 flex flex-col gap-0.5 rounded-sm border border-[#FFCD05]/30 bg-black/80 px-2 py-1 text-[9px] font-mono uppercase tracking-widest backdrop-blur-sm">
                  <span className="text-[#FFCD05] font-bold">{active} · Infinox MT5</span>
                  <span className="text-neutral-400 normal-case tracking-wider">Live MT5 tick via Trading Layer</span>
                </div>
              </div>
            </div>

            {/* Bottom tabs */}
            <BottomTabs />
          </section>

          {/* RIGHT — Bid/Ask Board (top 38%) + Order Ticket (bottom).
              On small screens, panels stack naturally; never overflow the viewport. */}
          <aside className="flex flex-col gap-1.5 lg:gap-2 min-w-0 lg:min-h-0 lg:h-[calc(100vh-6.5rem)] lg:overflow-hidden">
            <div className="lg:shrink-0 lg:max-h-[38%] lg:overflow-hidden h-[320px] lg:h-auto">
              <BidAskBoard
                symbols={watchBoardSymbols}
                activeSymbol={active}
                onSelect={(label) => selectSymbol(label)}
              />
            </div>
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto pr-0.5 space-y-2">
              <LiveExecutionBanner />
              <SystemHealthWidget />
              <BlackArrowTradePanel />
            </div>

          </aside>
        </div>

        <TerminalStatusBar activeSymbol={active} />
      </div>
    </div>
  );
};

const TerminalStatusBar = ({ activeSymbol }: { activeSymbol: string }) => {
  const { connected, liveAccount } = useLiveAccount();
  const { tick } = useBrokerSymbols();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const lastTick = tick?.time || tick?.timestamp || liveAccount?.lastSynced || null;
  const lastTickStr = lastTick
    ? new Date(lastTick).toLocaleTimeString()
    : "—";
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded border border-neutral-800/80 bg-[#0a0a0a] px-3 py-1.5 text-[9.5px] font-mono uppercase tracking-widest text-neutral-400">
      <div className="flex items-center gap-4">
        <span className={`flex items-center gap-1.5 ${connected ? "text-emerald-400" : "text-red-400"}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {connected ? "Connected" : "Disconnected"}
        </span>
        <span>Trading Layer: <span className="text-neutral-200">MT5</span></span>
        <span>Symbol: <span className="text-[#FFCD05]">{activeSymbol || "—"}</span></span>
      </div>
      <div className="flex items-center gap-4">
        <span>Last Tick: <span className="text-neutral-200">{lastTickStr}</span></span>
        <span>Ping: <span className="text-neutral-200">—</span></span>
        <span>Data: <span className="text-emerald-400">Live</span></span>
        <span>Server Time: <span className="text-neutral-200">{now.toLocaleTimeString()}</span></span>
      </div>
    </div>
  );
};

const Dashboard = () => (
  <BrokerSymbolsProvider>
    <LiveAccountProvider>
      <TerminalStateProvider>
        <DashboardInner />
      </TerminalStateProvider>
    </LiveAccountProvider>
  </BrokerSymbolsProvider>
);

export default Dashboard;
