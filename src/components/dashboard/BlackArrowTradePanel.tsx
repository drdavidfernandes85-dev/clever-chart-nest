import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Plug,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  X,
  RotateCcw,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useBrokerSymbols } from "@/contexts/BrokerSymbolsContext";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Advanced BlackArrow-style order ticket.
 * - Symbol selector, big BUY/SELL toggle
 * - Order type segmented control (Market / Stop / Limit)
 * - Volume quick chips + manual input
 * - SL / TP with current price reference + "no stops" checkbox
 * - Live Margin / Risk% / Potential P&L preview
 * - Big CONFIRM ORDER button
 * - Cancel Ord. | Invert | Close row
 */

const QUICK_VOLS = [0.01, 0.1, 0.5, 1.0, 2.0];

const pickTick = (tick: any) => {
  if (!tick) return { bid: null, ask: null };
  return {
    bid: Number(tick.bid ?? tick.Bid ?? tick.b ?? NaN),
    ask: Number(tick.ask ?? tick.Ask ?? tick.a ?? NaN),
  };
};

const fmt = (n: number | null | undefined, currency = "USD") => {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const fmtPx = (n: number | null | undefined, digits = 5) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toFixed(digits);

type OrderType = "market" | "stop" | "limit";

interface Props {
  className?: string;
}

const BlackArrowTradePanel = ({ className }: Props) => {
  const { user } = useAuth();
  const { symbol: ctxSymbol, side, setSide, setSymbol: setCtxSymbol } = useQuickTrade();
  const {
    tick,
    selectedSymbolValid,
    selectedSymbolInfo,
    symbols: brokerSymbols,
    isLive,
  } = useBrokerSymbols();
  const { liveAccount, positions, connected, refresh } = useLiveAccount();

  // ---- Persisted preferences ----
  const PREFS_KEY = "ba-ticket-prefs";
  type FocusTarget = "volume" | "price" | "orderType";
  type Prefs = {
    side: "buy" | "sell";
    orderType: OrderType;
    vol: string;
    focusTarget: FocusTarget;
    autoReset: boolean;
  };
  const defaultPrefs: Prefs = {
    side: "buy",
    orderType: "market",
    vol: "0.01",
    focusTarget: "volume",
    autoReset: true,
  };
  const loadPrefs = (): Prefs => {
    if (typeof window === "undefined") return defaultPrefs;
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return defaultPrefs;
      return { ...defaultPrefs, ...JSON.parse(raw) };
    } catch {
      return defaultPrefs;
    }
  };
  const initialPrefs = useRef<Prefs>(loadPrefs());

  const [orderType, setOrderType] = useState<OrderType>(initialPrefs.current.orderType);
  const [vol, setVol] = useState<string>(initialPrefs.current.vol);
  const [price, setPrice] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [noStops, setNoStops] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [autoReset, setAutoReset] = useState(initialPrefs.current.autoReset);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(
    initialPrefs.current.focusTarget,
  );
  const [lastExecution, setLastExecution] = useState<{
    side: "buy" | "sell";
    symbol: string;
    volume: number;
    ticket?: string | number;
    at: number;
  } | null>(null);

  const priceTouched = useRef(false);
  const volInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const orderTypeBtnRef = useRef<HTMLButtonElement>(null);
  const prevSpreadRef = useRef<number | null>(null);
  const prevBidRef = useRef<number | null>(null);
  const prevAskRef = useRef<number | null>(null);
  const [spreadTrend, setSpreadTrend] = useState<"up" | "down" | "flat">("flat");
  const [bidFlash, setBidFlash] = useState<"up" | "down" | null>(null);
  const [askFlash, setAskFlash] = useState<"up" | "down" | null>(null);

  // Apply initial preferred side once
  const initialSideRef = useRef(false);
  useEffect(() => {
    if (!initialSideRef.current) {
      initialSideRef.current = true;
      setSide(initialPrefs.current.side);
    }
  }, [setSide]);

  // Persist prefs on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ side, orderType, vol, focusTarget, autoReset }),
      );
    } catch { /* ignore */ }
  }, [side, orderType, vol, focusTarget, autoReset]);

  const { bid, ask } = pickTick(tick);
  const livePrice = side === "buy" ? ask : bid;
  const digits = Number(selectedSymbolInfo?.digits ?? 5);

  // Spread tracking with trend
  const spread =
    Number.isFinite(bid) && Number.isFinite(ask) && bid != null && ask != null
      ? Math.max(0, ask - bid)
      : null;
  useEffect(() => {
    if (spread == null) return;
    const prev = prevSpreadRef.current;
    if (prev != null) {
      const delta = spread - prev;
      const epsilon = Math.max(1e-9, prev * 0.02);
      if (delta > epsilon) setSpreadTrend("up");
      else if (delta < -epsilon) setSpreadTrend("down");
      else setSpreadTrend("flat");
    }
    prevSpreadRef.current = spread;
  }, [spread]);

  // Bid / Ask price-move flash cues (auto-clear)
  useEffect(() => {
    if (bid == null || !Number.isFinite(bid)) return;
    const prev = prevBidRef.current;
    if (prev != null && prev !== bid) {
      setBidFlash(bid > prev ? "up" : "down");
    }
    prevBidRef.current = bid;
  }, [bid]);
  useEffect(() => {
    if (ask == null || !Number.isFinite(ask)) return;
    const prev = prevAskRef.current;
    if (prev != null && prev !== ask) {
      setAskFlash(ask > prev ? "up" : "down");
    }
    prevAskRef.current = ask;
  }, [ask]);
  useEffect(() => {
    if (!bidFlash) return;
    const t = setTimeout(() => setBidFlash(null), 450);
    return () => clearTimeout(t);
  }, [bidFlash]);
  useEffect(() => {
    if (!askFlash) return;
    const t = setTimeout(() => setAskFlash(null), 450);
    return () => clearTimeout(t);
  }, [askFlash]);

  useEffect(() => {
    if (orderType !== "market" && !priceTouched.current && livePrice != null) {
      setPrice(livePrice.toFixed(digits));
    }
    if (orderType === "market") {
      setPrice("");
      priceTouched.current = false;
    }
  }, [livePrice, orderType, digits]);

  useEffect(() => {
    priceTouched.current = false;
  }, [ctxSymbol]);

  // Auto-clear execution highlight
  useEffect(() => {
    if (!lastExecution) return;
    const t = setTimeout(() => setLastExecution(null), 4000);
    return () => clearTimeout(t);
  }, [lastExecution]);

  const volNum = Number(vol) || 0;
  const entryPrice =
    orderType === "market" ? livePrice ?? 0 : Number(price) || livePrice || 0;
  const slNum = sl ? Number(sl) : null;
  const tpNum = tp ? Number(tp) : null;

  // Symbol picker list
  const normalizedSym = (ctxSymbol || "").replace(/\//g, "").toUpperCase();
  const symbolList = useMemo(() => {
    return brokerSymbols.slice(0, 800).filter((s) => {
      const q = symbolSearch.trim().toUpperCase();
      if (!q) return true;
      return (
        s.symbol.includes(q) ||
        (s.displayName || "").toUpperCase().includes(q)
      );
    });
  }, [brokerSymbols, symbolSearch]);

  // Quick metrics
  const equity = Number(liveAccount?.equity ?? 0);
  const currency = liveAccount?.currency || "USD";
  const leverage = Number(liveAccount?.leverage ?? 100) || 100;
  const contractSize = Number(selectedSymbolInfo?.contractSize ?? 100000) || 100000;
  const notional = entryPrice * volNum * contractSize;
  const marginRequired = leverage > 0 ? notional / leverage : 0;

  // Pip size heuristic
  const pipSize = normalizedSym.includes("JPY")
    ? 0.01
    : normalizedSym.includes("XAU")
      ? 0.1
      : normalizedSym.includes("BTC")
        ? 1
        : 0.0001;
  const valuePerPipPerLot = 10; // rough USD pip value per 1.00 lot

  const slPips = slNum && entryPrice
    ? Math.abs(entryPrice - slNum) / pipSize
    : 0;
  const tpPips = tpNum && entryPrice
    ? Math.abs(entryPrice - tpNum) / pipSize
    : 0;
  const potentialLoss = slPips * volNum * valuePerPipPerLot;
  const potentialProfit = tpPips * volNum * valuePerPipPerLot;
  const riskPct = equity > 0 && potentialLoss > 0 ? (potentialLoss / equity) * 100 : 0;

  // Validation
  const slTpError = (() => {
    if (noStops) return null;
    if (!entryPrice) return null;
    if (side === "buy") {
      if (slNum && slNum >= entryPrice) return "SL must be below entry for BUY";
      if (tpNum && tpNum <= entryPrice) return "TP must be above entry for BUY";
    } else {
      if (slNum && slNum <= entryPrice) return "SL must be above entry for SELL";
      if (tpNum && tpNum >= entryPrice) return "TP must be below entry for SELL";
    }
    return null;
  })();

  const canSubmit =
    !!user &&
    connected &&
    selectedSymbolValid !== false &&
    volNum > 0 &&
    !slTpError &&
    !submitting &&
    (orderType === "market" || Number(price) > 0);

  // Open positions on this symbol
  const symbolPositions = positions.filter((p) =>
    (p.symbol || "").toUpperCase().includes(normalizedSym),
  );
  const symbolPnl = symbolPositions.reduce((s, p) => s + Number(p.profit || 0), 0);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        symbol: normalizedSym,
        side,
        volume: Number(volNum.toFixed(2)),
        stopLoss: noStops ? null : slNum,
        takeProfit: noStops ? null : tpNum,
      };
      if (orderType !== "market") {
        body.type = orderType;
        body.entry = Number(price);
      }
      const { data, error } = await supabase.functions.invoke("execute-trade", { body });
      let res: any = data;
      if (error) {
        try {
          const ctx: any = (error as any)?.context;
          if (ctx?.json) res = await ctx.json();
          else if (ctx?.text) res = JSON.parse(await ctx.text());
        } catch { /* ignore */ }
        if (!res) {
          toast.error((error as any)?.message || "Order failed");
          return;
        }
      }
      if (res?.success === true) {
        const filledPrice = Number(res.price ?? res.openPrice ?? entryPrice) || entryPrice;
        const spreadCostStr =
          spread != null && volNum > 0
            ? fmt((spread / pipSize) * volNum * valuePerPipPerLot, currency)
            : "—";
        toast.success(
          `${side.toUpperCase()} ${normalizedSym} · ${volNum.toFixed(2)} lots`,
          {
            description: [
              `Px ${fmtPx(filledPrice, digits)}`,
              `Spread ${spreadCostStr}`,
              res.ticket ? `#${res.ticket}` : null,
            ]
              .filter(Boolean)
              .join("  ·  "),
            duration: 5000,
          },
        );
        window.dispatchEvent(new CustomEvent("trade-executed", { detail: { symbol: normalizedSym } }));
        window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
        refresh();
        // Highlight executed action
        setLastExecution({
          side,
          symbol: normalizedSym,
          volume: volNum,
          ticket: res.ticket,
          at: Date.now(),
        });
        // Always clear SL/TP/pending price
        setSl("");
        setTp("");
        setPrice("");
        priceTouched.current = false;
        // Optional reset of qty/order type to PREFERRED defaults
        if (autoReset) {
          setVol(initialPrefs.current.vol);
          setOrderType(initialPrefs.current.orderType);
          setSide(initialPrefs.current.side);
        }
        // Focus the user-chosen control
        setTimeout(() => {
          if (focusTarget === "price") priceInputRef.current?.focus();
          else if (focusTarget === "orderType") orderTypeBtnRef.current?.focus();
          else volInputRef.current?.focus();
        }, 50);
      } else {
        const msg =
          res?.retcodeDescription ||
          res?.retcode_description ||
          res?.error ||
          "Order rejected";
        toast.error("Order failed", { description: msg });
      }
    } catch (e: any) {
      toast.error(e?.message || "Order failed");
    } finally {
      setSubmitting(false);
    }
  };

  const closeSymbolPositions = async () => {
    if (symbolPositions.length === 0) {
      toast.info("No open positions on this symbol");
      return;
    }
    setSubmitting(true);
    try {
      for (const p of symbolPositions) {
        const opposite: "buy" | "sell" = p.side === "buy" ? "sell" : "buy";
        await supabase.functions.invoke("execute-trade", {
          body: {
            symbol: p.symbol,
            side: opposite,
            volume: Number(Number(p.volume).toFixed(2)),
            closeTicket: p.ticket,
          },
        });
      }
      toast.success(`Closed ${symbolPositions.length} position(s)`);
      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Close failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (connected === false) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 text-center",
          className,
        )}
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <h3 className="font-heading text-sm font-bold mb-1">MT5 account not connected</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Connect your trading account to place orders.
        </p>
        <Link
          to="/connect-mt"
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Connect account
        </Link>
      </div>
    );
  }

  const isBuy = side === "buy";
  const accentColor = isBuy ? "emerald" : "red";

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl overflow-hidden text-foreground shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.18)]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-background/40">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Order Ticket
        </span>
        <span className="text-[10px] text-muted-foreground">
          {liveAccount?.login ? `#${liveAccount.login}` : "—"} · {fmt(equity, currency)}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Symbol selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSymbolOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 hover:bg-background/80"
          >
            <div className="flex flex-col items-start">
              <span className="font-heading text-lg font-bold leading-tight">
                {normalizedSym || "—"}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {selectedSymbolInfo?.description || (isLive ? "Live broker symbol" : "Loading…")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono tabular-nums text-[11px] text-red-400">
                  Bid {fmtPx(bid, digits)}
                </div>
                <div className="font-mono tabular-nums text-[11px] text-emerald-400">
                  Ask {fmtPx(ask, digits)}
                </div>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", symbolOpen && "rotate-180")} />
            </div>
          </button>
          {symbolOpen ? (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-border/60 bg-popover shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  placeholder="Search symbol…"
                  className="flex-1 bg-transparent text-xs focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {symbolList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No symbols found</div>
                ) : (
                  symbolList.slice(0, 60).map((s) => (
                    <button
                      key={s.symbol}
                      type="button"
                      onClick={() => {
                        setCtxSymbol(s.displayName || s.symbol);
                        setSymbolOpen(false);
                        setSymbolSearch("");
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/40",
                        s.symbol === normalizedSym && "bg-primary/10 text-primary",
                      )}
                    >
                      <span className="font-mono">{s.symbol}</span>
                      <span className="text-[10px] text-muted-foreground truncate ml-2 max-w-[55%]">
                        {s.description || s.assetClass || ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Executed action highlight */}
        {lastExecution ? (
          <div
            className={cn(
              "rounded-md border px-2.5 py-1.5 flex items-center gap-2 text-[11px] font-semibold animate-in fade-in slide-in-from-top-1 duration-300",
              lastExecution.side === "buy"
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-red-500/50 bg-red-500/15 text-red-300",
            )}
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="uppercase tracking-wider">
              {lastExecution.side} {lastExecution.symbol} · {lastExecution.volume.toFixed(2)} lots
            </span>
            {lastExecution.ticket ? (
              <span className="ml-auto font-mono tabular-nums opacity-80">
                #{lastExecution.ticket}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Order type quick grid — 6 buttons (BlackArrow-style) */}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { s: "buy", t: "market", label: "Buy @ Mkt" },
              { s: "sell", t: "market", label: "Sell @ Mkt" },
              { s: "buy", t: "stop", label: "Buy Stop" },
              { s: "sell", t: "stop", label: "Sell Stop" },
              { s: "buy", t: "limit", label: "Buy Limit" },
              { s: "sell", t: "limit", label: "Sell Limit" },
            ] as { s: "buy" | "sell"; t: OrderType; label: string }[]
          ).map(({ s, t, label }, idx) => {
            const active = side === s && orderType === t;
            const tone = s === "buy";
            return (
              <button
                key={label}
                ref={idx === 0 ? orderTypeBtnRef : undefined}
                type="button"
                onClick={() => {
                  setSide(s);
                  setOrderType(t);
                }}
                className={cn(
                  "h-9 rounded-md border text-[11px] font-bold uppercase tracking-wider transition-all",
                  active
                    ? tone
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.5)]"
                      : "bg-red-500 text-white border-red-500 shadow-[0_4px_12px_-4px_rgba(239,68,68,0.5)]"
                    : tone
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Live Spread indicator */}
        <SpreadIndicator
          spread={spread}
          pipSize={pipSize}
          trend={spreadTrend}
          digits={digits}
        />

        {/* Live Bid / Ask strip */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "rounded-lg border p-2 text-center transition-all",
              !isBuy
                ? "border-red-500/60 bg-red-500/15"
                : "border-border/60 bg-background/40 hover:border-red-500/40",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-red-400/80 font-semibold">Sell · Bid</div>
            <div className="font-mono tabular-nums text-lg font-bold text-red-400 leading-tight">
              {fmtPx(bid, digits)}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn(
              "rounded-lg border p-2 text-center transition-all",
              isBuy
                ? "border-emerald-500/60 bg-emerald-500/15"
                : "border-border/60 bg-background/40 hover:border-emerald-500/40",
            )}
          >
            <div className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">Buy · Ask</div>
            <div className="font-mono tabular-nums text-lg font-bold text-emerald-400 leading-tight">
              {fmtPx(ask, digits)}
            </div>
          </button>
        </div>

        {/* BIG BUY / SELL selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn(
              "h-14 rounded-lg font-heading text-base font-bold tracking-wide transition-all flex items-center justify-center gap-2 border-2",
              isBuy
                ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_6px_18px_-4px_rgba(16,185,129,0.55)]"
                : "bg-background/40 text-muted-foreground border-border/60 hover:text-emerald-400 hover:border-emerald-500/40",
            )}
          >
            <TrendingUp className="h-5 w-5" /> BUY
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "h-14 rounded-lg font-heading text-base font-bold tracking-wide transition-all flex items-center justify-center gap-2 border-2",
              !isBuy
                ? "bg-red-500 text-white border-red-500 shadow-[0_6px_18px_-4px_rgba(239,68,68,0.55)]"
                : "bg-background/40 text-muted-foreground border-border/60 hover:text-red-400 hover:border-red-500/40",
            )}
          >
            <TrendingDown className="h-5 w-5" /> SELL
          </button>
        </div>

        {/* Volume */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</label>
            <input
              ref={volInputRef}
              value={vol}
              onChange={(e) => setVol(e.target.value)}
              inputMode="decimal"
              className="w-20 h-7 rounded border border-border/60 bg-background/60 px-2 text-right text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {QUICK_VOLS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setVol(q.toFixed(2))}
                className={cn(
                  "h-7 rounded border text-[11px] font-mono tabular-nums transition-colors",
                  vol === q.toFixed(2)
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/60 bg-background/60 hover:bg-background/80",
                )}
              >
                {q.toFixed(2)}
              </button>
            ))}
          </div>
        </div>

        {/* Pending price */}
        {orderType !== "market" ? (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Price
            </label>
            <input
              value={price}
              onChange={(e) => {
                priceTouched.current = true;
                setPrice(e.target.value);
              }}
              inputMode="decimal"
              placeholder={livePrice ? livePrice.toFixed(digits) : "0.00000"}
              className="w-full h-8 rounded border border-border/60 bg-background/60 px-2 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ) : null}

        {/* SL / TP */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80">
              Stop Loss
            </label>
            <input
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              disabled={noStops}
              inputMode="decimal"
              placeholder={livePrice ? livePrice.toFixed(digits) : "—"}
              className="w-full h-8 rounded border border-red-500/30 bg-background/60 px-2 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">
              Take Profit
            </label>
            <input
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              disabled={noStops}
              inputMode="decimal"
              placeholder={livePrice ? livePrice.toFixed(digits) : "—"}
              className="w-full h-8 rounded border border-emerald-500/30 bg-background/60 px-2 text-[12px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={noStops}
              onCheckedChange={(v) => setNoStops(v === true)}
              className="h-3.5 w-3.5"
            />
            Place without SL / TP
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={autoReset}
              onCheckedChange={(v) => setAutoReset(v === true)}
              className="h-3.5 w-3.5"
            />
            Reset after fill
          </label>
        </div>

        {slTpError ? (
          <div className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {slTpError}
          </div>
        ) : null}

        {/* Preview metrics — live based on side · order type · price · volume */}
        <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2 space-y-1">
          <PreviewRow
            label={`Entry · ${isBuy ? "BUY" : "SELL"} ${orderType.toUpperCase()}`}
            value={fmtPx(entryPrice || null, digits)}
            tone={isBuy ? "pos" : "neg"}
          />
          <PreviewRow label="Notional" value={fmt(notional, currency)} />
          <PreviewRow label="Margin req." value={fmt(marginRequired, currency)} />
          <PreviewRow
            label="Spread cost"
            value={
              spread != null && volNum > 0
                ? fmt((spread / pipSize) * volNum * valuePerPipPerLot, currency)
                : "—"
            }
            tone={spreadTrend === "up" ? "neg" : undefined}
          />
          <PreviewRow
            label="Risk"
            value={riskPct ? `${riskPct.toFixed(2)}% · ${fmt(potentialLoss, currency)}` : "—"}
            tone={riskPct > 2 ? "neg" : undefined}
          />
          <PreviewRow
            label="Potential P&L"
            value={potentialProfit ? `+${fmt(potentialProfit, currency)}` : "—"}
            tone="pos"
          />
        </div>

        {/* CONFIRM */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={cn(
            "w-full h-12 rounded-lg font-heading text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
            isBuy
              ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)]"
              : "bg-red-500 text-white hover:bg-red-600 shadow-[0_6px_20px_-6px_rgba(239,68,68,0.6)]",
          )}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm {isBuy ? "Buy" : "Sell"} · {volNum.toFixed(2)} lots
        </button>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-1.5">
          <ToolBtn
            onClick={() => {
              setSl("");
              setTp("");
              setPrice("");
              setNoStops(false);
              priceTouched.current = false;
            }}
            icon={<X className="h-3.5 w-3.5" />}
            label="Cancel Ord."
          />
          <ToolBtn
            onClick={() => setSide(isBuy ? "sell" : "buy")}
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            label="Invert"
          />
          <ToolBtn
            onClick={closeSymbolPositions}
            icon={<X className="h-3.5 w-3.5" />}
            label="Close"
            danger
          />
        </div>

        {symbolPositions.length > 0 ? (
          <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Open {normalizedSym}: {symbolPositions.length} pos
            </span>
            <span
              className={cn(
                "font-mono tabular-nums",
                symbolPnl > 0 ? "text-emerald-400" : symbolPnl < 0 ? "text-red-400" : "text-foreground",
              )}
            >
              {fmt(symbolPnl, currency)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const PreviewRow = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) => (
  <div className="flex items-center justify-between text-[11px]">
    <span className="text-muted-foreground">{label}</span>
    <span
      className={cn(
        "font-mono tabular-nums",
        tone === "pos" && "text-emerald-400",
        tone === "neg" && "text-red-400",
      )}
    >
      {value}
    </span>
  </div>
);

const ToolBtn = ({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-8 rounded border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors",
      danger
        ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        : "border-border/60 bg-background/60 text-foreground hover:bg-background/80",
    )}
  >
    {icon} {label}
  </button>
);

const SpreadIndicator = ({
  spread,
  pipSize,
  trend,
  digits,
}: {
  spread: number | null;
  pipSize: number;
  trend: "up" | "down" | "flat";
  digits: number;
}) => {
  const pips = spread != null && pipSize > 0 ? spread / pipSize : null;
  // Color cue: tight=emerald, normal=primary, wide=red
  const tone =
    pips == null
      ? "muted"
      : pips < 1
        ? "tight"
        : pips < 3
          ? "normal"
          : "wide";
  const toneClasses: Record<string, string> = {
    muted: "border-border/60 bg-background/40 text-muted-foreground",
    tight: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    normal: "border-primary/40 bg-primary/10 text-primary",
    wide: "border-red-500/40 bg-red-500/10 text-red-400",
  };
  const trendIcon =
    trend === "up" ? (
      <TrendingUp className="h-3 w-3 text-red-400" />
    ) : trend === "down" ? (
      <TrendingDown className="h-3 w-3 text-emerald-400" />
    ) : (
      <Activity className="h-3 w-3 opacity-70" />
    );
  // Visual width bar — clamp 0..6 pips for the bar fill
  const pct =
    pips == null ? 0 : Math.max(4, Math.min(100, (pips / 6) * 100));
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5 flex items-center gap-2 transition-colors",
        toneClasses[tone],
      )}
    >
      {trendIcon}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
          Spread
        </span>
        <span className="font-mono tabular-nums text-[12px] font-bold">
          {pips != null ? pips.toFixed(pips < 1 ? 2 : 1) : "—"}
          <span className="text-[9px] opacity-70 ml-0.5">pips</span>
        </span>
        <span className="font-mono tabular-nums text-[10px] opacity-70 truncate">
          ({spread != null ? spread.toFixed(digits) : "—"})
        </span>
      </div>
      <div className="ml-auto h-1.5 w-16 rounded-full bg-background/60 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            tone === "tight" && "bg-emerald-400",
            tone === "normal" && "bg-primary",
            tone === "wide" && "bg-red-400",
            tone === "muted" && "bg-muted-foreground/40",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default BlackArrowTradePanel;
