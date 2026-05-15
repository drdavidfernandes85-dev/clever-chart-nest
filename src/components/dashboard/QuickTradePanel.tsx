import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
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
  Plug,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { z } from "zod";
import { useQuickTrade } from "@/contexts/QuickTradeContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBrokerSymbols, FALLBACK_SYMBOLS } from "@/contexts/BrokerSymbolsContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { fetchMarketQuotes } from "@/lib/markets";
import { Checkbox } from "@/components/ui/checkbox";
import {
  validateStops,
  getEffectiveStops,
  matchQuote,
} from "@/lib/quick-trade-validation";
import { RefreshCw } from "lucide-react";

// Broker-safe defaults — used until get-mt5-symbol-data returns the
// connected broker's live symbol list.
interface SymbolItem {
  displayName: string;
  brokerSymbol: string;
}
const toBrokerSymbol = (label: string) => label.replace(/\//g, "").toUpperCase();
const DEFAULT_SYMBOL_ITEMS: SymbolItem[] = FALLBACK_SYMBOLS.map((s) => ({
  displayName: s.symbol,
  brokerSymbol: toBrokerSymbol(s.symbol),
}));

// Common broker symbol aliases. Maps a normalized user-facing token to a
// list of equivalent root names that brokers commonly use.
const SYMBOL_ALIASES: Record<string, string[]> = {
  XAUUSD: ["GOLD", "XAU/USD", "XAUUSD"],
  GOLD: ["XAUUSD"],
  XAGUSD: ["SILVER", "XAG/USD"],
  SILVER: ["XAGUSD"],
  US30: ["DJ30", "DOW30", "WS30", "USA30"],
  NAS100: ["NDX100", "USTEC", "USA100", "NQ100"],
  SPX500: ["US500", "SP500", "USA500"],
  GER40: ["DAX40", "DE40", "GER30"],
  BTCUSD: ["BTCUSDT", "BITCOIN"],
  BTCUSDT: ["BTCUSD"],
};

// Normalize a symbol: trim, uppercase, strip "/", "-", "_", and spaces.
const normalizeSymbol = (s: string) =>
  (s ?? "").trim().toUpperCase().replace(/[\s/_-]/g, "");

// Try to resolve a user-entered symbol against the live broker symbols list.
// Matches exact, case-insensitive, alias, and broker-suffix variants
// (e.g. "EURUSD" matches "EURUSD.m", "EURUSD.cash", "EURUSDi").
const resolveBrokerSymbol = (
  input: string,
  list: { symbol: string }[],
): string | null => {
  if (!input || list.length === 0) return null;
  const target = normalizeSymbol(input);
  const candidates = new Set<string>([target, ...(SYMBOL_ALIASES[target] ?? []).map(normalizeSymbol)]);
  // 1. Exact normalized match
  for (const s of list) {
    if (candidates.has(normalizeSymbol(s.symbol))) return s.symbol;
  }
  // 2. Suffix match: broker root starts with target (e.g. EURUSD.m → EURUSD)
  for (const s of list) {
    const norm = normalizeSymbol(s.symbol);
    for (const c of candidates) {
      if (norm.startsWith(c) && norm.length - c.length <= 4) return s.symbol;
    }
  }
  return null;
};

const QUICK_LOTS = [0.01, 0.02, 0.05, 0.1];

const tradeSchema = z.object({
  symbol: z.string().min(3).max(12),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  lots: z.number().positive().max(100),
  entry: z.number().nonnegative().optional(),
  sl: z.number().nonnegative().optional(),
  tp: z.number().nonnegative().optional(),
});

interface LiveAccount {
  account_number?: string;
  server?: string;
  equity?: number;
  currency?: string;
  symbols?: string[];
}

interface Props {
  compact?: boolean;
  symbols?: string[];
  onSymbolChange?: (label: string) => void;
}

const QuickTradePanel = ({ symbols: symbolsProp, onSymbolChange }: Props) => {
  const {
    symbol: ctxSymbol,
    side: ctxSide,
    setSymbol: setCtxSymbol,
    setSide: setCtxSide,
    prefill,
    prefillNonce,
  } = useQuickTrade();
  const { user } = useAuth();

  // --- Connected MT5 account (Trading Layer) ---
  const [accountConnected, setAccountConnected] = useState<boolean | null>(null);
  const [account, setAccount] = useState<LiveAccount | null>(null);
  const [accountChecking, setAccountChecking] = useState(true);

  const loadAccount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-live-account", {
        body: { refresh: true },
      });
      if (error) throw error;
      if ((data as any)?.success === true) {
        const acc = (data as any).account ?? (data as any).data ?? null;
        setAccount(acc);
        setAccountConnected(true);
      } else {
        setAccount(null);
        setAccountConnected(false);
      }
    } catch {
      setAccount(null);
      setAccountConnected(false);
    } finally {
      setAccountChecking(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  // Symbol universe: prop > broker symbols (live) > fallback.
  // Each item carries both a displayName (e.g. "EUR/USD") and the exact
  // broker symbol (e.g. "EURUSD") that must be sent to execute-trade.
  const {
    symbols: brokerSymbols,
    isLive: brokerSymbolsLive,
    loading: brokerSymbolsLoading,
    error: brokerSymbolsError,
    lastResponse: brokerSymbolsLastResponse,
    refresh: refreshBrokerSymbols,
    selectedSymbolValid: ctxSelectedSymbolValid,
    selectedSymbolInfo: ctxSelectedSymbolInfo,
    tick: ctxTick,
    setSelectedBrokerSymbol,
  } = useBrokerSymbols();
  const { isAdmin } = useIsAdmin();
  const showDebug = isAdmin;
  const SYMBOL_ITEMS = useMemo<SymbolItem[]>(() => {
    if (symbolsProp && symbolsProp.length > 0) {
      return symbolsProp.map((label) => ({
        displayName: label,
        brokerSymbol: toBrokerSymbol(label),
      }));
    }
    if (brokerSymbols.length > 0) {
      return brokerSymbols.map((s) => ({
        displayName: s.symbol,
        brokerSymbol: s.symbol,
      }));
    }
    return DEFAULT_SYMBOL_ITEMS;
  }, [symbolsProp, brokerSymbols]);

  // Resolve currently selected item from context value (matches either
  // displayName or brokerSymbol so legacy "EUR/USD" values keep working).
  const selectedItem: SymbolItem =
    SYMBOL_ITEMS.find(
      (it) => it.displayName === ctxSymbol || it.brokerSymbol === ctxSymbol,
    ) ?? SYMBOL_ITEMS[0];

  // Make sure context tracks an entry that exists in the list.
  useEffect(() => {
    if (!selectedItem) return;
    if (
      ctxSymbol !== selectedItem.displayName &&
      ctxSymbol !== selectedItem.brokerSymbol
    ) {
      setCtxSymbol(selectedItem.displayName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SYMBOL_ITEMS]);

  const accountEquity =
    accountConnected && account?.equity != null ? Number(account.equity) : 0;
  const accountCurrency = account?.currency || "USD";

  const [type, setType] = useState<"market" | "limit">("market");
  const [lots, setLots] = useState("0.01");
  const [entry, setEntry] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [noStops, setNoStops] = useState(false);
  const [openSymbols, setOpenSymbols] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tradeIdSrc, setTradeIdSrc] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceNonce, setPriceNonce] = useState(0);
  const [resultState, setResultState] = useState<{
    type: "filled" | "placed" | "rejected" | "failed";
    message: string;
  } | null>(null);
  const [flash, setFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const symbolDisplay = selectedItem?.displayName ?? ctxSymbol;
  // Resolve the broker symbol field-by-field, then strip "/" and uppercase.
  const rawBrokerSymbol: string =
    (selectedItem as any)?.brokerSymbol ||
    (selectedItem as any)?.name ||
    (selectedItem as any)?.symbol ||
    (selectedItem as any)?.displayName?.replace(/\//g, "") ||
    (selectedItem as any)?.label?.replace(/\//g, "") ||
    toBrokerSymbol(ctxSymbol);
  const normalizedSymbol = (rawBrokerSymbol ?? "")
    .replace(/\//g, "")
    .replace(/-/g, "")
    .toUpperCase();

  // Strict normalized match against the loaded broker symbols list.
  const existsInBrokerSymbols = brokerSymbols.some((s: any) =>
    String(s.brokerSymbol || s.name || s.symbol || "")
      .replace(/\//g, "")
      .replace(/-/g, "")
      .toUpperCase() === normalizedSymbol,
  );
  const symbolsLoaded = brokerSymbolsLive && brokerSymbols.length > 0;
  const lastSelectedSymbolValid =
    (brokerSymbolsLastResponse as any)?.selectedSymbolValid === true ||
    ctxSelectedSymbolValid === true;
  const isTradableSymbol = existsInBrokerSymbols || lastSelectedSymbolValid;

  useEffect(() => {
    if (normalizedSymbol) setSelectedBrokerSymbol(normalizedSymbol);
  }, [normalizedSymbol, setSelectedBrokerSymbol]);

  const selectedSymbolValid = lastSelectedSymbolValid;

  const symbolValidation: { ok: boolean; sentSymbol: string; reason: string; canRetry?: boolean } = (() => {
    if (accountConnected !== true) {
      return {
        ok: false,
        sentSymbol: normalizedSymbol,
        reason: "Connect your MT5 account before trading.",
      };
    }
    if (selectedSymbolValid !== true) {
      if (brokerSymbolsLoading) {
        return { ok: false, sentSymbol: normalizedSymbol, reason: "Loading broker symbols..." };
      }
      return {
        ok: false,
        sentSymbol: normalizedSymbol,
        reason: "This symbol is not available on your connected MT5 account.",
        canRetry: true,
      };
    }
    if (!(Number(lots) > 0)) {
      return { ok: false, sentSymbol: normalizedSymbol, reason: "Volume must be greater than 0." };
    }
    return { ok: true, sentSymbol: normalizedSymbol, reason: "" };
  })();

  const brokerSymbol = symbolValidation.sentSymbol;
  const side = ctxSide;
  const isBuy = side === "buy";

  // Apply prefill from Take This Trade buttons.
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
    setTradeIdSrc(prefill.signalId ?? null);
    if (typeof window !== "undefined") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1200);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce]);

  const lotsNum = parseFloat(lots) || 0;
  const slNum = sl.trim() === "" ? null : parseFloat(sl);
  const tpNum = tp.trim() === "" ? null : parseFloat(tp);
  const slValid = slNum !== null && !isNaN(slNum) && slNum > 0;
  const tpValid = tpNum !== null && !isNaN(tpNum) && tpNum > 0;

  // Effective values that will be sent to the broker. Empty/invalid → null.
  // The "Place trade without SL/TP" checkbox forces both to null.
  const { stopLoss: effectiveSl, takeProfit: effectiveTp } = getEffectiveStops({
    sl: slNum,
    tp: tpNum,
    noStops,
  });

  // Preview tradeId — generated once per modal open so what the user sees in
  // "Execute Trade Payload" is exactly what gets sent to the edge function.
  const previewTradeId = useMemo(
    () => tradeIdSrc ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : ""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confirming, tradeIdSrc],
  );

  // Fetch a current market price for the selected broker symbol so we can
  // validate manual SL/TP before sending the order. Refresh every 15s, plus
  // on demand via the retry button (priceNonce).
  useEffect(() => {
    if (!brokerSymbol) {
      setCurrentPrice(null);
      setPriceError(null);
      setPriceLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setPriceLoading(true);
      try {
        const quotes = await fetchMarketQuotes();
        if (cancelled) return;
        const match = matchQuote(brokerSymbol, quotes);
        if (match?.price != null) {
          setCurrentPrice(match.price);
          setPriceError(null);
        } else {
          setCurrentPrice(null);
          setPriceError(
            quotes.length === 0
              ? "Quote service unavailable"
              : "No live quote for this symbol",
          );
        }
      } catch {
        if (!cancelled) {
          setCurrentPrice(null);
          setPriceError("Failed to fetch current price");
        }
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [brokerSymbol, priceNonce]);

  // Validate SL/TP relative to the current market price.
  const stopsError = validateStops({
    side,
    currentPrice,
    sl: slNum,
    tp: tpNum,
    noStops,
  });

  // Symbol specs (contract size, tick value/size) are not yet exposed by
  // Trading Layer — until they are we cannot calculate accurate P&L or risk.
  const symbolSpecs: { tickValue: number; tickSize: number; contractSize: number } | null =
    null;

  const canCalculateRisk =
    accountEquity > 0 && slValid && symbolSpecs !== null;

  const adjustLots = (delta: number) => {
    const next = Math.max(0.01, Math.min(100, +(lotsNum + delta).toFixed(2)));
    setLots(next.toFixed(2));
  };

  const handlePlace = () => {
    const parsed = tradeSchema.safeParse({
      symbol: brokerSymbol,
      side,
      type,
      lots: lotsNum,
      entry: entry ? parseFloat(entry) : undefined,
      sl: effectiveSl ?? undefined,
      tp: effectiveTp ?? undefined,
    });
    if (!parsed.success) {
      toast.error("Invalid order", {
        description: parsed.error.issues[0]?.message ?? "Check your inputs",
      });
      return;
    }
    if (type === "limit") {
      toast.error("Limit orders coming soon");
      return;
    }
    if (stopsError) {
      toast.error(stopsError);
      return;
    }
    setConfirming(true);
  };

  const confirmTrade = async () => {
    if (!user) {
      toast.error("Please sign in to place a trade");
      setConfirming(false);
      return;
    }
    if (!accountConnected) {
      toast.error("MT5 account not connected", {
        description: "Connect your MT5 account through Trading Layer first.",
      });
      setConfirming(false);
      return;
    }
    // Validate the broker symbol against the live broker symbols list.
    // Block if the list isn't loaded OR the symbol can't be resolved.
    if (!symbolValidation.ok) {
      toast.error("Cannot send trade", { description: symbolValidation.reason });
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("execute-trade", {
        body: {
          symbol: brokerSymbol,
          side,
          volume: Number(lotsNum.toFixed(2)),
          stopLoss: effectiveSl,
          takeProfit: effectiveTp,
          signalId: tradeIdSrc || null,
        },
      });
      if (error) throw error;
      const res = data as any;
      if (res?.success === true) {
        const classification = (res.classification || res.status || "executed") as string;
        const label =
          classification === "filled" ? "Trade filled"
          : classification === "placed" ? "Trade placed"
          : `Trade ${classification}`;
        setResultState({
          type: classification === "placed" ? "placed" : "filled",
          message: label,
        });
        toast.success(label, {
          description: res.ticket ? `Ticket #${res.ticket}` : undefined,
        });
        setConfirming(false);
        setTradeIdSrc(null);
        // Reset form to defaults
        setLots("0.01");
        setSl("");
        setTp("");
        setEntry("");
        // Refresh the dashboard's live account + execution log.
        loadAccount();
        window.dispatchEvent(new CustomEvent("trade-executed"));
      } else {
        const msg = res?.error || "Trade execution failed";
        if (res?.status === "rejected" || res?.classification === "rejected") {
          setResultState({ type: "rejected", message: `Trade rejected: ${msg}` });
        } else {
          setResultState({ type: "failed", message: msg });
        }
        toast.error(msg);
      }
    } catch (e: any) {
      const msg = e?.message || "Trade execution failed";
      setResultState({ type: "failed", message: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const sideAccent = isBuy
    ? "from-emerald-500/15 to-transparent border-emerald-500/30"
    : "from-red-500/15 to-transparent border-red-500/30";

  // ---------- Not-connected state ----------
  if (!accountChecking && accountConnected === false) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card/80 to-background/40 backdrop-blur-xl p-6 text-center shadow-[0_8px_40px_-12px_hsl(var(--primary)/0.25)]">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Plug className="h-5 w-5" />
        </div>
        <h3 className="font-heading text-base font-bold text-foreground mb-1">
          MT5 account not connected
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Connect your MT5 account to start trading.
        </p>
        <Link to="/connect-mt">
          <Button className="rounded-full bg-primary text-background hover:bg-primary/90 font-bold">
            Connect MT5 Account
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <motion.div
        ref={rootRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`rounded-2xl border bg-gradient-to-br ${sideAccent} backdrop-blur-xl overflow-hidden transition-all duration-500 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6),0_0_40px_-12px_hsl(48_100%_51%/0.25)] ${
          flash ? "ring-2 ring-primary scale-[1.01]" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 bg-card/70 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-background ring-1 ring-primary/40 shadow-[0_0_18px_-4px_hsl(48_100%_51%/0.7)]">
              <Zap className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-heading text-sm font-bold uppercase tracking-widest text-foreground leading-none">
                Quick Trade
              </h3>
              <span className="mt-1 text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                Trading Layer execution
              </span>
            </div>
          </div>
          {accountConnected && (
            <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          )}
        </div>

        <div className="p-4 space-y-3.5 bg-card/60">
          {/* Symbol selector */}
          <div className="relative">
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1.5">
              <span>Symbol</span>
              {!brokerSymbolsLive && (
                <span
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-amber-400"
                  title={brokerSymbolsError ?? "Showing fallback symbols. Connect your MT5 account for live broker symbols."}
                >
                  Fallback
                </span>
              )}
            </Label>
            <button
              type="button"
              onClick={() => setOpenSymbols((v) => !v)}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-border/50 bg-background/60 px-3.5 text-left transition-colors hover:border-primary/40"
            >
              <span className="font-heading text-base font-bold text-foreground">
                {symbolDisplay}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  openSymbols ? "rotate-180" : ""
                }`}
              />
            </button>
            {openSymbols && (
              <ul className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border/50 bg-popover shadow-xl">
                {SYMBOL_ITEMS.map((it) => {
                  const isActive = it.brokerSymbol === brokerSymbol;
                  return (
                    <li key={it.brokerSymbol}>
                      <button
                        type="button"
                        onClick={() => {
                          setCtxSymbol(it.displayName);
                          onSymbolChange?.(it.displayName);
                          setOpenSymbols(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-heading font-semibold transition-colors hover:bg-primary/10 hover:text-primary ${
                          isActive ? "text-primary bg-primary/5" : "text-foreground"
                        }`}
                      >
                        <span>{it.displayName}</span>
                        {it.displayName !== it.brokerSymbol && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {it.brokerSymbol}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
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
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <button
                      disabled
                      aria-disabled="true"
                      className="h-9 w-full rounded-lg font-mono text-[10px] uppercase tracking-widest ring-1 bg-muted/10 text-muted-foreground/60 ring-border/20 cursor-not-allowed"
                    >
                      Limit
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Limit orders coming soon.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Lots stepper */}
          <div>
            <Label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Lots
            </Label>
            <div className="flex items-stretch gap-2">
              <button
                onClick={() => adjustLots(-0.01)}
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
                onClick={() => adjustLots(0.01)}
                aria-label="Increase lots"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-primary active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1.5 flex gap-1">
              {QUICK_LOTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setLots(v.toFixed(2))}
                  className="flex-1 h-7 rounded-md bg-muted/30 hover:bg-primary/10 hover:text-primary text-[10px] font-mono tabular-nums text-muted-foreground transition-colors"
                >
                  {v.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* SL / TP */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-red-400/80 mb-1.5 block">
                Stop Loss
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={noStops ? "" : sl}
                disabled={noStops}
                onChange={(e) =>
                  setSl(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-red-500/40 disabled:opacity-50"
              />
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/80 mb-1.5 block">
                Take Profit
              </Label>
              <Input
                inputMode="decimal"
                placeholder="—"
                value={noStops ? "" : tp}
                disabled={noStops}
                onChange={(e) =>
                  setTp(e.target.value.replace(/[^0-9.]/g, "").slice(0, 12))
                }
                className="h-11 bg-background/60 border-border/50 font-mono text-sm tabular-nums focus-visible:ring-emerald-500/40 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Place trade without SL/TP */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={noStops}
              onCheckedChange={(v) => setNoStops(v === true)}
            />
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Place trade without SL/TP
            </span>
          </label>

          {/* Current price + SL/TP rules + retry */}
          {!noStops && (
            <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-widest">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  Current price:
                  {priceLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  ) : (
                    <span
                      className={`tabular-nums ${
                        currentPrice != null ? "text-foreground" : "text-amber-400"
                      }`}
                    >
                      {currentPrice != null ? currentPrice : "—"}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setPriceNonce((n) => n + 1)}
                  disabled={priceLoading}
                  className="inline-flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-50"
                  aria-label="Retry price fetch"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${priceLoading ? "animate-spin" : ""}`}
                  />
                  Retry
                </button>
              </div>

              {/* Rule helper text */}
              <p className="text-[10px] leading-snug text-muted-foreground normal-case tracking-normal">
                {isBuy
                  ? "BUY: Stop Loss must be below current price · Take Profit must be above."
                  : "SELL: Stop Loss must be above current price · Take Profit must be below."}
                {currentPrice == null && (slValid || tpValid) && (
                  <>
                    {" "}
                    Current price unavailable — manual SL/TP cannot be validated;
                    trade will be allowed but the broker may reject invalid stops.
                  </>
                )}
              </p>

              {priceError && currentPrice == null && (
                <p className="text-[10px] leading-snug text-amber-400 normal-case tracking-normal">
                  {priceError}. Trade is still allowed; check the broker rules.
                </p>
              )}

              {stopsError && (slValid || tpValid) && (
                <p className="text-[10px] leading-snug text-red-400 normal-case tracking-normal">
                  {stopsError} Confirm Trade is disabled until you fix the values
                  or enable “Place trade without SL/TP”.
                </p>
              )}
            </div>
          )}

          {/* Live preview metrics — P&L / risk pending symbol specs */}
          <div className="rounded-xl border border-border/40 bg-background/40 divide-y divide-border/30 overflow-hidden">
            <Row
              label="Equity"
              value={
                accountConnected
                  ? `${accountCurrency} ${accountEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : "—"
              }
            />
            <Row
              label="Potential P&L"
              value="Calculated after symbol specs load"
              valueClass="text-muted-foreground italic text-[11px] normal-case"
            />
            <Row
              label="Risk"
              value={canCalculateRisk ? "—" : "Pending symbol data"}
              valueClass="text-muted-foreground italic text-[11px] normal-case"
            />
          </div>

          {/* Place trade button */}
          {(() => {
            const validBroker = SYMBOL_ITEMS.some(
              (it) => it.brokerSymbol === brokerSymbol,
            );
            const disabled =
              accountConnected !== true ||
              !brokerSymbol ||
              lotsNum <= 0 ||
              !validBroker ||
              !!stopsError;
            const reason =
              accountConnected !== true
                ? "Connect your MT5 account to place trades"
                : !brokerSymbol
                ? "Select a symbol"
                : !validBroker
                ? "Selected symbol is not a valid broker symbol"
                : lotsNum <= 0
                ? "Volume must be greater than 0"
                : stopsError
                ? stopsError
                : "";
            return (
              <>
                <Button
                  onClick={handlePlace}
                  disabled={disabled}
                  className={`w-full h-14 font-bold text-base tracking-wide rounded-xl transition-all hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed ${
                    isBuy
                      ? "bg-emerald-500 hover:bg-emerald-500 text-white shadow-[0_10px_30px_-10px_hsl(160_84%_50%/0.7)] hover:shadow-[0_15px_40px_-10px_hsl(160_84%_50%/0.9)]"
                      : "bg-red-500 hover:bg-red-500 text-white shadow-[0_10px_30px_-10px_hsl(0_84%_60%/0.7)] hover:shadow-[0_15px_40px_-10px_hsl(0_84%_60%/0.9)]"
                  }`}
                >
                  CONFIRM {isBuy ? "BUY" : "SELL"} TRADE
                </Button>
                {disabled && reason && (
                  <p className="mt-2 text-center text-[10px] font-mono uppercase tracking-widest text-amber-400/80">
                    {reason}
                  </p>
                )}
              </>
            );
          })()}

          {showDebug && (
            <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] font-mono text-amber-200/80">
              <summary className="cursor-pointer uppercase tracking-widest text-amber-400 hover:text-amber-300">
                Broker Symbols Debug
              </summary>
              <div className="mt-2 space-y-1">
                <div>function used: <span className="text-foreground">get-mt5-symbol-data</span></div>
                <div>symbolsLoading: <span className="text-foreground">{String(brokerSymbolsLoading)}</span></div>
                <div>symbolsLoaded: <span className="text-foreground">{String(symbolsLoaded)}</span></div>
                <div>brokerSymbols.length: <span className="text-foreground">{brokerSymbols.length}</span></div>
                <div>selected display symbol: <span className="text-foreground">{symbolDisplay}</span></div>
                <div>selected broker symbol: <span className="text-foreground">{normalizedSymbol}</span></div>
                <div>symbol exists in broker list: <span className="text-foreground">{String(existsInBrokerSymbols)}</span></div>
                <div>selectedSymbolValid: <span className="text-foreground">{String(ctxSelectedSymbolValid)}</span></div>
                <div>accountConnected: <span className="text-foreground">{String(accountConnected)}</span></div>
                {brokerSymbolsError && (
                  <div>error: <span className="text-red-400">{brokerSymbolsError}</span></div>
                )}
                <div className="pt-1">selectedSymbolInfo:</div>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-background/60 p-2 text-[10px] text-foreground/80 whitespace-pre-wrap break-all">
{JSON.stringify(ctxSelectedSymbolInfo, null, 2)}
                </pre>
                <div className="pt-1">tick:</div>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-background/60 p-2 text-[10px] text-foreground/80 whitespace-pre-wrap break-all">
{JSON.stringify(ctxTick, null, 2)}
                </pre>
                <div className="pt-1">last get-mt5-symbol-data response:</div>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-background/60 p-2 text-[10px] text-foreground/80 whitespace-pre-wrap break-all">
{JSON.stringify(brokerSymbolsLastResponse, null, 2)}
                </pre>
                <button
                  type="button"
                  onClick={() => refreshBrokerSymbols(normalizedSymbol)}
                  className="mt-1 rounded border border-amber-500/40 px-2 py-0.5 uppercase tracking-widest text-amber-300 hover:bg-amber-500/10"
                >
                  Refresh symbols
                </button>
              </div>
            </details>
          )}
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
                  onClick={() => !submitting && setConfirming(false)}
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
                        Confirm {isBuy ? "Buy" : "Sell"} Trade
                      </h4>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-2.5 text-xs">
                    {/* Prominent broker symbol that will actually be sent */}
                    <div
                      className={`rounded-lg border px-3 py-2.5 ${
                        symbolValidation.ok
                          ? "border-primary/30 bg-primary/5"
                          : "border-red-500/40 bg-red-500/10"
                      }`}
                    >
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
                        Broker symbol sent to execute-trade
                      </div>
                      <div
                        className={`font-heading text-lg font-bold tabular-nums ${
                          symbolValidation.ok ? "text-primary" : "text-red-400"
                        }`}
                      >
                        {brokerSymbol}
                      </div>
                      {symbolDisplay !== brokerSymbol && (
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          Displayed as {symbolDisplay}
                          {rawBrokerSymbol !== brokerSymbol && symbolValidation.ok && (
                            <> · normalized from {rawBrokerSymbol}</>
                          )}
                        </div>
                      )}
                      <div
                        className={`mt-1.5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ${
                          symbolValidation.ok ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        <span>
                          {symbolValidation.ok
                            ? `✓ Validated against ${brokerSymbols.length} broker symbols`
                            : `✗ ${symbolValidation.reason}`}
                        </span>
                        {symbolValidation.canRetry && (
                          <button
                            type="button"
                            onClick={() => refreshBrokerSymbols(normalizedSymbol)}
                            className="rounded border border-red-400/40 px-2 py-0.5 text-red-300 hover:bg-red-500/10"
                          >
                            Refresh
                          </button>
                        )}
                      </div>
                    </div>
                    <ConfirmRow
                      label="Direction"
                      value={isBuy ? "BUY" : "SELL"}
                      valueClass={isBuy ? "text-emerald-400" : "text-red-400"}
                    />
                    <ConfirmRow label="Volume" value={`${lotsNum.toFixed(2)} lots`} />
                    {noStops ? (
                      <ConfirmRow
                        label="Stops"
                        value="None — sending without SL/TP"
                        valueClass="text-amber-400"
                      />
                    ) : (
                      <>
                        <ConfirmRow
                          label="Stop Loss"
                          value={effectiveSl != null ? String(effectiveSl) : "None"}
                          valueClass={effectiveSl != null ? "text-red-400" : "text-muted-foreground"}
                        />
                        <ConfirmRow
                          label="Take Profit"
                          value={effectiveTp != null ? String(effectiveTp) : "None"}
                          valueClass={effectiveTp != null ? "text-emerald-400" : "text-muted-foreground"}
                        />
                      </>
                    )}
                    {/* Exact payload preview */}
                    <details className="rounded-lg border border-border/40 bg-background/40 px-3 py-2 group">
                      <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
                        Execute Trade Payload
                      </summary>
                      <pre className="mt-2 text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
{JSON.stringify(
  {
    tradeId: previewTradeId,
    symbol: brokerSymbol,
    side,
    volume: Number(lotsNum.toFixed(2)),
    stopLoss: effectiveSl,
    takeProfit: effectiveTp,
  },
  null,
  2,
)}
                      </pre>
                    </details>
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
                      disabled={submitting || !symbolValidation.ok || !!stopsError}
                      className={`flex-1 h-11 font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
                        isBuy
                          ? "bg-emerald-500 hover:bg-emerald-500/90 text-white"
                          : "bg-red-500 hover:bg-red-500/90 text-white"
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          Executing…
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1.5" />
                          CONFIRM {isBuy ? "BUY" : "SELL"} TRADE
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

      {/* Result modal */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {resultState && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setResultState(null)}
                  className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed left-1/2 top-1/2 z-[101] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
                >
                  <div className="flex flex-col items-center px-6 py-7 text-center">
                    {resultState.type === "filled" || resultState.type === "placed" ? (
                      <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                    ) : (
                      <XCircle className="h-10 w-10 text-red-400 mb-2" />
                    )}
                    <h4 className="font-heading text-base font-bold text-foreground mb-1">
                      {resultState.type === "filled" && "Trade filled"}
                      {resultState.type === "placed" && "Trade placed"}
                      {resultState.type === "rejected" && "Trade rejected"}
                      {resultState.type === "failed" && "Trade execution failed"}
                    </h4>
                    <p className="text-xs text-muted-foreground">{resultState.message}</p>
                    <Button
                      onClick={() => setResultState(null)}
                      className="mt-5 w-full bg-primary text-background hover:bg-primary/90 font-bold"
                    >
                      Close
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
