import { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  title?: string;
  children: ReactNode;
  editing: boolean;
}

/**
 * Wraps every widget on the customizable grid.
 * - Always: subtle glassmorphism + soft yellow glow on hover
 * - Edit mode: glowing dashed yellow border + drag handle
 */
const WidgetFrame = ({ children, editing, title }: Props) => {
  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 26, stiffness: 200, mass: 0.6 }}
      className={`group relative h-full w-full rounded-2xl transition-all duration-300 ${
        editing
          ? "ring-2 ring-primary/60 outline outline-1 outline-dashed outline-primary/50 outline-offset-2 shadow-[0_0_40px_-4px_hsl(48_100%_51%/0.5),inset_0_0_0_1px_hsl(48_100%_51%/0.15)] animate-pulse-soft"
          : "ring-1 ring-primary/15 hover:ring-primary/35 shadow-[0_8px_24px_-12px_hsl(48_100%_51%/0.25)] hover:shadow-[0_22px_60px_-22px_hsl(48_100%_51%/0.55)] hover:-translate-y-0.5"
      }`}
    >
      {/* Animated gradient border on edit */}
      {editing && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-60 [background:conic-gradient(from_var(--g,0deg),hsl(48_100%_51%/0.0),hsl(48_100%_51%/0.5),hsl(48_100%_51%/0.0))] [mask:linear-gradient(#fff,#fff)_content-box,linear-gradient(#fff,#fff)] [mask-composite:exclude] p-[1px]"
        />
      )}

      {editing && (
        <button
          className="widget-drag-handle absolute top-2 right-2 z-30 inline-flex h-8 px-2.5 cursor-grab active:cursor-grabbing items-center gap-1.5 rounded-md border border-primary/60 bg-black/85 text-primary backdrop-blur-md hover:bg-primary/20 transition-colors shadow-[0_4px_22px_-4px_hsl(48_100%_51%/0.75)]"
          aria-label={title ? `Drag ${title}` : "Drag widget"}
          type="button"
        >
          <GripVertical className="h-3.5 w-3.5" />
          <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:inline">
            Drag
          </span>
        </button>
      )}

      {/* Resize hint corner — only in edit mode */}
      {editing && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1 right-1 z-20 text-[9px] font-mono uppercase tracking-widest text-primary/70 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm border border-primary/30"
        >
          Resize
        </div>
      )}

      <div className="h-full w-full overflow-auto rounded-2xl">{children}</div>
    </motion.div>
  );
};

export default WidgetFrame;
