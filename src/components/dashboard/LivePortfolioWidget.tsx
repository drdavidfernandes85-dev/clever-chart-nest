import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  Activity,
  Server,
  Hash,
  Layers,
  DollarSign,
  AlertCircle,
  Plug,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface LiveData {
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  currency: string;
  leverage: number | null;
  floating_pnl: number;
  open_positions: number;
  account_number: string;
  server: string;
  status: string;
  last_synced: string | null;
}

const REFRESH_MS = 10_000;

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const AnimatedNumber = ({
  value,
  className,
  currency,
}: {
  value: number;
  className?: string;
  currency?: string;
}) => {
  const display = fmt(value, currency);
  return (
    <span className={cn("relative inline-block tabular-nums", className)}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={display}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="inline-block"
        >
          {display}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const LivePortfolioWidget = () => {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const visibleRef = useRef(true);

  const fetchLive = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data: res, error: invErr } = await supabase.functions.invoke(
        "get-live-account",
        { body: { refresh: true } },
      );
      if (invErr) throw invErr;
      if (res?.success === true) {
        setData(res.data as LiveData);
        setError(null);
      } else {
        setData(null);
        setError(res?.error ?? "Unable to load live account.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to reach the trading service.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const onVis = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) fetchLive();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => {
      if (visibleRef.current) fetchLive();
    }, REFRESH_MS);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchLive]);

  const pnl = data?.floating_pnl ?? 0;
  const pnlTone =
    pnl > 0
      ? "text-[hsl(145_65%_55%)]"
      : pnl < 0
      ? "text-red-400"
      : "text-muted-foreground";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20",
        "bg-gradient-to-br from-card/80 via-card/60 to-background/40 backdrop-blur-xl",
        "shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]",
      )}
    >
      {/* Glow accent */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative p-4 sm:p-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-foreground text-base sm:text-lg leading-tight">
                Live Portfolio
              </h2>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono">
                Auto-refresh · 10s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-[hsl(145_65%_55%)]">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={fetchLive}
              disabled={refreshing}
              className="h-8 gap-1.5 border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="text-xs">Refresh</span>
            </Button>
          </div>
        </div>

        {/* States */}
        {loading && !data && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-muted/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && !data && error && (
          <EmptyState message={error} />
        )}

        {data && (
          <>
            {/* Headline metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <Tile
                label="Balance"
                icon={<Wallet className="h-3.5 w-3.5" />}
                value={
                  <AnimatedNumber
                    value={data.balance}
                    currency={data.currency}
                    className="text-2xl font-bold text-foreground"
                  />
                }
              />
              <Tile
                label="Equity"
                icon={<DollarSign className="h-3.5 w-3.5" />}
                accent
                value={
                  <AnimatedNumber
                    value={data.equity}
                    currency={data.currency}
                    className="text-2xl font-bold text-primary"
                  />
                }
              />
              <Tile
                label="Floating P&L"
                icon={
                  pnl >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )
                }
                value={
                  <AnimatedNumber
                    value={pnl}
                    currency={data.currency}
                    className={cn("text-2xl font-bold", pnlTone)}
                  />
                }
              />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <Mini label="Open Positions" value={String(data.open_positions)} icon={<Layers className="h-3 w-3" />} />
              <Mini label="Free Margin" value={fmt(data.free_margin, data.currency)} />
              <Mini label="Margin" value={fmt(data.margin, data.currency)} />
              <Mini label="Currency" value={data.currency} />
              <Mini label="Server" value={data.server || "—"} icon={<Server className="h-3 w-3" />} />
              <Mini label="Account #" value={data.account_number || "—"} icon={<Hash className="h-3 w-3" />} />
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const Tile = ({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) => (
  <div
    className={cn(
      "rounded-xl border p-3.5 backdrop-blur-md",
      accent
        ? "border-primary/30 bg-primary/5"
        : "border-border/50 bg-background/40",
    )}
  >
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
      {icon}
      {label}
    </div>
    <div>{value}</div>
  </div>
);

const Mini = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) => (
  <div className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2">
    <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-mono text-muted-foreground mb-0.5">
      {icon}
      {label}
    </div>
    <div className="font-mono text-xs font-semibold text-foreground tabular-nums truncate">
      {value}
    </div>
  </div>
);

const EmptyState = ({ message }: { message: string }) => {
  const isNoAccount = /no connected/i.test(message);
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
        {isNoAccount ? <Plug className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
      </div>
      <p className="text-sm text-foreground font-medium mb-1">
        {isNoAccount ? "Connect your MT5 account to see live balance." : "Live data unavailable"}
      </p>
      {!isNoAccount && (
        <p className="text-xs text-muted-foreground mb-4 max-w-md">{message}</p>
      )}
      <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
        <Link to="/connect-mt">{isNoAccount ? "Connect Account" : "Manage Account"}</Link>
      </Button>
    </div>
  );
};

export default LivePortfolioWidget;
