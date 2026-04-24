import { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, AlertTriangle, Plug } from "lucide-react";
import { Link } from "react-router-dom";
import { useMTAccount } from "@/hooks/useMTAccount";

interface Exposure {
  symbol: string;
  riskPct: number;
  riskUsd: number;
}

const RiskMeter = () => {
  const { account, positions } = useMTAccount();
  const isConnected = !!account && account.status === "connected";

  const ACCOUNT_EQUITY = isConnected && account?.equity ? Number(account.equity) : 0;

  // Real risk derived from MT positions only (distance from open to SL × volume × pip value).
  // No mocks — empty array when no positions are open.
  const POSITIONS_RISK: Exposure[] = useMemo(() => {
    if (!isConnected || positions.length === 0) return [];
    return positions.map((p) => {
      const open = Number(p.open_price);
      const sl = p.stop_loss != null ? Number(p.stop_loss) : open * (p.side === "buy" ? 0.99 : 1.01);
      const distance = Math.abs(open - sl);
      const pipMult = p.symbol.includes("JPY") ? 100 : p.symbol.includes("XAU") ? 1 : 10000;
      const pips = distance * pipMult;
      const pipValue = p.symbol.includes("XAU") ? 100 : 10;
      const riskUsd = pips * pipValue * Number(p.volume);
      const riskPct = ACCOUNT_EQUITY > 0 ? (riskUsd / ACCOUNT_EQUITY) * 100 : 0;
      return { symbol: p.symbol, riskUsd, riskPct };
    });
  }, [isConnected, positions, ACCOUNT_EQUITY]);

  const total = useMemo(
    () => POSITIONS_RISK.reduce((acc, p) => acc + p.riskPct, 0),
    [POSITIONS_RISK],
  );
  const totalUsd = useMemo(
    () => POSITIONS_RISK.reduce((acc, p) => acc + p.riskUsd, 0),
    [POSITIONS_RISK],
  );


  // Updated thresholds: <1.5 safe, 1.5-3 moderate, >3 high
  const level: "safe" | "moderate" | "high" =
    total < 1.5 ? "safe" : total <= 3 ? "moderate" : "high";

  const color =
    level === "safe"
      ? "hsl(160 84% 50%)"
      : level === "moderate"
      ? "hsl(48 100% 51%)"
      : "hsl(0 84% 60%)";

  const label =
    level === "safe" ? "Conservative" : level === "moderate" ? "Moderate" : "High Risk";

  // Gauge: 0..6% scale (more sensitive)
  const max = 6;
  const pct = Math.min(100, (total / max) * 100);

  // Full circular gauge geometry
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const fullCirc = 2 * Math.PI * radius;
  // 270 deg arc (starts at -135deg)
  const arcLen = fullCirc * 0.75;
  const dash = (pct / 100) * arcLen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="rounded-2xl card-glass holo-scanline overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
            Risk Exposure
          </h3>
        </div>
        <span
          className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ring-1"
          style={{
            color,
            borderColor: color.replace(")", " / 0.4)"),
            backgroundColor: color.replace(")", " / 0.1)"),
          }}
        >
          {label}
        </span>
      </div>

      <div className="px-5 py-6 flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Circular gauge */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible -rotate-[135deg]"
            aria-hidden
          >
            {/* Track */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} ${fullCirc}`}
            />
            {/* Value arc */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${fullCirc}`}
              style={{
                filter: `drop-shadow(0 0 10px ${color.replace(")", " / 0.7)")})`,
                transition: "stroke-dasharray 0.7s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </svg>
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
              Total Risk
            </span>
            <span
              className="font-mono text-3xl font-bold tabular-nums leading-none mt-0.5"
              style={{
                color,
                textShadow: `0 0 18px ${color.replace(")", " / 0.5)")}`,
              }}
            >
              {total.toFixed(1)}%
            </span>
            <span className="text-[10px] font-mono text-muted-foreground mt-1">
              ${totalUsd.toFixed(0)} max
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex-1 min-w-0 w-full space-y-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {POSITIONS_RISK.length} positions
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              of ${ACCOUNT_EQUITY.toLocaleString()} equity
            </span>
          </div>
          <ul className="space-y-2">
            {POSITIONS_RISK.map((p) => {
              const pColor =
                p.riskPct < 1.5
                  ? "hsl(160 84% 50%)"
                  : p.riskPct <= 3
                  ? "hsl(48 100% 51%)"
                  : "hsl(0 84% 60%)";
              return (
                <li key={p.symbol} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-[11px] font-semibold text-foreground">
                      {p.symbol}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        ${p.riskUsd.toFixed(0)}
                      </span>
                      <span
                        className="font-mono text-[11px] font-bold tabular-nums w-12 text-right"
                        style={{ color: pColor }}
                      >
                        {p.riskPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.min(100, (p.riskPct / 3) * 100)}%`,
                        backgroundColor: pColor,
                        boxShadow: `0 0 8px ${pColor.replace(")", " / 0.7)")}`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Status banner */}
          <div
            className={`flex items-center gap-2 mt-3 rounded-lg px-3 py-2 ring-1`}
            style={{
              backgroundColor: color.replace(")", " / 0.08)"),
              borderColor: color.replace(")", " / 0.3)"),
            }}
          >
            {level === "high" ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color }} />
            ) : (
              <Shield className="h-3.5 w-3.5 shrink-0" style={{ color }} />
            )}
            <span
              className="text-[11px] font-mono tracking-wide"
              style={{ color }}
            >
              {level === "high"
                ? "Above target — consider reducing exposure"
                : level === "moderate"
                ? "Within healthy range"
                : "Well within risk budget"}
            </span>
          </div>

          {!isConnected && (
            <Link
              to="/connect-mt"
              className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
            >
              <Plug className="h-3 w-3" />
              Connect MT4/5 for real-time risk
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RiskMeter;
