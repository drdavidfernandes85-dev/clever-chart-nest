import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

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
import ExecutionAuditPanel from "@/components/dashboard/ExecutionAuditPanel";
import Mt5PositionVerificationPanel from "@/components/dashboard/Mt5PositionVerificationPanel";
import ExecutionReconciliationDebugPanel from "@/components/dashboard/ExecutionReconciliationDebugPanel";
import MarketDataDiagnosticsPanel from "@/components/dashboard/MarketDataDiagnosticsPanel";
import {
  checkAndHandle429,
  getCooldownRemainingMs,
  triggerRateLimitCooldown,
  isExecutionLocked,
  lockExecution,
  unlockExecution,
} from "@/lib/tradingLayerControl";
import { useExecutionLock } from "@/hooks/useExecutionLock";
import { useDevMode } from "@/hooks/useDevMode";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import RiskBadges from "@/components/dashboard/RiskBadges";
import { getExecutionDisplayState } from "@/lib/executionDisplayState";

const broadcastExec = (status: string) => {
  try { window.dispatchEvent(new CustomEvent("mt:exec-result", { detail: { status } })); }
  catch { /* ignore */ }
};

/**
 * Professional BlackArrow-style Order Ticket.
 * Dense institutional layout: dark UI, yellow accents, green buy / red sell.
 * Only market orders submit; pending types kept visible but disabled.
 */

const QUICK_VOLS = [0.01, 0.02, 0.03, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0];
const STRATEGIES = ["Standard", "Bracket", "None"] as const;
const ORDER_TYPES = ["Market", "Limit", "Stop"] as const;
const BEST_EXEC_VERSION = "BEST_EXEC_LIVE_CONTROLLED_V1_2026_05_19";
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

const submitBestExecutionOrderUrl = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/submit-best-execution-order?v=${Date.now()}&nonce=${crypto.randomUUID()}`;
};

interface Props {
  className?: string;
}

/** Infer compact asset class chip from a normalized symbol like "EURUSD" / "XAUUSD". */
function classify(sym: string): string {
  const u = (sym || "").toUpperCase();
  if (!u) return "FX";
  if (/^XAU|XAG|GOLD|SILVER|WTI|UKOIL|USOIL|BRENT|NGAS/.test(u)) return "Metals";
  if (/(BTC|ETH|USDT|SOL|XRP|ADA|DOGE|BNB|MATIC|DOT)/.test(u)) return "Crypto";
  if (/(US30|NAS100|US500|SPX|GER40|DAX|FTSE|NIKKEI|DJ30)/.test(u)) return "Index";
  if (/^[A-Z]{6}$/.test(u)) return "FX";
  return "Stock";
}

const BlackArrowTradePanel = ({ className }: Props) => {
  const { t } = useLanguage();

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
  const { devMode, isAdmin, setDevMode, rawEnabled: devEnabled } = useDevMode();

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
  const { locked: execLocked } = useExecutionLock();
  const [symbolOpen, setSymbolOpen] = useState(false);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [bidFlash, setBidFlash] = useState<"up" | "down" | null>(null);
  const [askFlash, setAskFlash] = useState<"up" | "down" | null>(null);

  const prevBidRef = useRef<number | null>(null);
  const prevAskRef = useRef<number | null>(null);
  const [execResult, setExecResult] = useState<ExecutionResultPayload | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    functionUsed: string;
    payload?: any;
    response?: any;
    error?: string;
    status?: number;
    at: string;
  } | null>(null);
  const [orderDebug, setOrderDebug] = useState<{
    status: "loading" | "success" | "error";
    functionUsed: string;
    requestUrl?: string;
    httpStatus?: number;
    payloadSent: any;
    rawEdgeFunctionResponse: any;
    edgeFunctionError: any;
    validationError: string | null;
  } | null>(null);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);
  const [liveTestConfirmed, setLiveTestConfirmed] = useState(false);
  const [liveTestSubmitting, setLiveTestSubmitting] = useState(false);

  // Post-trade confirmation flow state
  type LiveConfirmPhase = "placing" | "confirming" | "confirmed" | "pending_verification" | "rejected";
  interface LiveConfirmState {
    phase: LiveConfirmPhase;
    status?: string;
    retcode?: number;
    brokerMessage?: string;
    symbol?: string;
    side?: string;
    volume?: number;
    ticket?: number | string | null;
    entryPrice?: number | null;
    currentPrice?: number | null;
    pnl?: number | null;
    startedAt?: number;
    // Lifecycle (MT5 truth)
    brokerAccepted?: boolean;
    mt5Confirmed?: boolean;
    confirmationStatus?: "pending" | "confirmed" | "failed";
    confirmedTicket?: string | number | null;
    confirmedEntryPrice?: number | null;
    confirmedVolume?: number | null;
  }
  const [liveConfirm, setLiveConfirm] = useState<LiveConfirmState | null>(null);
  const positionsRef = useRef(positions);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  const [cooldownMs, setCooldownMs] = useState(getCooldownRemainingMs());
  useEffect(() => {
    const id = window.setInterval(() => setCooldownMs(getCooldownRemainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const cooling = cooldownMs > 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);




  async function directFetchSubmitBestExecutionOrder(payload: any) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("No active Supabase session/access token found.");
    }

    const requestUrl = submitBestExecutionOrderUrl();
    const response = await fetch(requestUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawText: text };
    }

    return { requestUrl, httpStatus: response.status, responseOk: response.ok, data };
  }

  async function handleLiveTest001() {
    if (cooling) {
      toast.warning(`Rate limited. Retry in ${cooldownSec}s.`);
      return;
    }
    const selectedSymbol = normalizedSym;
    const payload = {
      tradeId: crypto.randomUUID(),
      symbol: selectedSymbol || "XAUUSD",
      side: side || "buy",
      orderType: "market",
      volume: 0.01,
      stopLoss: null,
      takeProfit: null,
      dryRun: false,
      liveExecutionConfirmed: true,
      clientClickAt: new Date().toISOString(),
    };

    setLiveTestSubmitting(true);
    setOrderDebug({
      status: "loading",
      functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
      payloadSent: payload,
      rawEdgeFunctionResponse: null,
      edgeFunctionError: null,
      validationError: null,
    });

    try {
      const { requestUrl, httpStatus, responseOk, data } = await directFetchSubmitBestExecutionOrder(payload);

      if (httpStatus === 429 || (data && (data.retryAfter || data.tradingLayerStatus === 429))) {
        triggerRateLimitCooldown(Number(data?.retryAfter) > 0 ? Number(data.retryAfter) : 60);
      } else {
        checkAndHandle429(data, null);
      }


      const expectedLiveResponse =
        data?.version === BEST_EXEC_VERSION &&
        ((data?.step === "execution_result" && data?.liveOrderSent === true) ||
          (data?.step === "pretrade_validation" && data?.liveOrderSent === false));

      setOrderDebug({
        status: responseOk && expectedLiveResponse ? "success" : "error",
        functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
        requestUrl,
        httpStatus,
        payloadSent: payload,
        rawEdgeFunctionResponse: data,
        edgeFunctionError: responseOk ? null : data,
        validationError: data?.version
          ? expectedLiveResponse ? null : "Unexpected live execution response."
          : "Wrong live execution handler is still being used.",
      });

      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
      window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));

      const liveSent = data?.step === "execution_result" && data?.liveOrderSent === true;
      if (liveSent) {
        const rawStatus = String(data?.status ?? "").toLowerCase();
        const retcode = Number(data?.retcode ?? data?.mt5?.retcode ?? NaN);
        const brokerMessage = String(data?.brokerMessage ?? data?.broker_message ?? data?.mt5?.comment ?? "");

        if (rawStatus === "rejected" || rawStatus === "failed") {
          setLiveConfirm({
            phase: "rejected",
            status: rawStatus,
            retcode: Number.isFinite(retcode) ? retcode : undefined,
            brokerMessage,
            symbol: payload.symbol,
            side: payload.side,
            volume: payload.volume,
            startedAt: Date.now(),
          });
          toast.error("Execution rejected");
        } else {
          setLiveConfirm({
            phase: "placing",
            status: rawStatus || "placed",
            retcode: Number.isFinite(retcode) ? retcode : undefined,
            brokerMessage,
            symbol: payload.symbol,
            side: payload.side,
            volume: payload.volume,
            startedAt: Date.now(),
            brokerAccepted: true,
            mt5Confirmed: false,
            confirmationStatus: "pending",
          });
          toast.success("Order placed — confirming position in MT5...");
          runPostTradeConfirmation({
            symbol: payload.symbol,
            side: payload.side,
            volume: payload.volume,
            status: rawStatus || "placed",
            retcode: Number.isFinite(retcode) ? retcode : undefined,
            brokerMessage,
            tradeId: payload.tradeId,
          });
        }
      } else {
        if (responseOk) toast.success("Live test response received");
        else toast.error("Live test failed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOrderDebug({
        status: "error",
        functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
        payloadSent: payload,
        rawEdgeFunctionResponse: null,
        edgeFunctionError: message,
        validationError: message.includes("No active Supabase session")
          ? "User is not authenticated."
          : "Direct Edge Function fetch failed.",
      });
    } finally {
      setLiveTestSubmitting(false);
      try { await refresh(); } catch { /* ignore */ }
      setTimeout(() => setAuditRefreshKey(k => k + 1), 400);
    }
  }

  function findMatchingPosition(symbol: string, side: string, volume: number, sinceMs: number) {
    const sym = symbol.toUpperCase();
    const wantSide = side.toLowerCase();
    const list: any[] = (positionsRef.current as any) || [];
    return list.find((p: any) => {
      const pSym = String(p?.symbol ?? "").toUpperCase();
      const pSide = String(p?.side ?? p?.type ?? "").toLowerCase();
      const pVol = Number(p?.volume ?? p?.lots ?? 0);
      const pTime = p?.openTime ? new Date(p.openTime).getTime()
        : p?.time_open ? new Date(p.time_open).getTime()
        : p?.time ? Number(p.time) * 1000
        : Date.now();
      return pSym === sym
        && (pSide === wantSide || pSide.startsWith(wantSide))
        && Math.abs(pVol - volume) < 1e-6
        && pTime >= sinceMs - 10_000;
    });

  }

  async function runPostTradeConfirmation(args: {
    symbol: string; side: string; volume: number;
    status: string; retcode?: number; brokerMessage?: string;
    tradeId?: string;
  }) {
    const startedAt = Date.now();
    let auditUpdated = false;
    const updateAuditRow = async (match: any) => {
      if (auditUpdated) return;
      auditUpdated = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const ticket = String(match.ticket ?? match.id ?? "");
        const symbol = String(match.symbol ?? args.symbol);
        const side = String(match.side ?? match.type ?? args.side);
        const volume = Number(match.volume ?? match.lots ?? args.volume);
        const entry_price = match.openPrice ?? match.entryPrice ?? match.price_open ?? null;
        const current_price = match.currentPrice ?? match.price_current ?? null;
        const profit = match.profit ?? match.pnl ?? null;

        // Find the latest matching "placed" audit row
        let q = supabase
          .from("execution_audit_events")
          .select("id, raw")
          .eq("user_id", user.id)
          .eq("status", "placed")
          .order("created_at", { ascending: false })
          .limit(5);
        if (args.tradeId) q = q.eq("trade_id", args.tradeId);
        else q = q
          .ilike("symbol", symbol)
          .ilike("side", side)
          .eq("volume", volume)
          .gte("created_at", new Date(startedAt - 60_000).toISOString());

        const { data: rows } = await q;
        const target = (rows as any[] | null)?.[0];
        if (!target) return;

        const mergedRaw = {
          ...(target.raw && typeof target.raw === "object" ? target.raw : {}),
          classification: "placed_confirmed",
          positionConfirmed: true,
          confirmedTicket: ticket,
          confirmedSymbol: symbol,
          confirmedSide: side,
          confirmedVolume: volume,
          confirmedEntryPrice: entry_price,
          confirmedCurrentPrice: current_price,
          confirmedFloatingPnl: profit,
          confirmedAt: new Date().toISOString(),
        };

        await supabase
          .from("execution_audit_events")
          .update({
            status: "position_confirmed",
            outcome: "position_confirmed",
            broker_message: `Position confirmed. Ticket: ${ticket}`,
            ticket,
            raw: mergedRaw,
          })
          .eq("id", target.id);
        setAuditRefreshKey((k) => k + 1);
      } catch {
        /* ignore audit update failures */
      }
    };

    const tryMatch = () => {
      const match = findMatchingPosition(args.symbol, args.side, args.volume, startedAt);
      if (!match) return false;
      const confirmedTicket = match.ticket ?? match.id ?? null;
      const confirmedEntryPrice = match.openPrice ?? match.entryPrice ?? match.price_open ?? null;
      const confirmedVolume = Number(match.volume ?? match.lots ?? args.volume);
      setLiveConfirm({
        phase: "confirmed",
        status: args.status,
        retcode: args.retcode,
        brokerMessage: args.brokerMessage,
        symbol: String(match.symbol ?? args.symbol),
        side: String(match.side ?? match.type ?? args.side),
        volume: confirmedVolume,
        ticket: confirmedTicket,
        entryPrice: confirmedEntryPrice,
        currentPrice: match.currentPrice ?? match.price_current ?? null,
        pnl: match.profit ?? match.pnl ?? null,
        startedAt,
        brokerAccepted: true,
        mt5Confirmed: true,
        confirmationStatus: "confirmed",
        confirmedTicket,
        confirmedEntryPrice,
        confirmedVolume,
      });
      toast.success("Position confirmed", { description: `#${confirmedTicket ?? ""} ${args.symbol}`.trim() });
      void updateAuditRow(match);
      return true;
    };

    // Cadence: T+0, +1.5s, +3s, +5s, +8s
    const cadence = [0, 1500, 1500, 2000, 3000];
    for (let i = 0; i < cadence.length; i++) {
      if (cadence[i] > 0) await new Promise((r) => setTimeout(r, cadence[i]));
      try { await refresh(); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
      setAuditRefreshKey((k) => k + 1);
      if (i === 1) setLiveConfirm((prev) => prev ? { ...prev, phase: "confirming" } : prev);
      if (tryMatch()) { setAuditRefreshKey((k) => k + 1); return; }
    }

    // No match within 8s → write unconfirmed audit row, update UI, warn user.
    setLiveConfirm((prev) => prev ? {
      ...prev,
      phase: "pending_verification",
      brokerAccepted: true,
      mt5Confirmed: false,
      confirmationStatus: "failed",
    } : prev);
    toast.warning("Order was accepted by broker but not confirmed in MT5.", {
      description: "Please verify in MetaTrader.",
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let q = supabase
          .from("execution_audit_events")
          .select("id, raw")
          .eq("user_id", user.id)
          .eq("status", "placed")
          .order("created_at", { ascending: false })
          .limit(5);
        if (args.tradeId) q = q.eq("trade_id", args.tradeId);
        else q = q
          .ilike("symbol", args.symbol)
          .ilike("side", args.side)
          .eq("volume", args.volume)
          .gte("created_at", new Date(startedAt - 60_000).toISOString());
        const { data: rows } = await q;
        const target = (rows as any[] | null)?.[0];
        if (target) {
          const mergedRaw = {
            ...(target.raw && typeof target.raw === "object" ? target.raw : {}),
            classification: "placed_unconfirmed",
            mt5Confirmed: false,
            brokerAccepted: true,
            confirmationStatus: "failed",
            reconciledAt: new Date().toISOString(),
          };
          await supabase
            .from("execution_audit_events")
            .update({
              status: "execution_unconfirmed",
              outcome: "execution_unconfirmed",
              broker_message: "Broker accepted order but no matching MT5 position was found.",
              raw: mergedRaw,
            })
            .eq("id", target.id);
        }
      }
    } catch { /* ignore */ }
    setAuditRefreshKey((k) => k + 1);
  }



  async function handleBestExecutionDryRun() {
    const selectedSymbol = normalizedSym;
    const volume = vol;
    const payload = {
      tradeId: crypto.randomUUID(),
      symbol: selectedSymbol || "XAUUSD",
      side: "buy",
      orderType: "market",
      volume: Number(volume) || 0.01,
      stopLoss: null,
      takeProfit: null,
      dryRun: true,
      clientClickAt: new Date().toISOString(),
    };

    setOrderDebug({
      status: "loading",
      functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
      payloadSent: payload,
      rawEdgeFunctionResponse: null,
      edgeFunctionError: null,
      validationError: null,
    });

    try {
      const { requestUrl, httpStatus, responseOk, data } = await directFetchSubmitBestExecutionOrder(payload);

      setOrderDebug({
        status: responseOk ? "success" : "error",
        functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
        requestUrl,
        httpStatus,
        payloadSent: payload,
        rawEdgeFunctionResponse: data,
        edgeFunctionError: responseOk ? null : data,
        validationError:
          data?.version === BEST_EXEC_VERSION &&
          data?.step === "dry_run"
            ? null
            : "Wrong Edge Function response or auth/project mismatch.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOrderDebug({
        status: "error",
        functionUsed: "DIRECT_FETCH_LIVE_submit-best-execution-order",
        payloadSent: payload,
        rawEdgeFunctionResponse: null,
        edgeFunctionError: message,
        validationError: message.includes("No active Supabase session")
          ? "User is not authenticated."
          : "Direct Edge Function fetch failed.",
      });
    }
    // Refresh audit panel after every Dry Run attempt
    setTimeout(() => setAuditRefreshKey(k => k + 1), 400);
  }



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

  const { flags: riskFlags } = useRiskSettings();
  const killSwitchActive = riskFlags.killSwitch;
  const liveDisabled = !riskFlags.liveEnabled;

  const canSubmitMarket =
    !!user &&
    connected === true &&
    isBrokerSymbol &&
    symbolValid &&
    !!normalizedSym &&
    hasValidBidAsk &&
    volNum > 0 &&
    !volumeError &&
    !submitting &&
    !execLocked &&
    !killSwitchActive &&
    !liveDisabled;

  const submitMarket = async (sideArg: "buy" | "sell") => {
    if (!canSubmitMarket) {
      if (killSwitchActive) toast.error("Trading disabled by kill switch.");
      else if (liveDisabled) toast.error("Live trading is disabled by your risk settings.");
      else if (!connected) toast.error("Account not connected");
      else if (!isBrokerSymbol) toast.error("Invalid symbol");
      else if (!symbolValid) toast.error("Symbol not available on broker");
      else if (volumeError) toast.error(volumeError);
      else if (slTpError) toast.error(slTpError);
      return;
    }
    if (isExecutionLocked()) { toast.warning("Another execution is in progress."); return; }
    setSide(sideArg);
    setSubmitting(true);
    lockExecution(`order_${sideArg}`, 30000);
    const clientClickAt = new Date().toISOString();
    const tradeId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Snapshot live MT5 positions BEFORE the order for the reconciliation debug panel.
    const positionsBeforeSnapshot: any[] = JSON.parse(
      JSON.stringify((positionsRef.current as any[]) || []),
    );
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

      // Guard — submit-best-execution-order must NOT forward to execute-trade
      // while we're still in dry-run validation mode.
      const stepStr = String(res?.step ?? "").toLowerCase();
      if (stepStr === "trade_execution") {
        // eslint-disable-next-line no-console
        console.warn("[OrderTicket] WARNING: response step is 'trade_execution' — live execution path was hit.");
        toast.error("⚠️ Live execution path triggered (step: trade_execution). Stopping.");
        return;
      }
      if (stepStr && stepStr !== "dry_run") {
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

      // Treat broker-accepted / placed_unconfirmed as a confirmation-pending
      // case (NOT a rejection). The server now returns success=false +
      // step="execution_unconfirmed" for retcode 10008 with no live position.
      const brokerAccepted =
        res?.success === true ||
        res?.brokerAccepted === true ||
        res?.liveOrderSent === true ||
        String(res?.step ?? "").toLowerCase() === "execution_result" ||
        String(res?.step ?? "").toLowerCase() === "execution_unconfirmed" ||
        String(res?.classification ?? "").toLowerCase() === "placed_unconfirmed" ||
        String(res?.classification ?? "").toLowerCase() === "placed_confirmed" ||
        String(res?.outcome ?? "").toLowerCase() === "broker_accepted_no_position" ||
        Number(res?.retcode) === 10008 ||
        Number(res?.retcode) === 10009;

      if (brokerAccepted) {
        const liveOrderSent = res?.liveOrderSent === true || brokerAccepted;

        // NEVER show "ORDER EXECUTED" off the broker response alone.
        // Show pending first; only flip to success after MT5 reconciliation
        // confirms a matching live position.
        setExecResult({
          ...baseFields,
          outcome: "pending",
          brokerAccepted: true,
          mt5Confirmed: false,
          confirmationStatus: "pending",
          liveOrderSent,
          requestedPrice: res.requestedPrice ?? null,
          executedPrice: null,
          slippage: null,
          latencyMs: res.latencyMs ?? null,
          brokerMessage: liveOrderSent
            ? "Order sent — waiting for MT5 confirmation."
            : (res.brokerMessage ?? "Order accepted — waiting for MT5 confirmation."),
          status: "placed",
          ticket: null,
          confirmedTicket: null,
          confirmedEntryPrice: null,
          confirmedVolume: null,
          confirmedAt: null,
        });
        setPrice("");
        if (autoReset) { setVol(volumeMin.toFixed(2)); setOrderType("Market"); }

        // Snapshot pre-existing tickets so we only count NEW positions.
        const preTickets = new Set(
          ((positionsRef.current as any[]) || []).map((p: any) => String(p?.ticket ?? p?.id ?? "")),
        );
        const matchSym = normalizedSym.toUpperCase();
        const wantSide = sideArg.toLowerCase();
        const wantVol = Number(volNum.toFixed(2));

        const tryMatch = () => {
          const list: any[] = (positionsRef.current as any) || [];
          return list.find((p: any) => {
            const pTicket = String(p?.ticket ?? p?.id ?? "");
            if (!pTicket || preTickets.has(pTicket)) return false;
            const pSym = String(p?.symbol ?? "").toUpperCase();
            const pSide = String(p?.side ?? p?.type ?? "").toLowerCase();
            const pVol = Number(p?.volume ?? p?.lots ?? 0);
            return pSym === matchSym
              && (pSide === wantSide || pSide.startsWith(wantSide))
              && Math.abs(pVol - wantVol) < 1e-6;
          });
        };

        // Cadence: T+0, +1.5s, +3s, +5s, +8s
        const cadence = [0, 1500, 1500, 2000, 3000];
        let matched: any = null;
        for (let i = 0; i < cadence.length; i++) {
          if (cadence[i] > 0) await new Promise((r) => setTimeout(r, cadence[i]));
          try { await refresh(); } catch { /* ignore */ }
          window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
          window.dispatchEvent(new CustomEvent("mt:refresh-terminal-data"));
          matched = tryMatch();
          if (matched) break;
        }

        // ── Authoritative server-side reconciliation against Trading Layer ──
        // Inspects positions + pending orders + history orders + history deals
        // and returns one of:
        //   position_confirmed | deal_found_no_open_position |
        //   order_found_not_filled | execution_unconfirmed
        let reconcile: any = null;
        try {
          const { data: rec } = await supabase.functions.invoke(
            "reconcile-execution",
            {
              body: {
                tradeId,
                symbol: normalizedSym,
                side: sideArg,
                volume: Number(volNum.toFixed(2)),
                requestedPrice: res?.requestedPrice ?? null,
                clientClickAt,
                brokerRetcode: res?.retcode ?? null,
                brokerMessage:
                  res?.brokerMessage ?? res?.retcodeDescription ?? null,
                rawExecutionResponse: res ?? null,
              },
            },
          );
          reconcile = rec ?? null;
        } catch { /* reconcile is best-effort */ }

        // Reconcile is authoritative when it confirms an MT5 position.
        if (reconcile?.mt5Confirmed === true && reconcile?.confirmedTicket) {
          matched = matched || {
            ticket: reconcile.confirmedTicket,
            entry_price: reconcile.confirmedEntryPrice,
            price_open: reconcile.confirmedEntryPrice,
            volume: reconcile.confirmedVolume,
          };
        }

        // Build a unified broker-result view for the canonical mapper.
        const brokerView = {
          success: res?.success,
          status: matched ? "position_confirmed" : (liveOrderSent ? "placed" : (res?.status ?? "placed")),
          retcode: res?.retcode,
          liveOrderSent,
        };

        let confirmedPos: any = null;
        if (matched) {
          confirmedPos = {
            ticket: matched.ticket ?? matched.id ?? null,
            entry_price: matched.entry_price ?? null,
            price_open: matched.price_open ?? null,
            openPrice: matched.openPrice ?? matched.entryPrice ?? matched.current_price ?? null,
            volume: matched.volume ?? null,
            lots: matched.lots ?? null,
          };
        }

        const display = getExecutionDisplayState(brokerView, confirmedPos);

        if (display.status === "CONFIRMED") {
          setExecResult((prev) => prev ? {
            ...prev,
            outcome: "success",
            brokerAccepted: true,
            mt5Confirmed: true,
            confirmationStatus: "confirmed",
            confirmedTicket: display.confirmedTicket,
            confirmedEntryPrice: display.confirmedEntryPrice,
            confirmedVolume: display.confirmedVolume,
            confirmedAt: new Date().toISOString(),
            executedPrice: display.confirmedEntryPrice,
            ticket: display.confirmedTicket,
            status: "position_confirmed",
            brokerMessage: `Position confirmed in MT5. Ticket: ${display.confirmedTicket}`,
          } : prev);
          toast.success("Position confirmed", { description: `#${display.confirmedTicket ?? ""} ${normalizedSym}` });
        } else {
          // MT5 not confirmed. Use reconcile's authoritative classification
          // (deal_found_no_open_position, order_found_not_filled, or
          // execution_unconfirmed) when available; fall back to the generic
          // unconfirmed message otherwise.
          const recStatus: string = reconcile?.status ?? "execution_unconfirmed";
          const recExplanation: string =
            reconcile?.explanation ??
            "Broker accepted the order, but no matching MT5 position was found.";
          setExecResult((prev) => prev ? {
            ...prev,
            outcome: "unconfirmed",
            brokerAccepted: true,
            mt5Confirmed: false,
            confirmationStatus: "not_found",
            status: recStatus,
            brokerMessage: recExplanation,
          } : prev);
          toast.warning("Order accepted but no MT5 position confirmed", {
            description: recExplanation,
          });
        }
        setAuditRefreshKey((k) => k + 1);

        // Emit reconciliation debug payload for the Dev panel.
        try {
          const positionsAfterSnapshot: any[] = JSON.parse(
            JSON.stringify((positionsRef.current as any[]) || []),
          );
          window.dispatchEvent(new CustomEvent("mt:execution-reconcile-debug", {
            detail: {
              at: new Date().toISOString(),
              account: {
                account_number:
                  reconcile?.account?.mt5_login ??
                  (liveAccount as any)?.login ?? null,
                server:
                  reconcile?.account?.server ??
                  (liveAccount as any)?.server ?? null,
                trading_layer_trader_id:
                  reconcile?.account?.trading_layer_trader_id ??
                  (res as any)?.trading_layer_trader_id ??
                  (res as any)?.diagnostics?.trader_id ??
                  (res as any)?.diagnostics?.accountId ??
                  null,
              },
              request: {
                symbol: normalizedSym,
                side: sideArg,
                volume: Number(volNum.toFixed(2)),
                stopLoss: noStops ? null : (sl ? Number(sl) : null),
                takeProfit: noStops ? null : (tp ? Number(tp) : null),
                deviation: (res as any)?.diagnostics?.payloadSent?.deviation ?? null,
                endpoint: "submit-best-execution-order",
              },
              response: {
                retcode: (res as any)?.retcode ?? null,
                classification:
                  reconcile?.status ?? (res as any)?.classification ?? null,
                raw: res ?? null,
              },
              reconciliation: {
                positionsBefore: positionsBeforeSnapshot,
                positionsAfter: positionsAfterSnapshot,
                matchFound: !!matched || reconcile?.mt5Confirmed === true,
                confirmedTicket:
                  reconcile?.confirmedTicket ??
                  (matched ? (matched.ticket ?? matched.id ?? null) : null),
              },
              history: {
                matchingPendingOrderFound:
                  reconcile?.checked?.pendingOrders?.matchFound ??
                  (res as any)?.diagnostics?.matchingPendingOrderFound ?? null,
                matchingDealFound:
                  reconcile?.checked?.historyDeals?.matchFound ??
                  (res as any)?.diagnostics?.matchingDealFound ?? null,
              },
            },
          }));
        } catch { /* ignore */ }
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

        // Emit reconciliation debug payload for the Dev panel (no MT5 polling on reject/block).
        try {
          const positionsAfterSnapshot: any[] = JSON.parse(
            JSON.stringify((positionsRef.current as any[]) || []),
          );
          window.dispatchEvent(new CustomEvent("mt:execution-reconcile-debug", {
            detail: {
              at: new Date().toISOString(),
              account: {
                account_number: (liveAccount as any)?.login ?? null,
                server: (liveAccount as any)?.server ?? null,
                trading_layer_trader_id:
                  (res as any)?.trading_layer_trader_id ??
                  (res as any)?.diagnostics?.trader_id ??
                  (res as any)?.diagnostics?.accountId ??
                  null,
              },
              request: {
                symbol: normalizedSym,
                side: sideArg,
                volume: Number(volNum.toFixed(2)),
                stopLoss: noStops ? null : (sl ? Number(sl) : null),
                takeProfit: noStops ? null : (tp ? Number(tp) : null),
                deviation: (res as any)?.diagnostics?.payloadSent?.deviation ?? null,
                endpoint: "submit-best-execution-order",
              },
              response: {
                retcode: (res as any)?.retcode ?? null,
                classification: (res as any)?.classification ?? null,
                raw: res ?? null,
              },
              reconciliation: {
                positionsBefore: positionsBeforeSnapshot,
                positionsAfter: positionsAfterSnapshot,
                matchFound: false,
                confirmedTicket: null,
              },
              history: {
                matchingPendingOrderFound:
                  (res as any)?.diagnostics?.matchingPendingOrderFound ?? null,
                matchingDealFound:
                  (res as any)?.diagnostics?.matchingDealFound ?? null,
              },
            },
          }));
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      toast.error(e?.message || "Order failed");
      broadcastExec("Execution Failed");
    } finally {
      setSubmitting(false);
      unlockExecution();
    }
  };


  const closeSymbolPositions = async () => {
    if (symbolPositions.length === 0) {
      toast.info("No open positions on this symbol");
      return;
    }
    if (isExecutionLocked()) { toast.warning("Another execution is in progress."); return; }
    setSubmitting(true);
    lockExecution("close_symbol", 30000);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated.");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/close-position-controlled`;
      for (const p of symbolPositions) {
        const closeSide: "buy" | "sell" = p.side === "buy" ? "sell" : "buy";
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            ticket: String(p.ticket),
            symbol: p.symbol,
            volume: Number(Number(p.volume).toFixed(2)),
            side: closeSide,
          }),
        });
      }
      toast.success(`Closed ${symbolPositions.length} position(s)`);
      broadcastExec("Position Closed");
      window.dispatchEvent(new CustomEvent("mt:refresh-positions"));
      window.dispatchEvent(new CustomEvent("mt:refresh-execution-logs"));
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Close failed");
      broadcastExec("Close Failed");
    } finally {
      setSubmitting(false);
      unlockExecution();
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

  // Tick-age string for the micro quote strip ("3s" / "2m" / "1h" / "—").
  const tickAgeStr = (() => {
    const ts = tickUpdatedAt ? new Date(tickUpdatedAt).getTime() : null;
    if (!ts) return "—";
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  })();
  const spreadPts =
    spread != null
      ? (spread / (normalizedSym.includes("JPY") ? 0.01 : 0.0001)).toFixed(1)
      : null;

  return (
    <div className={cn(
      "rounded-sm border border-neutral-800/70 bg-[#0b0b0b] overflow-hidden text-neutral-100 text-[11px]",
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2 py-1 border-b border-neutral-800 bg-[#0a0a0a]">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFCD05]">{t("terminal.orderTicket" as never)}</span>
          <span className="px-1 py-[1px] rounded-sm border border-[#FFCD05]/40 bg-[#FFCD05]/10 text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-[#FFCD05]">
            Dry Run
          </span>
          {tickStale ? (
            <span className="inline-flex items-center gap-1 px-1 py-[1px] rounded-sm bg-amber-500/15 text-[8px] font-mono uppercase tracking-[0.18em] text-amber-400">
              <span className="inline-flex h-1 w-1 rounded-full bg-amber-400" /> Stale
            </span>
          ) : null}
          {devMode && (
            <span className="px-1 py-[1px] rounded-sm border border-neutral-700 bg-neutral-800/60 text-[8px] font-mono uppercase tracking-[0.18em] text-neutral-300">
              Dev
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setDevMode(!devEnabled)}
              title="Toggle developer panels (admin only)"
              className={cn(
                "rounded-sm border px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-widest transition-colors",
                devEnabled
                  ? "border-[#FFCD05] bg-[#FFCD05]/15 text-[#FFCD05]"
                  : "border-neutral-700 bg-transparent text-neutral-500 hover:text-neutral-200",
              )}
            >
              {devEnabled ? "Dev On" : "Dev Off"}
            </button>
          )}
          <span className="text-neutral-500">{liveAccount?.login ? `#${liveAccount.login}` : "—"}</span>
          <span className="text-neutral-700">·</span>
          <span className={cn(sessionPnl > 0 ? "text-emerald-400" : sessionPnl < 0 ? "text-red-400" : "text-neutral-100")}>
            {sessionPnl >= 0 ? "+" : ""}{fmt(sessionPnl, currency)}
          </span>
        </div>
      </div>

      <div className="p-1.5 space-y-1">


        {/* Symbol block */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSymbolOpen((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between rounded-sm border bg-[#0a0a0a] px-2 py-1.5 transition-colors",
              symbolOpen
                ? "border-[#FFCD05]/50 ring-1 ring-[#FFCD05]/20"
                : "border-neutral-800 hover:border-[#FFCD05]/30",
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-5 items-center rounded-sm border border-[#FFCD05]/30 bg-[#FFCD05]/5 px-1 text-[8.5px] font-mono font-bold uppercase tracking-widest text-[#FFCD05]">
                {classify(normalizedSym)}
              </span>
              <div className="flex flex-col items-start min-w-0">
                <span className="font-heading text-[12.5px] font-bold leading-tight text-neutral-50 tracking-wide">{normalizedSym || "—"}</span>
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider truncate max-w-[140px]">
                  {effectiveSelected?.description || selectedSymbolInfo?.description || (isLive ? "Live broker symbol" : "Loading…")}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="text-right font-mono tabular-nums leading-tight">
                <div className="text-[10.5px] text-red-400 font-semibold">{fmtPx(bid, digits)}</div>
                <div className="text-[10.5px] text-emerald-400 font-semibold">{fmtPx(ask, digits)}</div>
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

        {/* Execution block — BlackArrow-style compound side blocks.
            Each side stacks: side label · live price · large MKT execution button. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-1">
          {/* SELL side */}
          <div
            className={cn(
              "flex flex-col rounded-sm border overflow-hidden transition-colors",
              side === "sell"
                ? "border-red-500/70 bg-red-500/[0.06]"
                : "border-neutral-800 bg-[#0a0a0a]",
            )}
          >
            <button
              type="button"
              onClick={() => setSide("sell")}
              className="flex flex-col items-stretch px-2 py-1 text-left hover:bg-red-500/[0.04]"
            >
              <span className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.2em] text-red-400/80">
                <span>Sell</span><span>Bid</span>
              </span>
              <span className={cn(
                "font-mono tabular-nums text-[16px] leading-tight font-semibold text-red-400 transition-colors",
                bidFlash === "up" && "text-red-300",
                bidFlash === "down" && "text-red-500",
              )}>
                {fmtPx(bid, digits)}
              </span>
            </button>
            <SideBtn
              tone="sell"
              disabled={!canSubmitMarket}
              loading={submitting && side === "sell"}
              onClick={() => submitMarket("sell")}
            >
              Sell @ MKT
            </SideBtn>
          </div>

          {/* Center spread divider */}
          <div className="flex flex-col items-center justify-center px-1 text-center min-w-[44px]">
            <span className="text-[7.5px] font-mono uppercase tracking-[0.22em] text-neutral-500">Spread</span>
            <span className="font-mono tabular-nums text-[11px] text-neutral-200">{spreadPts ?? "—"}</span>
            <span className="mt-0.5 text-[7.5px] font-mono uppercase tracking-[0.22em] text-neutral-600">{tickAgeStr}</span>
          </div>

          {/* BUY side */}
          <div
            className={cn(
              "flex flex-col rounded-sm border overflow-hidden transition-colors",
              side === "buy"
                ? "border-emerald-500/70 bg-emerald-500/[0.06]"
                : "border-neutral-800 bg-[#0a0a0a]",
            )}
          >
            <button
              type="button"
              onClick={() => setSide("buy")}
              className="flex flex-col items-stretch px-2 py-1 text-left hover:bg-emerald-500/[0.04]"
            >
              <span className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">
                <span>Ask</span><span>Buy</span>
              </span>
              <span className={cn(
                "font-mono tabular-nums text-[16px] leading-tight font-semibold text-emerald-400 transition-colors text-right",
                askFlash === "up" && "text-emerald-300",
                askFlash === "down" && "text-emerald-500",
              )}>
                {fmtPx(ask, digits)}
              </span>
            </button>
            <SideBtn
              tone="buy"
              disabled={!canSubmitMarket}
              loading={submitting && side === "buy"}
              onClick={() => submitMarket("buy")}
            >
              Buy @ MKT
            </SideBtn>
          </div>
        </div>

        <p className="px-1 text-[9.5px] leading-snug text-muted-foreground/70">
          Sends a real order to your connected MT5 account. You are responsible for this decision. Not investment advice.
        </p>


        {/* Dev-only dry-run best-execution test */}
        {devMode && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleBestExecutionDryRun}
              className="h-5 rounded-sm border border-[#FFCD05]/40 bg-[#FFCD05]/10 px-2 text-[9px] font-mono uppercase tracking-wider text-[#FFCD05] hover:bg-[#FFCD05]/20"
            >
              Dry Run Best Execution
            </button>
          </div>
        )}

        {/* Dev-only LIVE CONTROLLED 0.01 test — visually isolated, requires checkbox */}
        {devMode && (
          <div className="mt-2 rounded-md border-2 border-red-600/70 bg-red-950/30 p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Live Controlled Test
            </div>
            <p className="text-[10px] leading-snug text-red-300">
              This sends a real market order to the connected MT5 account.
            </p>
            <label className="flex items-start gap-1.5 text-[10px] text-red-200 cursor-pointer">
              <Checkbox
                checked={liveTestConfirmed}
                onCheckedChange={(v) => setLiveTestConfirmed(v === true)}
                className="mt-0.5 border-red-500 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
              />
              <span>I understand this sends a real order to my connected MT5 account.</span>
            </label>
            <button
              type="button"
              disabled={!liveTestConfirmed || liveTestSubmitting || cooling}
              onClick={handleLiveTest001}
              title={cooling ? `Rate limited — retry in ${cooldownSec}s` : undefined}
              className="w-full h-7 rounded-sm border border-red-500 bg-red-600 px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {liveTestSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {cooling ? `RATE LIMITED — ${cooldownSec}s` : "LIVE TEST 0.01"}
            </button>
          </div>
        )}

        {/* Pending orders — 2×2 compact secondary grid */}
        <div className="grid grid-cols-2 gap-1">
          <SideBtn tone="buy" outline small disabled={pendingDisabled} title="Pending orders coming soon">Buy Stop</SideBtn>
          <SideBtn tone="sell" outline small disabled={pendingDisabled} title="Pending orders coming soon">Sell Stop</SideBtn>
          <SideBtn tone="buy" outline small disabled={pendingDisabled} title="Pending orders coming soon">Buy Limit</SideBtn>
          <SideBtn tone="sell" outline small disabled={pendingDisabled} title="Pending orders coming soon">Sell Limit</SideBtn>
        </div>


        {/* SL / TP — compact dual column */}
        <div className="rounded-sm border border-neutral-800 bg-[#080808] p-1.5 space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-400/80">Stop Loss</label>
                {slPips > 0 && !noStops ? (
                  <span className="text-[9px] font-mono tabular-nums text-red-400/70">{slPips.toFixed(0)} pips</span>
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
              <div className="grid grid-cols-3 gap-0.5">
                {[10, 20, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={noStops}
                    onClick={() => applyPipPreset("sl", p)}
                    className="h-5 rounded-sm border border-red-500/25 bg-red-500/5 text-[9px] font-mono tabular-nums text-red-300 hover:bg-red-500/15 disabled:opacity-40"
                  >
                    {p}p
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400/80">Take Profit</label>
                {tpPips > 0 && !noStops ? (
                  <span className="text-[9px] font-mono tabular-nums text-emerald-400/70">{tpPips.toFixed(0)} pips</span>
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
              <div className="grid grid-cols-3 gap-0.5">
                {[20, 40, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={noStops}
                    onClick={() => applyPipPreset("tp", p)}
                    className="h-5 rounded-sm border border-emerald-500/25 bg-emerald-500/5 text-[9px] font-mono tabular-nums text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40"
                  >
                    {p}p
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground border-t border-neutral-900 pt-1">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox checked={noStops} onCheckedChange={(v) => setNoStops(v === true)} className="h-3 w-3" />
              No SL/TP
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <Checkbox checked={autoReset} onCheckedChange={(v) => setAutoReset(v === true)} className="h-3 w-3" />
              Reset after fill
            </label>
          </div>
        </div>

        {(volumeError || slTpError) ? (
          <div className="flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3 shrink-0" /> {volumeError || slTpError}
          </div>
        ) : null}

        {/* Risk metrics summary — denser, two-column tabular layout */}
        <div className="rounded-sm border border-neutral-800 bg-[#0a0a0a]">
          <div className="flex items-center justify-between px-2 py-0.5 border-b border-neutral-900 bg-[#070707]">
            <span className="text-[8.5px] font-mono uppercase tracking-[0.2em] text-neutral-500">Risk Metrics</span>
            <span className={cn(
              "text-[9px] font-mono tabular-nums",
              riskPct > 2 ? "text-red-400" : riskPct > 1 ? "text-[#FFCD05]" : "text-emerald-400",
            )}>
              {riskPct ? `${riskPct.toFixed(2)}% acct` : "—"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-[1px] px-2 py-1">
            <SummaryRow label="Entry" value={fmtPx(entryPrice || null, digits)} tone={side === "buy" ? "pos" : "neg"} />
            <SummaryRow label="Notional" value={fmt(notional, currency)} />
            <SummaryRow label="Margin" value={fmt(marginRequired, currency)} />
            <SummaryRow label="Spread" value={spreadCost != null ? fmt(spreadCost, currency) : "—"} />
            <SummaryRow
              label="Max Loss"
              value={potentialLoss ? fmt(potentialLoss, currency) : "—"}
              tone={riskPct > 2 ? "neg" : undefined}
            />
            <SummaryRow
              label="Target P&L"
              value={potentialProfit ? `+${fmt(potentialProfit, currency)}` : "—"}
              tone="pos"
            />
          </div>
        </div>

        {/* Bottom row */}
        {/* Utility action bar — muted, never stronger than Buy/Sell */}
        <div className="grid grid-cols-4 gap-1">
          <ToolBtn
            onClick={() => { setSl(""); setTp(""); setPrice(""); setNoStops(false); }}
            icon={<X className="h-3 w-3" />}
            label="Cancel"
          />
          <ToolBtn
            onClick={() => setSide(side === "buy" ? "sell" : "buy")}
            icon={<RotateCcw className="h-3 w-3" />}
            label="Invert"
          />
          <ToolBtn onClick={closeSymbolPositions} icon={<X className="h-3 w-3" />} label="Close" danger />
          <ToolBtn
            onClick={() => { setSl(""); setTp(""); setPrice(""); setNoStops(false); closeSymbolPositions(); }}
            icon={<X className="h-3 w-3" />}
            label="Close + Cancel"
            danger
          />
        </div>


        {/* Symbol exposure footer removed — handled by SelectedSymbolExposure in the right rail. */}

      </div>
      <ExecutionResultModal result={execResult} onClose={() => setExecResult(null)} />

      {liveConfirm && (() => {
        const c = liveConfirm;
        const isConfirmed = c.phase === "confirmed" && c.ticket != null;
        const headerByPhase: Record<typeof c.phase, { text: string; tone: string }> = {
          placing: { text: "Broker accepted/placed the order. Waiting for final position confirmation.", tone: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300" },
          confirming: { text: "Broker accepted/placed the order. Waiting for final position confirmation.", tone: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300" },
          confirmed: { text: "Position confirmed", tone: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" },
          pending_verification: { text: "Order was placed by broker, but final position confirmation is pending. Please verify in MT5.", tone: "border-yellow-500/60 bg-yellow-500/10 text-yellow-200" },
          rejected: { text: "Execution rejected", tone: "border-red-500/60 bg-red-500/10 text-red-300" },
        };
        // status-based override line (hidden once position is confirmed)
        let statusLine: { text: string; tone: string } | null = null;
        const s = (c.status || "").toLowerCase();
        // NEVER claim "executed" off broker response alone — wait for MT5 ticket.
        if (s === "done") statusLine = { text: "Broker accepted — MT5 confirmation pending", tone: "text-yellow-300" };
        else if (s === "placed") statusLine = { text: "Order placed — MT5 confirmation pending", tone: "text-yellow-300" };
        else if (s === "rejected" || s === "failed") statusLine = { text: "Execution rejected", tone: "text-red-300" };
        const h = headerByPhase[c.phase];
        return (
          <div className={cn("mt-2 rounded border px-3 py-2 text-[11px] font-mono", h.tone)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold uppercase tracking-wider">{h.text}</div>
              <button type="button" onClick={() => setLiveConfirm(null)} className="text-current/70 hover:text-current">×</button>
            </div>
            {statusLine && !isConfirmed && (
              <div className={cn("mt-1", statusLine.tone)}>{statusLine.text}</div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-neutral-200">
              {c.symbol && (<><span className="text-neutral-500">Symbol</span><span>{c.symbol}</span></>)}
              {c.side && (<><span className="text-neutral-500">Side</span><span className="uppercase">{c.side}</span></>)}
              {c.volume != null && (<><span className="text-neutral-500">Volume</span><span>{c.volume}</span></>)}
              {c.ticket != null && (<><span className="text-neutral-500">Ticket</span><span>{String(c.ticket)}</span></>)}
              {c.entryPrice != null && (<><span className="text-neutral-500">Entry</span><span>{c.entryPrice}</span></>)}
              {c.currentPrice != null && (<><span className="text-neutral-500">Current</span><span>{c.currentPrice}</span></>)}
              {c.pnl != null && (
                <>
                  <span className="text-neutral-500">Floating P&L</span>
                  <span className={cn(c.pnl > 0 ? "text-emerald-300" : c.pnl < 0 ? "text-red-300" : "")}>
                    {fmt(c.pnl, currency)}
                  </span>
                </>
              )}
              {c.brokerMessage && (<><span className="text-neutral-500">Broker</span><span className="truncate">{c.brokerMessage}</span></>)}
              {c.retcode != null && (<><span className="text-neutral-500">Retcode</span><span>{c.retcode}</span></>)}
              {c.brokerAccepted != null && (<><span className="text-neutral-500">Broker accepted</span><span>{c.brokerAccepted ? "yes" : "no"}</span></>)}
              {c.mt5Confirmed != null && (<><span className="text-neutral-500">MT5 confirmed</span><span className={c.mt5Confirmed ? "text-emerald-300" : "text-yellow-300"}>{c.mt5Confirmed ? "yes" : "no"}</span></>)}
              {c.confirmationStatus && (<><span className="text-neutral-500">Confirmation</span><span className={cn(c.confirmationStatus === "confirmed" ? "text-emerald-300" : c.confirmationStatus === "failed" ? "text-red-300" : "text-yellow-300")}>{c.confirmationStatus}</span></>)}
              {c.confirmedTicket != null && (<><span className="text-neutral-500">Confirmed ticket</span><span>{String(c.confirmedTicket)}</span></>)}
              {c.confirmedEntryPrice != null && (<><span className="text-neutral-500">Confirmed entry</span><span>{c.confirmedEntryPrice}</span></>)}
              {c.confirmedVolume != null && (<><span className="text-neutral-500">Confirmed volume</span><span>{c.confirmedVolume}</span></>)}
            </div>
          </div>
        );
      })()}

      {/* Old debugInfo panel removed — only orderDebug.rawEdgeFunctionResponse is rendered below. */}


      {devMode && orderDebug && (
        <div className="mt-2 rounded border border-[#FFCD05]/60 bg-[#0a0a0a] text-[10px] font-mono overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-800 bg-[#050505] px-2 py-1">
            <span className="text-[9px] uppercase tracking-widest text-[#FFCD05]/80">Raw Edge Function Response</span>
            <button
              type="button"
              onClick={() => setOrderDebug(null)}
              className="text-neutral-500 hover:text-neutral-200"
            >
              ×
            </button>
          </div>
          <div className="p-2 space-y-1.5">
            <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap break-all text-neutral-100">
{JSON.stringify(orderDebug.rawEdgeFunctionResponse, null, 2)}
            </pre>
            {orderDebug.validationError === "Wrong live execution handler is still being used." && (
              <div className="text-red-400">Wrong live execution handler is still being used.</div>
            )}
          </div>
        </div>
      )}
      {devMode && (
        <div className="mt-3 space-y-3">
          <Mt5PositionVerificationPanel />
          <MarketDataDiagnosticsPanel />
          <ExecutionReconciliationDebugPanel />
          <ExecutionAuditPanel refreshKey={auditRefreshKey} />
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
