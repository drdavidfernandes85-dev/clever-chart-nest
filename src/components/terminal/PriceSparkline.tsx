/**
 * PriceSparkline — tiny SVG line chart of the last N bid/ask mids for a symbol.
 *
 * Reads from the SAME live tick stream the rest of the terminal uses
 * (`useMultiSymbolTicks`). Never opens a separate data source. When fewer than
 * 2 ticks have been buffered yet, renders "esperando datos…" instead of a fake
 * line.
 */
import { useEffect, useRef, useState } from "react";
import { useMultiSymbolTicks } from "@/hooks/useMultiSymbolTicks";

interface Props {
  symbol: string;
  maxPoints?: number;
  width?: number;
  height?: number;
}

export default function PriceSparkline({ symbol, maxPoints = 60, width = 220, height = 64 }: Props) {
  const ticks = useMultiSymbolTicks([symbol]);
  const t = ticks[symbol];
  const bufRef = useRef<number[]>([]);
  const [, force] = useState(0);

  useEffect(() => {
    const mid =
      t?.bid != null && t?.ask != null
        ? (t.bid + t.ask) / 2
        : t?.bid ?? t?.ask ?? null;
    if (mid == null || !Number.isFinite(mid)) return;
    const buf = bufRef.current;
    if (buf.length === 0 || buf[buf.length - 1] !== mid) {
      buf.push(mid);
      if (buf.length > maxPoints) buf.splice(0, buf.length - maxPoints);
      force((n) => n + 1);
    }
  }, [t?.bid, t?.ask, maxPoints]);

  // Reset buffer when symbol changes
  useEffect(() => {
    bufRef.current = [];
    force((n) => n + 1);
  }, [symbol]);

  const data = bufRef.current;
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[10px] uppercase tracking-widest text-neutral-600"
        style={{ width, height }}
      >
        esperando datos…
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = data[data.length - 1];
  const first = data[0];
  const up = last >= first;
  const stroke = up ? "#17C784" : "#F04E4E";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} points={points} />
      <circle
        cx={(data.length - 1) * step}
        cy={height - ((last - min) / span) * (height - 4) - 2}
        r={2}
        fill={stroke}
      />
    </svg>
  );
}
