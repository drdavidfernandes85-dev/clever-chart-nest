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
import { useSelectedQuote } from "@/hooks/useSelectedQuote";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  ExecutionResultModal,
  type ExecutionResultPayload,
} from "@/components/dashboard/ExecutionResultModal";

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
    tickUpdatedAt,
    tickError,
    selectedSymbolValid,
    selectedSymbolInfo,
    symbols: brokerSymbols,
    isLive,
  } = useBrokerSymbols();
  const { liveAccount, positions, connected, refresh } = useLiveAccount();

  // get-mt5-quotes drives the selected symbol's live price + specs
  // (stale-while-revalidate). Order Ticket never blanks on a transient
  // refresh failure — we always fall back to lastGoodSelectedSymbolData.
  const {
    selectedQuote,
    lastGoodSelectedSymbolData,
    dataDelayed: selectedDataDelayed,
  } = useSelectedQuote(ctxSymbol);
  const effectiveSelected = selectedQuote ?? lastGoodSelectedSymbolData;


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
  const [execResult, setExecResult] = useState<ExecutionResultPayload | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    functionUsed: string;
    payload: any;
    response?: any;
    error?: string;
    rawEdgeFunctionResponse?: any;
    edgeFunctionError?: string | null;
    validationError?: string;
    at: string;
  } | null>(null);

  // Latch "ever connected" so a transient polling failure cannot replace
  // the entire Order Ticket with the disconnected screen.
  const [everConnected, setEverConnected] = useState(false);
  useEffect(() => {
    if (connected) setEverConnected(true);
  }, [connected]);
  const showAsConnected = connected || everConnected;

  // Prefer get-mt5-quotes selectedQuote → lastGoodSelectedSymbolData → broker tick.
  const fallbackTick = pickTick(tick);
  const bid =
    effectiveSelected?.bid != null
      ? Number(effectiveSelected.bid)
      : fallbackTick.bid;
  const ask =
    effectiveSelected?.ask != null
      ? Number(effectiveSelected.ask)
      : fallbackTick.ask;
  const livePrice = side === "buy" ? ask : bid;
  const digits = Number(effectiveSelected?.digits ?? selectedSymbolInfo?.digits ?? 5);

  // Prefer selectedQuote.spread; derive from bid/ask only as fallback.
  const spread =
    effectiveSelected?.spread != null && Number.isFinite(Number(effectiveSelected.spread))
      ? Number(effectiveSelected.spread)
      : Number.isFinite(bid) && Number.isFinite(ask) && bid != null && ask != null
        ? Math.max(0, ask - bid)
        : null;
  const lastPrice =
    effectiveSelected?.last != null && Number.isFinite(Number(effectiveSelected.last))
      ? Number(effectiveSelected.last)
      : bid != null && ask != null
        ? (bid + ask) / 2
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
  const contractSize =
    Number(effectiveSelected?.contractSize ?? selectedSymbolInfo?.contractSize ?? 100000) ||
    100000;
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

  // ---- Volume specs from broker ----
  // ---- Volume specs (prefer selectedQuote, fall back to broker info) ----
  const volumeMin =
    Number(effectiveSelected?.volumeMin ?? selectedSymbolInfo?.volumeMin ?? 0.01) || 0.01;
  const volumeMax =
    Number(effectiveSelected?.volumeMax ?? selectedSymbolInfo?.volumeMax ?? 0) || 0;
  const volumeStep =
    Number(effectiveSelected?.volumeStep ?? selectedSymbolInfo?.volumeStep ?? 0.01) || 0.01;

  // Reject anything that doesn't look like a real broker symbol (alphanum, 3-15 chars)
  const isBrokerSymbol = /^[A-Z0-9._]{3,15}$/.test(normalizedSym);

  const volumeError = (() => {
    if (volNum <= 0) return "Volume must be > 0";
    if (volNum < volumeMin) return `Min volume ${volumeMin}`;
    if (volumeMax > 0 && volNum > volumeMax) return `Max volume ${volumeMax}`;
    if (volumeStep > 0) {
      // Snap-check on volume step (1e-6 tolerance for float math)
      const steps = volNum / volumeStep;
      if (Math.abs(steps - Math.round(steps)) > 1e-6) {
        return `Volume must be a multiple of ${volumeStep}`;
      }
    }
    return null;
  })();

  // Execution gating must NOT depend on Bid/Ask Board freshness or
  // "Data delayed" badge — only on real broker/account state and a
  // usable bid OR ask on the selected symbol.
  const hasValidBidAsk =
    Number.isFinite(Number(bid)) ||
    Number.isFinite(Number(ask)) ||
    Number.isFinite(Number(effectiveSelected?.bid)) ||
    Number.isFinite(Number(effectiveSelected?.ask)) ||
    Number.isFinite(Number((selectedSymbolInfo as any)?.bid)) ||
    Number.isFinite(Number((selectedSymbolInfo as any)?.ask));

  // selectedSymbolValid: broker confirmation OR a usable selectedQuote.
  const symbolValid = selectedSymbolValid === true || !!effectiveSelected?.valid;

  // "Data delayed" surfaces when get-mt5-quotes failed to return a fresh
  // selectedQuote but a last-good snapshot is still keeping the ticket alive.
  const showDataDelayed = selectedDataDelayed && !!effectiveSelected;

  const canSubmitMarket =
    !!user &&
    connected === true &&
    isBrokerSymbol &&
    symbolValid &&
    !!normalizedSym &&
    hasValidBidAsk &&
    volNum > 0 &&
    !volumeError &&
    !submitting;

  const submitMarket = async (sideArg: "buy" | "sell") => {
    if (!canSubmitMarket) {
      if (!connected) toast.error("Account not connected");
      else if (!isBrokerSymbol) toast.error("Invalid symbol");
      else if (!symbolValid) toast.error("Symbol not available on broker");
      else if (volumeError) toast.error(volumeError);
      else if (slTpError) toast.error(slTpError);
      return;
    }
    setSide(sideArg);
    setSubmitting(true);
    const clientClickAt = new Date().toISOString();
    const tradeId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const payload = {
        tradeId,
        symbol: normalizedSym,
        side: sideArg,
        orderType: "market" as const,
        volume: Number(volNum.toFixed(2)),
        stopLoss: noStops ? null : (sl ? Number(sl) : null),
        takeProfit: noStops ? null : (tp ? Number(tp) : null),
        dryRun: true,
        clientClickAt,
      };

      // Debug: log + show in temporary debug panel BEFORE the call
      // eslint-disable-next-line no-console
      console.log("[OrderTicket] functionUsed:", "submit-best-execution-order");
      // eslint-disable-next-line no-console
      console.log("[OrderTicket] payload:", payload);
      setDebugInfo({
        functionUsed: "submit-best-execution-order",
        payload,
        at: new Date().toISOString(),
      });

      const { data, error } = await supabase.functions.invoke(
        "submit-best-execution-order",
        { body: payload },
      );

      // eslint-disable-next-line no-console
      console.log("[OrderTicket] raw response:", { data, error });
      setDebugInfo((prev) =>
        prev
          ? {
              ...prev,
              response: data ?? null,
              error: error ? (error as any)?.message || String(error) : undefined,
            }
          : prev,
      );

      let res: any = data;
      if (error && !res) {
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

      // Canary check — submit-best-execution-order must NOT forward to
      // execute-trade while we're still in dry-run validation mode.
      const stepStr = String(res?.step ?? "").toLowerCase();
      if (stepStr === "trade_execution") {
        // eslint-disable-next-line no-console
        console.warn("[OrderTicket] WARNING: response step is 'trade_execution' — live execution path was hit.");
        toast.error("⚠️ Live execution path triggered (step: trade_execution). Stopping.");
        return;
      }
      if (stepStr && stepStr !== "dry_run" && stepStr !== "canary_dry_run_no_trading_layer_call") {
        // eslint-disable-next-line no-console
        console.warn("[OrderTicket] Unexpected step in dry-run mode:", res?.step);
        toast.warning(`Unexpected response step: ${res?.step}`);
      }


      // Always trigger downstream refreshes regardless of outcome.
      window.dispatchEvent(new CustomEvent("trade-executed", { detail: { symbol: normalizedSym, tradeId } }));
      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
      window.dispatchEvent(new CustomEvent("mt:refresh-market-watch"));
      window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
      window.dispatchEvent(new CustomEvent("mt:refresh-quotes"));
      refresh();

      const baseFields = {
        symbol: normalizedSym,
        side: sideArg,
        volume: Number(volNum.toFixed(2)),
        digits,
      };

      if (res?.success === true) {
        setExecResult({
          ...baseFields,
          outcome: "success",
          requestedPrice: res.requestedPrice ?? null,
          executedPrice: res.executedPrice ?? null,
          slippage: res.slippage ?? null,
          latencyMs: res.latencyMs ?? null,
          brokerMessage: res.brokerMessage ?? null,
          status: res.status ?? "done",
          ticket: res.ticket ?? null,
        });
        setPrice("");
        if (autoReset) { setVol(volumeMin.toFixed(2)); setOrderType("Market"); }
      } else {
        // Distinguish pre-trade "blocked" (best-execution control) from broker "rejected".
        const statusStr = String(res?.status || "").toLowerCase();
        const isBlocked =
          statusStr === "blocked" ||
          res?.blocked === true ||
          (res?.step && String(res.step).toLowerCase().includes("pre")) ||
          (Array.isArray(res?.reasons) && res.reasons.length > 0 && res.retcode == null);

        const reasons = Array.isArray(res?.reasons) ? res.reasons.join(" · ") : null;

        if (isBlocked) {
          setExecResult({
            ...baseFields,
            outcome: "blocked",
            reason: res?.error || reasons || "Pre-trade check failed",
            ruleViolated: res?.ruleViolated || reasons || res?.error || null,
            bid: res?.bid ?? res?.requestedBid ?? bid ?? null,
            ask: res?.ask ?? res?.requestedAsk ?? ask ?? null,
            spread:
              res?.spread ??
              (bid != null && ask != null ? Math.max(0, ask - bid) : null),
            tickAgeMs: res?.tickAgeMs ?? null,
          });
        } else {
          setExecResult({
            ...baseFields,
            outcome: "rejected",
            brokerMessage: res?.brokerMessage || res?.error || "Order rejected",
            retcode: res?.retcode ?? null,
            requestedPrice: res?.requestedPrice ?? null,
            quoteBid: res?.quoteBid ?? res?.bid ?? bid ?? null,
            quoteAsk: res?.quoteAsk ?? res?.ask ?? ask ?? null,
            latencyMs: res?.latencyMs ?? null,
          });
        }
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

  if (!showAsConnected) {
    return (
      <div className={cn("rounded-sm border border-neutral-800 bg-[#0c0c0c] p-5 text-center", className)}>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFCD05]/15 text-[#FFCD05]">
          <Plug className="h-5 w-5" />
        </div>
        <h3 className="font-heading text-sm font-bold mb-1">MT5 account not connected</h3>
        <p className="text-xs text-muted-foreground mb-3">Connect your trading account to place orders.</p>
        <Link to="/connect-mt" className="inline-flex items-center justify-center rounded-md bg-[#FFCD05] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90">
          Connect account
        </Link>
      </div>
    );
  }

  const pendingDisabled = true; // Limit/Stop pending orders not yet supported by backend
  const priceInputDisabled = orderType === "Market";

  // "Data delayed" surfaces when:
  //   (a) the selected symbol has NO usable bid AND NO usable ask anywhere
  //       (live tick, get-mt5-quotes selectedQuote, last-good broker info)
  //       AND the last tick refresh failed, OR
  //   (b) get-mt5-quotes failed to return a fresh selectedQuote but a
  //       last-good snapshot is keeping the Order Ticket alive.
  const selectedTickAvailable =
    Number.isFinite(Number(bid)) ||
    Number.isFinite(Number(ask)) ||
    Number.isFinite(Number(effectiveSelected?.bid)) ||
    Number.isFinite(Number(effectiveSelected?.ask)) ||
    Number.isFinite(Number((selectedSymbolInfo as any)?.bid)) ||
    Number.isFinite(Number((selectedSymbolInfo as any)?.ask));
  const tickStale = (!selectedTickAvailable && !!tickError) || showDataDelayed;

  return (
    <div className={cn(
      "rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden text-neutral-100 text-[11px]",
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-neutral-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFCD05]">Order Ticket</span>
          {tickStale ? (
            <span className="flex items-center gap-1 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-[1px] text-[8.5px] font-mono uppercase tracking-widest text-amber-400">
              <span className="inline-flex h-1 w-1 rounded-full bg-amber-400" />
              Data delayed
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
          <span className="text-neutral-500">{liveAccount?.login ? `#${liveAccount.login}` : "—"}</span>
          <span className="text-neutral-700">·</span>
          <span className={cn(sessionPnl > 0 ? "text-emerald-400" : sessionPnl < 0 ? "text-red-400" : "text-neutral-100")}>
            {sessionPnl >= 0 ? "+" : ""}{fmt(sessionPnl, currency)}
          </span>
        </div>
      </div>



      <div className="p-1.5 space-y-1">
        {/* Dry-run banner */}
        <div className="flex items-center gap-1.5 rounded-sm border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-2 py-1">
          <AlertTriangle className="h-3 w-3 text-[#FFCD05] shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#FFCD05]">
            DRY RUN MODE ACTIVE — no live orders will be sent.
          </span>
        </div>

        {/* Symbol block */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSymbolOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-sm border border-neutral-800 bg-[#0a0a0a] px-2 py-1 hover:border-neutral-700"
          >
            <div className="flex flex-col items-start min-w-0">
              <span className="font-heading text-[12px] font-bold leading-tight">{normalizedSym || "—"}</span>
              <span className="text-[9px] text-neutral-500 uppercase tracking-wider truncate max-w-[160px]">
                {effectiveSelected?.description || selectedSymbolInfo?.description || (isLive ? "Live broker symbol" : "Loading…")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="text-right font-mono tabular-nums leading-tight">
                <div className="text-[10px] text-red-400">{fmtPx(bid, digits)}</div>
                <div className="text-[10px] text-emerald-400">{fmtPx(ask, digits)}</div>
              </div>
              <ChevronDown className={cn("h-3 w-3 text-neutral-500 transition-transform", symbolOpen && "rotate-180")} />
            </div>
          </button>
          {symbolOpen ? (
            <div className="absolute z-30 mt-1 w-full rounded-sm border border-neutral-800 bg-[#0a0a0a] shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-800 px-2 py-1.5">
                <Search className="h-3 w-3 text-neutral-500" />
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
                  <div className="px-3 py-2 text-[11px] text-neutral-500">No symbols found</div>
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
                        "w-full flex items-center justify-between px-2 py-1 text-[11px] hover:bg-neutral-900",
                        s.symbol === normalizedSym && "bg-[#FFCD05]/10 text-[#FFCD05]",
                      )}
                    >
                      <span className="font-mono">{s.symbol}</span>
                      <span className="text-[10px] text-neutral-500 truncate ml-2 max-w-[55%]">
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
        <div className="grid grid-cols-6 gap-0.5">
          {QUICK_VOLS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setVol(q.toFixed(2))}
              className={cn(
                "h-5 rounded-sm border text-[10px] font-mono tabular-nums transition-colors",
                vol === q.toFixed(2)
                  ? "border-[#FFCD05] bg-[#FFCD05]/15 text-[#FFCD05]"
                  : "border-neutral-800 bg-[#0a0a0a] text-neutral-300 hover:border-neutral-700",
              )}
            >
              {q.toFixed(2)}
            </button>
          ))}
        </div>

        {/* Bid/Ask tiles — large institutional click-to-side targets */}
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={cn(
              "group flex flex-col items-stretch rounded-sm border px-2 py-1 text-left transition-colors",
              side === "sell"
                ? "border-red-500/70 bg-red-500/10"
                : "border-neutral-800 bg-[#0a0a0a] hover:border-red-500/40",
            )}
          >
            <span className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.18em] text-red-400/80">
              <span>Sell</span><span>Bid</span>
            </span>
            <span className={cn(
              "font-mono tabular-nums text-[15px] leading-tight font-semibold text-red-400 transition-colors",
              bidFlash === "up" && "text-red-300",
              bidFlash === "down" && "text-red-500",
            )}>
              {fmtPx(bid, digits)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={cn(
              "group flex flex-col items-stretch rounded-sm border px-2 py-1 text-left transition-colors",
              side === "buy"
                ? "border-emerald-500/70 bg-emerald-500/10"
                : "border-neutral-800 bg-[#0a0a0a] hover:border-emerald-500/40",
            )}
          >
            <span className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">
              <span>Buy</span><span>Ask</span>
            </span>
            <span className={cn(
              "font-mono tabular-nums text-[15px] leading-tight font-semibold text-emerald-400 transition-colors",
              askFlash === "up" && "text-emerald-300",
              askFlash === "down" && "text-emerald-500",
            )}>
              {fmtPx(ask, digits)}
            </span>
          </button>
        </div>

        {/* Market buttons — primary */}
        <div className="grid grid-cols-2 gap-1">
          <SideBtn tone="buy" disabled={!canSubmitMarket} loading={submitting && side === "buy"} onClick={() => submitMarket("buy")}>
            Buy @ MKT
          </SideBtn>
          <SideBtn tone="sell" disabled={!canSubmitMarket} loading={submitting && side === "sell"} onClick={() => submitMarket("sell")}>
            Sell @ MKT
          </SideBtn>
        </div>

        {/* Dev-only dry-run best-execution test */}
        {import.meta.env.DEV && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={async () => {
                setDebugInfo(null);
                const selectedSymbol = normalizedSym;
                const payload = {
                  tradeId: crypto.randomUUID(),
                  symbol: selectedSymbol || "XAUUSD",
                  side: "buy" as const,
                  orderType: "market" as const,
                  volume: Number(vol) || 0.01,
                  stopLoss: null,
                  takeProfit: null,
                  dryRun: true,
                  clientClickAt: new Date().toISOString(),
                };
                console.log("[OrderTicket] Dry Run:", payload);
                setDebugInfo({
                  functionUsed: "submit-best-execution-order",
                  payload,
                  rawEdgeFunctionResponse: undefined,
                  edgeFunctionError: null,
                  at: new Date().toISOString(),
                });
                try {
                  const { data, error } = await supabase.functions.invoke(
                    "submit-best-execution-order",
                    { body: payload },
                  );
                  console.log("[OrderTicket] Dry Run response:", { data, error });
                  const edgeFunctionError = error?.message || null;
                  const validationError =
                    data?.step === "deploy_verify_submit_best_execution_order" &&
                    data?.version === "DEPLOY_VERIFY_BEST_EXEC_V3_2026_05_19_0049"
                      ? undefined
                      : "Frontend is not showing the real Edge Function response.";
                  if (validationError) toast.error(validationError);
                  setDebugInfo({
                    functionUsed: "submit-best-execution-order",
                    payload,
                    rawEdgeFunctionResponse: data,
                    edgeFunctionError,
                    validationError,
                    at: new Date().toISOString(),
                  });
                  window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
                } catch (e: any) {
                  const validationError = "Frontend is not showing the real Edge Function response.";
                  toast.error(validationError);
                  setDebugInfo({
                    functionUsed: "submit-best-execution-order",
                    payload,
                    rawEdgeFunctionResponse: null,
                    edgeFunctionError: e?.message || String(e),
                    validationError,
                    at: new Date().toISOString(),
                  });
                }
              }}
              className="h-5 rounded-sm border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-2 text-[9px] font-mono uppercase tracking-wider text-[#FFCD05] hover:bg-[#FFCD05]/20"
            >
              Dry Run Best Execution
            </button>
          </div>
        )}

        {/* Pending — single condensed row */}
        <div className="grid grid-cols-4 gap-1">
          <SideBtn tone="buy" outline small disabled={pendingDisabled} title="Pending orders coming soon">Buy Stop</SideBtn>
          <SideBtn tone="sell" outline small disabled={pendingDisabled} title="Pending orders coming soon">Sell Stop</SideBtn>
          <SideBtn tone="buy" outline small disabled={pendingDisabled} title="Pending orders coming soon">Buy Lmt</SideBtn>
          <SideBtn tone="sell" outline small disabled={pendingDisabled} title="Pending orders coming soon">Sell Lmt</SideBtn>
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
              className="w-full h-6 rounded-sm border border-red-500/30 bg-[#0a0a0a] px-1.5 text-[10.5px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
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
              className="w-full h-6 rounded-sm border border-emerald-500/30 bg-[#0a0a0a] px-1.5 text-[10.5px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
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

        {(volumeError || slTpError) ? (
          <div className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {volumeError || slTpError}
          </div>
        ) : null}

        {/* Summary */}
        <div className="rounded-sm border border-neutral-800 bg-[#0a0a0a] px-2 py-1 space-y-[1px]">
          <SummaryRow label="Entry" value={fmtPx(entryPrice || null, digits)} tone={side === "buy" ? "pos" : "neg"} />
          <SummaryRow label="Notional" value={fmt(notional, currency)} />
          <SummaryRow label="Margin" value={fmt(marginRequired, currency)} />
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
      <ExecutionResultModal result={execResult} onClose={() => setExecResult(null)} />

      {debugInfo && (
        <div className="mt-2 rounded border border-[#FFCD05]/40 bg-[#0a0a0a] text-[10px] font-mono overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-[#050505] px-2 py-1">
            <span className="uppercase tracking-widest text-[#FFCD05]">
              Order Debug · {debugInfo.functionUsed}
            </span>
            <button
              type="button"
              onClick={() => setDebugInfo(null)}
              className="text-neutral-500 hover:text-neutral-200"
            >
              ×
            </button>
          </div>
          <div className="p-2 space-y-1.5">
            {!('rawEdgeFunctionResponse' in debugInfo) && (
              <>
                <div className="text-neutral-500">at {debugInfo.at}</div>
                <div>
                  <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-0.5">Payload</div>
                  <pre className="max-h-[140px] overflow-auto whitespace-pre-wrap break-all text-neutral-200">
{JSON.stringify(debugInfo.payload, null, 2)}
                  </pre>
                </div>
              </>
            )}
            {debugInfo.error && (
              <div>
                <div className="text-red-400 uppercase tracking-widest text-[9px] mb-0.5">Error</div>
                <pre className="max-h-[100px] overflow-auto whitespace-pre-wrap break-all text-red-300">
{debugInfo.error}
                </pre>
              </div>
            )}
            {debugInfo.validationError && (
              <div>
                <div className="text-red-400 uppercase tracking-widest text-[9px] mb-0.5">Validation Error</div>
                <pre className="max-h-[100px] overflow-auto whitespace-pre-wrap break-all text-red-300">
{debugInfo.validationError}
                </pre>
              </div>
            )}
            {"rawEdgeFunctionResponse" in debugInfo && (
              <div>
                <div className="text-emerald-400 uppercase tracking-widest text-[9px] mb-0.5">rawEdgeFunctionResponse</div>
                <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all text-neutral-200">
{JSON.stringify(debugInfo.rawEdgeFunctionResponse, null, 2)}
                </pre>
              </div>
            )}
            {"edgeFunctionError" in debugInfo && (
              <div>
                <div className="text-red-400 uppercase tracking-widest text-[9px] mb-0.5">edgeFunctionError</div>
                <pre className="max-h-[100px] overflow-auto whitespace-pre-wrap break-all text-red-300">
{JSON.stringify(debugInfo.edgeFunctionError, null, 2)}
                </pre>
              </div>
            )}
            {debugInfo.response !== undefined && (
              <div>
                <div className="text-emerald-400 uppercase tracking-widest text-[9px] mb-0.5">Response</div>
                <pre className="max-h-[180px] overflow-auto whitespace-pre-wrap break-all text-neutral-200">
{JSON.stringify(debugInfo.response, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DenseSelect = ({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) => (
  <div className="space-y-0.5">
    <div className="text-[8.5px] font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-6 rounded-sm border border-neutral-800 bg-[#0a0a0a] px-1.5 pr-5 text-[10.5px] text-neutral-100 appearance-none focus:outline-none focus:ring-1 focus:ring-[#FFCD05]/60 focus:border-[#FFCD05]/60"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500 pointer-events-none" />
    </div>
  </div>
);

const DenseInput = ({
  label, value, onChange, disabled, mono,
}: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean; mono?: boolean }) => (
  <div className="space-y-0.5">
    <div className="text-[8.5px] font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      inputMode="decimal"
      className={cn(
        "w-full h-6 rounded-sm border border-neutral-800 bg-[#0a0a0a] px-1.5 text-[10.5px] text-neutral-100 focus:outline-none focus:ring-1 focus:ring-[#FFCD05]/60 focus:border-[#FFCD05]/60 disabled:opacity-60",
        mono && "font-mono tabular-nums text-right",
      )}
    />
  </div>
);

const SideBtn = ({
  tone, outline, small, disabled, loading, onClick, title, children,
}: {
  tone: "buy" | "sell";
  outline?: boolean;
  small?: boolean;
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
        "rounded-sm font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:cursor-not-allowed",
        small ? "h-6 text-[9.5px]" : "h-8 text-[11px]",
        outline
          ? buy
            ? "border border-emerald-600/50 bg-emerald-600/10 text-emerald-300 hover:bg-emerald-600/20"
            : "border border-red-600/50 bg-red-600/10 text-red-300 hover:bg-red-600/20"
          : buy
            ? "bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500"
            : "bg-red-600 text-white border border-red-500 hover:bg-red-500",
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
      "h-6 rounded-sm border text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors",
      danger
        ? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20"
        : "border-neutral-800 bg-[#0a0a0a] text-neutral-300 hover:border-neutral-700 hover:text-neutral-100",
    )}
  >
    {icon} {label}
  </button>
);

export default BlackArrowTradePanel;
