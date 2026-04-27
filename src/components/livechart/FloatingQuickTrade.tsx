import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Zap, GripVertical, Minus, X } from "lucide-react";
import QuickTradePanel from "@/components/dashboard/QuickTradePanel";
import { useAuth } from "@/contexts/AuthContext";
import { useQuickTrade } from "@/contexts/QuickTradeContext";

const STORAGE_PREFIX = "eltr.floatingQuickTrade.v4";

// Widget dimensions used for clamping & default placement.
const PILL_W = 220;
const PILL_H = 56;
const PANEL_W = 360;
// Tall enough to render the full QuickTradePanel without internal scrolling
// on common laptop viewports. Capped to viewport via maxHeight at render time.
const PANEL_H = 760;
// Reserve space for the mobile bottom navigation (h-16 + safe-area).
const MOBILE_BOTTOM_INSET = 88;

interface Pos {
  x: number;
  y: number;
  open: boolean;
}

/** Default placement: open panel near the bottom-right of the viewport. */
const defaultPos = (): Pos => {
  if (typeof window === "undefined") return { x: 24, y: 120, open: true };
  const isMobile = window.innerWidth < 1024;
  const bottomInset = isMobile ? MOBILE_BOTTOM_INSET : 32;
  const width = isMobile ? Math.min(PANEL_W, window.innerWidth - 24) : PANEL_W;
  const height = Math.min(PANEL_H, window.innerHeight - bottomInset - 24);
  return {
    x: isMobile ? 12 : Math.max(24, window.innerWidth - width - 24),
    y: Math.max(80, window.innerHeight - height - bottomInset),
    open: true,
  };
};

interface FloatingQuickTradeProps {
  /** Optional list of symbol labels (e.g. "BTC/USDT") shown in the panel's picker. */
  symbols?: string[];
  /** Called when the user picks a symbol — lets the parent sync the chart. */
  onSymbolChange?: (label: string) => void;
}

const FloatingQuickTrade = ({ symbols, onSymbolChange }: FloatingQuickTradeProps = {}) => {
  const { user } = useAuth();
  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${user?.id ?? "guest"}`,
    [user?.id],
  );

  const [pos, setPos] = useState<Pos>(defaultPos);
  const [hydrated, setHydrated] = useState(false);
  const [fsHost, setFsHost] = useState<Element | null>(null);
  const constraintsRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();

  // Hydrate from localStorage when the user (storage key) changes.
  useEffect(() => {
    setHydrated(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Pos>;
        setPos((prev) => ({
          x: typeof saved.x === "number" ? saved.x : prev.x,
          y: typeof saved.y === "number" ? saved.y : prev.y,
          open: !!saved.open,
        }));
      } else {
        setPos(defaultPos());
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      /* ignore */
    }
  }, [pos, hydrated, storageKey]);

  // Keep widget on-screen if viewport shrinks
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        ...p,
        x: Math.min(Math.max(8, p.x), window.innerWidth - 80),
        y: Math.min(Math.max(8, p.y), window.innerHeight - 80),
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Re-portal into the fullscreen element when the chart goes fullscreen so
  // the floating widget stays visible (fixed elements outside the FS host
  // are hidden by the browser).
  useEffect(() => {
    const update = () => setFsHost(document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  // Auto-expand whenever something calls openTrade() (e.g. "Take this signal")
  const { prefillNonce } = useQuickTrade();
  useEffect(() => {
    if (prefillNonce > 0) setPos((p) => ({ ...p, open: true }));
  }, [prefillNonce]);

  const setOpen = (open: boolean) => setPos((p) => ({ ...p, open }));

  const startDrag = (e: React.PointerEvent) => {
    dragControls.start(e);
  };

  // Cap panel size to viewport so it never overflows on small screens.
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 1024;
  const panelWidth =
    typeof window !== "undefined"
      ? Math.min(PANEL_W, window.innerWidth - 24)
      : PANEL_W;
  const maxPanelHeight =
    typeof window !== "undefined"
      ? Math.min(PANEL_H, window.innerHeight - (isMobile ? MOBILE_BOTTOM_INSET + 24 : 32))
      : PANEL_H;

  const widget = (
    <>
      {/* Invisible drag bounds = the whole viewport */}
      <div
        ref={constraintsRef}
        className="pointer-events-none fixed inset-0 z-[60]"
        aria-hidden
      />
      <motion.div
        drag
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        dragConstraints={constraintsRef}
        dragElastic={0.05}
        initial={false}
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        onDragEnd={(_, info) => {
          const width = pos.open ? panelWidth : PILL_W;
          const height = pos.open ? maxPanelHeight : PILL_H;
          const bottomInset = isMobile ? MOBILE_BOTTOM_INSET : 8;
          setPos((p) => ({
            ...p,
            x: Math.min(Math.max(8, p.x + info.offset.x), window.innerWidth - width),
            y: Math.min(Math.max(8, p.y + info.offset.y), window.innerHeight - height - bottomInset),
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
              style={{ width: panelWidth, maxHeight: maxPanelHeight }}
              className="flex flex-col overflow-hidden rounded-2xl border border-primary/30 bg-card/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85),0_0_50px_-12px_hsl(48_100%_51%/0.35)] backdrop-blur-2xl"
            >
              {/* Drag handle — only header starts a drag */}
              <div
                onPointerDown={startDrag}
                className="flex shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-card/80 px-3 py-2 backdrop-blur-xl cursor-grab active:cursor-grabbing touch-none"
              >
                <div className="flex items-center gap-1.5 text-foreground pointer-events-none">
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
              {/* Body — naturally sized; no inner scroll unless viewport is tiny */}
              <div className="flex-1 overflow-y-auto p-2">
                <QuickTradePanel compact symbols={symbols} onSymbolChange={onSymbolChange} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="flex h-12 items-center rounded-full border border-primary/40 bg-card/90 backdrop-blur-2xl shadow-[0_15px_40px_-10px_hsl(48_100%_51%/0.6),0_0_30px_-8px_hsl(48_100%_51%/0.5)] hover:shadow-[0_20px_50px_-10px_hsl(48_100%_51%/0.85)] transition-shadow"
            >
              {/* Drag handle */}
              <span
                onPointerDown={startDrag}
                aria-label="Drag Quick Trade"
                className="flex h-full items-center pl-2 pr-1 cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </span>
              {/* Click target — opens the panel for opening/closing positions */}
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open Quick Trade"
                className="group flex h-full items-center gap-2 pl-1 pr-4"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Zap className="h-4 w-4" />
                </span>
                <span className="font-heading text-[11px] font-extrabold uppercase tracking-widest text-foreground">
                  Quick Trade
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );

  // When the chart is fullscreen, portal the widget into that element so it
  // remains visible above the FS surface.
  if (fsHost) return createPortal(widget, fsHost);
  return widget;
};

export default FloatingQuickTrade;
