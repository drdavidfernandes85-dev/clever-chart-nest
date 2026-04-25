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
          ? "ring-1 ring-primary/50 outline outline-1 outline-dashed outline-primary/40 outline-offset-2 shadow-[0_0_28px_-6px_hsl(48_100%_51%/0.35)]"
          : "hover:shadow-[0_18px_50px_-22px_hsl(48_100%_51%/0.35)]"
      }`}
    >
      {editing && (
        <button
          className="widget-drag-handle absolute top-2 right-2 z-30 inline-flex h-8 px-2 cursor-grab active:cursor-grabbing items-center gap-1 rounded-md border border-primary/50 bg-black/80 text-primary backdrop-blur-md hover:bg-primary/15 transition-colors shadow-[0_4px_18px_-4px_hsl(48_100%_51%/0.6)]"
          aria-label={title ? `Drag ${title}` : "Drag widget"}
          type="button"
        >
          <GripVertical className="h-3.5 w-3.5" />
          <span className="text-[10px] font-mono uppercase tracking-widest hidden sm:inline">
            Drag
          </span>
        </button>
      )}
      <div className="h-full w-full overflow-auto rounded-2xl">{children}</div>
    </motion.div>
  );
};

export default WidgetFrame;
