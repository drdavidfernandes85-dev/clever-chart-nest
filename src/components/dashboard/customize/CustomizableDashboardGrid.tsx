import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import WidgetFrame from "./WidgetFrame";
import { WidgetId, WIDGET_LABELS } from "./presets";
import type { Layouts } from "@/hooks/useDashboardLayout";
import type { LayoutItem } from "react-grid-layout";

import "./grid.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface Props {
  editing: boolean;
  layouts: Layouts;
  onLayoutChange: (
    current: readonly LayoutItem[],
    all: {
      lg?: readonly LayoutItem[];
      md?: readonly LayoutItem[];
      sm?: readonly LayoutItem[];
      xs?: readonly LayoutItem[];
    },
  ) => void;
  /** Map widget id → React node (the actual widget). */
  widgets: Record<WidgetId, ReactNode>;
}

const COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
const BREAKPOINTS = { lg: 1280, md: 1024, sm: 768, xs: 480, xxs: 0 };
const ROW_HEIGHT = 56;
const MARGIN_Y = 16;

/** Widgets that should auto-fit their height to content. */
const AUTOFIT_WIDGETS: WidgetId[] = ["marketMovers"];

const CustomizableDashboardGrid = ({
  editing,
  layouts,
  onLayoutChange,
  widgets,
}: Props) => {
  const [isMobile, setIsMobile] = useState(false);
  const measureRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /**
   * Auto-fit: measure intrinsic content height of marked widgets and
   * adjust their `h` so the frame hugs the content (no internal scroll, no empty space).
   */
  const runAutofit = useCallback(() => {
    const lg = layouts.lg;
    if (!lg?.length) return;
    let changed = false;
    const next = lg.map((l) => {
      if (!AUTOFIT_WIDGETS.includes(l.i as WidgetId)) return l;
      const el = measureRefs.current[l.i];
      if (!el) return l;
      const contentH = el.scrollHeight;
      if (contentH <= 0) return l;
      // Convert px → grid rows. Each row = ROW_HEIGHT + MARGIN_Y vertical gap.
      const rows = Math.max(
        l.minH ?? 4,
        Math.ceil((contentH + MARGIN_Y) / (ROW_HEIGHT + MARGIN_Y)),
      );
      if (rows !== l.h) {
        changed = true;
        return { ...l, h: rows };
      }
      return l;
    });
    if (!changed) return;
    onLayoutChange(next, { lg: next, md: layouts.md, sm: layouts.sm, xs: layouts.xs });
  }, [layouts, onLayoutChange]);

  // Re-run auto-fit when layout (preset) changes or window resizes
  useEffect(() => {
    const id = window.setTimeout(runAutofit, 80);
    const onResize = () => runAutofit();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts.lg.map((l) => l.i).join(",")]);

  const items = useMemo(
    () =>
      layouts.lg.map((l) => {
        const id = l.i as WidgetId;
        const isAutofit = AUTOFIT_WIDGETS.includes(id);
        return (
          <div key={l.i} data-widget-id={l.i}>
            <WidgetFrame editing={editing} title={WIDGET_LABELS[id]}>
              {isAutofit ? (
                <div ref={(el) => (measureRefs.current[l.i] = el)}>
                  {widgets[id]}
                </div>
              ) : (
                widgets[id]
              )}
            </WidgetFrame>
          </div>
        );
      }),
    [layouts.lg, editing, widgets],
  );

  // Mobile: render stacked single-column, no drag/resize
  if (isMobile) {
    return (
      <div className="space-y-5">
        {layouts.lg.map((l) => (
          <div key={l.i} data-widget-id={l.i}>
            {widgets[l.i as WidgetId]}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`dashboard-grid ${editing ? "dashboard-grid-editing" : ""}`}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts as unknown as { [k: string]: LayoutItem[] }}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={[16, MARGIN_Y]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms
        onLayoutChange={onLayoutChange}
      >
        {items}
      </ResponsiveGridLayout>
    </div>
  );
};

export default CustomizableDashboardGrid;
