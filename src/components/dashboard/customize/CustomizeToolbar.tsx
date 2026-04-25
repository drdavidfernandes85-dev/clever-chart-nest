import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Save, Settings2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PresetId } from "./presets";

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

  const onReset = async () => {
    resetDefault();
    const { toast } = await import("sonner");
    toast.success("Layout reset to default");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Customize toggle */}
      <Button
        size="sm"
        onClick={() => setEditing(!editing)}
        variant={editing ? "default" : "outline"}
        className={
          editing
            ? "h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold uppercase tracking-wider rounded-lg shadow-[0_8px_24px_-8px_hsl(48_100%_51%/0.6)]"
            : "h-9 px-3.5 border-primary/40 bg-card/60 text-foreground hover:bg-primary/10 hover:text-primary text-xs font-bold uppercase tracking-wider rounded-lg"
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

      {/* Reset */}
      <Button
        size="sm"
        variant="outline"
        onClick={onReset}
        className="h-9 px-3.5 border-border/40 bg-card/40 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 text-xs font-bold uppercase tracking-wider rounded-lg"
      >
        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
        Reset
      </Button>

      {/* Save Layout */}
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
              className="h-9 px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-bold uppercase tracking-wider rounded-lg shadow-[0_8px_24px_-8px_hsl(48_100%_51%/0.6)]"
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
