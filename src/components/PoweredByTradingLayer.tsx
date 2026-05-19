import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  variant?: "badge" | "inline" | "muted";
}

/**
 * Compliance attribution: every trade-idea / copy-tools / execution
 * surface must visibly state that the underlying trading technology is
 * provided by Trading Layer — NOT by the broker.
 *
 * No broker logo is used here on purpose. If a Trading Layer logo SVG
 * is added under src/assets later, swap the <Layers /> mark for it.
 */
const PoweredByTradingLayer = ({ className, variant = "badge" }: Props) => {
  if (variant === "muted") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70",
          className,
        )}
      >
        <Layers className="h-3 w-3" />
        Powered by Trading Layer
      </span>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground",
          className,
        )}
      >
        <Layers className="h-3.5 w-3.5 text-primary" />
        Powered by{" "}
        <span className="font-semibold text-foreground">Trading Layer</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
      aria-label="Trading technology powered by Trading Layer"
    >
      <Layers className="h-3 w-3" />
      Powered by Trading Layer
    </span>
  );
};

export default PoweredByTradingLayer;
