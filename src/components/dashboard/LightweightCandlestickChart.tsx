import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type Time,
} from "lightweight-charts";
import { Activity } from "lucide-react";

/**
 * Hedge-fund grade candlestick chart with volume sub-pane.
 * Themed to the site palette (gold accents, bull green, bear red).
 * Generates realistic-looking OHLC data and streams a new bar every ~2s
 * so the surface always feels alive without external data deps.
 */

interface Props {
  symbol?: string;
  height?: number;
  className?: string;
}

// lightweight-charts color parser requires comma-less hsl() OR hex. Using hex to be safe.
const BULL = "#2EC46D";
const BEAR = "#DC3545";
const GOLD = "#FFCD05"; // INFINOX Yellow
const GRID = "rgba(255, 255, 255, 0.04)";
const TEXT = "rgba(255, 255, 255, 0.55)";

const generateSeries = (count: number, start = 1.085) => {
  const candles: CandlestickData[] = [];
  const volumes: HistogramData[] = [];
  let lastClose = start;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < count; i++) {
    const time = (now - (count - i) * 60) as Time;
    const open = lastClose;
    const drift = (Math.random() - 0.5) * 0.0014;
    const close = +(open + drift).toFixed(5);
    const high = +Math.max(open, close, open + Math.random() * 0.0009).toFixed(5);
    const low = +Math.min(open, close, open - Math.random() * 0.0009).toFixed(5);
    candles.push({ time, open, high, low, close });
    volumes.push({
      time,
      value: 200 + Math.random() * 800,
      color: close >= open ? "rgba(46, 196, 109, 0.35)" : "rgba(220, 53, 69, 0.35)",
    });
    lastClose = close;
  }
  return { candles, volumes };
};

const LightweightCandlestickChart = ({
  symbol = "EUR/USD",
  height = 360,
  className = "",
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastCandleRef = useRef<CandlestickData | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT,
        fontFamily: "'JetBrains Mono', 'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: GOLD, width: 1, style: 3, labelBackgroundColor: GOLD },
        horzLine: { color: GOLD, width: 1, style: 3, labelBackgroundColor: GOLD },
      },
      width: containerRef.current.clientWidth,
      height,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: BULL,
      downColor: BEAR,
      wickUpColor: BULL,
      wickDownColor: BEAR,
      borderVisible: false,
      priceFormat: { type: "price", precision: 5, minMove: 0.00001 },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: BULL,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const { candles, volumes } = generateSeries(180);
    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
    lastCandleRef.current = candles[candles.length - 1];
    setLastPrice(lastCandleRef.current.close);
    setChange(lastCandleRef.current.close - candles[0].open);

    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      chart.applyOptions({ width: w });
    });
    ro.observe(containerRef.current);

    // Live tick stream
    const tickInterval = window.setInterval(() => {
      if (!candleSeriesRef.current || !lastCandleRef.current) return;
      const last = lastCandleRef.current;
      const drift = (Math.random() - 0.5) * 0.0008;
      const newClose = +(last.close + drift).toFixed(5);
      const updated: CandlestickData = {
        time: last.time,
        open: last.open,
        high: +Math.max(last.high, newClose).toFixed(5),
        low: +Math.min(last.low, newClose).toFixed(5),
        close: newClose,
      };
      lastCandleRef.current = updated;
      candleSeriesRef.current.update(updated);
      setLastPrice(newClose);
    }, 1500);

    // New bar every ~30s to avoid drift
    const newBarInterval = window.setInterval(() => {
      if (!candleSeriesRef.current || !volumeSeriesRef.current || !lastCandleRef.current) return;
      const prev = lastCandleRef.current;
      const newTime = ((prev.time as number) + 60) as Time;
      const open = prev.close;
      const close = +(open + (Math.random() - 0.5) * 0.0012).toFixed(5);
      const newCandle: CandlestickData = {
        time: newTime,
        open,
        high: +Math.max(open, close, open + Math.random() * 0.0007).toFixed(5),
        low: +Math.min(open, close, open - Math.random() * 0.0007).toFixed(5),
        close,
      };
      lastCandleRef.current = newCandle;
      candleSeriesRef.current.update(newCandle);
      volumeSeriesRef.current.update({
        time: newTime,
        value: 200 + Math.random() * 800,
        color: close >= open ? "rgba(46, 196, 109, 0.35)" : "rgba(220, 53, 69, 0.35)",
      });
    }, 30000);

    return () => {
      window.clearInterval(tickInterval);
      window.clearInterval(newBarInterval);
      ro.disconnect();
      chart.remove();
    };
  }, [height]);

  const isUp = change >= 0;

  return (
    <div className={`relative overflow-hidden rounded-2xl glass-panel ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="font-heading text-sm font-semibold text-foreground tracking-wide">
              {symbol} <span className="text-[10px] text-muted-foreground font-mono ml-1">M1 · LIVE</span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-mono text-base font-semibold text-foreground tabular-nums">
                {lastPrice?.toFixed(5) ?? "—"}
              </span>
              <span
                className="font-mono text-[11px] tabular-nums"
                style={{ color: isUp ? BULL : BEAR }}
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

      {/* Chart canvas */}
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
};

export default LightweightCandlestickChart;
