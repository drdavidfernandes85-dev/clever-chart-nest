import { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle } from "lucide-react";

interface Exposure {
  symbol: string;
  riskPct: number; // % of equity at risk on this position
}

const POSITIONS_RISK: Exposure[] = [
  { symbol: "EUR/USD", riskPct: 0.6 },
  { symbol: "XAU/USD", riskPct: 0.8 },
  { symbol: "GBP/JPY", riskPct: 0.4 },
];

const RiskMeter = () => {
  const total = useMemo(
    () => POSITIONS_RISK.reduce((acc, p) => acc + p.riskPct, 0),
    []
  );

  // Risk levels: <2% safe, 2-5% moderate, >5% high
  const level: "safe" | "moderate" | "high" =
    total < 2 ? "safe" : total < 5 ? "moderate" : "high";

  const color =
    level === "safe"
      ? "hsl(160 84% 50%)"
      : level === "moderate"
      ? "hsl(48 100% 51%)"
      : "hsl(0 84% 60%)";

  const label =
    level === "safe" ? "Safe" : level === "moderate" ? "Moderate" : "High Risk";

  // Gauge: 0..10% scale
  const max = 10;
  const pct = Math.min(100, (total / max) * 100);

  // Arc geometry
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Half-circle arc: 180 deg from left to right
  const circ = Math.PI * radius;
  const dash = (pct / 100) * circ;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg ring-1"
            style={{
              backgroundColor: `${color.replace(")", " / 0.12)")}`,
              color,
              boxShadow: `inset 0 0 0 1px ${color.replace(")", " / 0.3)")}`,
            }}
          >
            <Shield className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Risk Exposure
          </h3>
        </div>
        <span
          className="text-[9px] font-mono uppercase tracking-widest font-bold"
          style={{ color }}
        >
          {label}
        </span>
      </div>

      <div className="px-5 py-5 flex items-center gap-5">
        {/* Half-circle gauge */}
        <div className="relative shrink-0" style={{ width: size, height: size / 2 + 6 }}>
          <svg
            width={size}
            height={size / 2 + 6}
            viewBox={`0 0 ${size} ${size / 2 + 6}`}
            className="overflow-visible"
            aria-hidden
          >
            {/* Track */}
            <path
              d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
              fill="none"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              strokeWidth={stroke}
              strokeLinecap="round"
            />
            {/* Value arc */}
            <path
              d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{
                filter: `drop-shadow(0 0 8px ${color.replace(")", " / 0.6)")})`,
                transition: "stroke-dasharray 0.6s ease-out",
              }}
            />
          </svg>
          {/* Center value */}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col items-center"
            style={{ top: cy - 18 }}
          >
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{ color, textShadow: `0 0 16px ${color.replace(")", " / 0.4)")}` }}
            >
              {total.toFixed(1)}%
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              Of Equity
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            {POSITIONS_RISK.length} positions
          </div>
          <ul className="space-y-1.5">
            {POSITIONS_RISK.map((p) => (
              <li key={p.symbol} className="flex items-center justify-between gap-2">
                <span className="font-heading text-[11px] font-semibold text-foreground truncate">
                  {p.symbol}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative h-1 w-16 sm:w-20 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.min(100, (p.riskPct / 2) * 100)}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 6px ${color.replace(")", " / 0.6)")}`,
                      }}
                    />
                  </div>
                  <span
                    className="font-mono text-[10px] tabular-nums w-10 text-right"
                    style={{ color }}
                  >
                    {p.riskPct.toFixed(2)}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {level === "high" && (
            <div className="flex items-center gap-1.5 mt-2 rounded-md bg-red-500/10 ring-1 ring-red-500/30 px-2 py-1">
              <AlertTriangle className="h-3 w-3 text-red-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-red-400">
                Reduce exposure
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RiskMeter;
