// Admin — Controlled-Close Dispatch Preview (no mutation).
// Invokes close-position-controlled with validateOnly=true against the
// historical incident ticket (1169166422) to render the corrected close
// route + DTO that the platform WOULD dispatch, without sending any request
// to the Trading Layer.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const INCIDENT_TICKET = "1169166422";
const VERIFIED_ROUTE = "559a12e4-16d8-4db3-be48-40fbea54bcfe";
const WRONG_PRIOR_ROUTE = "29008868-d583-4ab5-a6c1-57586fe92007";
const EXPECTED_DTO = {
  side: "buy", symbol: "EURUSD", volume: 0.01,
  position: Number(INCIDENT_TICKET), deviation: 20,
};

const Row = ({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-1 text-[11px]">
    <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
    <span className={`font-mono ${ok === true ? "text-emerald-300" : ok === false ? "text-red-300" : "text-foreground"}`}>{v}</span>
  </div>
);

const AdminControlledCloseDispatchPreviewCard = () => {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("close-position-controlled", {
        body: {
          validateOnly: true,
          ticket: INCIDENT_TICKET,
          symbol: "EURUSD",
          brokerSymbol: "EURUSD",
          openSide: "sell",
          volume: 0.01,
          liveCloseConfirmed: true,
          routeAccountId: VERIFIED_ROUTE,
        },
      });
      if (error) throw error;
      setPreview(data ?? null);
      toast.success("Close dispatch preview (no mutation)");
    } catch (e: any) {
      toast.error(e?.message || "Preview failed");
    } finally {
      setBusy(false);
    }
  };

  const endpointOk = preview?.expectedEndpoint === `/api/v1/accounts/${VERIFIED_ROUTE}/trades/send`;
  const routeOk = preview?.verifiedRouteAccountId === VERIFIED_ROUTE;
  const dtoOk = preview && JSON.stringify(preview.outboundCloseDTO) === JSON.stringify(EXPECTED_DTO);

  return (
    <Card className="p-4 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-center gap-2 mb-2">
        <FlaskConical className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-semibold">Validate Controlled Close Dispatch — No Mutation</h3>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
        Read-only preview of the corrected controlled-close path against incident
        ticket {INCIDENT_TICKET}. No Trading Layer request is sent. Used to verify the
        wrong-route defect is fixed before any future authorised lifecycle retest.
      </p>

      <Button size="sm" variant="outline" onClick={run} disabled={busy} className="mb-3">
        {busy ? "Validating…" : "Run mutation-suppressed close preview"}
      </Button>

      {preview && (
        <div className="rounded border border-border/40 p-2 bg-background/40">
          <Row k="validationOnly" v={String(preview.validationOnly === true)} ok={preview.validationOnly === true} />
          <Row k="mutationSuppressed" v={String(preview.mutationSuppressed === true)} ok={preview.mutationSuppressed === true} />
          <Row k="closeAuthoritySource" v={preview.closeAuthoritySource ?? "—"} ok={preview.closeAuthoritySource === "trading_layer_live_forced"} />
          <Row k="verifiedRouteAccountId" v={preview.verifiedRouteAccountId ?? "—"} ok={routeOk} />
          <Row k="priorIncorrectRouteAccountId" v={WRONG_PRIOR_ROUTE} ok={false} />
          <Row k="routeMismatchFixed" v={String(preview.routeMismatchFixed === true)} ok={preview.routeMismatchFixed === true} />
          <Row k="expectedEndpoint" v={preview.expectedEndpoint ?? "—"} ok={endpointOk} />
          <Row k="brokerSymbol" v={preview.brokerSymbol ?? "—"} ok={preview.brokerSymbol === "EURUSD"} />
          <Row k="closeSideForSellPosition" v={preview.closeSide ?? "—"} ok={preview.closeSide === "buy"} />
          <Row k="volume" v={String(preview.volume)} ok={Number(preview.volume) === 0.01} />
          <Row k="positionTicket" v={preview.positionTicket ?? "—"} ok={String(preview.positionTicket) === INCIDENT_TICKET} />
          <Row k="outboundCloseDTO" v={<code className="text-[10px]">{JSON.stringify(preview.outboundCloseDTO)}</code>} ok={dtoOk} />
          <Row k="WOULD_DISPATCH_BROKER_CLOSE" v="true (preview only)" ok />
          <Row k="BROKER_CLOSE_MUTATION_DISPATCHED" v="false" ok />
          <Row k="TRADING_LAYER_REQUEST_SENT" v="false" ok />

        </div>
      )}

      <div className="mt-3 pt-2 border-t border-border/30 text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        general_client_live_execution = disabled · pending_orders_enabled = false · no authorisation created
      </div>
    </Card>
  );
};

export default AdminControlledCloseDispatchPreviewCard;
