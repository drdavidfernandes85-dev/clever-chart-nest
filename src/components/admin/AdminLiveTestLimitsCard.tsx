import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Gauge } from "lucide-react";
import {
  getAdminLiveTestLimits,
  updateAdminLiveTestLimits,
  type AdminLiveTestLimits,
} from "@/lib/adminLiveTests";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
    <Label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="min-w-[140px]">{children}</div>
  </div>
);

const AdminLiveTestLimitsCard = () => {
  const [limits, setLimits] = useState<AdminLiveTestLimits | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<AdminLiveTestLimits>>({});

  useEffect(() => { void (async () => { const l = await getAdminLiveTestLimits(); setLimits(l); setDraft(l ?? {}); })(); }, []);

  const onChange = (k: keyof AdminLiveTestLimits, v: any) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!limits) return;
    setSaving(true);
    try {
      const next = await updateAdminLiveTestLimits(limits.id, {
        max_order_volume: Number(draft.max_order_volume),
        max_simultaneous_test_positions: Number(draft.max_simultaneous_test_positions),
        max_daily_live_test_orders: Number(draft.max_daily_live_test_orders),
        max_daily_test_loss_usd: Number(draft.max_daily_test_loss_usd),
        pending_orders_enabled: !!draft.pending_orders_enabled,
        partial_close_cap_increase_enabled: !!draft.partial_close_cap_increase_enabled,
      });
      if (next) { setLimits(next); setDraft(next); toast.success("Live test limits updated"); }
    } catch (e: any) { toast.error(e?.message || "Failed to update limits"); } finally { setSaving(false); }
  };

  if (!limits) return (
    <Card className="p-4"><p className="text-xs text-muted-foreground">Loading live test limits…</p></Card>
  );

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Admin Live Test Limits</h3>
      </div>
      <Field label="max_order_volume (lots)">
        <Input type="number" step="0.01" min="0.01" value={String(draft.max_order_volume ?? "")} onChange={(e) => onChange("max_order_volume", e.target.value)} className="h-7 text-xs font-mono" />
      </Field>
      <Field label="max_simultaneous_test_positions">
        <Input type="number" min="1" value={String(draft.max_simultaneous_test_positions ?? "")} onChange={(e) => onChange("max_simultaneous_test_positions", e.target.value)} className="h-7 text-xs font-mono" />
      </Field>
      <Field label="max_daily_live_test_orders">
        <Input type="number" min="1" value={String(draft.max_daily_live_test_orders ?? "")} onChange={(e) => onChange("max_daily_live_test_orders", e.target.value)} className="h-7 text-xs font-mono" />
      </Field>
      <Field label="max_daily_test_loss_usd">
        <Input type="number" min="0" value={String(draft.max_daily_test_loss_usd ?? "")} onChange={(e) => onChange("max_daily_test_loss_usd", e.target.value)} className="h-7 text-xs font-mono" />
      </Field>
      <Field label="pending_orders_enabled">
        <Switch checked={!!draft.pending_orders_enabled} onCheckedChange={(v) => onChange("pending_orders_enabled", v)} />
      </Field>
      <Field label="partial_close_cap_increase_enabled">
        <Switch checked={!!draft.partial_close_cap_increase_enabled} onCheckedChange={(v) => onChange("partial_close_cap_increase_enabled", v)} />
      </Field>
      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Limits"}</Button>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed pt-1">
        Backend enforces these limits in every live execution path. <b>pending_orders_enabled</b> should remain off
        until at least one market open and close have been confirmed. <b>partial_close_cap_increase_enabled</b>
        allows raising <b>max_order_volume</b> above 0.01 only after the initial verification matrix passes.
      </p>
    </Card>
  );
};

export default AdminLiveTestLimitsCard;
