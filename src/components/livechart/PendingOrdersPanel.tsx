import { useCallback, useEffect, useState } from "react";
import { Loader2, X, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startAdminLiveTest, updateAdminLiveTest } from "@/lib/adminLiveTests";

interface PendingOrderRow {
  id?: string;
  ticket: string;
  symbol: string;
  type: string;
  side: "buy" | "sell";
  volume: number;
  entry_price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  status?: string;
}

const fmt = (sym: string, v: number | null | undefined) => {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const u = (sym || "").toUpperCase();
  const d = u.includes("JPY") ? 3 : u.includes("XAU") || u.includes("BTC") ? 2 : 5;
  return Number(v).toFixed(d);
};

const PendingOrdersPanel = () => {
  const [orders, setOrders] = useState<PendingOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("mt_pending_orders")
        .select("id,ticket:ea_ticket,symbol,order_type,side,volume,entry_price,stop_loss,take_profit,status")
        .order("created_at", { ascending: false })
        .limit(50);
      const mapped: PendingOrderRow[] = (data ?? []).map((r: any) => ({
        id: r.id,
        ticket: String(r.ticket ?? r.id ?? ""),
        symbol: r.symbol ?? "",
        type: r.order_type ?? "",
        side: r.side === "sell" ? "sell" : "buy",
        volume: Number(r.volume) || 0,
        entry_price: r.entry_price,
        stop_loss: r.stop_loss,
        take_profit: r.take_profit,
        status: r.status,
      }));
      setOrders(mapped.filter((o) => o.status !== "cancelled" && o.status !== "executed"));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); const id = window.setInterval(load, 15000); return () => window.clearInterval(id); }, [load]);

  const cancel = async (row: PendingOrderRow) => {
    if (!row.ticket) return toast.error("Order ticket missing");
    setCancellingId(row.id ?? row.ticket);
    const testId = await startAdminLiveTest({
      testType: "cancel_pending",
      brokerSymbol: row.symbol, side: row.side, requestedVolume: row.volume,
      notes: `cancel pending order ${row.ticket}`,
    });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-pending-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
        },
        body: JSON.stringify({ orderId: row.ticket, symbol: row.symbol }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.success === false) {
        toast.error(data?.error || "Cancel failed", { description: data?.brokerMessage });
        if (testId) await updateAdminLiveTest(testId, {
          status: "fail",
          confirmation_status: data?.status || "cancel_rejected",
          retcode: data?.retcode ?? null,
          latency_ms: data?.latencyMs ?? null,
          rate_limit_hit: data?.tradingLayerStatus === 429,
          evidence: data,
        });
        return;
      }

      // Broker accepted — verify by re-checking the pending orders list.
      toast.message("Cancel accepted by broker — verifying…", { description: `#${row.ticket}` });
      if (testId) await updateAdminLiveTest(testId, {
        status: "pending",
        confirmation_status: "cancel_broker_accepted_pending_confirmation",
        order_id: String(row.ticket),
        latency_ms: data?.latencyMs ?? null,
        evidence: data,
      });

      // Poll up to ~16s for fresh broker-reported evidence that the order
      // was cancelled/expired/removed by MT5. Absence alone (e.g. local
      // optimistic removal) is NOT treated as confirmation — we require an
      // explicit status the broker wrote into mt_pending_orders, or no
      // matching row AND a fetched_at timestamp newer than the cancel call.
      const cancelSentAt = Date.now();
      let confirmed = false;
      let confirmationSource: "broker_status" | "fresh_absence" | null = null;
      for (let i = 0; i < 8; i++) {
        await new Promise((res) => setTimeout(res, 2000));
        const { data: rows } = await supabase
          .from("mt_pending_orders")
          .select("ea_ticket,status,fetched_at,updated_at")
          .eq("ea_ticket", String(row.ticket))
          .limit(1);
        const r0: any = (rows ?? [])[0];
        if (r0 && ["cancelled", "canceled", "expired", "removed"].includes(String(r0.status).toLowerCase())) {
          confirmed = true; confirmationSource = "broker_status"; break;
        }
        if (!r0) {
          // Only accept absence if the broker-reported feed has refreshed AFTER
          // the cancel call (so we know it's not just optimistic removal).
          const { data: any2 } = await supabase
            .from("mt_pending_orders")
            .select("fetched_at")
            .order("fetched_at", { ascending: false, nullsFirst: false })
            .limit(1);
          const lastFetch = (any2 ?? [])[0]?.fetched_at;
          if (lastFetch && new Date(lastFetch).getTime() > cancelSentAt) {
            confirmed = true; confirmationSource = "fresh_absence"; break;
          }
        }
      }
      await load();

      if (confirmed) {
        toast.success("Pending order cancelled", { description: `#${row.ticket} ${row.symbol}` });
        if (testId) await updateAdminLiveTest(testId, {
          status: "pass", confirmation_status: "order_cancelled_confirmed", verified: true,
          evidence: { ...(data || {}), confirmationSource },
        });
      } else {
        toast.warning("Cancel unconfirmed", { description: "Broker accepted but no fresh MT5 evidence yet." });
        if (testId) await updateAdminLiveTest(testId, {
          status: "fail", confirmation_status: "cancel_unconfirmed_after_reconciliation",
          evidence: { ...(data || {}), confirmationSource: null },
        });
      }
    } catch (e: any) {
      toast.error("Cancel failed", { description: e?.message });
      if (testId) await updateAdminLiveTest(testId, { status: "fail", notes: e?.message });
    } finally { setCancellingId(null); }
  };



  return (
    <div className="flex flex-col rounded-sm border border-neutral-800 bg-[#0c0c0c] overflow-hidden text-neutral-100">
      <div className="flex items-center justify-between border-b border-neutral-800 bg-[#0a0a0a] px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <ListOrdered className="h-3 w-3 text-[#FFCD05]" />
          <h3 className="font-heading text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-200">Pending Orders</h3>
          <span className="font-mono text-[9px] tabular-nums text-neutral-500 border-l border-neutral-800 pl-1.5 ml-0.5">{orders.length}</span>
        </div>
      </div>
      {loading && orders.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-3 py-6 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : orders.length === 0 ? (
        <div className="px-3 py-6 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">No pending orders</div>
      ) : (
        <div className="max-h-[260px] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[700px] text-[11px] font-mono">
            <thead className="sticky top-0 z-10 bg-[#0a0a0a]">
              <tr className="text-left text-[9px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-3 py-2 font-normal">Ticket</th>
                <th className="px-3 py-2 font-normal">Symbol</th>
                <th className="px-3 py-2 font-normal">Type</th>
                <th className="px-3 py-2 font-normal text-right">Vol</th>
                <th className="px-3 py-2 font-normal text-right">Entry</th>
                <th className="px-3 py-2 font-normal text-right">SL</th>
                <th className="px-3 py-2 font-normal text-right">TP</th>
                <th className="px-3 py-2 font-normal text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/70">
              {orders.map((o) => {
                const id = o.id ?? o.ticket;
                return (
                  <tr key={id} className="tabular-nums hover:bg-neutral-900/40">
                    <td className="px-3 py-2 text-neutral-200">{o.ticket}</td>
                    <td className="px-3 py-2 font-bold">{o.symbol}</td>
                    <td className="px-3 py-2 uppercase text-neutral-300">{o.type}</td>
                    <td className="px-3 py-2 text-right text-neutral-200">{o.volume.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{fmt(o.symbol, o.entry_price)}</td>
                    <td className="px-3 py-2 text-right text-red-400/80">{fmt(o.symbol, o.stop_loss)}</td>
                    <td className="px-3 py-2 text-right text-emerald-400/80">{fmt(o.symbol, o.take_profit)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={cancellingId === id}
                        onClick={() => cancel(o)}
                        className="inline-flex h-5 items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-1.5 text-[9px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                      >
                        {cancellingId === id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="shrink-0 border-t border-neutral-900 bg-[#070707] px-2 py-[3px] text-[8px] font-mono uppercase tracking-[0.22em] text-[#5d6168] text-center">
        Cancel routes through backend cancel-pending-order · admin live test
      </div>
    </div>
  );
};

export default PendingOrdersPanel;
