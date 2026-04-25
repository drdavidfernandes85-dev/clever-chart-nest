import { motion, AnimatePresence } from "framer-motion";
import { Check, RotateCcw, Save, Settings2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRESETS, PresetId } from "./presets";

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
    if (r.ok) {
      const { toast } = await import("sonner");
      toast.success("Layout saved");
    } else {
      const { toast } = await import("sonner");
      toast.error(r.reason ?? "Could not save layout");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Preset switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 border-primary/30 bg-card/60 text-foreground hover:bg-primary/10 hover:text-primary text-xs font-bold uppercase tracking-wider rounded-lg"
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Layout: {PRESETS.find((p) => p.id === preset)?.name ?? "Custom"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72 bg-card/95 backdrop-blur-xl border-primary/20"
        >
          <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Presets
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRESETS.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className="flex items-start gap-2 py-2 cursor-pointer focus:bg-primary/10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-foreground">{p.name}</span>
                  {p.id === preset && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {p.description}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={resetDefault}
            className="cursor-pointer focus:bg-primary/10 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Reset to Default
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
