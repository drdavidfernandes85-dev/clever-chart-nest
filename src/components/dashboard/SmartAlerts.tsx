import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Zap,
  ChevronDown,
  Activity,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useQuickTrade } from "@/contexts/QuickTradeContext";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type RawSignal = {
  id: string;
  pair: string;
  direction: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  author_id: string;
  created_at: string;
};

type AlertKind = "consensus" | "breakout" | "volatility" | "momentum";

interface SmartAlert {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  tag: string;
  symbol: string;
  side: "buy" | "sell";
  entry?: number;
  sl?: number;
  tp?: number;
  lots?: string;
  signalId?: string | null;
  conviction: number; // 0-100, used for sorting
}

interface Props {
  /** Render with a collapsible header (used in Live Chart workspace). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Active chart symbol (e.g. "EUR/USD") so technical alerts can target it. */
  activeSymbol?: string;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const splitPair = (sym: string) => {
  const [base, quote] = sym.split("/");
  return { base, quote };
};

const pipSizeFor = (sym: string) =>
  sym.includes("JPY") ? 0.01 : sym.includes("XAU") ? 0.1 : 0.0001;

const decimalsFor = (sym: string) =>
  sym.includes("JPY") ? 3 : sym.includes("XAU") ? 2 : 5;

/**
 * Aggregate raw mentor signals into "consensus" alerts.
 * Groups by pair + direction (within last 24h, status active/open) and counts unique authors.
 */
const buildConsensusAlerts = (signals: RawSignal[]): SmartAlert[] => {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const grouped = new Map<
    string,
    {
      pair: string;
      side: "buy" | "sell";
      authors: Set<string>;
      latest: RawSignal;
    }
  >();

  for (const s of signals) {
    if (!["active", "open"].includes(s.status.toLowerCase())) continue;
    if (new Date(s.created_at).getTime() < dayAgo) continue;
    const side = s.direction.toLowerCase() === "buy" ? "buy" : "sell";
    const key = `${s.pair}|${side}`;
    const cur = grouped.get(key);
    if (cur) {
      cur.authors.add(s.author_id);
      if (new Date(s.created_at) > new Date(cur.latest.created_at)) {
        cur.latest = s;
      }
    } else {
      grouped.set(key, {
        pair: s.pair,
        side,
        authors: new Set([s.author_id]),
        latest: s,
      });
    }
  }

  const out: SmartAlert[] = [];
  grouped.forEach(({ pair, side, authors, latest }) => {
    const count = authors.size;
    // Conviction grows with mentor alignment.
    const conviction = Math.min(98, 55 + count * 12);
    out.push({
      id: `consensus-${latest.id}`,
      kind: "consensus",
      title: "High-conviction trade idea",
      body: `${pair} ${side.toUpperCase()} · ${count} mentor${count > 1 ? "s" : ""} aligned`,
      tag: `${conviction}%`,
      symbol: pair,
      side,
      entry: Number(latest.entry_price),
      sl: latest.stop_loss != null ? Number(latest.stop_loss) : undefined,
      tp: latest.take_profit != null ? Number(latest.take_profit) : undefined,
      signalId: latest.id,
      conviction,
    });
  });

  return out;
};

// ----------------------------------------------------------------------------
// Live price tracker — used to derive breakout / volatility alerts for the
// currently active chart symbol.
// ----------------------------------------------------------------------------

const useTechnicalAlerts = (symbol?: string): SmartAlert[] => {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const historyRef = useRef<{ t: number; p: number }[]>([]);

  useEffect(() => {
    if (!symbol) {
      setAlerts([]);
      historyRef.current = [];
      return;
    }
    historyRef.current = [];
    setAlerts([]);

    let cancelled = false;

    const fetchPrice = async (): Promise<number | null> => {
      try {
        const { base, quote } = splitPair(symbol);
        if (!base || !quote) return null;
        if (base === "XAU" || quote === "XAU") {
          const r = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
          const j = await r.json();
          return Number(j?.price);
        }
        const r = await fetch(
          `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`,
          { cache: "no-store" },
        );
        const j = await r.json();
        return Number(j?.rates?.[quote]);
      } catch {
        return null;
      }
    };

    const compute = async () => {
      const p = await fetchPrice();
      if (cancelled || !p || !Number.isFinite(p)) return;
      const now = Date.now();
      const hist = historyRef.current;
      hist.push({ t: now, p });
      // Keep last 30 minutes only
      while (hist.length && now - hist[0].t > 30 * 60 * 1000) hist.shift();

      if (hist.length < 4) return; // need enough samples

      const prices = hist.map((h) => h.p);
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const last = prices[prices.length - 1];
      const first = prices[0];
      const range = high - low || pipSizeFor(symbol);
      const atrLikeRecent =
        prices.slice(-Math.min(4, prices.length)).reduce((acc, v, i, arr) => {
          if (i === 0) return acc;
          return acc + Math.abs(v - arr[i - 1]);
        }, 0) / Math.max(1, Math.min(3, prices.length - 1));
      const atrLikeOlder =
        prices.slice(0, -Math.min(4, prices.length)).reduce((acc, v, i, arr) => {
          if (i === 0) return acc;
          return acc + Math.abs(v - arr[i - 1]);
        }, 0) / Math.max(1, prices.length - 5);

      const next: SmartAlert[] = [];
      const dec = decimalsFor(symbol);
      const pip = pipSizeFor(symbol);

      // --- Breakout watch: current price within 0.1 * range of recent high/low
      const nearHigh = high - last < range * 0.1;
      const nearLow = last - low < range * 0.1;
      if (nearHigh) {
        const side: "buy" = "buy";
        next.push({
          id: `tech-breakout-${symbol}`,
          kind: "breakout",
          title: "Breakout watch",
          body: `${symbol} testing ${high.toFixed(dec)} resistance`,
          tag: "LIVE",
          symbol,
          side,
          entry: last,
          sl: last - 20 * pip,
          tp: last + 40 * pip,
          conviction: 75,
        });
      } else if (nearLow) {
        next.push({
          id: `tech-breakdown-${symbol}`,
          kind: "breakout",
          title: "Breakdown watch",
          body: `${symbol} pressing ${low.toFixed(dec)} support`,
          tag: "LIVE",
          symbol,
          side: "sell",
          entry: last,
          sl: last + 20 * pip,
          tp: last - 40 * pip,
          conviction: 73,
        });
      }

      // --- Volatility spike (ATR proxy +30% vs older window)
      if (atrLikeOlder > 0 && atrLikeRecent / atrLikeOlder > 1.3) {
        const pct = Math.round(((atrLikeRecent / atrLikeOlder) - 1) * 100);
        const upBias = last >= first;
        next.push({
          id: `tech-vol-${symbol}`,
          kind: "volatility",
          title: "Volatility spike",
          body: `${symbol} ATR +${pct}% in last 15m`,
          tag: "ATR",
          symbol,
          side: upBias ? "buy" : "sell",
          entry: last,
          sl: upBias ? last - 25 * pip : last + 25 * pip,
          tp: upBias ? last + 50 * pip : last - 50 * pip,
          conviction: 68,
        });
      }

      // --- Strong momentum: last vs first move > 0.4 * range
      const momentum = (last - first) / range;
      if (Math.abs(momentum) > 0.4) {
        const isUp = momentum > 0;
        next.push({
          id: `tech-mom-${symbol}`,
          kind: "momentum",
          title: "Strong momentum",
          body: `${symbol} ${isUp ? "trending up" : "trending down"} (${(momentum * 100).toFixed(0)}% of range)`,
          tag: isUp ? "BULL" : "BEAR",
          symbol,
          side: isUp ? "buy" : "sell",
          entry: last,
          sl: isUp ? last - 20 * pip : last + 20 * pip,
          tp: isUp ? last + 35 * pip : last - 35 * pip,
          conviction: 65,
        });
      }

      if (!cancelled) setAlerts(next);
    };

    compute();
    const id = window.setInterval(compute, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  return alerts;
};

// ----------------------------------------------------------------------------
// Card / List
// ----------------------------------------------------------------------------

const KIND_ICON: Record<AlertKind, typeof Sparkles> = {
  consensus: Sparkles,
  breakout: TrendingUp,
  volatility: Zap,
  momentum: Activity,
};

const AlertRow = ({
  alert,
  onTake,
}: {
  alert: SmartAlert;
  onTake: (a: SmartAlert) => void;
}) => {
  const Icon = KIND_ICON[alert.kind];
  const isBuy = alert.side === "buy";
  return (
    <li className="px-3 py-2.5 hover:bg-primary/5 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            alert.kind === "consensus"
              ? "border-primary/40 bg-primary/10 text-primary"
              : isBuy
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground truncate">
              {alert.title}
            </p>
            <span
              className={`shrink-0 font-mono text-[10px] tabular-nums ${
                alert.kind === "consensus" ? "text-primary" : "text-foreground/80"
              }`}
            >
              {alert.tag}
            </span>
          </div>
          <p className="truncate text-[10.5px] text-muted-foreground">{alert.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onTake(alert)}
        className={`mt-2 ml-11 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
          isBuy
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            : "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        }`}
      >
        {isBuy ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        Take This Trade
      </button>
    </li>
  );
};

const AlertList = ({
  alerts,
  onTake,
}: {
  alerts: SmartAlert[];
  onTake: (a: SmartAlert) => void;
}) => {
  if (alerts.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <Target className="mx-auto h-5 w-5 text-muted-foreground/60 mb-2" />
        <p className="text-[11px] text-muted-foreground">
          No high-quality alerts right now.
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
          Watching mentors and the tape — we'll ping you when something fires.
        </p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/30">
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} onTake={onTake} />
      ))}
    </ul>
  );
};

const FooterLink = () => (
  <Link
    to="/signals"
    className="flex items-center justify-center gap-1 border-t border-border/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors"
  >
    See All Signals
    <ArrowRight className="h-3 w-3" />
  </Link>
);

// ----------------------------------------------------------------------------
// Main component
// ----------------------------------------------------------------------------

const SmartAlerts = ({
  collapsible = false,
  defaultOpen = true,
  activeSymbol,
}: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const [signals, setSignals] = useState<RawSignal[]>([]);
  const { openTrade } = useQuickTrade();

  // Pull recent mentor signals (live)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("trading_signals")
        .select("id, pair, direction, entry_price, stop_loss, take_profit, status, author_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled && data) setSignals(data as RawSignal[]);
    };
    load();
    const channel = supabase
      .channel(`smart-alerts-signals-${Math.random().toString(36).slice(2)}`);
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "trading_signals" },
      load,
    );
    channel.subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const technical = useTechnicalAlerts(activeSymbol);

  const alerts = useMemo(() => {
    const consensus = buildConsensusAlerts(signals);
    const merged = [...consensus, ...technical];
    // Sort by conviction desc, then keep top 5
    return merged
      .sort((a, b) => b.conviction - a.conviction)
      .slice(0, 5);
  }, [signals, technical]);

  const handleTake = (a: SmartAlert) => {
    openTrade({
      symbol: a.symbol,
      side: a.side,
      lots: a.lots,
      entry: a.entry != null ? a.entry.toFixed(decimalsFor(a.symbol)) : undefined,
      sl: a.sl != null ? a.sl.toFixed(decimalsFor(a.symbol)) : undefined,
      tp: a.tp != null ? a.tp.toFixed(decimalsFor(a.symbol)) : undefined,
      signalId: a.signalId ?? null,
    });
  };

  const count = alerts.length;

  if (!collapsible) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Smart Alerts
            </h3>
          </div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
            {count} live
          </span>
        </div>
        <AlertList alerts={alerts} onTake={handleTake} />
        <FooterLink />
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-primary/30 bg-card/70 backdrop-blur-md overflow-hidden">
        <CollapsibleTrigger className="group flex w-full items-center justify-between border-b border-border/40 px-3 py-2 hover:bg-primary/5 transition-colors data-[state=closed]:border-b-0">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-proxima text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
              Smart Alerts
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              {count} live
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AlertList alerts={alerts} onTake={handleTake} />
          <FooterLink />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default SmartAlerts;
