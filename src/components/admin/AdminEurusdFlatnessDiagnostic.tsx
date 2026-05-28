// Read-only EURUSD flatness diagnostic. Authoritative source is fresh Trading Layer
// live positions/orders, NOT the mt_positions mirror. This card never submits a trade,
// close, modify, cancel, or creates a lifecycle authorisation. It only reports whether
// the final lifecycle retest is eligible for manual authorisation.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const INCIDENT_TICKET = "1169128468";

type FlatnessResp = {
  success: boolean;
  checkedAt?: string;
  source?: string;
  route?: { brokerSymbol: string; traderId: string; login: string | null };
  positions?: { totalCount: number; eurusdCount: number; eurusd: { ticket: string; symbol: string; side: string; volume: number }[] };
  orders?: { lookupOk: boolean; httpStatus: number; error: string | null; eurusdCount: number; eurusd: { ticket: string; symbol: string; side: string; volume: number }[] };
  incident?: { ticket: string; currentlyOpen: boolean };
  residualEurusdExposure?: "none" | "detected";
  retestEligibleForAuthorisation?: boolean;
  error?: string;
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-1 text-[11px]">
    <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
    <span className="font-mono text-foreground">{v}</span>
  </div>
);

const AdminEurusdFlatnessDiagnostic = () => {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<FlatnessResp | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true); setErr(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke("admin-eurusd-flatness", { body: {} });
      if (error) throw error;
      setData(resp as FlatnessResp);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const eligible = data?.retestEligibleForAuthorisation === true;
  const incidentOpen = data?.incident?.currentlyOpen === true;
  const residual = data?.residualEurusdExposure ?? "—";

  return (
    <Card className="p-4 border-border/40 bg-muted/5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">EURUSD Flatness — Final Retest Eligibility (Read-Only)</h3>
        <Badge variant="outline" className="font-mono text-[10px]">incident {INCIDENT_TICKET}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        Source: forced live Trading Layer positions & pending orders for the verified route.
        This panel never submits a trade, close, modify, cancel, or authorisation.
      </p>

      <Row k="checked_at" v={data?.checkedAt ?? "…"} />
      <Row k="source" v={data?.source ?? "…"} />
      <Row k="route_broker_symbol" v={data?.route?.brokerSymbol ?? "—"} />
      <Row k="route_trader_id" v={data?.route?.traderId ?? "—"} />
      <Row k="route_mt5_login" v={data?.route?.login ?? "—"} />
      <Row k="total_open_positions" v={data?.positions?.totalCount ?? "…"} />
      <Row k="open_eurusd_positions_count" v={data?.positions?.eurusdCount ?? "…"} />
      <Row
        k="open_eurusd_tickets"
        v={
          data?.positions?.eurusd?.length
            ? data.positions.eurusd.map((p) => `${p.ticket} ${p.side} ${p.volume}`).join(" | ")
            : "none"
        }
      />
      <Row k="pending_orders_lookup_ok" v={data?.orders ? (data.orders.lookupOk ? "yes" : `no (${data.orders.error ?? data.orders.httpStatus})`) : "…"} />
      <Row k="pending_eurusd_orders_count" v={data?.orders?.eurusdCount ?? "…"} />
      <Row
        k="pending_eurusd_orders"
        v={
          data?.orders?.eurusd?.length
            ? data.orders.eurusd.map((o) => `${o.ticket} ${o.side} ${o.volume}`).join(" | ")
            : "none"
        }
      />
      <Row k={`incident_ticket_${INCIDENT_TICKET}_open`} v={data ? (incidentOpen ? "yes" : "no") : "…"} />
      <Row
        k="residual_eurusd_exposure"
        v={<span className={residual === "none" ? "text-emerald-300" : residual === "detected" ? "text-red-300" : ""}>{residual}</span>}
      />
      <Row
        k="final_lifecycle_retest_eligible_for_authorisation"
        v={
          data == null ? "…" : (
            <span className={eligible ? "text-emerald-300" : "text-red-300"}>
              {eligible ? "yes" : "no"}
            </span>
          )
        }
      />

      {data && eligible && (
        <div className="mt-3 p-2 rounded border border-emerald-500/40 bg-emerald-500/5 text-[11px] text-emerald-200">
          <CheckCircle2 className="h-3 w-3 inline mr-1" />
          Account is flat for EURUSD. The existing Final Platform Lifecycle Validation card may be
          manually returned to <span className="font-mono">not_authorised</span> and the operator may
          authorise one entry dispatch + one close dispatch. Nothing is authorised automatically.
        </div>
      )}
      {data && !eligible && (
        <div className="mt-3 p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Residual EURUSD exposure or lookup failure detected. Final lifecycle retest remains
          blocked. Review native MT5 before any further action.
        </div>
      )}
      {err && (
        <div className="mt-3 p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
          {err}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
          <RefreshCw className="h-3 w-3 mr-1" />
          {busy ? "Checking…" : "Refresh Live Flatness (Read-Only)"}
        </Button>
      </div>
    </Card>
  );
};

export default AdminEurusdFlatnessDiagnostic;
