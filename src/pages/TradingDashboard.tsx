import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Wallet,
  Activity,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import infinoxLogo from "@/assets/infinox-logo-white.png";

// ---------- Types ----------
interface Symbol {
  symbol?: string;
  name?: string;
  description?: string;
  digits?: number;
  volume_min?: number;
  volume_max?: number;
  volume_step?: number;
  [k: string]: any;
}

interface AccountInfo {
  login?: number | string;
  server?: string;
  balance?: number;
  equity?: number;
  profit?: number;
  margin_free?: number;
  free_margin?: number;
  currency?: string;
  leverage?: number;
  [k: string]: any;
}

interface Mt5Info extends AccountInfo {}

interface DashboardResponse {
  success: boolean;
  error?: string;
  account?: AccountInfo | null;
  mt5?: Mt5Info | null;
  symbols?: Symbol[];
  linkedAccount?: {
    account_number?: string | number;
    server?: string;
    status?: string;
    last_synced?: string | null;
  };
}

interface Signal {
  id: string;
  symbol: string;
  direction: "buy" | "sell";
  entryFrom: number;
  entryTo: number;
  stopLoss: number;
  takeProfit: number;
  suggestedRisk: string;
}

// Demo signals (until wired to backend signal feed for this account)
const DEMO_SIGNALS: Signal[] = [
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
];

// ---------- Helpers ----------
const fmt = (v: any, digits = 2) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";

const fmtMoney = (v: any, currency = "USD") =>
  typeof v === "number" && Number.isFinite(v)
    ? `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
    : "—";

// ---------- Page ----------
const TradingDashboard = () => {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("trading-dashboard", {
        body: { refresh: true },
      });
      if (error) throw error;
      setData(res as DashboardResponse);
      if (manual && (res as DashboardResponse)?.success) toast.success("Dashboard refreshed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to load dashboard");
      setData({ success: false, error: e?.message || "Failed to load dashboard" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = window.setInterval(() => load(false), 30_000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [load]);

  const account: AccountInfo = useMemo(
    () => ({ ...(data?.mt5 ?? {}), ...(data?.account ?? {}) }),
    [data]
  );
  const symbols = data?.symbols ?? [];
  const currency = account.currency || "USD";
  const equity = Number(account.equity) || 0;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SEO
        title="Trading Dashboard | IX Sala de Trading"
        description="Live trading account dashboard, risk panel, symbols and signals."
      />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={infinoxLogo} alt="INFINOX" className="h-5" />
            <span className="hidden sm:inline text-[10px] text-muted-foreground/30">|</span>
            <span className="hidden sm:inline font-heading text-sm font-semibold text-foreground">
              Trading <span className="text-primary">Dashboard</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={refreshing}
              className="gap-1.5 rounded-full"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data?.success ? (
          <NoAccountState message={data?.error || "No connected trading account found."} />
        ) : (
          <>
            <AccountSummary account={account} linked={data.linkedAccount} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskPanel equity={equity} currency={currency} symbols={symbols} />
              <SymbolSearch symbols={symbols} />
            </div>
            <OpenPositions />
            <SignalCards signals={DEMO_SIGNALS} equity={equity} currency={currency} />
          </>
        )}
      </div>
    </div>
  );
};

// ---------- States ----------
const NoAccountState = ({ message }: { message: string }) => (
  <div className="rounded-2xl border border-border/40 bg-card p-10 text-center">
    <AlertTriangle className="mx-auto h-10 w-10 text-primary mb-3" />
    <h2 className="font-heading text-lg font-semibold text-foreground mb-1">Dashboard unavailable</h2>
    <p className="text-sm text-muted-foreground mb-5">{message}</p>
    <Link to="/connect-mt">
      <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/80">
        Connect your MT5 account
      </Button>
    </Link>
  </div>
);

// ---------- Account Summary ----------
const Stat = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className="rounded-xl border border-border/40 bg-card/60 p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className={`mt-1 font-heading text-lg font-bold ${accent ? "text-primary" : "text-foreground"}`}>
      {value}
    </p>
  </div>
);

const AccountSummary = ({
  account,
  linked,
}: {
  account: AccountInfo;
  linked?: DashboardResponse["linkedAccount"];
}) => {
  const currency = account.currency || "USD";
  const profit = Number(account.profit ?? 0);
  const profitPositive = profit >= 0;
  const free = account.free_margin ?? account.margin_free;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
            Account Summary
          </h2>
        </div>
        {linked?.status && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {linked.status}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Account #" value={String(account.login ?? linked?.account_number ?? "—")} />
        <Stat label="Server" value={String(linked?.server ?? account.server ?? "—")} />
        <Stat label="Balance" value={fmtMoney(account.balance, currency)} />
        <Stat label="Equity" value={fmtMoney(account.equity, currency)} accent />
        <Stat
          label="Profit"
          value={
            typeof profit === "number"
              ? `${profitPositive ? "+" : ""}${profit.toFixed(2)} ${currency}`
              : "—"
          }
        />
        <Stat label="Free Margin" value={fmtMoney(free, currency)} />
        <Stat label="Currency" value={currency} />
        <Stat label="Leverage" value={account.leverage ? `1:${account.leverage}` : "—"} />
      </div>
    </section>
  );
};

// ---------- Risk Panel ----------
const RISK_PRESETS = [0.5, 1, 2] as const;

const RiskPanel = ({
  equity,
  currency,
  symbols,
}: {
  equity: number;
  currency: string;
  symbols: Symbol[];
}) => {
  const [riskPct, setRiskPct] = useState<number>(1);
  const [customRisk, setCustomRisk] = useState<string>("");
  const [lot, setLot] = useState<string>("0.10");
  const [symbolPick, setSymbolPick] = useState<string>(symbols[0]?.symbol || symbols[0]?.name || "");

  useEffect(() => {
    if (!symbolPick && symbols.length) setSymbolPick(symbols[0]?.symbol || symbols[0]?.name || "");
  }, [symbols, symbolPick]);

  const sym = symbols.find((s) => (s.symbol || s.name) === symbolPick);
  const lotNum = parseFloat(lot);
  const minVol = sym?.volume_min;
  const maxVol = sym?.volume_max;
  const tooLow = sym && Number.isFinite(lotNum) && minVol != null && lotNum < minVol;
  const tooHigh = sym && Number.isFinite(lotNum) && maxVol != null && lotNum > maxVol;

  const effectiveRisk = customRisk ? parseFloat(customRisk) : riskPct;
  const riskAmount = (equity * (effectiveRisk || 0)) / 100;

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
          Risk Panel
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Equity" value={fmtMoney(equity, currency)} />
        <Stat label="Risk Amount" value={fmtMoney(riskAmount, currency)} accent />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Risk per trade</p>
        <div className="flex flex-wrap gap-2">
          {RISK_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setRiskPct(p);
                setCustomRisk("");
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                !customRisk && riskPct === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/50 text-muted-foreground hover:text-foreground"
              }`}
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
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Symbol</p>
        <select
          value={symbolPick}
          onChange={(e) => setSymbolPick(e.target.value)}
          className="w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
        >
          {symbols.map((s) => {
            const v = s.symbol || s.name || "";
            return (
              <option key={v} value={v}>
                {v}
              </option>
            );
          })}
        </select>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Lot Size</p>
        <Input
          type="number"
          step={sym?.volume_step ?? 0.01}
          value={lot}
          onChange={(e) => setLot(e.target.value)}
          className="h-9"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Min {fmt(minVol, 2)} • Max {fmt(maxVol, 2)} • Step {fmt(sym?.volume_step, 2)}
        </p>
        {(tooLow || tooHigh) && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {tooLow
                ? `Volume is below the symbol minimum (${minVol}).`
                : `Volume exceeds the symbol maximum (${maxVol}).`}
            </span>
          </div>
        )}
      </div>
    </section>
  );
};

// ---------- Symbol Search ----------
const SymbolSearch = ({ symbols }: { symbols: Symbol[] }) => {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? symbols.filter((s) =>
          [s.symbol, s.name, s.description].filter(Boolean).some((v) => String(v).toLowerCase().includes(t))
        )
      : symbols;
    return list.slice(0, 50);
  }, [symbols, q]);

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
          Symbol Search
        </h2>
        <Badge variant="outline" className="ml-auto border-border/50 text-muted-foreground">
          {symbols.length}
        </Badge>
      </div>
      <Input
        placeholder="Search symbols..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 h-9"
      />
      <div className="max-h-72 overflow-y-auto divide-y divide-border/30 rounded-md border border-border/30">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">No symbols found</p>
        ) : (
          filtered.map((s, i) => {
            const name = s.symbol || s.name || `#${i}`;
            return (
              <div key={`${name}-${i}`} className="px-3 py-2 hover:bg-primary/5 transition">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-semibold text-foreground">{name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    digits {fmt(s.digits, 0)}
                  </span>
                </div>
                {s.description && (
                  <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  min {fmt(s.volume_min, 2)} • step {fmt(s.volume_step, 2)} • max {fmt(s.volume_max, 2)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

// ---------- Open Positions ----------
const OpenPositions = () => {
  const positions: any[] = []; // not yet wired
  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
          Open Positions
        </h2>
      </div>
      {positions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          No open positions
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Symbol</th>
                <th>Side</th>
                <th>Volume</th>
                <th>Entry</th>
                <th>Current</th>
                <th>SL</th>
                <th>TP</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {/* future rows */}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ---------- Signal Cards ----------
const SignalCards = ({
  signals,
  equity,
  currency,
}: {
  signals: Signal[];
  equity: number;
  currency: string;
}) => {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-base font-semibold text-foreground uppercase tracking-tight">
        Active Signals
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {signals.map((s) => {
          const isBuy = s.direction === "buy";
          const Icon = isBuy ? TrendingUp : TrendingDown;
          const accent = isBuy ? "text-emerald-500" : "text-destructive";
          const riskNum = parseFloat(s.suggestedRisk) || 0;
          const riskAmt = (equity * riskNum) / 100;
          return (
            <article
              key={s.id}
              className="rounded-2xl border border-border/40 bg-card p-5 hover:border-primary/40 transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-foreground">{s.symbol}</span>
                  <Badge className={`gap-1 ${isBuy ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive"} border-0 uppercase`}>
                    <Icon className="h-3 w-3" />
                    {s.direction}
                  </Badge>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Risk {s.suggestedRisk}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Entry</p>
                  <p className="font-mono text-foreground">
                    {s.entryFrom} – {s.entryTo}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Stop Loss</p>
                  <p className={`font-mono ${accent}`}>{s.stopLoss}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Take Profit</p>
                  <p className="font-mono text-primary">{s.takeProfit}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  ≈ {fmtMoney(riskAmt, currency)} at risk
                </p>
                <Button
                  size="sm"
                  className="rounded-full bg-primary text-primary-foreground hover:bg-primary/80"
                  onClick={() => toast.info(`Signal ready: ${s.symbol} ${s.direction.toUpperCase()}`)}
                >
                  Take This Signal
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default TradingDashboard;
