import { Wallet, TrendingUp } from "lucide-react";

/**
 * Top-bar account snapshot: equity + day P&L pill.
 * Pure presentation; placeholder values until wired to live account stats.
 */
const AccountSnapshot = () => {
  return (
    <div className="hidden md:flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/60 px-3 py-1.5">
        <Wallet className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Equity
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          $48,212.30
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10 px-3 py-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-[hsl(145_65%_50%)]" />
        <span className="font-mono text-xs font-semibold tabular-nums text-[hsl(145_65%_50%)]">
          +$2,418.50
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(145_65%_50%)]/80">
          today
        </span>
      </div>
    </div>
  );
};

export default AccountSnapshot;
