import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, GripVertical, Minus, X } from "lucide-react";
import QuickTradePanel from "@/components/dashboard/QuickTradePanel";

const STORAGE_KEY = "eltr.floatingQuickTrade.v1";

interface Pos {
  x: number;
  y: number;
  open: boolean;
}

const defaultPos = (): Pos => {
  if (typeof window === "undefined") return { x: 24, y: 120, open: false };
  return {
    x: Math.max(16, window.innerWidth - 360),
    y: Math.max(80, window.innerHeight - 520),
    open: false,
  };
};

/**
 * A floating, draggable Quick Trade widget.
 * - Collapsed: a compact pill with a Zap icon + drag handle.
 * - Expanded: full QuickTradePanel for opening/closing positions.
 * Position and open state persist per-user in localStorage.
 */
const FloatingQuickTrade = () => {
  const [pos, setPos] = useState<Pos>(defaultPos);
  const [hydrated, setHydrated] = useState(false);
  const constraintsRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage once
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Pos>;
        setPos((prev) => ({
          x: typeof saved.x === "number" ? saved.x : prev.x,
          y: typeof saved.y === "number" ? saved.y : prev.y,
          open: !!saved.open,
        }));
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos, hydrated]);

  // Keep widget on-screen if viewport shrinks
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        ...p,
        x: Math.min(Math.max(8, p.x), window.innerWidth - 80),
        y: Math.min(Math.max(64, p.y), window.innerHeight - 80),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const setOpen = (open: boolean) => setPos((p) => ({ ...p, open }));

  return (
    <>
      {/* Invisible drag bounds = the whole viewport */}
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed inset-0 z-[60]"
        aria-hidden
      />
      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0.05}
        initial={false}
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        onDragEnd={(_, info) => {
          setPos((p) => ({
            ...p,
            x: Math.min(Math.max(8, p.x + info.offset.x), window.innerWidth - (p.open ? 360 : 200)),
            y: Math.min(Math.max(64, p.y + info.offset.y), window.innerHeight - (p.open ? 520 : 56)),
          }));
        }}
        className="fixed left-0 top-0 z-[70] select-none"
        style={{ touchAction: "none" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {pos.open ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-[340px] overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_50px_-12px_hsl(48_100%_51%/0.35)] backdrop-blur-2xl"
            >
              {/* Drag header */}
              <div className="flex items-center justify-between gap-2 border-b border-border/40 bg-card/80 px-3 py-2 backdrop-blur-xl cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1.5 text-foreground">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="font-heading text-[11px] font-bold uppercase tracking-widest">
                    Quick Trade
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setOpen(false)}
                    aria-label="Minimize"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {/* Body — stop drag interactions inside the panel */}
              <div
                className="max-h-[70vh] overflow-y-auto p-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <QuickTradePanel compact />
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="collapsed"
              type="button"
              onClick={() => setOpen(true)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="group flex h-12 items-center gap-2 rounded-full border border-primary/40 bg-card/90 pl-2 pr-4 backdrop-blur-2xl shadow-[0_15px_40px_-10px_hsl(48_100%_51%/0.6),0_0_30px_-8px_hsl(48_100%_51%/0.5)] hover:shadow-[0_20px_50px_-10px_hsl(48_100%_51%/0.85)] transition-shadow cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Zap className="h-4 w-4" />
              </span>
              <span className="font-heading text-[11px] font-extrabold uppercase tracking-widest text-foreground">
                Quick Trade
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default FloatingQuickTrade;