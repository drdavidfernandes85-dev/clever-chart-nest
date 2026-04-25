import { ReactNode, useMemo, useState, useEffect } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
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

const CustomizableDashboardGrid = ({
  editing,
  layouts,
  onLayoutChange,
  widgets,
}: Props) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const items = useMemo(
    () =>
      layouts.lg.map((l) => (
        <div key={l.i} data-widget-id={l.i}>
          <WidgetFrame editing={editing} title={WIDGET_LABELS[l.i as WidgetId]}>
            {widgets[l.i as WidgetId]}
          </WidgetFrame>
        </div>
      )),
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
        rowHeight={44}
        margin={[20, 20]}
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
