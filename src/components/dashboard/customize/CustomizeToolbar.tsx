import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Save, Settings2, X, Loader2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PRESETS, PresetId } from "./presets";
import PresetThumbnail from "./PresetThumbnail";

interface Props {
  editing: boolean;
  setEditing: (v: boolean) => void;
  preset: PresetId;
  applyPreset: (id: PresetId) => void;
  save: () => Promise<{ ok: boolean; reason?: string }>;
  resetDefault: () => void;
  dirty: boolean;
  saving: boolean;
}

const CustomizeToolbar = ({
  editing,
  setEditing,
  preset,
  applyPreset,
  save,
  resetDefault,
  dirty,
  saving,
}: Props) => {
  const onSave = async () => {
    const r = await save();
    const { toast } = await import("sonner");
    if (r.ok) toast.success("Layout saved");
    else toast.error(r.reason ?? "Could not save layout");
  };

  const current = PRESETS.find((p) => p.id === preset);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset switcher — visual gallery */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 border-primary/30 bg-card/60 text-foreground hover:bg-primary/10 hover:text-primary text-xs font-bold uppercase tracking-wider rounded-lg"
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5 text-primary" />
            <span className="hidden sm:inline">Layout:&nbsp;</span>
            {current?.name ?? "Custom"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[min(92vw,420px)] p-3 bg-card/95 backdrop-blur-xl border-primary/20 shadow-[0_20px_60px_-15px_hsl(48_100%_51%/0.25)]"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Layout Presets
            </span>
            <button
              onClick={resetDefault}
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => {
              const active = p.id === preset;
              return (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={`group relative text-left rounded-lg border p-2 transition-all ${
                    active
                      ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(48_100%_51%/0.4)]"
                      : "border-border/40 bg-background/30 hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  {active && (
                    <span className="absolute top-1.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                  )}
                  <PresetThumbnail lg={p.lg} active={active} />
                  <div className="mt-1.5">
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        active ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {p.name}
                    </div>
                    <p className="text-[9.5px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                      {p.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Edit toggle */}
      <Button
        size="sm"
        onClick={() => setEditing(!editing)}
        variant={editing ? "default" : "outline"}
        className={
          editing
            ? "h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold uppercase tracking-wider rounded-lg"
            : "h-9 px-3 border-primary/30 bg-card/60 text-foreground hover:bg-primary/10 hover:text-primary text-xs font-bold uppercase tracking-wider rounded-lg"
        }
      >
        {editing ? (
          <>
            <X className="h-3.5 w-3.5 mr-1.5" />
            Done
          </>
        ) : (
          <>
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Customize
          </>
        )}
      </Button>

      {/* Reset to Default — always visible */}
      <Button
        size="sm"
        variant="ghost"
        onClick={resetDefault}
        className="h-9 px-3 text-muted-foreground hover:text-primary hover:bg-primary/5 text-xs font-bold uppercase tracking-wider rounded-lg"
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        <span className="hidden sm:inline">Reset</span>
      </Button>

      {/* Save */}
      <AnimatePresence>
        {(editing || dirty) && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.18 }}
          >
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || !dirty}
              className="h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-bold uppercase tracking-wider rounded-lg shadow-[0_8px_24px_-8px_hsl(48_100%_51%/0.6)]"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1.5" />
              )}
              {dirty ? "Save Layout" : "Saved"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomizeToolbar;
