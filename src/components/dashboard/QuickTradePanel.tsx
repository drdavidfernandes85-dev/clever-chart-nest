import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  Plus,
  Minus,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { useMTAccount } from "@/hooks/useMTAccount";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AUD/USD", "GBP/JPY", "USD/CAD", "NZD/USD"];

const LEVERAGE = 30;

// Map a "EUR/USD" style symbol to base/quote for the FX API.
const splitPair = (sym: string) => {
  const [base, quote] = sym.split("/");
  return { base, quote };
};

const tradeSchema = z.object({
  symbol: z.string().min(3).max(10),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  lots: z.number().positive().max(100),
  entry: z.number().nonnegative().optional(),
  sl: z.number().nonnegative().optional(),
  tp: z.number().nonnegative().optional(),
});

const pipMul = (sym: string) =>
  sym.includes("JPY") ? 100 : sym.includes("XAU") ? 10 : 10000;

const pipValuePerLot = (sym: string) => (sym.includes("XAU") ? 10 : 10);

interface Props {
  compact?: boolean;
}

const QuickTradePanel = ({ compact = false }: Props) => {
  const {
    symbol: ctxSymbol,
    side: ctxSide,
    setSymbol: setCtxSymbol,
    setSide: setCtxSide,
    prefill,
    prefillNonce,
  } = useQuickTrade();
  const { account } = useMTAccount();
  const { user } = useAuth();

  // Live equity from MT account; fall back to 0 if not connected.
  const accountEquity =
    account && account.status === "connected" && account.equity != null
      ? Number(account.equity)
      : 0;

  const [type, setType] = useState<"market" | "limit">("market");
  const [lots, setLots] = useState("1.00");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [openSymbols, setOpenSymbols] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [signalId, setSignalId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const symbol = ctxSymbol;
  const side = ctxSide;

  // Apply prefill (lots, entry, SL, TP, signal_id) every time openTrade() is called.
  useEffect(() => {
    if (!prefill) return;
    if (prefill.lots) setLots(prefill.lots);
    if (prefill.entry) {
      setEntry(prefill.entry);
      setType("limit");
    } else {
      setType("market");
      setEntry("");
    }
    setSl(prefill.sl ?? "");
    setTp(prefill.tp ?? "");
    setSignalId(prefill.signalId ?? null);
    // Visual confirmation: scroll the inline panel into view + flash it
    if (typeof window !== "undefined") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1200);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  // Reset SL/TP when user manually changes symbol (but not when prefilled).
  useEffect(() => {
    setEntry((prev) => prev);
  }, [symbol]);

  // Poll live price for the active symbol every 5s.
  useEffect(() => {
    let cancelled = false;
    const fetchPrice = async () => {
      try {
        const { base, quote } = splitPair(symbol);
        if (!base || !quote) return;

        let p: number | null = null;

        if (base === "XAU" || quote === "XAU") {
          const res = await fetch("https://api.gold-api.com/price/XAU", {
            cache: "no-store",
          });
          const json = await res.json();
          p = Number(json?.price);
        } else {
          const res = await fetch(
            `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`,
            { cache: "no-store" },
          );
          const json = await res.json();
          p = Number(json?.rates?.[quote]);
        }

        if (Number.isFinite(p) && !cancelled) {
          setLivePrices((prev) => ({ ...prev, [symbol]: p as number }));
        }
      } catch {
        /* swallow */
      }
    };
    fetchPrice();
    const id = window.setInterval(fetchPrice, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  const livePrice = livePrices[symbol] ?? 0;
  const refPrice = type === "limit" && entry ? parseFloat(entry) || livePrice : livePrice;

  const lotsNum = parseFloat(lots) || 0;

  const margin = useMemo(() => {
    const notional = lotsNum * (symbol.includes("XAU") ? refPrice * 100 : 100000);
    return notional / LEVERAGE;
  }, [lotsNum, refPrice, symbol]);

  // Potential P&L preview based on TP target
  const tpNum = parseFloat(tp) || 0;
  const slNum = parseFloat(sl) || 0;

  const projectedPnl = useMemo(() => {
    if (!tpNum || lotsNum <= 0) return 0;
    const dir = side === "buy" ? 1 : -1;
    const diff = (tpNum - refPrice) * dir;
    const pips = diff * pipMul(symbol);
    return pips * pipValuePerLot(symbol) * lotsNum * (symbol.includes("XAU") ? 10 : 1);
  }, [tpNum, refPrice, side, lotsNum, symbol]);

  const projectedRiskUsd = useMemo(() => {
    if (!slNum || lotsNum <= 0) return 0;
    const dir = side === "buy" ? 1 : -1;
    const diff = (refPrice - slNum) * dir;
    const pips = diff * pipMul(symbol);
    return Math.abs(pips * pipValuePerLot(symbol) * lotsNum * (symbol.includes("XAU") ? 10 : 1));
  }, [slNum, refPrice, side, lotsNum, symbol]);

  const projectedPnlPct = accountEquity > 0 ? (projectedPnl / accountEquity) * 100 : 0;
  const riskPct = accountEquity > 0 ? (projectedRiskUsd / accountEquity) * 100 : 0;

  const adjustLots = (delta: number) => {
    const next = Math.max(0.01, Math.min(100, lotsNum + delta));
    setLots(next.toFixed(2));
  };

  const handlePlace = () => {
    const parsed = tradeSchema.safeParse({
      symbol,
      side,
      type,
      lots: lotsNum,
      entry: entry ? parseFloat(entry) : undefined,
      sl: slNum || undefined,
      tp: tpNum || undefined,
    });
    if (!parsed.success) {
      toast.error("Invalid order", {
        description: parsed.error.issues[0]?.message ?? "Check your inputs",
      });
      return;
    }
    if (type === "limit" && !parsed.data.entry) {
      toast.error("Limit order requires entry price");
      return;
    }

    // --- Reference price (limit entry or live price) ---
    const ref =
      type === "limit" && parsed.data.entry ? parsed.data.entry : livePrice;
    if (!ref || ref <= 0) {
      toast.error("Live price not available yet", {
        description: "Wait a couple of seconds for the price to load and try again.",
      });
      return;
    }

    // --- Auto-fill SL/TP at 20 pips from entry if user left them empty ---
    // 1 pip = 0.0001 for most pairs, 0.01 for JPY pairs, 0.1 for XAU.
    const pipSize = symbol.includes("JPY") ? 0.01 : symbol.includes("XAU") ? 0.1 : 0.0001;
    const distance = 20 * pipSize;
    const decimals = symbol.includes("JPY") ? 3 : symbol.includes("XAU") ? 2 : 5;

    let finalSl = slNum;
    let finalTp = tpNum;
    if (!finalSl) {
      finalSl = isBuy ? ref - distance : ref + distance;
      setSl(finalSl.toFixed(decimals));
    }
    if (!finalTp) {
      finalTp = isBuy ? ref + distance : ref - distance;
      setTp(finalTp.toFixed(decimals));
    }

    // Sanity: SL/TP must be in the same order of magnitude as the live price.
    const outOfRange = (v?: number) =>
      v != null && (v > ref * 5 || v < ref / 5);
    if (outOfRange(finalSl) || outOfRange(finalTp)) {
      toast.error("Stop Loss / Take Profit look wrong", {
        description: `Current ${symbol} price is ~${ref.toFixed(decimals)}. Your SL/TP must be in the same range.`,
      });
      return;
    }
    if (isBuy) {
      if (finalSl >= ref) {
        toast.error("Invalid Stop Loss", {
          description: `For a BUY, SL must be BELOW current price (${ref.toFixed(decimals)}).`,
        });
        return;
      }
      if (finalTp <= ref) {
        toast.error("Invalid Take Profit", {
          description: `For a BUY, TP must be ABOVE current price (${ref.toFixed(decimals)}).`,
        });
        return;
      }
    } else {
      if (finalSl <= ref) {
        toast.error("Invalid Stop Loss", {
          description: `For a SELL, SL must be ABOVE current price (${ref.toFixed(decimals)}).`,
        });
        return;
      }
      if (finalTp >= ref) {
        toast.error("Invalid Take Profit", {
          description: `For a SELL, TP must be BELOW current price (${ref.toFixed(decimals)}).`,
        });
        return;
      }
    }

    setConfirming(true);
  };

  // Convert "EUR/USD" → "EURUSD" so the EA can find the broker symbol.
  const toBrokerSymbol = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

  const confirmTrade = async () => {
    if (!user) {
      toast.error("Please sign in to place a trade");
      setConfirming(false);
      return;
    }
    if (!account || account.status !== "connected") {
      toast.error("MT account not connected", {
        description: "Connect your MetaTrader EA from Connect MT first.",
      });
      setConfirming(false);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        user_id: user.id,
        account_id: account.id,
        signal_id: signalId,
        symbol: toBrokerSymbol(symbol),
        side,
        order_type: type,
        volume: Number(lotsNum.toFixed(2)),
        entry_price: type === "limit" && entry ? parseFloat(entry) : null,
        stop_loss: slNum || null,
        take_profit: tpNum || null,
      };
      console.log("[QuickTrade] inserting order:", payload);
      const { error } = await supabase.from("mt_pending_orders").insert(payload);
      if (error) {
        console.error("[QuickTrade] insert error:", error);
        throw error;
      }
      setConfirming(false);
      setSignalId(null);
      toast.success(`Order queued: ${side.toUpperCase()} ${lotsNum.toFixed(2)} ${symbol}`, {
        description:
          "Sent to your EA. It will execute on the next poll (≤5 seconds).",
      });
    } catch (e: any) {
      toast.error("Could not queue order", {
        description: e?.message ?? "Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isBuy = side === "buy";
  const sideAccent = isBuy
    ? "from-emerald-500/15 to-transparent border-emerald-500/30"
    : "from-red-500/15 to-transparent border-red-500/30";

  return (
    <>
      <motion.div
        ref={rootRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`rounded-2xl border bg-gradient-to-br ${sideAccent} backdrop-blur-sm overflow-hidden transition-all duration-500 ${
          flash ? "ring-2 ring-primary scale-[1.01]" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5 bg-card/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <h3 className="font-heading text-sm font-semibold text-foreground tracking-wide">
              Quick Trade
            </h3>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>

        <div className="p-5 space-y-4 bg-card/60">
          {/* Symbol selector */}
          <div className="relative">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Symbol
            </Label>
            <button
              type="button"
              onClick={() => setOpenSymbols((v) => !v)}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background/60 px-3.5 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="font-heading text-base font-bold text-foreground">
                  {symbol}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {livePrice.toFixed(symbol.includes("JPY") ? 3 : symbol.includes("XAU") ? 2 : 5)}
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  openSymbols ? "rotate-180" : ""
                }`}
              />
            </button>
            {openSymbols && (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border/50 bg-popover shadow-xl">
                {SYMBOLS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => {
                        setCtxSymbol(s);
                        setOpenSymbols(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-heading font-semibold transition-colors hover:bg-primary/10 hover:text-primary ${
                        s === symbol ? "text-primary bg-primary/5" : "text-foreground"
                      }`}
                    >
                      <span>{s}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {(livePrices[s] ?? 0).toFixed(s.includes("JPY") ? 3 : s.includes("XAU") ? 2 : 5)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Side toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCtxSide("buy")}
              className={`h-12 rounded-xl font-heading text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ring-1 ${
                isBuy
                  ? "bg-emerald-500/20 text-emerald-400 ring-emerald-500/50 shadow-[0_0_25px_-5px_hsl(160_84%_50%/0.5)]"
                  : "bg-muted/30 text-muted-foreground ring-border/40 hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Buy
            </button>
            <button
              onClick={() => setCtxSide("sell")}
              className={`h-12 rounded-xl font-heading text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ring-1 ${
                !isBuy
                  ? "bg-red-500/20 text-red-400 ring-red-500/50 shadow-[0_0_25px_-5px_hsl(0_84%_60%/0.5)]"
                  : "bg-muted/30 text-muted-foreground ring-border/40 hover:text-foreground"
              }`}
            >
              <TrendingDown className="h-4 w-4" />
              Sell
            </button>
          </div>

          {/* Order type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("market")}
              className={`h-9 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ring-1 ${
                type === "market"
                  ? "bg-primary/15 text-primary ring-primary/40"
                  : "bg-muted/20 text-muted-foreground ring-border/30 hover:text-foreground"
              }`}
            >
              Market
            </button>
            <button
              onClick={() => setType("limit")}
              className={`h-9 rounded-lg font-mono text-[10px] uppercase tracking-widest transition-all ring-1 ${
                type === "limit"
                  ? "bg-primary/15 text-primary ring-primary/40"
                  : "bg-muted/20 text-muted-foreground ring-border/30 hover:text-foreground"
              }`}
            >
              Limit
            </button>
          </div>

          {/* Lots stepper */}
          <div>
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Lots
            </Label>
            <div className="flex items-stretch gap-2">
              <button
                onClick={() => adjustLots(-0.1)}
                aria-label="Decrease lots"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
              >
                <Minus className="h-4 w-4" />
              </button>
              <Input
                inputMode="decimal"
                value={lots}
                onChange={(e) =>
                  setLots(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))
                }
                className="h-12 flex-1 bg-background/60 border-border/50 font-mono text-base font-bold tabular-nums text-center focus-visible:ring-primary/40"
              />
              <button
                onClick={() => adjustLots(0.1)}
                aria-label="Increase lots"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex gap-1">
              {[0.1, 0.5, 1, 2, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setLots(v.toFixed(2))}
                  className="flex-1 h-7 rounded-md bg-muted/30 hover:bg-primary/10 hover:text-primary text-[10px] font-mono tabular-nums text-muted-foreground transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Entry price (limit only) */}
          {type === "limit" && (
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Entry Price
              </Label>
              <Input
                inputMode="decimal"
                placeholder={livePrice.toFixed(5)}
                value={entry}
                onChange={(e) =>
                  setEntry(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-primary/40"
              />
            </div>
          )}

          {/* SL / TP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-red-400/80 mb-1.5 block">
                Stop Loss
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={sl}
                onChange={(e) =>
                  setSl(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-red-500/40"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 mb-1.5 block">
                Take Profit
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={tp}
                onChange={(e) =>
                  setTp(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-emerald-500/40"
              />
            </div>
          </div>

          {/* Live preview metrics */}
          <div className="rounded-xl border border-border/40 bg-background/40 divide-y divide-border/30 overflow-hidden">
            <Row label="Est. Margin" value={`$${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
            <Row
              label="Potential P&L"
              value={
                tpNum
                  ? `${projectedPnl >= 0 ? "+" : "−"}$${Math.abs(projectedPnl).toFixed(2)}  (${
                      projectedPnl >= 0 ? "+" : "−"
                    }${Math.abs(projectedPnlPct).toFixed(2)}%)`
                  : "—"
              }
              valueClass={
                tpNum
                  ? projectedPnl >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                  : "text-muted-foreground"
              }
            />
            <Row
              label="Risk %"
              value={slNum ? `${riskPct.toFixed(2)}%  ($${projectedRiskUsd.toFixed(2)})` : "—"}
              valueClass={
                slNum
                  ? riskPct > 3
                    ? "text-red-400"
                    : riskPct > 1.5
                    ? "text-primary"
                    : "text-emerald-400"
                  : "text-muted-foreground"
              }
            />
          </div>

          {/* Place trade button */}
          <Button
            onClick={handlePlace}
            className={`w-full h-14 font-bold text-base tracking-wide rounded-xl transition-all hover:scale-[1.01] ${
              isBuy
                ? "bg-emerald-500 hover:bg-emerald-500 text-white shadow-[0_10px_30px_-10px_hsl(160_84%_50%/0.7)] hover:shadow-[0_15px_40px_-10px_hsl(160_84%_50%/0.9)]"
                : "bg-red-500 hover:bg-red-500 text-white shadow-[0_10px_30px_-10px_hsl(0_84%_60%/0.7)] hover:shadow-[0_15px_40px_-10px_hsl(0_84%_60%/0.9)]"
            }`}
          >
            PLACE {isBuy ? "BUY" : "SELL"} TRADE
          </Button>
        </div>
      </motion.div>

      {/* Confirmation modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {confirming && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirming(false)}
                  className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ type: "spring", damping: 22, stiffness: 280 }}
                  className="fixed left-1/2 top-1/2 z-[101] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
                >
                  <div
                    className={`px-5 py-4 border-b border-border/40 ${
                      isBuy ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${isBuy ? "text-emerald-400" : "text-red-400"}`}
                      />
                      <h4 className="font-heading text-sm font-bold text-foreground">
                        Confirm {isBuy ? "Buy" : "Sell"} Order
                      </h4>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-2.5 text-xs">
                    <ConfirmRow label="Symbol" value={symbol} />
                    <ConfirmRow
                      label="Side"
                      value={isBuy ? "BUY (long)" : "SELL (short)"}
                      valueClass={isBuy ? "text-emerald-400" : "text-red-400"}
                    />
                    <ConfirmRow label="Type" value={type.toUpperCase()} />
                    <ConfirmRow label="Size" value={`${lotsNum.toFixed(2)} lots`} />
                    {type === "limit" && entry && (
                      <ConfirmRow label="Entry" value={entry} />
                    )}
                    {sl && <ConfirmRow label="Stop Loss" value={sl} valueClass="text-red-400" />}
                    {tp && <ConfirmRow label="Take Profit" value={tp} valueClass="text-emerald-400" />}
                    <ConfirmRow
                      label="Est. Margin"
                      value={`$${margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    />
                    {slNum > 0 && (
                      <ConfirmRow
                        label="Risk"
                        value={`${riskPct.toFixed(2)}% ($${projectedRiskUsd.toFixed(2)})`}
                        valueClass={
                          riskPct > 3
                            ? "text-red-400"
                            : riskPct > 1.5
                            ? "text-primary"
                            : "text-emerald-400"
                        }
                      />
                    )}
                  </div>
                  <div className="flex gap-2 px-5 py-4 border-t border-border/40 bg-muted/20">
                    <Button
                      variant="ghost"
                      onClick={() => setConfirming(false)}
                      disabled={submitting}
                      className="flex-1 h-11"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={confirmTrade}
                      disabled={submitting}
                      className={`flex-1 h-11 font-bold ${
                        isBuy
                          ? "bg-emerald-500 hover:bg-emerald-500/90 text-white"
                          : "bg-red-500 hover:bg-red-500/90 text-white"
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Sending to EA…
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          PLACE TRADE
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

const Row = ({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="flex items-center justify-between px-3.5 py-2.5">
    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <span className={`font-mono text-xs font-semibold tabular-nums ${valueClass}`}>
      {value}
    </span>
  </div>
);

const ConfirmRow = ({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
    <span className={`font-heading font-bold ${valueClass}`}>{value}</span>
  </div>
);

export default QuickTradePanel;
