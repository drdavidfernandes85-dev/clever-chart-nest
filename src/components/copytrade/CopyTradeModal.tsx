import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMTAccount } from "@/hooks/useMTAccount";
import { MENTOR_TIERS, MentorTierId } from "@/lib/mentor-tier";
import MentorBadge from "@/components/social/MentorBadge";

export interface CopyTradeRequest {
  signalId: string | null;
  pair: string;
  side: "buy" | "sell";
  entry: number;
  sl: number | null;
  tp: number | null;
  authorName?: string;
  authorTierId?: MentorTierId | null;
}

interface Props {
  request: CopyTradeRequest | null;
  onClose: () => void;
}

type Phase = "review" | "sending" | "executed" | "failed";

const RISK_PCT = 0.01; // 1% of equity

const pipSize = (sym: string) =>
  sym.includes("JPY") ? 0.01 : sym.includes("XAU") ? 0.1 : 0.0001;

const pipValuePerLot = (sym: string) => (sym.includes("XAU") ? 10 : 10);

const decimalsFor = (sym: string) =>
  sym.includes("JPY") ? 3 : sym.includes("XAU") ? 2 : 5;

const toBrokerSymbol = (s: string) => s.replace(/[^A-Za-z0-9]/g, "");

const CopyTradeModal = ({ request, onClose }: Props) => {
  const { user } = useAuth();
  const { account } = useMTAccount();
  const [phase, setPhase] = useState<Phase>("review");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Reset phase whenever a new request opens.
  useEffect(() => {
    if (request) {
      setPhase("review");
      setOrderId(null);
      setTicket(null);
      setErrorMsg(null);
      setAccepted(false);
    }
  }, [request]);

  const equity = account?.equity ? Number(account.equity) : 0;
  const isConnected = account?.status === "connected";

  // ---- Risk-based lot sizing: arriesgar 1% del equity hasta el SL ----
  const computed = useMemo(() => {
    if (!request) return { lots: 0.1, riskUsd: 0, rewardUsd: 0, slPips: 0, tpPips: 0 };
    const ps = pipSize(request.pair);
    const slDistance = request.sl != null ? Math.abs(request.entry - request.sl) : 0;
    const tpDistance = request.tp != null ? Math.abs(request.tp - request.entry) : 0;
    const slPips = slDistance / ps;
    const tpPips = tpDistance / ps;

    let lots = 0.1;
    if (equity > 0 && slPips > 0) {
      const riskTarget = equity * RISK_PCT;
      const valuePerPipPerLot = pipValuePerLot(request.pair);
      // lots * pips * value-per-pip = riskTarget
      lots = riskTarget / (slPips * valuePerPipPerLot);
      // clamp to broker-sane bounds
      lots = Math.max(0.01, Math.min(10, parseFloat(lots.toFixed(2))));
    }
    const riskUsd = slPips * pipValuePerLot(request.pair) * lots;
    const rewardUsd = tpPips * pipValuePerLot(request.pair) * lots;
    return { lots, riskUsd, rewardUsd, slPips, tpPips };
  }, [request, equity]);

  // ---- Subscribe to realtime updates on the queued order ----
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`copy-order-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mt_pending_orders",
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          const row = payload?.new;
          if (!row) return;
          if (row.status === "executed") {
            setTicket(row.ea_ticket ?? null);
            setPhase("executed");
          } else if (row.status === "failed") {
            setErrorMsg(row.ea_message ?? "Order rejected by broker");
            setPhase("failed");
          }
        },
      )
      .subscribe();

    // Safety timeout — if no EA confirmation in 45s, surface a soft warning but
    // keep the modal open so the user can close manually.
    const timeout = window.setTimeout(() => {
      setPhase((p) => {
        if (p === "sending") {
          setErrorMsg(
            "No confirmation received yet. The order is still queued — your EA may be offline.",
          );
          return "failed";
        }
        return p;
      });
    }, 45_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearTimeout(timeout);
    };
  }, [orderId]);

  if (!request) return null;
  if (typeof document === "undefined") return null;

  const isBuy = request.side === "buy";
  const dec = decimalsFor(request.pair);
  const tier = request.authorTierId ? MENTOR_TIERS[request.authorTierId] : null;

  // ---- Validate SL / TP relative to entry ----
  const validate = (): string | null => {
    const ref = request.entry;
    if (!ref || ref <= 0) return "Invalid entry price.";
    if (request.sl != null) {
      if (isBuy && request.sl >= ref) return "For BUY, SL must be below entry.";
      if (!isBuy && request.sl <= ref) return "For SELL, SL must be above entry.";
    }
    if (request.tp != null) {
      if (isBuy && request.tp <= ref) return "For BUY, TP must be above entry.";
      if (!isBuy && request.tp >= ref) return "For SELL, TP must be below entry.";
    }
    return null;
  };

  const handleConfirm = async () => {
    if (!user) {
      toast.error("Please sign in");
      return;
    }
    if (!account || !isConnected) {
      toast.error("MT account not connected", {
        description: "Connect your EA from Connect MT first.",
      });
      return;
    }
    const err = validate();
    if (err) {
      toast.error("Invalid stops", { description: err });
      return;
    }

    setPhase("sending");
    setErrorMsg(null);

    try {
      const payload = {
        user_id: user.id,
        account_id: account.id,
        signal_id: request.signalId,
        symbol: toBrokerSymbol(request.pair),
        side: request.side,
        order_type: "market" as const,
        volume: computed.lots,
        entry_price: null,
        stop_loss: request.sl,
        take_profit: request.tp,
      };
      const { data, error } = await supabase
        .from("mt_pending_orders")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      setOrderId(data.id);
    } catch (e: any) {
      setPhase("failed");
      setErrorMsg(e?.message ?? "Could not queue order");
    }
  };

  const sideAccent = isBuy
    ? "from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/30"
    : "from-red-500/15 via-red-500/5 to-transparent border-red-500/30";

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase === "sending" ? undefined : onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-md overflow-hidden rounded-2xl border bg-card bg-gradient-to-b ${sideAccent} shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_60px_-12px_hsl(48_100%_51%/0.25)]`}
        >
          {/* Fiery primary glow accent */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px rounded-2xl"
            style={{
              background:
                "radial-gradient(120% 60% at 50% 0%, hsl(48 100% 51% / 0.18), transparent 60%)",
            }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-between border-b border-border/40 bg-card/80 px-5 py-3.5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
                {phase === "review" && "Copy Signal"}
                {phase === "sending" && "Sending to MT5…"}
                {phase === "executed" && "Trade Executed"}
                {phase === "failed" && "Trade Failed"}
              </h3>
            </div>
            {phase !== "sending" && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Author strip */}
          {request.authorName && (
            <div className="relative flex items-center gap-2 border-b border-border/30 bg-background/40 px-5 py-2.5 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Signal by
              </span>
              <span className="font-heading text-sm font-bold text-foreground">
                {request.authorName}
              </span>
              {tier && <MentorBadge tier={tier} />}
            </div>
          )}

          {/* Body */}
          <div className="relative space-y-4 bg-card/70 px-5 py-5 backdrop-blur-xl">
            {/* Pair + side hero */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
                  {request.pair}
                </p>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ring-1 ${
                  isBuy
                    ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
                    : "bg-red-500/15 text-red-400 ring-red-500/40"
                }`}
              >
                {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span className="font-heading text-sm font-bold uppercase tracking-wider">
                  {request.side}
                </span>
              </div>
            </div>

            {/* Trade details grid */}
            <div className="grid grid-cols-2 gap-2">
              <DetailCell label="Entry" value={request.entry.toFixed(dec)} />
              <DetailCell label="Lots" value={computed.lots.toFixed(2)} accent="primary" />
              <DetailCell
                label="Stop Loss"
                value={request.sl != null ? request.sl.toFixed(dec) : "—"}
                accent="red"
                sub={request.sl != null ? `${computed.slPips.toFixed(0)} pips` : undefined}
              />
              <DetailCell
                label="Take Profit"
                value={request.tp != null ? request.tp.toFixed(dec) : "—"}
                accent="green"
                sub={request.tp != null ? `${computed.tpPips.toFixed(0)} pips` : undefined}
              />
            </div>

            {/* Risk / reward summary */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-red-400/80">
                  Risk
                </p>
                <p className="font-heading text-base font-bold tabular-nums text-red-400">
                  -${computed.riskUsd.toFixed(2)}
                </p>
                {equity > 0 && (
                  <p className="font-mono text-[9px] text-red-400/60">
                    {((computed.riskUsd / equity) * 100).toFixed(2)}% of equity
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-emerald-400/80">
                  Potential P&L
                </p>
                <p className="font-heading text-base font-bold tabular-nums text-emerald-400">
                  +${computed.rewardUsd.toFixed(2)}
                </p>
                {computed.slPips > 0 && (
                  <p className="font-mono text-[9px] text-emerald-400/60">
                    R:R {(computed.tpPips / computed.slPips).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Account state notice */}
            {!isConnected && phase === "review" && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Your MetaTrader EA is not connected. Connect from{" "}
                  <a href="/connect-mt" className="font-semibold underline">
                    Connect MT
                  </a>{" "}
                  first.
                </span>
              </div>
            )}

            {/* Phase content */}
            {phase === "review" && (
              <>
                {/* Mandatory risk acknowledgement */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 transition-colors hover:bg-primary/10">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
                    aria-label="Acknowledge trading risk"
                  />
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    I acknowledge that trading involves risk and I take full
                    responsibility for my own trading decisions.
                  </span>
                </label>

                <button
                  onClick={handleConfirm}
                  disabled={!isConnected || !accepted}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-heading text-sm font-extrabold uppercase tracking-[0.18em] text-white shadow-[0_15px_40px_-12px_rgba(16,185,129,0.6)] transition-all hover:bg-emerald-400 hover:shadow-[0_18px_50px_-12px_rgba(16,185,129,0.8)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm & Place Trade
                </button>
              </>
            )}

            {phase === "sending" && (
              <div className="flex flex-col items-center justify-center gap-3 py-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-heading text-sm font-bold text-foreground">
                  Sending order to your EA…
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  EA polls every ≤5 seconds
                </p>
              </div>
            )}

            {phase === "executed" && (
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/40">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="font-heading text-base font-bold text-emerald-400">
                  Trade executed successfully
                </p>
                {ticket && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">
                      Ticket
                    </span>
                    <span className="font-heading text-sm font-bold tabular-nums text-foreground">
                      #{ticket}
                    </span>
                    <a
                      href="https://www.metatrader5.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300"
                      aria-label="Open in MT5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="mt-1 h-10 w-full rounded-lg border border-border/50 bg-card font-heading text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted/40"
                >
                  Done
                </button>
              </div>
            )}

            {phase === "failed" && (
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-2 ring-red-500/40">
                  <XCircle className="h-7 w-7 text-red-400" />
                </div>
                <p className="font-heading text-base font-bold text-red-400">
                  Order could not be executed
                </p>
                {errorMsg && (
                  <p className="max-w-xs text-center font-mono text-[11px] leading-snug text-muted-foreground">
                    {errorMsg}
                  </p>
                )}
                <div className="mt-1 grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={onClose}
                    className="h-10 rounded-lg border border-border/50 bg-card font-heading text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-muted/40"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setPhase("review");
                      setErrorMsg(null);
                      setOrderId(null);
                    }}
                    className="h-10 rounded-lg bg-primary font-heading text-xs font-bold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`fixed left-1/2 top-1/2 z-[101] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card bg-gradient-to-b ${sideAccent} shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5 bg-card/80 backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
              {phase === "review" && "Copy Signal"}
              {phase === "sending" && "Sending to MT5…"}
              {phase === "executed" && "Trade Executed"}
              {phase === "failed" && "Trade Failed"}
            </h3>
          </div>
          {phase !== "sending" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4 bg-card/70 backdrop-blur-xl">
          {/* Pair + side hero */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-heading text-2xl font-extrabold tracking-tight text-foreground">
                {request.pair}
              </p>
              {request.authorName && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  via {request.authorName}
                </p>
              )}
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 ring-1 ${
                isBuy
                  ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/40"
                  : "bg-red-500/15 text-red-400 ring-red-500/40"
              }`}
            >
              {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="font-heading text-sm font-bold uppercase tracking-wider">
                {request.side}
              </span>
            </div>
          </div>

          {/* Trade details grid */}
          <div className="grid grid-cols-2 gap-2">
            <DetailCell label="Entry" value={request.entry.toFixed(dec)} />
            <DetailCell label="Lots" value={computed.lots.toFixed(2)} accent="primary" />
            <DetailCell
              label="Stop Loss"
              value={request.sl != null ? request.sl.toFixed(dec) : "—"}
              accent="red"
              sub={request.sl != null ? `${computed.slPips.toFixed(0)} pips` : undefined}
            />
            <DetailCell
              label="Take Profit"
              value={request.tp != null ? request.tp.toFixed(dec) : "—"}
              accent="green"
              sub={request.tp != null ? `${computed.tpPips.toFixed(0)} pips` : undefined}
            />
          </div>

          {/* Risk / reward summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-red-400/80">
                Risk
              </p>
              <p className="font-heading text-base font-bold text-red-400 tabular-nums">
                -${computed.riskUsd.toFixed(2)}
              </p>
              {equity > 0 && (
                <p className="font-mono text-[9px] text-red-400/60">
                  {((computed.riskUsd / equity) * 100).toFixed(2)}% of equity
                </p>
              )}
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-emerald-400/80">
                Potential P&L
              </p>
              <p className="font-heading text-base font-bold text-emerald-400 tabular-nums">
                +${computed.rewardUsd.toFixed(2)}
              </p>
              {computed.slPips > 0 && (
                <p className="font-mono text-[9px] text-emerald-400/60">
                  R:R {(computed.tpPips / computed.slPips).toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Account state notice */}
          {!isConnected && phase === "review" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Your MetaTrader EA is not connected. Connect from{" "}
                <a href="/connect-mt" className="underline font-semibold">
                  Connect MT
                </a>{" "}
                first.
              </span>
            </div>
          )}

          {/* Phase content */}
          {phase === "review" && (
            <button
              onClick={handleConfirm}
              disabled={!isConnected}
              className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-muted disabled:text-muted-foreground text-white font-heading font-extrabold uppercase tracking-[0.18em] text-sm shadow-[0_15px_40px_-12px_rgba(16,185,129,0.6)] hover:shadow-[0_18px_50px_-12px_rgba(16,185,129,0.8)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-5 w-5" />
              Confirm & Place Trade
            </button>
          )}

          {phase === "sending" && (
            <div className="flex flex-col items-center justify-center gap-3 py-4">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="font-heading text-sm font-bold text-foreground">
                Sending order to your EA…
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                EA polls every ≤5 seconds
              </p>
            </div>
          )}

          {phase === "executed" && (
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-500/40">
                <CheckCircle2 className="h-7 w-7 text-emerald-400" />
              </div>
              <p className="font-heading text-base font-bold text-emerald-400">
                Trade executed successfully
              </p>
              {ticket && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">
                    Ticket
                  </span>
                  <span className="font-heading text-sm font-bold text-foreground tabular-nums">
                    #{ticket}
                  </span>
                  <a
                    href="https://www.metatrader5.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300"
                    aria-label="Open in MT5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-1 h-10 w-full rounded-lg bg-card hover:bg-muted/40 border border-border/50 text-foreground font-heading font-bold uppercase tracking-wider text-xs transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center justify-center gap-3 py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-2 ring-red-500/40">
                <XCircle className="h-7 w-7 text-red-400" />
              </div>
              <p className="font-heading text-base font-bold text-red-400">
                Order could not be executed
              </p>
              {errorMsg && (
                <p className="font-mono text-[11px] text-center text-muted-foreground max-w-xs leading-snug">
                  {errorMsg}
                </p>
              )}
              <div className="grid w-full grid-cols-2 gap-2 mt-1">
                <button
                  onClick={onClose}
                  className="h-10 rounded-lg bg-card hover:bg-muted/40 border border-border/50 text-foreground font-heading font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setPhase("review");
                    setErrorMsg(null);
                    setOrderId(null);
                  }}
                  className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold uppercase tracking-wider text-xs transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

const DetailCell = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "red" | "green";
}) => {
  const valueColor =
    accent === "red"
      ? "text-red-400"
      : accent === "green"
        ? "text-emerald-400"
        : accent === "primary"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`font-heading text-base font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sub && (
        <p className="font-mono text-[9px] text-muted-foreground/70 mt-0.5">{sub}</p>
      )}
    </div>
  );
};

export default CopyTradeModal;
