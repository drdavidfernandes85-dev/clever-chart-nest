/**
 * Pending Order Modal — Buy/Sell Limit/Stop ticket (admin live test).
 *
 * Submits to `submit-pending-order` and records a row in
 * `admin_live_execution_tests` via startAdminLiveTest/updateAdminLiveTest.
 *
 * Confirmation handoff is via the executionConfirmationCoordinator, so the
 * UI never claims a pending-order "placed" status without MT5 evidence.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { startAdminLiveTest, updateAdminLiveTest, type AdminTestType } from "@/lib/adminLiveTests";
import { executionConfirmationCoordinator } from "@/services/executionConfirmationCoordinator";
import {
  useTerminalExecutionEligibility,
  type TerminalExecutionEligibility,
} from "@/lib/terminalExecutionEligibility";

export type PendingType = "buy_limit" | "sell_limit" | "buy_stop" | "sell_stop";

interface Props {
  open: boolean;
  onClose: () => void;
  pendingType: PendingType;
  symbol: string;
  bid: number | null;
  ask: number | null;
  digits: number;
  defaultVolume: number;
  maxVolume: number;
  traderId?: string | null;
  mt5Login?: string | null;
}

const LABELS: Record<PendingType, string> = {
  buy_limit: "Buy Limit",
  sell_limit: "Sell Limit",
  buy_stop: "Buy Stop",
  sell_stop: "Sell Stop",
};

function validateEntry(pt: PendingType, entry: number, bid: number | null, ask: number | null) {
  if (!Number.isFinite(entry) || entry <= 0) return "Entry price required";
  if (bid == null || ask == null) return null;
  if (pt === "buy_limit"  && !(entry < ask)) return "Buy Limit must be below current ask";
  if (pt === "sell_limit" && !(entry > bid)) return "Sell Limit must be above current bid";
  if (pt === "buy_stop"   && !(entry > ask)) return "Buy Stop must be above current ask";
  if (pt === "sell_stop"  && !(entry < bid)) return "Sell Stop must be below current bid";
  return null;
}

const PendingOrderModal = ({
  open, onClose, pendingType, symbol, bid, ask, digits,
  defaultVolume, maxVolume, traderId, mt5Login,
}: Props) => {
  const side: "buy" | "sell" = pendingType.startsWith("buy") ? "buy" : "sell";
  const [entry, setEntry] = useState("");
  const [vol, setVol] = useState(defaultVolume.toFixed(2));
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [ack, setAck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    data: eligibility,
    loading: eligLoading,
    refresh: refreshEligibility,
  } = useTerminalExecutionEligibility(open ? symbol : null);

  useEffect(() => {
    if (open) {
      setEntry("");
      setVol(defaultVolume.toFixed(2));
      setSl(""); setTp(""); setAck(false);
      refreshEligibility();
    }
  }, [open, defaultVolume, symbol, refreshEligibility]);

  const entryNum = Number(entry);
  const volNum = Number(vol);
  const entryErr = useMemo(
    () => validateEntry(pendingType, entryNum, bid, ask),
    [pendingType, entryNum, bid, ask],
  );
  const volErr =
    !Number.isFinite(volNum) || volNum <= 0 ? "Volume must be > 0" :
    volNum > maxVolume ? `Volume exceeds admin test cap ${maxVolume}` : null;

  const sideReady = side === "buy" ? eligibility?.buyReady : eligibility?.sellReady;
  const sideBlocked =
    side === "buy" ? eligibility?.buyBlockedReason : eligibility?.sellBlockedReason;
  const eligOk =
    !!eligibility &&
    !!eligibility.brokerSymbol &&
    eligibility.routeVerified === true &&
    sideReady === true;
  const eligBlockerCopy = !eligibility
    ? "Loading execution eligibility…"
    : !eligibility.brokerSymbol
      ? "Broker symbol unresolved — refresh execution eligibility before submitting."
      : !eligibility.routeVerified
        ? "Account route not verified."
        : !sideReady
          ? (sideBlocked || `${side.toUpperCase()} not ready for ${eligibility.brokerSymbol}.`)
          : null;

  const canSubmit = !entryErr && !volErr && ack && !submitting && eligOk;


  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const tradeId = crypto.randomUUID();
    const testId = await startAdminLiveTest({
      testType: pendingType as AdminTestType,
      tradeId,
      brokerSymbol: symbol,
      side,
      requestedVolume: volNum,
      traderId: traderId ?? null,
      mt5Login: mt5Login ?? null,
      notes: `${LABELS[pendingType]} ${symbol} @ ${entryNum}`,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-pending-order`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({
          tradeId,
          symbol,
          displaySymbol: symbol,
          brokerSymbol: eligibility?.brokerSymbol ?? symbol,
          symbolMappingSource: "trading_layer_symbols",
          symbolMappingCheckedAt: eligibility?.checkedAt ?? null,
          accountTradeMode: eligibility?.accountTradeModeLabel ?? eligibility?.accountTradeModeRaw ?? null,
          symbolTradeMode: eligibility?.symbolTradeModeLabel ?? eligibility?.symbolTradeModeRaw ?? null,
          pendingType,
          volume: volNum,
          entryPrice: entryNum,
          currentBid: bid,
          currentAsk: ask,
          stopLoss: sl ? Number(sl) : null,
          takeProfit: tp ? Number(tp) : null,
        }),
      });
      const data = await res.json().catch(() => ({} as any));

      const brokerAccepted = res.ok && (data?.success === true || data?.status === "pending_order_placed");
      if (testId) {
        await updateAdminLiveTest(testId, {
          status: brokerAccepted ? "pending" : "fail",
          confirmation_status: brokerAccepted ? "broker_accepted_pending_confirmation" : (data?.status || "pending_order_failed"),
          order_id: data?.orderId != null ? String(data.orderId) : null,
          request_id: data?.requestId ?? null,
          retcode: data?.retcode ?? null,
          retcode_name: data?.retcodeName ?? null,
          retcode_description: data?.brokerMessage ?? null,
          latency_ms: data?.latencyMs ?? null,
          rate_limit_hit: data?.tradingLayerStatus === 429,
          evidence: data,
        });
      }

      if (!brokerAccepted) {
        toast.error(data?.error || "Pending order rejected", { description: data?.brokerMessage });
        return;
      }

      toast.success("Pending order sent", { description: "Awaiting MT5 confirmation." });

      // Hand off to coordinator for evidence-based confirmation.
      executionConfirmationCoordinator.enqueue({
        tradeId,
        clientOrderId: tradeId,
        requestId: data?.requestId ?? null,
        orderId: data?.orderId != null ? String(data.orderId) : null,
        dealId: null,
        positionTicket: null,
        brokerSymbol: symbol,
        symbol,
        side,
        volume: volNum,
        requestedPrice: entryNum,
        retcode: data?.retcode ?? null,
        brokerMessage: data?.brokerMessage ?? null,
        clientClickAt: new Date().toISOString(),
        rawExecutionResponse: data,
        traderId: traderId ?? null,
        accountId: data?.metaapi_account_id ?? null,
      });

      // When coordinator finishes, reflect into the test row.
      const unsub = executionConfirmationCoordinator.subscribe((snapshot) => {
        const st = snapshot[tradeId];
        if (!st) return;
        if (st.status === "pending_order_placed") {
          if (testId) void updateAdminLiveTest(testId, {
            status: "pass",
            confirmation_status: "pending_order_placed",
            verified: true,
          });
          unsub();
        } else if (st.status === "order_rejected") {
          if (testId) void updateAdminLiveTest(testId, {
            status: "fail",
            confirmation_status: "order_rejected",
            notes: st.message ?? null,
          });
          unsub();
        } else if (st.status === "confirmation_delayed_rate_limited") {
          if (testId) void updateAdminLiveTest(testId, {
            status: "pending",
            confirmation_status: "confirmation_delayed_rate_limited",
            rate_limit_hit: true,
          });
        } else if (st.status === "unconfirmed_after_reconciliation") {
          if (testId) void updateAdminLiveTest(testId, {
            status: "fail",
            confirmation_status: "unconfirmed_after_reconciliation",
          });
          unsub();
        }
      });
      window.dispatchEvent(new CustomEvent("mt:refresh-pending-orders"));
      onClose();
    } catch (e: any) {
      toast.error("Pending order failed", { description: e?.message });
      if (testId) await updateAdminLiveTest(testId, { status: "fail", notes: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;
  const toneClasses = side === "buy"
    ? "border-emerald-500/60 bg-emerald-600 hover:bg-emerald-500 text-white"
    : "border-red-500/60 bg-red-600 hover:bg-red-500 text-white";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-sm border border-neutral-700 bg-[#0c0c0c] text-neutral-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FFCD05]">{LABELS[pendingType]}</span>
            <span className="font-mono text-[11px] text-neutral-200">{symbol}</span>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-2 p-3 text-[11px]">
          <div className="flex items-center justify-between rounded-sm border border-neutral-800 bg-[#0a0a0a] px-2 py-1 font-mono tabular-nums">
            <span className="text-red-400">Bid {bid != null ? bid.toFixed(digits) : "—"}</span>
            <span className="text-emerald-400">Ask {ask != null ? ask.toFixed(digits) : "—"}</span>
          </div>

          <label className="block">
            <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Entry / Trigger Price</span>
            <input
              value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder="0.00000"
              className="mt-0.5 w-full rounded-sm border border-neutral-700 bg-[#0a0a0a] px-2 py-1 font-mono text-[12px] text-neutral-100 focus:border-[#FFCD05] focus:outline-none"
            />
            {entryErr ? <span className="block pt-0.5 text-[10px] text-red-400">{entryErr}</span> : null}
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block col-span-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">Lots</span>
              <input value={vol} onChange={(e) => setVol(e.target.value)} inputMode="decimal"
                className="mt-0.5 w-full rounded-sm border border-neutral-700 bg-[#0a0a0a] px-2 py-1 font-mono text-[12px] text-neutral-100 focus:border-[#FFCD05] focus:outline-none" />
            </label>
            <label className="block col-span-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">SL</span>
              <input value={sl} onChange={(e) => setSl(e.target.value)} inputMode="decimal" placeholder="—"
                className="mt-0.5 w-full rounded-sm border border-neutral-700 bg-[#0a0a0a] px-2 py-1 font-mono text-[12px] text-red-300 focus:border-[#FFCD05] focus:outline-none" />
            </label>
            <label className="block col-span-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-500">TP</span>
              <input value={tp} onChange={(e) => setTp(e.target.value)} inputMode="decimal" placeholder="—"
                className="mt-0.5 w-full rounded-sm border border-neutral-700 bg-[#0a0a0a] px-2 py-1 font-mono text-[12px] text-emerald-300 focus:border-[#FFCD05] focus:outline-none" />
            </label>
          </div>

          {volErr ? <p className="text-[10px] text-red-400">{volErr}</p> : null}

          <div className="rounded-sm border-2 border-red-600/70 bg-red-950/30 p-1.5 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-red-400">
              <AlertTriangle className="h-3 w-3" /> Real MT5 Pending Order
            </div>
            <label className="flex items-start gap-1.5 text-[10px] text-red-200 cursor-pointer">
              <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)}
                className="mt-0.5 border-red-500 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" />
              <span>I understand this places a real {LABELS[pendingType].toLowerCase()} order on the connected MT5 account.</span>
            </label>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-7 rounded-sm border border-neutral-700 bg-[#0a0a0a] text-[10px] font-mono uppercase tracking-wider text-neutral-400 hover:text-neutral-100">
              Cancel
            </button>
            <button type="button" disabled={!canSubmit} onClick={submit}
              className={`flex-1 h-7 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 ${toneClasses}`}>
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              Place {LABELS[pendingType]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingOrderModal;
