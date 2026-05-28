// Read-only diagnostic for the local mt_positions mirror vs the authoritative
// Trading Layer live-positions source. Does NOT submit a trade, close, modify
// or cancel. The "Refresh Live Position / Repair Mirror" action invokes
// `get-live-account` (forceRefresh) which is read-only — close-position-controlled
// is responsible for the actual self-heal upsert during a live close path.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const INCIDENT_TICKET = "1169128468";

type LivePos = { ticket: string; symbol: string; side: string; volume: number };
type MirrorRow = { ticket: string; symbol: string; side: string; volume: number };

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border/20 last:border-0 py-1 text-[11px]">
    <span className="text-muted-foreground uppercase tracking-wider">{k}</span>
    <span className="font-mono text-foreground">{v}</span>
  </div>
);

const AdminLivePositionMirrorDiagnostic = () => {
  const [ticket] = useState(INCIDENT_TICKET);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<{ ok: boolean; pos: LivePos | null; count: number; fetchedAt: string | null; error?: string | null } | null>(null);
  const [mirror, setMirror] = useState<MirrorRow | null>(null);
  const [mirrorChecked, setMirrorChecked] = useState(false);

  const loadMirror = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const { data } = await supabase
      .from("mt_positions")
      .select("ticket,symbol,side,volume")
      .eq("user_id", u.user.id)
      .eq("ticket", ticket)
      .maybeSingle();
    setMirror((data as MirrorRow | null) ?? null);
    setMirrorChecked(true);
  };

  const refresh = async () => {
    setBusy(true);
    try {
      await loadMirror();
      const { data } = await supabase.functions.invoke("get-live-account", { body: { forceRefresh: true } });
      const positions: any[] = Array.isArray((data as any)?.positions) ? (data as any).positions : [];
      const match = positions.find((p) => String(p?.ticket) === ticket) ?? null;
      setLive({
        ok: !!data,
        pos: match ? { ticket: String(match.ticket), symbol: String(match.symbol ?? "").toUpperCase(), side: String(match.side ?? "").toLowerCase(), volume: Number(match.volume) } : null,
        count: positions.length,
        fetchedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setLive({ ok: false, pos: null, count: 0, fetchedAt: new Date().toISOString(), error: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const liveFound = !!live?.pos;
  const mirrorFound = !!mirror;
  const matchStatus =
    !mirrorChecked || !live ? "checking"
    : liveFound && mirrorFound ? (mirror!.symbol.toUpperCase() === live!.pos!.symbol && mirror!.side.toLowerCase() === live!.pos!.side && Math.abs(mirror!.volume - live!.pos!.volume) < 1e-8 ? "matched" : "attributes_mismatch")
    : liveFound && !mirrorFound ? "missing_locally_live_in_tl"
    : !liveFound && mirrorFound ? "local_only_not_live"
    : "both_absent";

  return (
    <Card className="p-4 border-border/40 bg-muted/5">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Live Position vs Local Mirror — Diagnostic (Read-Only)</h3>
        <Badge variant="outline" className="font-mono text-[10px]">ticket {ticket}</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
        Authoritative source for close-path validation is now a forced live Trading Layer positions read,
        not mt_positions. This panel never submits a trade, close, modify or cancel.
      </p>

      <Row k="lifecycle_position_ticket" v={ticket} />
      <Row k="tl_live_lookup_status" v={live ? (live.ok ? "ok" : "error") : "…"} />
      <Row k="tl_live_position_count" v={live?.count ?? "…"} />
      <Row k="live_ticket_found" v={live ? (liveFound ? "yes" : "no") : "…"} />
      <Row k="live_symbol" v={live?.pos?.symbol ?? "—"} />
      <Row k="live_side" v={live?.pos?.side ?? "—"} />
      <Row k="live_volume" v={live?.pos?.volume ?? "—"} />
      <Row k="mt_positions_row_found" v={mirrorChecked ? (mirrorFound ? "yes" : "no") : "…"} />
      <Row k="mirror_match_status" v={<span className={matchStatus === "matched" ? "text-emerald-300" : matchStatus === "missing_locally_live_in_tl" ? "text-amber-300" : matchStatus === "both_absent" ? "text-muted-foreground" : "text-red-300"}>{matchStatus}</span>} />
      <Row k="last_live_fetched_at" v={live?.fetchedAt ?? "—"} />

      {matchStatus === "both_absent" && (
        <div className="mt-3 p-2 rounded border border-red-500/40 bg-red-500/5 text-[11px] text-red-200">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Ticket {ticket} is no longer open live and was not in the local mirror at time of the failed close.
          Prior mirror gap caused the controlled-close pre-dispatch block. No repairable open position remains.
          Close-path may be revalidated only through a later approved lifecycle test.
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={refresh} disabled={busy}>
          <RefreshCw className="h-3 w-3 mr-1" />
          {busy ? "Refreshing…" : "Refresh Live Position / Repair Mirror (Read-Only)"}
        </Button>
      </div>
    </Card>
  );
};

export default AdminLivePositionMirrorDiagnostic;
