import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity } from "lucide-react";
import TradingViewAdvancedIframe from "@/components/dashboard/TradingViewAdvancedIframe";

/**
 * Real live market chart powered by TradingView Advanced Chart widget.
 * Streams actual market data (no mock). Keeps the premium yellow glowing
 * LIVE price overlay, M1 timeframe and STREAMING badge.
 */

interface Props {
  symbol?: string; // TradingView symbol e.g. "FX:EURUSD"
  displaySymbol?: string; // Pretty label e.g. "EUR/USD"
  interval?: string; // "1" | "5" | "15" | "60" ...
  height?: number;
  className?: string;
}

const BULL = "#2EC46D";
const BEAR = "#DC3545";

// Map TradingView symbol to a free FX quote endpoint (exchangerate.host — no key required)
const symbolToPair = (sym: string): { base: string; quote: string } | null => {
  const clean = sym.replace(/^[A-Z]+:/, "");
  if (clean.length < 6) return null;
  return { base: clean.slice(0, 3), quote: clean.slice(3, 6) };
};

const LiveTradingViewChart = ({
  symbol = "FX:EURUSD",
  displaySymbol = "EUR/USD",
  interval = "1",
  height = 720,
  className = "",
}: Props) => {
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [openPrice, setOpenPrice] = useState<number | null>(null);

  // Live FX price polling for the badge — uses free exchangerate.host (no API key)
  useEffect(() => {
    const pair = symbolToPair(symbol);
    if (!pair) return;

    let cancelled = false;

    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://api.exchangerate.host/latest?base=${pair.base}&symbols=${pair.quote}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        const price = json?.rates?.[pair.quote];
        if (typeof price === "number" && !cancelled) {
          setLivePrice(price);
          setOpenPrice((prev) => (prev === null ? price : prev));
        }
      } catch {
        /* swallow — UI gracefully shows last known */
      }
    };

    fetchPrice();
    const id = window.setInterval(fetchPrice, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  const change = livePrice !== null && openPrice !== null ? livePrice - openPrice : 0;
  const isUp = change >= 0;
  const liveColor = isUp ? BULL : BEAR;
  const intervalLabel =
    interval === "1" ? "M1" : interval === "5" ? "M5" : interval === "15" ? "M15" : interval === "60" ? "H1" : interval;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-2xl glass-panel holo-scanline holo-shine ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="font-heading text-sm font-semibold text-foreground tracking-wide">
              {displaySymbol}{" "}
              <span className="text-[10px] text-muted-foreground font-mono ml-1">
                {intervalLabel} · LIVE
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono text-base font-semibold text-foreground tabular-nums">
                {livePrice !== null ? livePrice.toFixed(5) : "—"}
              </span>
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: liveColor }}
              >
                {isUp ? "▲" : "▼"} {(change * 10000).toFixed(1)} pips
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Streaming
          </span>
        </div>
      </div>

      {/* Real TradingView widget */}
      <TradingViewAdvancedIframe
        symbol={symbol}
        interval={interval}
        height={height}
        allowSymbolChange={false}
        hideSideToolbar={true}
        withDateRanges={false}
        saveImage={false}
        calendar={false}
        details={false}
        hotlist={false}
        studies={[]}
      />

      {/* Premium glowing LIVE price badge — top right */}
      {livePrice !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.2 }}
          className="pointer-events-none absolute right-5 top-20 z-20 flex items-center gap-3 rounded-2xl border border-primary/40 bg-background/85 px-5 py-3 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 0 0 1px hsl(48 100% 51% / 0.08), 0 10px 40px -10px hsl(48 100% 51% / 0.45), 0 0 60px -20px hsl(48 100% 51% / 0.6)",
          }}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: liveColor }}
            />
            <span
              className="relative inline-flex h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: liveColor }}
            />
          </span>
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout">
              <motion.span
                key={livePrice}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="font-mono text-xl font-semibold tabular-nums leading-none text-foreground"
              >
                {livePrice.toFixed(5)}
              </motion.span>
            </AnimatePresence>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: liveColor }}
              >
                {isUp ? "+" : ""}
                {(change * 10000).toFixed(1)} pips
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">
                Live
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default LiveTradingViewChart;
