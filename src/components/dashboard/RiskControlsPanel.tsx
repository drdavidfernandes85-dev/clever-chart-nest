import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRiskSettings, RISK_DEFAULTS, RiskSettings } from "@/hooks/useRiskSettings";
import { toast } from "sonner";
import { Shield, AlertOctagon } from "lucide-react";

/**
 * Admin/Dev-mode Risk Controls panel.
 * Writes go through useRiskSettings.save which also writes risk_setting_audit_logs.
 * Backend Edge Functions read these same settings before executing any trade.
 */
const RiskControlsPanel = () => {
  const { settings, save, loading } = useRiskSettings();
  const [draft, setDraft] = useState<RiskSettings | null>(null);
  const cur: RiskSettings = draft ?? settings;
  const dirty = !!draft;

  const set = <K extends keyof RiskSettings>(k: K, v: RiskSettings[K]) =>
    setDraft({ ...cur, [k]: v });

  const onSave = async () => {
    if (!draft) return;
    const diff: Partial<RiskSettings> = {};
    (Object.keys(draft) as (keyof RiskSettings)[]).forEach((k) => {
      if (JSON.stringify(draft[k]) !== JSON.stringify(settings[k])) {
        (diff as any)[k] = draft[k];
      }
    });
    const err = await save(diff, "admin/dev panel update");
    if (err) toast.error("Failed to save risk settings");
    else {
      toast.success("Risk settings saved");
      setDraft(null);
    }
  };

  return (
    <div className="rounded-md border border-[#FFCD05]/30 bg-[#0a0a0a] p-4 text-[11px] text-neutral-200">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-[#FFCD05]">
          <Shield className="h-4 w-4" /> Risk Controls
        </div>
        {cur.kill_switch_enabled && (
          <span className="inline-flex items-center gap-1 rounded-sm border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-red-300">
            <AlertOctagon className="h-3 w-3" /> Kill Switch Active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Toggle label="Live Trading Enabled" v={cur.live_trading_enabled} on={(v) => set("live_trading_enabled", v)} />
        <Toggle label="Kill Switch" v={cur.kill_switch_enabled} on={(v) => set("kill_switch_enabled", v)} danger />
        <Toggle label="Testing Mode (0.01 cap)" v={cur.testing_mode_enabled} on={(v) => set("testing_mode_enabled", v)} />
        <Num label="Max Order Volume" v={cur.max_order_volume} on={(v) => set("max_order_volume", v)} step={0.01} />
        <Num label="Max Close Volume" v={cur.max_close_volume} on={(v) => set("max_close_volume", v)} step={0.01} />
        <Num label="Max Daily Volume" v={cur.max_daily_volume} on={(v) => set("max_daily_volume", v)} step={0.01} />
        <Num label="Max Daily Trades" v={cur.max_daily_trades} on={(v) => set("max_daily_trades", v)} step={1} />
        <Num label="Max Daily Loss (USD)" v={cur.max_daily_loss} on={(v) => set("max_daily_loss", v)} step={1} />
        <SymbolList label="Allowed Symbols (blank = all)" v={cur.allowed_symbols ?? []} on={(v) => set("allowed_symbols", v.length ? v : null)} />
        <SymbolList label="Blocked Symbols" v={cur.blocked_symbols} on={(v) => set("blocked_symbols", v)} />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" disabled={!dirty || loading}
          onClick={() => setDraft({ ...RISK_DEFAULTS })}>
          Reset Defaults
        </Button>
        <Button variant="ghost" size="sm" disabled={!dirty || loading} onClick={() => setDraft(null)}>
          Discard
        </Button>
        <Button size="sm" disabled={!dirty || loading} onClick={onSave}
          className="bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90">
          Save Changes
        </Button>
      </div>

      <p className="mt-3 text-[10px] text-neutral-500">
        Backend Edge Functions (submit-best-execution-order, close-position-controlled,
        modify-position-protection) enforce these limits server-side. Frontend checks
        are advisory only.
      </p>
    </div>
  );
};

const Toggle = ({ label, v, on, danger }: { label: string; v: boolean; on: (v: boolean) => void; danger?: boolean }) => (
  <label className="flex items-center justify-between rounded-sm border border-neutral-800 bg-[#111] px-2 py-1.5">
    <span className={danger && v ? "text-red-300" : "text-neutral-200"}>{label}</span>
    <Switch checked={v} onCheckedChange={on} />
  </label>
);

const Num = ({ label, v, on, step }: { label: string; v: number; on: (v: number) => void; step: number }) => (
  <label className="flex items-center justify-between gap-2 rounded-sm border border-neutral-800 bg-[#111] px-2 py-1.5">
    <span className="text-neutral-300">{label}</span>
    <Input type="number" step={step} value={v}
      onChange={(e) => on(Number(e.target.value))}
      className="h-7 w-24 border-neutral-700 bg-[#0a0a0a] text-right font-mono text-[11px]" />
  </label>
);

const SymbolList = ({ label, v, on }: { label: string; v: string[]; on: (v: string[]) => void }) => (
  <label className="flex items-start justify-between gap-2 rounded-sm border border-neutral-800 bg-[#111] px-2 py-1.5 sm:col-span-2">
    <span className="mt-1 whitespace-nowrap text-neutral-300">{label}</span>
    <Input value={v.join(", ")}
      onChange={(e) => on(e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))}
      placeholder="EURUSD, XAUUSD"
      className="h-7 flex-1 border-neutral-700 bg-[#0a0a0a] font-mono text-[11px]" />
  </label>
);

export default RiskControlsPanel;
