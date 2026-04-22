import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";

/**
 * Order Book / Market Depth — left-rail pro panel.
 * Illustrative depth ladder with live-feeling tick updates.
 */

type Row = { price: number; size: number };

const seedRows = (mid: number, side: "bid" | "ask"): Row[] =>
  Array.from({ length: 9 }, (_, i) => {
    const step = (i + 1) * 0.00012;
    const price = side === "bid" ? mid - step : mid + step;
    return { price, size: Math.round(80 + Math.random() * 920) };
  });

const OrderBook = () => {
  const [mid, setMid] = useState(1.09608);
  const [bids, setBids] = useState<Row[]>(() => seedRows(1.09608, "bid"));
  const [asks, setAsks] = useState<Row[]>(() => seedRows(1.09608, "ask"));

  useEffect(() => {
    const t = setInterval(() => {
      setMid((m) => +(m + (Math.random() - 0.5) * 0.00018).toFixed(5));
      setBids((rows) =>
        rows.map((r) => ({ ...r, size: Math.max(40, r.size + Math.round((Math.random() - 0.5) * 60)) })),
      );
      setAsks((rows) =>
        rows.map((r) => ({ ...r, size: Math.max(40, r.size + Math.round((Math.random() - 0.5) * 60)) })),
      );
    }, 1400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setBids(seedRows(mid, "bid"));
    setAsks(seedRows(mid, "ask"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxSize = Math.max(...bids.map((b) => b.size), ...asks.map((a) => a.size));

  return (
    <div className="rounded-2xl border border-primary/25 bg-card/70 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Order Book
          </h3>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">EUR/USD · L2</span>
      </div>

      {/* Asks — descending from top */}
      <ul className="px-2 py-1.5">
        {asks.slice().reverse().map((a, i) => {
          const w = (a.size / maxSize) * 100;
          return (
            <li key={`a-${i}`} className="relative grid grid-cols-[1fr_auto] items-center px-1.5 py-[3px]">
              <div
                className="absolute inset-y-0 right-0 bg-[hsl(0_70%_55%/0.12)]"
                style={{ width: `${w}%` }}
              />
              <span className="relative font-mono text-[10.5px] tabular-nums text-[hsl(0_70%_60%)]">
                {a.price.toFixed(5)}
              </span>
              <span className="relative font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {a.size.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Mid price */}
      <div className="border-y border-primary/30 bg-primary/5 px-3 py-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">MID</span>
        <span className="font-mono text-sm tabular-nums font-bold text-primary">{mid.toFixed(5)}</span>
      </div>

      {/* Bids */}
      <ul className="px-2 py-1.5">
        {bids.map((b, i) => {
          const w = (b.size / maxSize) * 100;
          return (
            <li key={`b-${i}`} className="relative grid grid-cols-[1fr_auto] items-center px-1.5 py-[3px]">
              <div
                className="absolute inset-y-0 right-0 bg-[hsl(145_65%_50%/0.12)]"
                style={{ width: `${w}%` }}
              />
              <span className="relative font-mono text-[10.5px] tabular-nums text-[hsl(145_65%_55%)]">
                {b.price.toFixed(5)}
              </span>
              <span className="relative font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {b.size.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default OrderBook;
