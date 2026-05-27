import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, ShieldCheck, FlaskConical } from "lucide-react";

const PERMITTED = {
  symbol: "EURUSD",
  brokerSymbol: "EURUSD",
  side: "sell" as const,
  volume: 0.01,
  routeAccountId: "559a12e4-16d8-4db3-be48-40fbea54bcfe",
  endpoint: "/api/v1/accounts/559a12e4-16d8-4db3-be48-40fbea54bcfe/trades/send",
  dto: { side: "sell", symbol: "EURUSD", volume: 0.01 },
};

const ACK_ITEMS = [
  "Volume fixed at 0.01",
  "Symbol fixed at EURUSD",
  "brokerSymbol fixed at EURUSD",
  "Side fixed at SELL",
  `Endpoint fixed at ${PERMITTED.endpoint}`,
  'Outbound DTO exactly {"side":"sell","symbol":"EURUSD","volume":0.01}',
  "Server fresh-tick validation required",
  "Risk / kill-switch / idempotency remain active",
  "If position confirms, only Close on that exact position is permitted next",
  "If rejected, the platform immediately re-blocks without another retry",
] as const;

type Auth = {
  id: string;
  authorised_at: string;
  expires_at: string;
  consumed_at: string | null;
  outcome: string | null;
  outcome_retcode: number | null;
  consumed_order_id: string | null;
};

const Pill = ({ tone, children }: { tone: "ok" | "warn" | "fail"; children: React.ReactNode }) => {
  const cls =
    tone === "ok"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : tone === "warn"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : "bg-red-500/15 text-red-300 border-red-500/30";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>{children}</span>;
};

const AdminControlledRetestCard = () => {
  const [acks, setAcks] = useState<boolean[]>(() => ACK_ITEMS.map(() => false));
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pretrade, setPretrade] = useState<any>(null);
  const [authorising, setAuthorising] = useState(false);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);

  const allAcked = acks.every(Boolean);
  const pretradePassed = pretrade?.wouldSubmit === true;
  const previewOk =
    !!preview?.outbound &&
    preview.outbound.body?.side === "sell" &&
    preview.outbound.body?.symbol === "EURUSD" &&
    preview.outbound.body?.volume === 0.01 &&
    Object.keys(preview.outbound.body).length === 3 &&
    preview.outbound.internalMetadataExcluded === true;

  // Load latest unconsumed authorisation.
  const refreshAuth = async () => {
    const { data } = await supabase
      .from("controlled_retest_authorisations")
      .select("*")
      .order("authorised_at", { ascending: false })
      .limit(1);
    setAuth((data?.[0] as Auth) ?? null);
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  useEffect(() => {
    if (!auth || auth.consumed_at) return setRemaining(0);
    const tick = () => {
      const ms = new Date(auth.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [auth]);

  const runPreviews = async () => {
    setPreviewing(true);
    try {
      // Full pretrade (mutation-suppressed) via existing validator.
      const { data: pre } = await supabase.functions.invoke("validate-full-pretrade", {
        body: {
          symbol: PERMITTED.symbol,
          side: PERMITTED.side,
          volume: PERMITTED.volume,
          brokerSymbol: PERMITTED.brokerSymbol,
        },
      });
      setPretrade(pre);
      // Outbound DTO preview via submit-controlled-retest in previewOnly mode.
      // Falls back if no authorisation exists yet — we still want a quick echo.
      const { data: prev } = await supabase.functions.invoke("submit-controlled-retest", {
        body: { previewOnly: true },
      });
      setPreview(prev);
    } catch (e: any) {
      toast.error(`Preview failed: ${e?.message ?? "unknown"}`);
    } finally {
      setPreviewing(false);
    }
  };

  const authorise = async () => {
    if (!allAcked) return toast.error("All acknowledgements required.");
    if (!pretradePassed) return toast.error("Full pre-trade preview must pass first.");
    setAuthorising(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("controlled_retest_authorisations")
        .insert({
          authorised_by: uid,
          permitted_symbol: PERMITTED.symbol,
          permitted_broker_symbol: PERMITTED.brokerSymbol,
          permitted_side: PERMITTED.side,
          permitted_volume: PERMITTED.volume,
          permitted_route_account_id: PERMITTED.routeAccountId,
          permitted_orders: 1,
          expires_at: expires,
        });
      if (error) throw error;
      toast.success("Controlled retest authorised — single-use, 10 min.");
      await refreshAuth();
    } catch (e: any) {
      toast.error(`Authorise failed: ${e?.message ?? "unknown"}`);
    } finally {
      setAuthorising(false);
    }
  };

  const submitRetest = async () => {
    if (!auth || auth.consumed_at) return;
    if (!window.confirm("Dispatch ONE live EURUSD SELL 0.01? This is a real broker order.")) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-controlled-retest", {
        body: { authorisationId: auth.id },
      });
      if (error) throw error;
      toast.success(`Outcome: ${data?.outcome ?? "unknown"}`);
      await refreshAuth();
    } catch (e: any) {
      toast.error(`Submission failed: ${e?.message ?? "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const authActive = !!auth && !auth.consumed_at && remaining > 0;

  return (
    <Card className="p-5 space-y-4 border-amber-500/40 bg-amber-500/5">
      <div className="flex items-start gap-3">
        <FlaskConical className="h-5 w-5 text-amber-400 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-base font-semibold">
            Authorise One Controlled EURUSD SELL Retest
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Single-use, server-validated, minimal Trading Layer DTO. General BUY/SELL and pending orders remain disabled.
          </p>
        </div>
        {authActive ? (
          <Pill tone="warn">
            authorised · {Math.floor(remaining / 1000)}s
          </Pill>
        ) : auth?.consumed_at ? (
          <Pill tone={auth.outcome === "placed" ? "ok" : "fail"}>
            consumed · {auth.outcome ?? "unknown"}
          </Pill>
        ) : (
          <Pill tone="fail">no authorisation</Pill>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={runPreviews} disabled={previewing}>
          {previewing ? "Running preview…" : "Run mutation-suppressed preview"}
        </Button>
      </div>

      {pretrade && (
        <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1">
          <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Full pre-trade validation</div>
          <Row k="wouldSubmit" v={String(pretrade.wouldSubmit)} ok={pretrade.wouldSubmit} />
          <Row k="route" v={pretrade.route ?? "—"} ok={!!pretrade.route} />
          <Row k="brokerSymbol" v={pretrade.brokerSymbol ?? "—"} ok={pretrade.brokerSymbol === "EURUSD"} />
          <Row k="accountTradeMode" v={`${pretrade.accountTradeModeRaw ?? "—"} (${pretrade.accountTradeModeLabel ?? "—"})`} ok={pretrade.accountPermission === "pass"} />
          <Row k="symbolTradeMode" v={`${pretrade.symbolTradeModeRaw ?? "—"} (${pretrade.symbolTradeModeLabel ?? "—"})`} ok={pretrade.symbolPermission === "pass"} />
          <Row k="freshTick" v={`${pretrade.freshTick} · age ${pretrade.freshTickAgeMs ?? "?"}ms`} ok={pretrade.freshTick === "pass"} />
          <Row k="risk" v={pretrade.riskValidation} ok={pretrade.riskValidation === "pass"} />
          <Row k="killSwitch" v={pretrade.killSwitch} ok={pretrade.killSwitch === "pass"} />
          <Row k="idempotency" v={pretrade.idempotency} ok={pretrade.idempotency === "pass"} />
          {pretrade.blockedCode && <Row k="blockedCode" v={pretrade.blockedCode} ok={false} />}
        </div>
      )}

      {preview?.outbound && (
        <div className="rounded border border-border/40 p-3 text-xs font-mono space-y-1">
          <div className="text-muted-foreground uppercase tracking-wider text-[10px] mb-1">Exact outbound TL DTO</div>
          <Row k="endpoint" v={preview.outbound.endpointPath} ok={preview.outbound.endpointPath === PERMITTED.endpoint} />
          <Row k="method" v={preview.outbound.method} ok={preview.outbound.method === "POST"} />
          <Row k="body" v={JSON.stringify(preview.outbound.body)} ok={previewOk} />
          <Row k="deviation absent" v={String(preview.outbound.deviationAbsent ?? !("deviation" in (preview.outbound.body ?? {})))} ok />
          <Row k="internal metadata excluded" v={String(preview.outbound.internalMetadataExcluded)} ok={preview.outbound.internalMetadataExcluded === true} />
          <Row k="fields" v={preview.outbound.fieldsInBody?.join(", ") ?? "—"} ok={previewOk} />
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Acknowledgements</div>
        {ACK_ITEMS.map((label, i) => (
          <label key={i} className="flex items-start gap-2 text-xs">
            <Checkbox
              checked={acks[i]}
              onCheckedChange={(v) =>
                setAcks((prev) => prev.map((p, idx) => (idx === i ? v === true : p)))
              }
              disabled={authActive || !!auth?.consumed_at}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
        <Button
          size="sm"
          onClick={authorise}
          disabled={authorising || !allAcked || !pretradePassed || !previewOk || authActive}
        >
          {authorising ? "Authorising…" : "Authorise (one-shot, 10 min)"}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={submitRetest}
          disabled={!authActive || submitting}
        >
          {submitting ? "Submitting…" : "Submit Controlled SELL 0.01"}
        </Button>
      </div>

      {auth?.consumed_at && (
        <div className="text-xs font-mono p-2 rounded bg-background/60 border border-border/40">
          <div className="flex items-center gap-2">
            {auth.outcome === "placed" ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            )}
            <span>
              Outcome: <Badge variant="outline">{auth.outcome ?? "unknown"}</Badge>
              {auth.outcome_retcode != null && <> · retcode {auth.outcome_retcode}</>}
              {auth.consumed_order_id && <> · order {auth.consumed_order_id}</>}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

const Row = ({ k, v, ok }: { k: string; v: React.ReactNode; ok?: boolean }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-0.5">
    <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{k}</span>
    <span className={ok ? "text-emerald-300" : "text-red-300"}>{v}</span>
  </div>
);

export default AdminControlledRetestCard;
