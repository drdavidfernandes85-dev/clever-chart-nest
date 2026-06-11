import { useState, useMemo, useRef, useEffect } from "react";
import {
  Eye,
  Plus,
  X,
  Search,
  Star,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useBrokerSymbols, type BrokerSymbol } from "@/contexts/BrokerSymbolsContext";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";

interface Props {
  onSelectSymbol?: (symbol: string) => void;
}

function fmtPrice(n: number | null, digits: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  const d = digits ?? 5;
  return n.toFixed(d);
}

function fmtSpread(bid: number | null, ask: number | null, digits: number | null): string {
  if (bid == null || ask == null) return "—";
  const raw = ask - bid;
  const d = digits ?? 5;
  // For forex show in pips (1 pip = 0.0001 for 5-digit, 0.01 for 3-digit)
  const pipSize = d >= 5 ? 0.0001 : d >= 3 ? 0.01 : 1;
  const pips = raw / pipSize;
  return pips.toFixed(1);
}

export default function TerminalWatchlist({ onSelectSymbol }: Props) {
  const { favorites, loading: favLoading, remove, add } = useFavorites();
  const {
    symbols: catalog,
    setSelectedBrokerSymbol,
    selectedBrokerSymbol,
    loading: catalogLoading,
  } = useBrokerSymbols();

  const symbols = useMemo(
    () => favorites.map((f) => f.symbol.toUpperCase()),
    [favorites],
  );
  const ticks = useMultiSymbolTicks(symbols);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) searchRef.current?.focus();
  }, [adding]);

  const available = useMemo(() => {
    const owned = new Set(symbols);
    const q = query.trim().toUpperCase();
    return catalog
      .filter((s) => {
        if (owned.has(s.symbol.toUpperCase())) return false;
        if (!q) return true;
        const sym = s.symbol.toUpperCase();
        const name = (s.displayName || "").toUpperCase();
        const desc = (s.description || "").toUpperCase();
        return sym.includes(q) || name.includes(q) || desc.includes(q);
      })
      .slice(0, 40);
  }, [catalog, symbols, query]);

  const handleSelect = (symbol: string) => {
    setSelectedBrokerSymbol(symbol);
    onSelectSymbol?.(symbol);
  };

  const handleAdd = (sym: BrokerSymbol) => {
    add({
      symbol: sym.symbol,
      display_name: sym.displayName || sym.symbol,
      description: sym.description,
      category: sym.assetClass,
    });
    setQuery("");
    setAdding(false);
  };

  const handleRemove = (sym: string) => {
    remove(sym);
  };

  const loading = favLoading || catalogLoading;

  return (
    <div className="flex h-full flex-col bg-[#111214]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-[#FFCD05]" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-200">
            Watchlist
          </span>
          <span className="text-[9px] font-mono text-neutral-500">{symbols.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-neutral-500 hover:text-[#FFCD05] hover:bg-[#FFCD05]/10 transition-colors"
          title="Add symbol"
        >
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>

      {/* Add / Search */}
      {adding && (
        <div className="border-b border-neutral-800 px-2 py-1.5 shrink-0">
          <div className="flex items-center gap-1.5 rounded bg-neutral-900 px-1.5 py-1">
            <Search className="h-3 w-3 text-neutral-500 shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar símbolo…"
              className="w-full bg-transparent text-[11px] text-neutral-200 placeholder:text-neutral-600 outline-none"
            />
          </div>
          <div className="mt-1 max-h-40 overflow-y-auto">
            {available.length === 0 ? (
              <div className="px-1 py-2 text-center text-[10px] text-neutral-500">
                {query ? "Sin coincidencias" : "Escribe para buscar…"}
              </div>
            ) : (
              available.map((sym) => (
                <button
                  key={sym.symbol}
                  type="button"
                  onClick={() => handleAdd(sym)}
                  className="flex w-full items-center justify-between gap-2 px-1 py-1 text-left hover:bg-neutral-800/60 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px] font-semibold text-neutral-200">
                      {sym.symbol}
                    </span>
                    <span className="text-[9px] text-neutral-500 truncate max-w-[140px]">
                      {sym.displayName || sym.description || sym.assetClass || ""}
                    </span>
                  </div>
                  <Plus className="h-3 w-3 text-neutral-500" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && symbols.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[10px] uppercase tracking-wider">Cargando…</span>
          </div>
        ) : symbols.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-3 text-center text-neutral-500">
            <Star className="h-4 w-4 opacity-40" />
            <span className="text-[10px] uppercase tracking-wider">
              Tu watchlist está vacía
            </span>
            <span className="text-[10px] text-neutral-600">
              Pulsa + para añadir símbolos del bróker
            </span>
          </div>
        ) : (
          symbols.map((sym) => {
            const t = ticks[sym];
            const isActive =
              selectedBrokerSymbol.toUpperCase() === sym;
            const bid = t?.bid ?? null;
            const ask = t?.ask ?? null;
            const digits = t?.digits ?? null;
            const changePct = t?.changePct ?? null;
            const isUp = (changePct ?? 0) >= 0;

            return (
              <div
                key={sym}
                className={`group flex items-center gap-1 border-b border-neutral-800/60 px-2 py-[5px] transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#FFCD05]/8 border-l-2 border-l-[#FFCD05]"
                    : "border-l-2 border-l-transparent hover:bg-neutral-800/40"
                }`}
                onClick={() => handleSelect(sym)}
              >
                {/* Star / Remove */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(sym);
                  }}
                  className="opacity-0 group-hover:opacity-100 inline-flex h-4 w-4 items-center justify-center rounded text-neutral-600 hover:text-red-400 transition-all shrink-0"
                  title="Remove"
                >
                  <X className="h-2.5 w-2.5" />
                </button>

                {/* Symbol */}
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className={`font-mono text-[11px] font-semibold truncate ${
                      isActive ? "text-[#FFCD05]" : "text-neutral-200"
                    }`}
                  >
                    {sym}
                  </span>
                  <span className="text-[9px] text-neutral-500 font-mono tabular-nums">
                    B:{fmtPrice(bid, digits)} A:{fmtPrice(ask, digits)}
                  </span>
                </div>

                {/* Right column: spread + change */}
                <div className="flex flex-col items-end shrink-0 ml-auto">
                  <span className="text-[9px] font-mono text-neutral-500 tabular-nums">
                    Spr {fmtSpread(bid, ask, digits)}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-[9px] font-mono tabular-nums ${
                      changePct == null
                        ? "text-neutral-600"
                        : isUp
                          ? "text-emerald-400"
                          : "text-red-400"
                    }`}
                  >
                    {changePct != null ? (
                      <>
                        {isUp ? (
                          <TrendingUp className="h-2 w-2" />
                        ) : (
                          <TrendingDown className="h-2 w-2" />
                        )}
                        {isUp ? "+" : ""}
                        {changePct.toFixed(2)}%
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-neutral-800 bg-[#0a0a0a] px-2 py-[3px] text-[8px] font-mono uppercase tracking-[0.18em] text-neutral-600 text-center">
        Live · Trading Layer
      </div>
    </div>
  );
}
