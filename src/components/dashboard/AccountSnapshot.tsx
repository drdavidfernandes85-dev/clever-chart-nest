import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, TrendingUp } from "lucide-react";

/**
 * Top-bar account snapshot: equity + day P&L pill.
 * Equity ticks subtly to feel alive; values are placeholder until wired
 * to live account stats. Brand stays IX yellow; gains use semantic green.
 */
const BASE_EQUITY = 48212.3;
const DAY_PNL = 2418.5;

const AccountSnapshot = () => {
  const [equity, setEquity] = useState(BASE_EQUITY);

  useEffect(() => {
    const id = window.setInterval(() => {
      // tiny random walk for "live" feel
      setEquity((prev) => +(prev + (Math.random() - 0.5) * 6).toFixed(2));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const formatted = equity.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
      <div className="flex items-center gap-1.5 rounded-full border border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10 px-3 py-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-[hsl(145_65%_50%)]" />
        <span className="font-mono text-xs font-semibold tabular-nums text-[hsl(145_65%_50%)]">
          +${DAY_PNL.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(145_65%_50%)]/80">
          today
        </span>
      </div>
    </div>
  );
};

export default AccountSnapshot;
