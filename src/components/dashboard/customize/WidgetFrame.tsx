import { ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  title?: string;
  children: ReactNode;
  editing: boolean;
}

/**
 * Wraps every widget on the customizable grid. In edit mode it adds
 * a subtle yellow ring + a drag handle in the top-right; otherwise it
 * is fully transparent so existing widget styling shows through.
 */
const WidgetFrame = ({ children, editing }: Props) => {
  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 28, stiffness: 220 }}
      className={`relative h-full w-full ${
        editing
          ? "ring-1 ring-primary/40 rounded-2xl outline outline-1 outline-dashed outline-primary/30 outline-offset-2"
          : ""
      }`}
    >
      {editing && (
        <div className="widget-drag-handle absolute top-2 right-2 z-30 inline-flex h-7 w-7 cursor-grab active:cursor-grabbing items-center justify-center rounded-md border border-primary/40 bg-black/70 text-primary backdrop-blur-md hover:bg-primary/15 transition-colors">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="h-full w-full overflow-auto">{children}</div>
    </motion.div>
  );
};

export default WidgetFrame;
