/**
 * TicketPresetsPanel — manage user_trade_presets.
 *
 * Opened from the gear icon in the Nueva Orden header. Lets the user set:
 *   - one global default ("riesgo 1% del balance, TP 2:1")
 *   - per-symbol overrides ("EURUSD: SL 20 pips, TP 40 pips")
 *
 * Symbol-specific preset wins over global on auto-fill in the ticket.
 * Manual edits in the ticket NEVER write back to the preset.
 */
import { useState } from "react";
import { Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  usePresets,
  type TradePreset,
  type PresetMode,
  type PresetVolumeMode,
} from "@/hooks/usePresets";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const MODE_OPTS: { value: PresetMode; label: string }[] = [
  { value: "pips", label: "Pips" },
  { value: "price", label: "Precio" },
  { value: "amount", label: "Monto" },
  { value: "pct", label: "% balance" },
];

interface DraftRow {
  id: string | null;
  symbol: string;
  sl_mode: PresetMode;
  sl_value: string;
  tp_mode: PresetMode;
  tp_value: string;
  default_volume: string;
  volume_mode: PresetVolumeMode;
}

function presetToDraft(p: TradePreset | null): DraftRow {
  return {
    id: p?.id ?? null,
    symbol: p?.symbol ?? "",
    sl_mode: p?.sl_mode ?? "pips",
    sl_value: p?.sl_value != null ? String(p.sl_value) : "",
    tp_mode: p?.tp_mode ?? "pips",
    tp_value: p?.tp_value != null ? String(p.tp_value) : "",
    default_volume: p?.default_volume != null ? String(p.default_volume) : "",
    volume_mode: p?.volume_mode ?? "lotes",
  };
}

export default function TicketPresetsPanel({ open, onOpenChange }: Props) {
  const { presets, loading, upsert, remove } = usePresets();
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [saving, setSaving] = useState(false);

  const startNew = () => setDraft(presetToDraft(null));
  const startEdit = (p: TradePreset) => setDraft(presetToDraft(p));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const slV = draft.sl_value.trim() === "" ? null : Number(draft.sl_value);
      const tpV = draft.tp_value.trim() === "" ? null : Number(draft.tp_value);
      const vol = draft.default_volume.trim() === "" ? null : Number(draft.default_volume);
      if (slV != null && (!Number.isFinite(slV) || slV <= 0)) throw new Error("SL inválido");
      if (tpV != null && (!Number.isFinite(tpV) || tpV <= 0)) throw new Error("TP inválido");
      if (vol != null && (!Number.isFinite(vol) || vol <= 0)) throw new Error("Volumen inválido");
      await upsert({
        symbol: draft.symbol.trim() === "" ? null : draft.symbol.trim().toUpperCase(),
        sl_mode: draft.sl_mode,
        sl_value: slV,
        tp_mode: draft.tp_mode,
        tp_value: tpV,
        default_volume: vol,
        volume_mode: draft.volume_mode,
      });
      toast.success("Preset guardado");
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el preset");
    } finally {
      setSaving(false);
    }
  };

  const del = async (p: TradePreset) => {
    try {
      await remove(p.id);
      toast.success("Preset eliminado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setDraft(null); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl bg-[#111214] border-neutral-800 text-neutral-100">
        <DialogHeader>
          <DialogTitle className="text-[#FFCD05]">Presets del ticket</DialogTitle>
          <DialogDescription className="text-neutral-400">
            Auto-rellena SL/TP y volumen al abrir un símbolo. El preset específico de un símbolo gana sobre el global.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-neutral-500"><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</div>
          ) : presets.length === 0 ? (
            <div className="text-xs text-neutral-500">No tienes presets aún. Crea uno global y, opcionalmente, sobreescribe por símbolo.</div>
          ) : (
            <div className="space-y-1">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded border border-neutral-800 bg-[#0e0e10] px-2 py-1.5 text-xs",
                    draft?.id === p.id && "ring-1 ring-[#FFCD05]/50",
                  )}
                >
                  <button onClick={() => startEdit(p)} className="flex-1 text-left">
                    <div className="font-mono font-bold text-neutral-100">
                      {p.symbol ?? "Global"}
                    </div>
                    <div className="text-[10px] text-neutral-500 font-mono">
                      SL {p.sl_value ?? "—"} {p.sl_mode} · TP {p.tp_value ?? "—"} {p.tp_mode} · Vol {p.default_volume ?? "—"} {p.volume_mode}
                    </div>
                  </button>
                  <button onClick={() => del(p)} className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {draft == null ? (
            <Button onClick={startNew} variant="outline" size="sm" className="w-full border-dashed border-neutral-700">
              <Plus className="h-3 w-3 mr-1" /> Nuevo preset
            </Button>
          ) : (
            <div className="rounded border border-[#FFCD05]/40 bg-[#FFCD05]/5 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Símbolo</Label>
                  <Input
                    value={draft.symbol}
                    onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
                    placeholder="vacío = global"
                    className="h-8 bg-[#16171a] border-neutral-800 text-neutral-100 font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-neutral-400">Volumen por defecto</Label>
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft.default_volume}
                      onChange={(e) => setDraft({ ...draft, default_volume: e.target.value })}
                      placeholder="0.0"
                      className="h-8 bg-[#16171a] border-neutral-800 text-neutral-100 font-mono"
                    />
                    <Select value={draft.volume_mode} onValueChange={(v) => setDraft({ ...draft, volume_mode: v as PresetVolumeMode })}>
                      <SelectTrigger className="h-8 w-[90px] bg-[#16171a] border-neutral-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lotes">Lotes</SelectItem>
                        <SelectItem value="usd_pt">USD/pt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ModeField label="Stop Loss" mode={draft.sl_mode} value={draft.sl_value} accent="red"
                  onMode={(m) => setDraft({ ...draft, sl_mode: m })}
                  onValue={(v) => setDraft({ ...draft, sl_value: v })} />
                <ModeField label="Take Profit" mode={draft.tp_mode} value={draft.tp_value} accent="emerald"
                  onMode={(m) => setDraft({ ...draft, tp_mode: m })}
                  onValue={(v) => setDraft({ ...draft, tp_value: v })} />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={saving}>Cancelar</Button>
                <Button size="sm" onClick={save} disabled={saving} className="bg-[#FFCD05] text-black hover:bg-[#ffd633]">
                  {saving ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Guardando…</> : "Guardar preset"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeField({
  label, mode, value, accent, onMode, onValue,
}: {
  label: string; mode: PresetMode; value: string; accent: "red" | "emerald";
  onMode: (m: PresetMode) => void; onValue: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className={cn("text-[10px] uppercase tracking-wider font-bold", accent === "red" ? "text-red-400" : "text-emerald-400")}>{label}</Label>
      <div className="flex gap-1">
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          placeholder="0.0"
          className="h-8 bg-[#16171a] border-neutral-800 text-neutral-100 font-mono"
        />
        <Select value={mode} onValueChange={(v) => onMode(v as PresetMode)}>
          <SelectTrigger className="h-8 w-[110px] bg-[#16171a] border-neutral-800">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
