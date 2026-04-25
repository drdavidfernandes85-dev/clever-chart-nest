import type { LayoutItem } from "react-grid-layout";
import { WIDGET_LABELS, WidgetId } from "./presets";

interface Props {
  lg: LayoutItem[];
  active?: boolean;
}

/** Mini visual preview of a preset layout — 12-col scaled SVG. */
const PresetThumbnail = ({ lg, active = false }: Props) => {
  // Compute viewBox height from max y+h (so all presets fit)
  const maxY = Math.max(...lg.map((l) => l.y + l.h), 12);
  const W = 120;
  const H = Math.max(60, Math.round((maxY / 12) * 60));
  const cellW = W / 12;
  const cellH = H / maxY;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-auto rounded-md border ${
        active
          ? "border-primary/60 bg-primary/5"
          : "border-border/40 bg-background/40"
      } transition-colors`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {lg.map((l) => {
        const isHero =
          l.i === "portfolio" || (l.w >= 8 && l.h >= 8);
        return (
          <rect
            key={l.i}
            x={l.x * cellW + 1}
            y={l.y * cellH + 1}
            width={l.w * cellW - 2}
            height={l.h * cellH - 2}
            rx={1.5}
            className={
              isHero
                ? "fill-primary/40"
                : active
                ? "fill-primary/20"
                : "fill-foreground/15"
            }
            stroke="currentColor"
            strokeWidth={0.4}
            strokeOpacity={active ? 0.5 : 0.25}
          >
            <title>{WIDGET_LABELS[l.i as WidgetId]}</title>
          </rect>
        );
      })}
    </svg>
  );
};

export default PresetThumbnail;
