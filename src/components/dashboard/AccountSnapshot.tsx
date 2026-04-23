import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, TrendingUp, Plug } from "lucide-react";
import { Link } from "react-router-dom";
import { useMTAccount } from "@/hooks/useMTAccount";

/**
 * Top-bar account snapshot. Shows real equity + day P&L delta from the
 * latest MT snapshots. When no MT account is connected, shows a compact
 * "Connect MT" call-to-action — no mock data.
 */
const AccountSnapshot = () => {
  const { account, snapshots } = useMTAccount();
  const isConnected =
    !!account && account.status === "connected" && account.equity != null;

  const [equity, setEquity] = useState<number>(
    isConnected ? Number(account!.equity) : 0,
  );

  useEffect(() => {
    if (isConnected) setEquity(Number(account!.equity));
  }, [isConnected, account]);

  const dayPnl = (() => {
    if (!isConnected) return 0;
    if (snapshots.length === 0) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const todays = snapshots.filter((s) => s.recorded_at.startsWith(today));
    const baseline = (todays[0] ?? snapshots[0]).equity;
    return Number(account!.equity) - Number(baseline);
  })();

  if (!isConnected) {
    return (
      <Link
        to="/connect-mt"
        className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors"
      >
        <Plug className="h-3.5 w-3.5" />
        Connect MT4/5
      </Link>
    );
  }

  const formatted = equity.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const positivePnl = dayPnl >= 0;

  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5">
        <Wallet className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Equity
        </span>
        <span className="relative font-mono text-xs font-semibold tabular-nums text-foreground min-w-[72px] text-right inline-block">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={formatted}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="inline-block"
            >
              ${formatted}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${
          positivePnl
            ? "border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10"
            : "border-red-500/30 bg-red-500/10"
        }`}
      >
        <TrendingUp
          className={`h-3.5 w-3.5 ${
            positivePnl ? "text-[hsl(145_65%_50%)]" : "text-red-400 rotate-180"
          }`}
        />
        <span
          className={`font-mono text-xs font-semibold tabular-nums ${
            positivePnl ? "text-[hsl(145_65%_50%)]" : "text-red-400"
          }`}
        >
          {positivePnl ? "+" : "−"}$
          {Math.abs(dayPnl).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${
            positivePnl ? "text-[hsl(145_65%_50%)]/80" : "text-red-400/80"
          }`}
        >
          today
        </span>
      </div>
    </div>
  );
};

export default AccountSnapshot;
