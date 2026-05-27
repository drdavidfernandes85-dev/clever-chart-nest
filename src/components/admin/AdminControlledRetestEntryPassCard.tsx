import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type EntryEvidence = Record<string, any> | null;

const KEY = "controlled_retest_entry_1169109844";

const Row = ({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-0.5">
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{k}</span>
    <span className={ok ? "text-emerald-300" : "text-amber-300"}>{v}</span>
  </div>
);

const AdminControlledRetestEntryPassCard = () => {
  const [evidence, setEvidence] = useState<EntryEvidence>(null);
  const [openEur, setOpenEur] = useState<number | null>(null);
  const [pendingEur, setPendingEur] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    setEvidence((data?.value as any) ?? null);
  };

  const checkExposure = async () => {
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      const [posRes, pendRes] = await Promise.all([
        supabase
          .from("mt_positions")
          .select("id", { count: "exact", head: true })
          .or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD"),
        uid
          ? supabase
              .from("mt_pending_orders")
              .select("id", { count: "exact", head: true })
              .eq("user_id", uid)
              .eq("status", "pending")
              .or("symbol.eq.EURUSD,broker_symbol.eq.EURUSD")
          : Promise.resolve({ count: 0 } as any),
      ]);
      setOpenEur(posRes.count ?? 0);
      setPendingEur((pendRes as any).count ?? 0);
      setCheckedAt(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    checkExposure();
  }, []);

  if (!evidence) {
    return null;
  }

  const residualNone = openEur === 0 && pendingEur === 0;

  return (
    <Card className="p-5 space-y-4 border-emerald-500/40 bg-emerald-500/5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-base font-semibold">
            Controlled EURUSD SELL Retest — Entry PASS / Manual Close Confirmed
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Controlled entry submission passed using the verified minimal Trading Layer DTO.
            The position was safely closed manually in native MT5. Platform-controlled close
            execution has not yet been live-validated.
          </p>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
          entry · pass
        </Badge>
      </div>

      <div className="rounded border border-emerald-500/30 bg-background/40 p-3 text-xs font-mono space-y-1">
        <div className="text-emerald-300 uppercase tracking-wider text-[10px] mb-1">
          Entry evidence
        </div>
        <Row k="entry test" v="PASS" ok />
        <Row k="broker symbol" v={evidence.brokerSymbol} ok={evidence.brokerSymbol === "EURUSD"} />
        <Row k="display symbol" v={evidence.displaySymbol} ok={evidence.displaySymbol === "EURUSD"} />
        <Row k="route account" v={evidence.routeAccountId} ok />
        <Row k="side / volume" v={`${String(evidence.side).toUpperCase()} ${evidence.volume}`} ok />
        <Row k="outbound DTO" v={JSON.stringify(evidence.outboundDTO)} ok />
        <Row k="deviation absent" v={String(evidence.deviationAbsent)} ok={evidence.deviationAbsent === true} />
        <Row k="internal metadata excluded" v={String(evidence.internalMetadataExcluded)} ok={evidence.internalMetadataExcluded === true} />
        <Row k="retcode" v={`${evidence.retcode} / ${evidence.retcodeName}`} ok={evidence.retcode === 10008} />
        <Row k="retcode description" v={evidence.retcodeDescription} ok />
        <Row k="order / ticket" v={evidence.orderId} ok />
        <Row k="account trade mode" v={evidence.accountTradeMode} ok />
        <Row k="symbol trade mode" v={evidence.symbolTradeMode} ok />
        <Row k="broker mutation dispatched" v={String(evidence.brokerMutationDispatched)} ok={evidence.brokerMutationDispatched === true} />
      </div>

      <div className="rounded border border-emerald-500/30 bg-background/40 p-3 text-xs font-mono space-y-1">
        <div className="text-emerald-300 uppercase tracking-wider text-[10px] mb-1">
          MT5 lifecycle (user-confirmed from native MT5)
        </div>
        <Row k="mt5 entry confirmed" v={String(evidence.mt5EntryConfirmed)} ok={evidence.mt5EntryConfirmed === true} />
        <Row k="entry price" v={evidence.entryPrice} ok />
        <Row k="entry time" v={evidence.entryTime} ok />
        <Row k="mt5 position closed" v={String(evidence.mt5PositionClosed)} ok={evidence.mt5PositionClosed === true} />
        <Row k="close price" v={evidence.closePrice} ok />
        <Row k="close time" v={evidence.closeTime} ok />
        <Row k="realised P&L" v={`+${evidence.realisedPnl}`} ok />
        <Row k="closure source" v="MANUAL NATIVE MT5 CLOSE" ok />
        <Row k="position safety state" v={evidence.positionSafetyState} ok />
        <Row k="evidence source" v={evidence.evidenceSource} ok />
      </div>

      <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1">
        <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1 flex items-center justify-between">
          <span>Final residual exposure (read-only)</span>
          <Button size="sm" variant="ghost" onClick={checkExposure} disabled={loading} className="h-6 px-2 text-[10px]">
            {loading ? "checking…" : "refresh"}
          </Button>
        </div>
        <Row k="current open EURUSD positions" v={openEur ?? "—"} ok={openEur === 0} />
        <Row k="current pending EURUSD orders" v={pendingEur ?? "—"} ok={pendingEur === 0} />
        <Row k="residual EURUSD exposure" v={residualNone ? "none" : "detected"} ok={residualNone} />
        <Row k="position closed" v="yes" ok />
        <Row k="closure source" v="manual native MT5 confirmation" ok />
        <Row k="checked at" v={checkedAt ?? "—"} ok={!!checkedAt} />
      </div>

      <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs font-mono space-y-1">
        <div className="text-amber-300 uppercase tracking-wider text-[10px] mb-1 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" /> Pending validations
        </div>
        <Row k="platform controlled-close validation" v="PENDING" ok={false} />
        <Row k="complete platform open/close lifecycle" v="PENDING" ok={false} />
        <Row k="controlled close validation status" v={evidence.controlledCloseValidationStatus} ok={false} />
        <Row k="full lifecycle status" v={evidence.fullLifecycleStatus} ok={false} />
      </div>

      <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1">
        <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">
          Execution permission state
        </div>
        <Row k="EURUSD controlled platform entry" v="PASSED" ok />
        <Row k="controlled platform close" v="NOT YET LIVE-VALIDATED" ok={false} />
        <Row k="general live client execution" v="DISABLED PENDING COMPLETE LIFECYCLE VALIDATION" ok={false} />
        <Row k="pending orders" v="DISABLED" ok={false} />
        <Row k="new entry tests" v="DISABLED unless separately authorised lifecycle plan" ok={false} />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span>
          No mutation was dispatched in this reconciliation pass. Risk, fresh-tick,
          kill-switch, idempotency and confirmation-coordinator safeguards are unchanged.
        </span>
      </div>
    </Card>
  );
};

export default AdminControlledRetestEntryPassCard;
