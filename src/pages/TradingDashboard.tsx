import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Activity,
  Target,
  CheckCircle2,
  Server,
  Hash,
  Zap,
  Plug,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";

// Legacy dashboard widgets — preserved on the new dashboard
import KpiStrip from "@/components/dashboard/KpiStrip";
import ForexTickerBar from "@/components/dashboard/ForexTickerBar";
import WebinarHeroBanner from "@/components/webinars/WebinarHeroBanner";
import OpenAccountBanner from "@/components/dashboard/OpenAccountBanner";
import MentorTierBanner from "@/components/social/MentorTierBanner";
import MentorTierCelebration from "@/components/social/MentorTierCelebration";
import KeywordCrossLinks from "@/components/seo/KeywordCrossLinks";
import QuickTradePanel from "@/components/dashboard/QuickTradePanel";
import PortfolioOverview from "@/components/dashboard/PortfolioOverview";
import Watchlist from "@/components/dashboard/Watchlist";
import MarketMovers from "@/components/dashboard/MarketMovers";
import RiskMeter from "@/components/dashboard/RiskMeter";
import RecentActivity from "@/components/dashboard/RecentActivity";
import { useAuth } from "@/contexts/AuthContext";
import { useMentorTierProgress } from "@/hooks/useMentorTierProgress";
import { useQuickTrade, QuickTradeProvider } from "@/contexts/QuickTradeContext";
import { LiveAccountProvider } from "@/contexts/LiveAccountContext";
import { BrokerSymbolsProvider } from "@/contexts/BrokerSymbolsContext";
import { X } from "lucide-react";

// ---------- Types ----------
interface LivePosition {
  ticket: string | null;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  entry_price: number;
  current_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  profit: number;
}

interface LiveData {
  balance: number;
  equity: number;
  margin: number;
  free_margin: number;
  currency: string;
  leverage: number | null;
  floating_pnl: number;
  open_positions: number;
  positions: LivePosition[];
  account_number: string;
  server: string;
  status: string;
  last_synced: string | null;
}

interface LiveResponse {
  success: boolean;
  error?: string;
  stage?: string;
  errorCode?:
    | "NO_MT5_ACCOUNT"
    | "MISSING_TRADER_ID"
    | "TL_CONFIG_MISSING"
    | "TL_AUTH_FAILED"
    | "TL_ACCOUNT_NOT_FOUND"
    | "TL_RATE_LIMITED"
    | "TL_SERVICE_DOWN"
    | "TL_TIMEOUT"
    | "TL_NETWORK"
    | "TL_UPSTREAM_ERROR";
  tradingLayerStatus?: number;
  retryAfter?: number | null;
  retryable?: boolean;
  data?: LiveData;
}

interface TradeIdea {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  entryFrom: number;
  entryTo: number;
  stopLoss: number;
  takeProfit: number;
  suggestedRisk: string;
}

interface ExecutionLog {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  classification: string | null;
  retcode_description: string | null;
  ticket: string | null;
  error_message: string | null;
}

const DEMO_TRADE_IDEAS: TradeIdea[] = [
  {
    id: "s1",
    symbol: "EURUSD",
    direction: "buy",
    entryFrom: 1.0845,
    entryTo: 1.0855,
    stopLoss: 1.082,
    takeProfit: 1.092,
    suggestedRisk: "1%",
  },
  {
    id: "s2",
    symbol: "XAUUSD",
    direction: "sell",
    entryFrom: 2348,
    entryTo: 2352,
    stopLoss: 2362,
    takeProfit: 2320,
    suggestedRisk: "0.5%",
  },
  {
    id: "s3",
    symbol: "GBPJPY",
    direction: "buy",
    entryFrom: 198.4,
    entryTo: 198.6,
    stopLoss: 197.8,
    takeProfit: 200.2,
    suggestedRisk: "1%",
  },
];

// ---------- Helpers ----------
const fmtMoney = (v: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

const fmtPrice = (v: number | null | undefined, digits = 5) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString();
  } catch {
    return "—";
  }
};

const AnimatedValue = ({
  value,
  className,
  format,
}: {
  value: number;
  className?: string;
  format: (n: number) => string;
}) => (
  <span className={cn("relative inline-block tabular-nums", className)}>
    <AnimatePresence mode="popLayout">
      <motion.span
        key={format(value)}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 6, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="inline-block"
      >
        {format(value)}
      </motion.span>
    </AnimatePresence>
  </span>
);

// ---------- Page ----------
const TradingDashboard = () => {
  const [res, setRes] = useState<LiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const visibleRef = useRef(true);
  const backoffTickRef = useRef(false);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-live-account", {
        body: { refresh: true },
      });
      if (error) throw error;
      setRes(data as LiveResponse);
      setLastUpdated(new Date());
      if (manual && (data as LiveResponse)?.success) toast.success("Dashboard refreshed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load dashboard");
      setRes({ success: false, error: e?.message || "Failed to load dashboard" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from("trade_execution_logs")
      .select("id, created_at, symbol, side, volume, status, classification, retcode_description, ticket, error_message")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs((data ?? []) as ExecutionLog[]);
  }, []);

  useEffect(() => {
    load();
    loadLogs();
    const onVis = () => {
      visibleRef.current = !document.hidden;
      if (visibleRef.current) load();
    };
    document.addEventListener("visibilitychange", onVis);
    // Poll every 30s (was 10s). Trading Layer rate-limits aggressive polling;
    // back off to 60s when the last response was 429 or upstream-error.
    const id = setInterval(() => {
      if (!visibleRef.current) return;
      const code = res?.errorCode;
      const backoff = code === "TL_RATE_LIMITED" || code === "TL_SERVICE_DOWN";
      if (backoff) {
        // Skip every other tick → effective 60s while throttled.
        backoffTickRef.current = !backoffTickRef.current;
        if (backoffTickRef.current) return;
      }
      load();
    }, 30_000);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, loadLogs, res?.errorCode]);

  const data = res?.data;
  const connected = res?.success === true && !!data;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="Trading Dashboard | IX Sala de Trading"
        description="Live trading account dashboard, risk panel, open trades and trade ideas."
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/30 bg-background/80 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl flex h-16 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-heading text-base sm:text-lg font-bold text-foreground leading-tight truncate">
                Trading Room <span className="text-primary">Dashboard</span>
              </h1>
              {connected && (
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  <Hash className="inline h-3 w-3 -mt-0.5" />
                  {data!.account_number}
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <Server className="inline h-3 w-3 -mt-0.5" />
                  {data!.server}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[hsl(145_65%_50%)]/30 bg-[hsl(145_65%_50%)]/10 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-[hsl(145_65%_55%)]">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={refreshing}
              className="gap-1.5 rounded-full border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="text-xs">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
        {/* Simplified launch panel: clear next actions before any heavy widgets.
            Always rendered (even before MT5 connects) so the user always sees
            an unambiguous path forward. */}
        <PanelActionCards connected={connected} />

        {loading && !res ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !connected ? (
          <ServiceStatusCard
            res={res}
            onRetry={() => load(true)}
            retrying={refreshing}
          />



        ) : (
          <>
            <LivePortfolioPanel data={data!} lastUpdated={lastUpdated} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <RiskPanel equity={data!.equity} currency={data!.currency} />
              <TradeIdeaCards ideas={DEMO_TRADE_IDEAS} onTaken={() => { loadLogs(); load(); }} />
            </div>
            <OpenPositionsTable positions={data!.positions} currency={data!.currency} />
            <ExecutionLogTable logs={logs} />
          </>
        )}
      </div>
    </div>
  );
};

// ---------- Launch Panel Action Cards ----------
// Reduces first-load complexity. Cards are state-aware:
// - Profile / Connect MT5 card flips its CTA based on `connected`.
// - All other cards link to the simplified launch nav destinations.
const PANEL_ACTIONS: { to: string; title: string; desc: string; primary?: boolean }[] = [
  { to: "/chatroom", title: "Continue to Trading Room", desc: "Live community, market discussion and shared ideas.", primary: true },
  { to: "/webinars", title: "Join Next Webinar", desc: "Live educational sessions and market reviews." },
  { to: "/ideas", title: "Review Market Ideas", desc: "Educational market ideas — you stay in control." },
  { to: "/dashboard", title: "Open LTR Terminal Pro", desc: "Charts, order controls and risk tools." },
];

const PanelActionCards = ({ connected }: { connected: boolean }) => (
  <section
    aria-labelledby="panel-actions-title"
    className="rounded-2xl border border-primary/20 bg-card/40 backdrop-blur-xl p-4 md:p-5"
  >
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 id="panel-actions-title" className="font-heading text-base md:text-lg font-semibold text-foreground">
        What would you like to do next?
      </h2>
      <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
        Quick actions
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {PANEL_ACTIONS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={cn(
            "group flex flex-col gap-1.5 rounded-xl border p-3.5 transition-all min-h-[96px]",
            a.primary
              ? "border-primary/40 bg-primary/10 hover:bg-primary/15 hover:border-primary/60"
              : "border-border/40 bg-background/40 hover:border-primary/30 hover:bg-primary/5",
          )}
        >
          <span className={cn("text-sm font-semibold", a.primary ? "text-primary" : "text-foreground")}>
            {a.title}
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">{a.desc}</span>
        </Link>
      ))}
      <Link
        to={connected ? "/profile" : "/connect-mt"}
        className="group flex flex-col gap-1.5 rounded-xl border border-border/40 bg-background/40 p-3.5 transition-all hover:border-primary/30 hover:bg-primary/5 min-h-[96px]"
      >
        <span className="text-sm font-semibold text-foreground">
          {connected ? "Complete Profile" : "Connect MT5 Account"}
        </span>
        <span className="text-[11px] leading-snug text-muted-foreground">
          {connected
            ? "Keep your trader profile up to date."
            : "Required for live account and trading features."}
        </span>
      </Link>
    </div>
  </section>
);


// ---------- States ----------
// ---------- Contained service-status card ----------
// Replaces the previous full-page "Dashboard unavailable" state.
// The dashboard's PanelActionCards (Education / Webinars / Community / Ideas /
// Terminal / Connect MT5) remain rendered above this card, so users always
// have a path forward even when Trading Layer or MT5 is unreachable.
const ERROR_COPY: Record<string, { title: string; body: string }> = {
  NO_MT5_ACCOUNT: {
    title: "Connect your MT5 account",
    body: "Connect your MT5 account to see your live portfolio, positions and execution history. Education, webinars, community and market ideas remain available above.",
  },
  MISSING_TRADER_ID: {
    title: "Account connection incomplete",
    body: "Your MT5 account is registered but is missing a Trading Layer identifier. Reconnect from Manage Account to finish setup.",
  },
  TL_CONFIG_MISSING: {
    title: "Trading Layer configuration missing",
    body: "An administrator needs to configure the Trading Layer API key before live trading services can come online.",
  },
  TL_AUTH_FAILED: {
    title: "Trading Layer authorization failed",
    body: "The Trading Layer API key was rejected. An administrator needs to verify the credentials.",
  },
  TL_ACCOUNT_NOT_FOUND: {
    title: "MT5 account not found in Trading Layer",
    body: "Your MT5 account is no longer linked in Trading Layer. Reconnect from Manage Account to restore live data.",
  },
  TL_RATE_LIMITED: {
    title: "Rate limited — retrying shortly",
    body: "Live trading services are throttling requests. The dashboard will automatically retry. Education, webinars, community and market ideas remain available above.",
  },
  TL_SERVICE_DOWN: {
    title: "Live trading services are temporarily unavailable",
    body: "Trading Layer is experiencing an issue on their side. The dashboard will retry automatically. Everything else remains accessible.",
  },
  TL_TIMEOUT: {
    title: "Connection timed out",
    body: "The Trading Layer connection took too long to respond. Tap Retry to try again.",
  },
  TL_NETWORK: {
    title: "Network error reaching Trading Layer",
    body: "Could not reach Trading Layer. Check your connection and retry.",
  },
  TL_UPSTREAM_ERROR: {
    title: "Live trading services are temporarily unavailable",
    body: "Trading Layer returned an unexpected response. Tap Retry to try again.",
  },
};

const ServiceStatusCard = ({
  res,
  onRetry,
  retrying,
}: {
  res: LiveResponse | null;
  onRetry: () => void;
  retrying: boolean;
}) => {
  const { devMode } = useDevMode();
  const code = res?.errorCode ?? (res?.error ? "TL_UPSTREAM_ERROR" : "NO_MT5_ACCOUNT");
  const isNoAccount = code === "NO_MT5_ACCOUNT" || code === "MISSING_TRADER_ID";
  const copy = ERROR_COPY[code] ?? ERROR_COPY.TL_UPSTREAM_ERROR;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-5 md:p-6 shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.15)]">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {isNoAccount ? <Plug className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>

          {devMode && (
            <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3 font-mono text-[11px] text-muted-foreground/80 space-y-0.5">
              <div>stage: <span className="text-foreground">{res?.stage ?? "—"}</span></div>
              <div>errorCode: <span className="text-foreground">{code}</span></div>
              {res?.tradingLayerStatus != null && (
                <div>upstream HTTP: <span className="text-foreground">{res.tradingLayerStatus}</span></div>
              )}
              {res?.retryAfter != null && (
                <div>retry-after: <span className="text-foreground">{res.retryAfter}s</span></div>
              )}
              {res?.error && (
                <div className="break-words">message: <span className="text-foreground">{res.error}</span></div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {!isNoAccount && (
              <Button
                size="sm"
                onClick={onRetry}
                disabled={retrying}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                {retrying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Retry connection
              </Button>
            )}
            <Link to="/connect-mt">
              <Button size="sm" variant="outline" className="rounded-full">
                {isNoAccount ? "Connect Account" : "Manage Account"}
              </Button>
            </Link>
            <Link to="/education">
              <Button size="sm" variant="ghost" className="rounded-full">
                Continue to Education
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};


// ---------- Live Portfolio ----------
const LivePortfolioPanel = ({
  data,
  lastUpdated,
}: {
  data: LiveData;
  lastUpdated: Date | null;
}) => {
  const pnlTone =
    data.floating_pnl > 0
      ? "text-[hsl(145_65%_55%)]"
      : data.floating_pnl < 0
      ? "text-red-400"
      : "text-muted-foreground";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/80 via-card/60 to-background/40 backdrop-blur-xl shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]">
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative p-5">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-heading text-base sm:text-lg font-bold text-foreground leading-tight">
                Live Portfolio
              </h2>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-mono flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
                <span className="text-muted-foreground/40">·</span>
                Auto 10s
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <BigTile
            label="Balance"
            icon={<Wallet className="h-3.5 w-3.5" />}
            value={
              <AnimatedValue
                value={data.balance}
                format={(v) => fmtMoney(v, data.currency)}
                className="text-2xl font-bold text-foreground"
              />
            }
          />
          <BigTile
            label="Equity"
            accent
            value={
              <AnimatedValue
                value={data.equity}
                format={(v) => fmtMoney(v, data.currency)}
                className="text-2xl font-bold text-primary"
              />
            }
          />
          <BigTile
            label="Floating P&L"
            icon={
              data.floating_pnl >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )
            }
            value={
              <AnimatedValue
                value={data.floating_pnl}
                format={(v) => `${v >= 0 ? "+" : ""}${fmtMoney(v, data.currency)}`}
                className={cn("text-2xl font-bold", pnlTone)}
              />
            }
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Mini label="Open Trades" value={String(data.open_positions)} />
          <Mini label="Free Margin" value={fmtMoney(data.free_margin, data.currency)} />
          <Mini label="Margin" value={fmtMoney(data.margin, data.currency)} />
          <Mini label="Currency" value={data.currency} />
        </div>
      </div>
    </section>
  );
};

const BigTile = ({
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
      accent ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40",
    )}
  >
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">
      {icon}
      {label}
    </div>
    <div>{value}</div>
  </div>
);

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border/40 bg-background/30 px-2.5 py-2">
    <div className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground mb-0.5">
      {label}
    </div>
    <div className="font-mono text-xs font-semibold text-foreground tabular-nums truncate">
      {value}
    </div>
  </div>
);

// ---------- Risk Panel ----------
const RISK_PRESETS = [0.5, 1, 2] as const;

const RiskPanel = ({ equity, currency }: { equity: number; currency: string }) => {
  const [riskPct, setRiskPct] = useState<number>(1);
  const [customRisk, setCustomRisk] = useState<string>("");
  const [lot, setLot] = useState<string>("0.10");

  const effectiveRisk = customRisk ? parseFloat(customRisk) : riskPct;
  const riskAmount = (equity * (effectiveRisk || 0)) / 100;
  const tooHigh = (effectiveRisk || 0) > 3;

  return (
    <section className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
          Risk Panel
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <BigTile label="Equity" value={<span className="text-lg font-bold">{fmtMoney(equity, currency)}</span>} />
        <BigTile
          label="Estimated Risk"
          accent
          value={<span className="text-lg font-bold text-primary">{fmtMoney(riskAmount, currency)}</span>}
        />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-mono">
          Risk per trade
        </p>
        <div className="flex flex-wrap gap-2">
          {RISK_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setRiskPct(p);
                setCustomRisk("");
              }}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                !customRisk && riskPct === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40",
              )}
            >
              {p}%
            </button>
          ))}
          <Input
            type="number"
            step="0.1"
            min="0"
            placeholder="Custom %"
            value={customRisk}
            onChange={(e) => setCustomRisk(e.target.value)}
            className="h-8 w-28 text-xs"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-mono">
          Lot Size
        </p>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={lot}
          onChange={(e) => setLot(e.target.value)}
          className="h-9"
        />
      </div>

      {tooHigh && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Risk above 3% is considered very aggressive. Consider lowering it.</span>
        </div>
      )}
    </section>
  );
};

// ---------- Open Trades ----------
const OpenPositionsTable = ({
  positions,
  currency,
}: {
  positions: LivePosition[];
  currency: string;
}) => (
  <section className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-5">
    <div className="flex items-center gap-2 mb-4">
      <Activity className="h-4 w-4 text-primary" />
      <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
        Open Trades
      </h2>
      <Badge variant="outline" className="ml-auto border-border/50 text-muted-foreground">
        {positions.length}
      </Badge>
    </div>
    {positions.length === 0 ? (
      <p className="rounded-md border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
        No open trades.
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border/30">
              <th className="py-2 pr-3">Symbol</th>
              <th className="pr-3">Side</th>
              <th className="pr-3">Volume</th>
              <th className="pr-3">Entry</th>
              <th className="pr-3">Current</th>
              <th className="pr-3">SL</th>
              <th className="pr-3">TP</th>
              <th className="text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {positions.map((p) => {
              const positive = p.profit >= 0;
              return (
                <tr key={p.ticket ?? `${p.symbol}-${p.entry_price}`} className="font-mono text-xs">
                  <td className="py-2.5 pr-3 font-bold text-foreground">{p.symbol}</td>
                  <td className="pr-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        p.side === "buy"
                          ? "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)]"
                          : "bg-red-500/15 text-red-400",
                      )}
                    >
                      {p.side}
                    </span>
                  </td>
                  <td className="pr-3 tabular-nums">{p.volume.toFixed(2)}</td>
                  <td className="pr-3 tabular-nums">{fmtPrice(p.entry_price)}</td>
                  <td className="pr-3 tabular-nums">{fmtPrice(p.current_price)}</td>
                  <td className="pr-3 tabular-nums text-muted-foreground">{fmtPrice(p.stop_loss)}</td>
                  <td className="pr-3 tabular-nums text-muted-foreground">{fmtPrice(p.take_profit)}</td>
                  <td
                    className={cn(
                      "text-right font-bold tabular-nums",
                      positive ? "text-[hsl(145_65%_55%)]" : "text-red-400",
                    )}
                  >
                    {positive ? "+" : ""}
                    {fmtMoney(p.profit, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

// ---------- Trade Ideas ----------
const TradeIdeaCards = ({
  ideas,
  onTaken,
}: {
  ideas: TradeIdea[];
  onTaken: () => void;
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TradeIdea | null>(null);
  const [volume, setVolume] = useState<string>("0.10");

  const openConfirm = (idea: TradeIdea) => {
    setVolume("0.10");
    setConfirming(idea);
  };

  const confirmTrade = async () => {
    if (!confirming) return;
    const idea = confirming;
    const vol = parseFloat(volume);
    if (!Number.isFinite(vol) || vol <= 0) {
      toast.error("Enter a valid volume.");
      return;
    }
    setBusyId(idea.id);
    setConfirming(null);
    try {
      const { data, error } = await supabase.functions.invoke("submit-best-execution-order", {
        body: {
          tradeId: idea.id,
          symbol: idea.symbol,
          side: idea.direction,
          orderType: "market",
          volume: vol,
          stopLoss: idea.stopLoss,
          takeProfit: idea.takeProfit,
        },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.success === true) {
        const status = res.status as string;
        if (status === "filled") toast.success("Trade executed successfully");
        else if (status === "placed") toast.success("Trade placed");
        else if (status === "partial") toast.success("Trade partially filled");
        else toast.success("Trade executed");
        window.dispatchEvent(new Event("mt:refresh-positions"));
      } else {
        toast.error(res?.error || "Trade execution failed");
      }
      onTaken();
    } catch (e: any) {
      toast.error(e?.message || "Trade execution failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
            Trade Ideas
          </h2>
          <Badge variant="outline" className="ml-auto border-primary/30 text-primary text-[10px]">
            Featured Trade Setups
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ideas.map((s) => {
            const isBuy = s.direction === "buy";
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border/40 bg-background/40 p-4 hover:border-primary/40 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">{s.symbol}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        isBuy
                          ? "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)]"
                          : "bg-red-500/15 text-red-400",
                      )}
                    >
                      {s.direction}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    Risk {s.suggestedRisk}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3 text-xs font-mono">
                  <TradeStat label="Entry" value={`${s.entryFrom}–${s.entryTo}`} />
                  <TradeStat label="SL" value={String(s.stopLoss)} tone="red" />
                  <TradeStat label="TP" value={String(s.takeProfit)} tone="green" />
                </div>
                <Button
                  size="sm"
                  onClick={() => openConfirm(s)}
                  disabled={busyId === s.id}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                >
                  {busyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Review Idea"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirm Trade</DialogTitle>
            <DialogDescription>
              You are about to execute this trade on your connected MT5 account.
            </DialogDescription>
          </DialogHeader>
          {confirming && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ConfirmRow label="Symbol" value={confirming.symbol} mono />
                <ConfirmRow
                  label="Direction"
                  value={confirming.direction.toUpperCase()}
                  tone={confirming.direction === "buy" ? "green" : "red"}
                />
                <ConfirmRow label="Stop Loss" value={String(confirming.stopLoss)} mono />
                <ConfirmRow label="Take Profit" value={String(confirming.takeProfit)} mono />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                  Volume
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="h-9 mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmTrade}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              Confirm Trade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ConfirmRow = ({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "red" | "green";
}) => (
  <div className="rounded-md border border-border/40 bg-background/40 px-2.5 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
      {label}
    </div>
    <div
      className={cn(
        "font-semibold text-sm tabular-nums truncate",
        mono && "font-mono",
        tone === "red" && "text-red-400",
        tone === "green" && "text-[hsl(145_65%_55%)]",
        !tone && "text-foreground",
      )}
    >
      {value}
    </div>
  </div>
);

const TradeStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "red" | "green";
}) => (
  <div className="rounded-md border border-border/40 bg-background/40 px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div
      className={cn(
        "tabular-nums font-semibold",
        tone === "red" && "text-red-400",
        tone === "green" && "text-[hsl(145_65%_55%)]",
        !tone && "text-foreground",
      )}
    >
      {value}
    </div>
  </div>
);

// ---------- Trade Execution Log ----------
const ExecutionLogTable = ({ logs }: { logs: ExecutionLog[] }) => (
  <section className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-5">
    <div className="flex items-center gap-2 mb-4">
      <Clock className="h-4 w-4 text-primary" />
      <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
        Trade Execution Log
      </h2>
      <Badge variant="outline" className="ml-auto border-border/50 text-muted-foreground">
        {logs.length}
      </Badge>
    </div>
    {logs.length === 0 ? (
      <p className="rounded-md border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
        No trades executed yet.
      </p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-mono border-b border-border/30">
              <th className="py-2 pr-3">Time</th>
              <th className="pr-3">Symbol</th>
              <th className="pr-3">Side</th>
              <th className="pr-3">Volume</th>
              <th className="pr-3">Status</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {logs.map((l) => {
              const ok = l.status === "filled" || l.status === "placed" || l.status === "partial";
              return (
                <tr key={l.id} className="font-mono text-xs">
                  <td className="py-2.5 pr-3 text-muted-foreground">{fmtTime(l.created_at)}</td>
                  <td className="pr-3 font-bold text-foreground">{l.symbol}</td>
                  <td className="pr-3 uppercase">{l.side}</td>
                  <td className="pr-3 tabular-nums">{Number(l.volume).toFixed(2)}</td>
                  <td className="pr-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        ok
                          ? "bg-[hsl(145_65%_50%)]/15 text-[hsl(145_65%_55%)]"
                          : "bg-red-500/15 text-red-400",
                      )}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="text-muted-foreground truncate max-w-[260px]">
                    {l.ticket
                      ? `Ticket #${l.ticket}`
                      : l.retcode_description || l.error_message || l.classification || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export default TradingDashboard;
