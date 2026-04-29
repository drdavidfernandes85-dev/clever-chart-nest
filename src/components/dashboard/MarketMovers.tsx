import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, Loader2, Download } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  MARKET_UNIVERSE,
  fetchMarketQuotes,
  decimalsFor,
  type MarketSymbol,
} from "@/lib/markets";
import { toCSV, downloadCSV } from "@/lib/csv";
import { toast } from "sonner";

interface Mover {
  symbol: string;
  price: number;
  changePct: number;
  asset: MarketSymbol;
  volume?: string;
}

const MoverList = ({
  title,
  rows,
  variant,
  showVolume = false,
}: {
  title: string;
  rows: Mover[];
  variant: "gainers" | "losers" | "active";
  showVolume?: boolean;
}) => {
  const { t } = useLanguage();
  const Icon =
    variant === "gainers" ? TrendingUp : variant === "losers" ? TrendingDown : Activity;
  const accent =
    variant === "gainers"
      ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/30"
      : variant === "losers"
      ? "text-red-400 bg-red-500/10 ring-red-500/30"
      : "text-primary bg-primary/10 ring-primary/30";

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2.5">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 ${accent}`}
          >
            <Icon className="h-2.5 w-2.5" />
          </div>
          <h3 className="font-heading text-[11px] font-semibold text-foreground tracking-wide uppercase">
            {title}
          </h3>
        </div>
        <span className="text-[8px] font-mono uppercase tracking-widest text-muted-foreground">
          24H
        </span>
      </div>
      <ul className="divide-y divide-border/20">
        {rows.length === 0 && (
          <li className="px-3.5 py-6 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
            {t("movers.loading")}
          </li>
        )}
        {rows.map((m) => {
          const up = m.changePct >= 0;
          const decimals = decimalsFor(m.asset, m.price);
          return (
            <li
              key={m.symbol}
              className="flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-muted/20 transition-colors"
            >
              <div className="min-w-0 flex items-baseline gap-2">
                <span className="font-heading text-[11px] font-semibold text-foreground">
                  {m.symbol}
                </span>
                {showVolume && m.volume && (
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {m.volume}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] tabular-nums text-foreground">
                  {m.price.toLocaleString("en-US", {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  })}
                </span>
                <span
                  className={`font-mono text-[10px] font-semibold tabular-nums ${
                    up ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {up ? "+" : ""}
                  {m.changePct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const ASSET_TABS = [
  { key: "all",    labelKey: "movers.tab.all"    as const },
  { key: "crypto", labelKey: "movers.tab.crypto" as const },
  { key: "forex",  labelKey: "movers.tab.forex"  as const },
  { key: "index",  labelKey: "movers.tab.index"  as const },
  { key: "stock",  labelKey: "movers.tab.stock"  as const },
] as const;

type TabKey = typeof ASSET_TABS[number]["key"];

const MarketMovers = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");

  // Single edge-function call returns crypto + forex + indices + stocks.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const quotes = await fetchMarketQuotes();
      if (cancelled) return;
      const next: Mover[] = quotes
        .map((q) => {
          const asset = MARKET_UNIVERSE.find((m) => m.symbol === q.symbol);
          if (!asset || q.price == null || q.changePct == null) return null;
          if (!Number.isFinite(q.price)) return null;
          return {
            symbol: q.symbol,
            asset,
            price: q.price,
            changePct: q.changePct,
            volume: q.volume,
          };
        })
        .filter(Boolean) as Mover[];
      setData(next);
      setLoading(false);
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const filtered = useMemo(
    () => (tab === "all" ? data : data.filter((d) => d.asset.assetClass === tab)),
    [data, tab],
  );

  const gainers = useMemo(
    () => [...filtered].sort((a, b) => b.changePct - a.changePct).slice(0, 4),
    [filtered],
  );
  const losers = useMemo(
    () => [...filtered].sort((a, b) => a.changePct - b.changePct).slice(0, 4),
    [filtered],
  );
  const mostActive = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
        .slice(0, 4),
    [filtered],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      aria-labelledby="market-movers-heading"
      className="p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h2
          id="market-movers-heading"
          className="font-heading text-sm font-semibold text-foreground tracking-wide"
        >
          {t("movers.title")}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-0.5 rounded-full border border-border/40 bg-muted/30 p-0.5">
            {ASSET_TABS.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${
                  tab === tb.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(tb.labelKey)}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {loading ? t("movers.loading") : t("movers.live")}
          </span>
          <button
            onClick={() => {
              if (!filtered.length) {
                toast.error("No data to export yet");
                return;
              }
              const rows = filtered.map((d) => ({
                symbol: d.symbol,
                asset_class: d.asset.assetClass,
                price: d.price.toFixed(decimalsFor(d.asset, d.price)),
                change_pct: d.changePct.toFixed(2),
                volume: d.volume ?? "",
              }));
              downloadCSV(
                `market-movers-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
                toCSV(rows, [
                  { key: "symbol", label: "Symbol" },
                  { key: "asset_class", label: "Asset Class" },
                  { key: "price", label: "Price" },
                  { key: "change_pct", label: "Change %" },
                  { key: "volume", label: "Volume" },
                ]),
              );
              toast.success(`Exported ${rows.length} rows`);
            }}
            title="Export to CSV"
            className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <MoverList title={t("movers.gainers")} rows={gainers} variant="gainers" />
        <MoverList title={t("movers.losers")} rows={losers} variant="losers" />
        <MoverList title={t("movers.active")} rows={mostActive} variant="active" showVolume />
      </div>
    </motion.section>
  );
};

export default MarketMovers;
