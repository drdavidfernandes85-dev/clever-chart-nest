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
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { useBrokerSymbols, type BrokerSymbol } from "@/contexts/BrokerSymbolsContext";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";

interface Props {
  onSelectSymbol?: (symbol: string) => void;
}

const STALE_MS = 10_000;
const FLASH_MS = 450;

function fmtPrice(n: number | null, digits: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(digits ?? 5);
}

function fmtSpread(bid: number | null, ask: number | null, digits: number | null): string {
  if (bid == null || ask == null) return "—";
  const d = digits ?? 5;
  const pipSize = d >= 5 ? 0.0001 : d >= 3 ? 0.01 : 1;
  return ((ask - bid) / pipSize).toFixed(1);
}

/** Normalize a raw broker path/category/symbol → Spanish bucket label. */
function classifyAsset(sym: BrokerSymbol): string {
  const raw = (sym.assetClass || "").toLowerCase();
  const s = sym.symbol.toUpperCase();
  if (raw.includes("forex") || /^(EUR|GBP|USD|JPY|AUD|NZD|CAD|CHF|MXN|BRL)/.test(s) && s.length === 6) return "Forex";
  if (raw.includes("metal") || /^X(AU|AG|PT|PD)/.test(s)) return "Metales";
  if (raw.includes("crypto") || /(BTC|ETH|XRP|LTC|SOL|ADA|DOGE)/.test(s)) return "Cripto";
  if (raw.includes("indic") || raw.includes("index") || /(US30|NAS100|SPX500|GER|UK100|JP225|HK50|AUS200)/.test(s)) return "Índices";
  if (raw.includes("comm") || raw.includes("energ") || raw.includes("oil") || /(WTI|BRENT|NGAS|XBR|XTI)/.test(s)) return "Materias primas";
  if (raw.includes("stock") || raw.includes("equit") || raw.includes("share")) return "Acciones";
  return "Otros";
}

const GROUP_ORDER = ["Forex", "Índices", "Materias primas", "Metales", "Cripto", "Acciones", "Otros"];

interface TickMeta {
  flash: "up" | "down" | null;
  stale: boolean;
}

function useTickFeedback(
  symbols: string[],
  ticks: Record<string, { bid: number | null; ask: number | null }>,
): Record<string, TickMeta> {
  const prevPrice = useRef<Record<string, number>>({});
  const lastUpdate = useRef<Record<string, number>>({});
  const [meta, setMeta] = useState<Record<string, TickMeta>>({});

  // Detect price changes → flash + timestamp
  useEffect(() => {
    const next: Record<string, TickMeta> = { ...meta };
    let changed = false;
    for (const sym of symbols) {
      const t = ticks[sym];
      const mid =
        t?.bid != null && t?.ask != null ? (t.bid + t.ask) / 2 : t?.bid ?? t?.ask ?? null;
      if (mid == null) continue;
      const prev = prevPrice.current[sym];
      if (prev !== undefined && prev !== mid) {
        const dir = mid > prev ? "up" : "down";
        next[sym] = { flash: dir, stale: false };
        changed = true;
        // Clear flash after FLASH_MS
        setTimeout(() => {
          setMeta((m) => (m[sym]?.flash ? { ...m, [sym]: { ...m[sym], flash: null } } : m));
        }, FLASH_MS);
      }
      if (prev === undefined || prev !== mid) {
        prevPrice.current[sym] = mid;
        lastUpdate.current[sym] = Date.now();
      }
    }
    if (changed) setMeta(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticks, symbols.join(",")]);

  // Stale watchdog — re-evaluate every 2s
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setMeta((prev) => {
        let mutated = false;
        const next = { ...prev };
        for (const sym of symbols) {
          const last = lastUpdate.current[sym];
          const isStale = last != null && now - last > STALE_MS;
          const cur = next[sym] ?? { flash: null, stale: false };
          if (cur.stale !== isStale) {
            next[sym] = { ...cur, stale: isStale };
            mutated = true;
          }
        }
        return mutated ? next : prev;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [symbols.join(",")]);

  return meta;
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
  const tickMeta = useTickFeedback(symbols, ticks);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) searchRef.current?.focus();
  }, [adding]);

  // Build lookup: symbol → catalog entry → group
  const catalogBySymbol = useMemo(() => {
    const m = new Map<string, BrokerSymbol>();
    for (const s of catalog) m.set(s.symbol.toUpperCase(), s);
    return m;
  }, [catalog]);

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const sym of symbols) {
      const meta = catalogBySymbol.get(sym) ?? ({ symbol: sym, assetClass: null } as BrokerSymbol);
      const g = classifyAsset(meta);
      (groups[g] ||= []).push(sym);
    }
    return GROUP_ORDER.filter((g) => groups[g]?.length).map((g) => ({ name: g, items: groups[g] }));
  }, [symbols, catalogBySymbol]);

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
          title="Añadir símbolo"
        >
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
      </div>

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
          grouped.map((group) => {
            const isCollapsed = collapsed[group.name] === true;
            return (
              <div key={group.name}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.name]: !isCollapsed }))
                  }
                  className="flex w-full items-center gap-1 bg-[#0e0e10] px-2 py-1 border-b border-neutral-800/80 text-left hover:bg-neutral-900/60"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-2.5 w-2.5 text-neutral-500" />
                  ) : (
                    <ChevronDown className="h-2.5 w-2.5 text-neutral-500" />
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    {group.name}
                  </span>
                  <span className="text-[9px] font-mono text-neutral-600 ml-1">
                    {group.items.length}
                  </span>
                </button>
                {!isCollapsed &&
                  group.items.map((sym) => {
                    const t = ticks[sym];
                    const isActive = selectedBrokerSymbol.toUpperCase() === sym;
                    const bid = t?.bid ?? null;
                    const ask = t?.ask ?? null;
                    const digits = t?.digits ?? null;
                    const changePct = t?.changePct ?? null;
                    const isUp = (changePct ?? 0) >= 0;
                    const meta = tickMeta[sym];
                    const flashCls =
                      meta?.flash === "up"
                        ? "bg-emerald-500/15"
                        : meta?.flash === "down"
                          ? "bg-red-500/15"
                          : "";

                    return (
                      <div
                        key={sym}
                        className={`group flex items-center gap-1 border-b border-neutral-800/60 px-2 py-[5px] transition-colors cursor-pointer ${
                          isActive
                            ? "bg-[#FFCD05]/8 border-l-2 border-l-[#FFCD05]"
                            : "border-l-2 border-l-transparent hover:bg-neutral-800/40"
                        } ${flashCls}`}
                        onClick={() => handleSelect(sym)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(sym);
                          }}
                          className="opacity-0 group-hover:opacity-100 inline-flex h-4 w-4 items-center justify-center rounded text-neutral-600 hover:text-red-400 transition-all shrink-0"
                          title="Quitar"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span
                              className={`font-mono text-[11px] font-semibold truncate ${
                                isActive ? "text-[#FFCD05]" : "text-neutral-200"
                              }`}
                            >
                              {sym}
                            </span>
                            {meta?.stale && (
                              <span
                                title="Sin actualizaciones del feed por más de 10 segundos"
                                className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 text-[8px] uppercase text-amber-400"
                              >
                                <AlertCircle className="h-2 w-2" />
                                Sin señal
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] font-mono tabular-nums ${meta?.stale ? "text-neutral-600" : "text-neutral-500"}`}
                          >
                            B:{fmtPrice(bid, digits)} A:{fmtPrice(ask, digits)}
                          </span>
                        </div>

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
                  })}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-800 bg-[#0a0a0a] px-2 py-[3px] text-[8px] font-mono uppercase tracking-[0.18em] text-neutral-600 text-center">
        Live · Trading Layer
      </div>
    </div>
  );
}
