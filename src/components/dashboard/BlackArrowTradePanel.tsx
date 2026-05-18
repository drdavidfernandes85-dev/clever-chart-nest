import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Loader2,
  Plug,
  Search,
  AlertTriangle,
  X,
  RotateCcw,
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
 * Professional BlackArrow-style Order Ticket.
 * Dense institutional layout: dark UI, yellow accents, green buy / red sell.
 * Only market orders submit; pending types kept visible but disabled.
 */

const QUICK_VOLS = [0.01, 0.1, 0.25, 0.5, 1.0, 2.0];
const STRATEGIES = ["Standard", "Bracket", "None"] as const;
const ORDER_TYPES = ["Market", "Limit", "Stop"] as const;
type Strategy = typeof STRATEGIES[number];
type OrderTypeLabel = typeof ORDER_TYPES[number];

const pickTick = (tick: any) => {
  if (!tick) return { bid: null as number | null, ask: null as number | null };
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

  const [strategy, setStrategy] = useState<Strategy>("Standard");
  const [orderType, setOrderType] = useState<OrderTypeLabel>("Market");
  const [vol, setVol] = useState<string>("0.01");
  const [price, setPrice] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [noStops, setNoStops] = useState(false);
  const [autoReset, setAutoReset] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [bidFlash, setBidFlash] = useState<"up" | "down" | null>(null);
  const [askFlash, setAskFlash] = useState<"up" | "down" | null>(null);

  const prevBidRef = useRef<number | null>(null);
  const prevAskRef = useRef<number | null>(null);

  const { bid, ask } = pickTick(tick);
  const livePrice = side === "buy" ? ask : bid;
  const digits = Number(selectedSymbolInfo?.digits ?? 5);

  const spread =
    Number.isFinite(bid) && Number.isFinite(ask) && bid != null && ask != null
      ? Math.max(0, ask - bid)
      : null;

  // bid/ask flash
  useEffect(() => {
    if (bid == null || !Number.isFinite(bid)) return;
    const prev = prevBidRef.current;
    if (prev != null && prev !== bid) setBidFlash(bid > prev ? "up" : "down");
    prevBidRef.current = bid;
  }, [bid]);
  useEffect(() => {
    if (ask == null || !Number.isFinite(ask)) return;
    const prev = prevAskRef.current;
    if (prev != null && prev !== ask) setAskFlash(ask > prev ? "up" : "down");
    prevAskRef.current = ask;
  }, [ask]);
  useEffect(() => {
    if (!bidFlash) return;
    const t = setTimeout(() => setBidFlash(null), 400);
    return () => clearTimeout(t);
  }, [bidFlash]);
  useEffect(() => {
    if (!askFlash) return;
    const t = setTimeout(() => setAskFlash(null), 400);
    return () => clearTimeout(t);
  }, [askFlash]);

  const volNum = Number(vol) || 0;
  const entryPrice =
    orderType === "Market" ? livePrice ?? 0 : Number(price) || livePrice || 0;
  const slNum = sl ? Number(sl) : null;
  const tpNum = tp ? Number(tp) : null;

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

  const equity = Number(liveAccount?.equity ?? 0);
  const balance = Number(liveAccount?.balance ?? 0);
  const sessionPnl = equity - balance;
  const currency = liveAccount?.currency || "USD";
  const leverage = Number(liveAccount?.leverage ?? 100) || 100;
  const contractSize = Number(selectedSymbolInfo?.contractSize ?? 100000) || 100000;
  const notional = entryPrice * volNum * contractSize;
  const marginRequired = leverage > 0 ? notional / leverage : 0;

  const pipSize = normalizedSym.includes("JPY")
    ? 0.01
    : normalizedSym.includes("XAU")
      ? 0.1
      : normalizedSym.includes("BTC")
        ? 1
        : 0.0001;
  const valuePerPipPerLot = 10;

  const effectiveSl = noStops ? null : slNum;
  const effectiveTp = noStops ? null : tpNum;
  const slPips = effectiveSl && entryPrice ? Math.abs(entryPrice - effectiveSl) / pipSize : 0;
  const tpPips = effectiveTp && entryPrice ? Math.abs(entryPrice - effectiveTp) / pipSize : 0;
  const potentialLoss = slPips * volNum * valuePerPipPerLot;
  const potentialProfit = tpPips * volNum * valuePerPipPerLot;
  const riskPct = equity > 0 && potentialLoss > 0 ? (potentialLoss / equity) * 100 : 0;
  const spreadCost =
    spread != null && volNum > 0 ? (spread / pipSize) * volNum * valuePerPipPerLot : null;

  const slTpError = (() => {
    if (noStops || !entryPrice) return null;
    if (side === "buy") {
      if (slNum && slNum >= entryPrice) return "SL must be below entry for BUY";
      if (tpNum && tpNum <= entryPrice) return "TP must be above entry for BUY";
    } else {
      if (slNum && slNum <= entryPrice) return "SL must be above entry for SELL";
      if (tpNum && tpNum >= entryPrice) return "TP must be below entry for SELL";
    }
    return null;
  })();

  const applyPipPreset = (kind: "sl" | "tp", pips: number) => {
    if (!entryPrice || !pipSize) return;
    const dist = pips * pipSize;
    const buy = side === "buy";
    const target =
      kind === "sl"
        ? buy ? entryPrice - dist : entryPrice + dist
        : buy ? entryPrice + dist : entryPrice - dist;
    const formatted = target.toFixed(digits);
    if (kind === "sl") setSl(formatted);
    else setTp(formatted);
    if (noStops) setNoStops(false);
  };

  const symbolPositions = positions.filter((p) =>
    (p.symbol || "").toUpperCase().includes(normalizedSym),
  );
  const symbolPnl = symbolPositions.reduce((s, p) => s + Number(p.profit || 0), 0);

  const canSubmitMarket =
    !!user && connected && selectedSymbolValid !== false && volNum > 0 && !slTpError && !submitting;

  const submitMarket = async (sideArg: "buy" | "sell") => {
    if (!canSubmitMarket) return;
    setSide(sideArg);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        symbol: normalizedSym,
        side: sideArg,
        volume: Number(volNum.toFixed(2)),
        stopLoss: noStops ? null : slNum,
        takeProfit: noStops ? null : tpNum,
      };
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
        toast.success(`${sideArg.toUpperCase()} ${normalizedSym} · ${volNum.toFixed(2)} lots`, {
          description: [
            `Px ${fmtPx(filledPrice, digits)}`,
            res.ticket ? `#${res.ticket}` : null,
          ].filter(Boolean).join("  ·  "),
          duration: 4000,
        });
        window.dispatchEvent(new CustomEvent("trade-executed", { detail: { symbol: normalizedSym } }));
        window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
        refresh();
        setSl(""); setTp(""); setPrice("");
        if (autoReset) { setVol("0.01"); setOrderType("Market"); }
      } else {
        toast.error("Order failed", {
          description: res?.retcodeDescription || res?.retcode_description || res?.error || "Order rejected",
        });
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
      <div className={cn("rounded-lg border border-border/60 bg-card/80 p-5 text-center", className)}>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <h3 className="font-heading text-sm font-bold mb-1">MT5 account not connected</h3>
        <p className="text-xs text-muted-foreground mb-3">Connect your trading account to place orders.</p>
        <Link to="/connect-mt" className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
          Connect account
        </Link>
      </div>
    );
  }

  const pendingDisabled = true; // Limit/Stop pending orders not yet supported by backend
  const priceInputDisabled = orderType === "Market";

  return (
    <div className={cn(
      "rounded-lg border border-border/60 bg-card/95 overflow-hidden text-foreground text-[11px]",
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border/60 bg-background/60">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Order Ticket</span>
        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
          <span className="text-muted-foreground">{liveAccount?.login ? `#${liveAccount.login}` : "—"}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn(sessionPnl > 0 ? "text-emerald-400" : sessionPnl < 0 ? "text-red-400" : "text-foreground")}>
            {sessionPnl >= 0 ? "+" : ""}{fmt(sessionPnl, currency)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground">{fmt(equity, currency)}</span>
        </div>
      </div>

      <div className="p-2 space-y-1.5">
        {/* Symbol block */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSymbolOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded border border-border/60 bg-background/60 px-2 py-1.5 hover:bg-background/80"
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="font-heading text-sm font-bold leading-tight">{normalizedSym || "—"}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider truncate max-w-[180px]">
                {selectedSymbolInfo?.description || (isLive ? "Live broker symbol" : "Loading…")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right font-mono tabular-nums leading-tight">
                <div className="text-[10px] text-red-400">{fmtPx(bid, digits)}</div>
                <div className="text-[10px] text-emerald-400">{fmtPx(ask, digits)}</div>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", symbolOpen && "rotate-180")} />
            </div>
          </button>
          {symbolOpen ? (
            <div className="absolute z-30 mt-1 w-full rounded border border-border/60 bg-popover shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1.5">
                <Search className="h-3 w-3 text-muted-foreground" />
                <input
                  autoFocus
                  value={symbolSearch}
                  onChange={(e) => setSymbolSearch(e.target.value)}
                  placeholder="Search symbol…"
                  className="flex-1 bg-transparent text-[11px] focus:outline-none"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                {symbolList.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-muted-foreground">No symbols found</div>
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
                        "w-full flex items-center justify-between px-2.5 py-1 text-[11px] hover:bg-muted/40",
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

        {/* Strategy / Order type / Price / Qty */}
        <div className="grid grid-cols-4 gap-1">
          <DenseSelect label="Strategy" value={strategy} onChange={(v) => setStrategy(v as Strategy)} options={[...STRATEGIES]} />
          <DenseSelect label="Type" value={orderType} onChange={(v) => setOrderType(v as OrderTypeLabel)} options={[...ORDER_TYPES]} />
          <DenseInput
            label="Price"
            value={priceInputDisabled ? (livePrice != null ? livePrice.toFixed(digits) : "—") : price}
            onChange={setPrice}
            disabled={priceInputDisabled}
            mono
          />
          <DenseInput label="Lots" value={vol} onChange={setVol} mono />
        </div>

        {/* Quick volume chips */}
        <div className="grid grid-cols-6 gap-1">
          {QUICK_VOLS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setVol(q.toFixed(2))}
              className={cn(
                "h-6 rounded border text-[10px] font-mono tabular-nums transition-colors",
                vol === q.toFixed(2)
                  ? "border-primary/70 bg-primary/20 text-primary"
                  : "border-border/60 bg-background/60 hover:bg-background/80",
              )}
            >
              {q.toFixed(2)}
            </button>
          ))}
        </div>

        {/* 3 rows × 2 cols of order buttons */}
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <SideBtn tone="buy" disabled={!canSubmitMarket} loading={submitting && side === "buy"} onClick={() => submitMarket("buy")}>
              Buy @ MKT
            </SideBtn>
            <SideBtn tone="sell" disabled={!canSubmitMarket} loading={submitting && side === "sell"} onClick={() => submitMarket("sell")}>
              Sell @ MKT
            </SideBtn>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <SideBtn tone="buy" outline disabled={pendingDisabled} title="Pending orders coming soon">Buy Stop</SideBtn>
            <SideBtn tone="sell" outline disabled={pendingDisabled} title="Pending orders coming soon">Sell Stop</SideBtn>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <SideBtn tone="buy" outline disabled={pendingDisabled} title="Pending orders coming soon">Buy Limit</SideBtn>
            <SideBtn tone="sell" outline disabled={pendingDisabled} title="Pending orders coming soon">Sell Limit</SideBtn>
          </div>
        </div>

        {/* Bid/Ask tiles */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "rounded border px-2 py-1.5 text-center transition-colors",
              side === "sell" ? "border-red-500/70 bg-red-500/15" : "border-border/60 bg-background/40 hover:border-red-500/40",
              bidFlash === "up" && "ring-1 ring-emerald-400/60",
              bidFlash === "down" && "ring-1 ring-red-400/60",
            )}
          >
            <div className="text-[9px] uppercase tracking-wider text-red-400/80 font-semibold">Sell · Bid</div>
            <div className="font-mono tabular-nums text-sm font-bold leading-tight text-red-400">{fmtPx(bid, digits)}</div>
          </button>
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn(
              "rounded border px-2 py-1.5 text-center transition-colors",
              side === "buy" ? "border-emerald-500/70 bg-emerald-500/15" : "border-border/60 bg-background/40 hover:border-emerald-500/40",
              askFlash === "up" && "ring-1 ring-emerald-400/60",
              askFlash === "down" && "ring-1 ring-red-400/60",
            )}
          >
            <div className="text-[9px] uppercase tracking-wider text-emerald-400/80 font-semibold">Buy · Ask</div>
            <div className="font-mono tabular-nums text-sm font-bold leading-tight text-emerald-400">{fmtPx(ask, digits)}</div>
          </button>
        </div>

        {/* SL / TP */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold uppercase tracking-wider text-red-400/80">Stop Loss</label>
              {slPips > 0 && !noStops ? (
                <span className="text-[9px] font-mono tabular-nums text-red-400/70">{slPips.toFixed(0)}p</span>
              ) : null}
            </div>
            <input
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              disabled={noStops}
              inputMode="decimal"
              placeholder="—"
              className="w-full h-6 rounded border border-red-500/30 bg-background/60 px-1.5 text-[11px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
            />
            <div className="grid grid-cols-3 gap-1">
              {[10, 20, 50].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={noStops}
                  onClick={() => applyPipPreset("sl", p)}
                  className="h-5 rounded border border-red-500/25 bg-red-500/5 text-[9px] font-mono tabular-nums text-red-300 hover:bg-red-500/15 disabled:opacity-40"
                >
                  {p}p
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/80">Take Profit</label>
              {tpPips > 0 && !noStops ? (
                <span className="text-[9px] font-mono tabular-nums text-emerald-400/70">{tpPips.toFixed(0)}p</span>
              ) : null}
            </div>
            <input
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              disabled={noStops}
              inputMode="decimal"
              placeholder="—"
              className="w-full h-6 rounded border border-emerald-500/30 bg-background/60 px-1.5 text-[11px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
            />
            <div className="grid grid-cols-3 gap-1">
              {[20, 40, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={noStops}
                  onClick={() => applyPipPreset("tp", p)}
                  className="h-5 rounded border border-emerald-500/25 bg-emerald-500/5 text-[9px] font-mono tabular-nums text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40"
                >
                  {p}p
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox checked={noStops} onCheckedChange={(v) => setNoStops(v === true)} className="h-3 w-3" />
            Place without SL/TP
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox checked={autoReset} onCheckedChange={(v) => setAutoReset(v === true)} className="h-3 w-3" />
            Reset after fill
          </label>
        </div>

        {slTpError ? (
          <div className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {slTpError}
          </div>
        ) : null}

        {/* Summary */}
        <div className="rounded border border-border/60 bg-background/40 px-2 py-1.5 space-y-0.5">
          <SummaryRow label="Entry" value={fmtPx(entryPrice || null, digits)} tone={side === "buy" ? "pos" : "neg"} />
          <SummaryRow label="Notional" value={fmt(notional, currency)} />
          <SummaryRow label="Margin Required" value={fmt(marginRequired, currency)} />
          <SummaryRow label="Spread Cost" value={spreadCost != null ? fmt(spreadCost, currency) : "—"} />
          <SummaryRow
            label="Risk"
            value={riskPct ? `${riskPct.toFixed(2)}% · ${fmt(potentialLoss, currency)}` : "—"}
            tone={riskPct > 2 ? "neg" : undefined}
          />
          <SummaryRow
            label="Potential P&L"
            value={potentialProfit ? `+${fmt(potentialProfit, currency)}` : "—"}
            tone="pos"
          />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-3 gap-1">
          <ToolBtn
            onClick={() => { setSl(""); setTp(""); setPrice(""); setNoStops(false); }}
            icon={<X className="h-3 w-3" />}
            label="Cancel Order"
          />
          <ToolBtn
            onClick={() => setSide(side === "buy" ? "sell" : "buy")}
            icon={<RotateCcw className="h-3 w-3" />}
            label="Invert"
          />
          <ToolBtn onClick={closeSymbolPositions} icon={<X className="h-3 w-3" />} label="Close" danger />
        </div>

        {symbolPositions.length > 0 ? (
          <div className="rounded border border-border/60 bg-background/40 px-2 py-1 flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Open {normalizedSym}: {symbolPositions.length} pos</span>
            <span className={cn(
              "font-mono tabular-nums",
              symbolPnl > 0 ? "text-emerald-400" : symbolPnl < 0 ? "text-red-400" : "text-foreground",
            )}>
              {fmt(symbolPnl, currency)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const DenseSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div className="space-y-0.5">
    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-7 rounded border border-border/60 bg-background/60 px-1.5 pr-5 text-[11px] appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  </div>
);

const DenseInput = ({
  label, value, onChange, disabled, mono,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; mono?: boolean }) => (
  <div className="space-y-0.5">
    <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      inputMode="decimal"
      className={cn(
        "w-full h-7 rounded border border-border/60 bg-background/60 px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60",
        mono && "font-mono tabular-nums text-right",
      )}
    />
  </div>
);

const SideBtn = ({
  tone, outline, disabled, loading, onClick, title, children,
}: {
  tone: "buy" | "sell";
  outline?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) => {
  const buy = tone === "buy";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "h-8 rounded text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed",
        outline
          ? buy
            ? "border border-emerald-500/40 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15"
            : "border border-red-500/40 bg-red-500/5 text-red-300 hover:bg-red-500/15"
          : buy
            ? "bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600"
            : "bg-red-500 text-white border border-red-500 hover:bg-red-600",
      )}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {children}
    </button>
  );
};

const SummaryRow = ({
  label, value, tone,
}: { label: string; value: string; tone?: "pos" | "neg" }) => (
  <div className="flex items-center justify-between text-[10.5px]">
    <span className="text-muted-foreground">{label}</span>
    <span className={cn(
      "font-mono tabular-nums",
      tone === "pos" && "text-emerald-400",
      tone === "neg" && "text-red-400",
    )}>
      {value}
    </span>
  </div>
);

const ToolBtn = ({
  onClick, icon, label, danger,
}: { onClick: () => void; icon: React.ReactNode; label: string; danger?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-7 rounded border text-[10px] font-semibold flex items-center justify-center gap-1 transition-colors",
      danger
        ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        : "border-border/60 bg-background/60 text-foreground hover:bg-background/80",
    )}
  >
    {icon} {label}
  </button>
);

export default BlackArrowTradePanel;
