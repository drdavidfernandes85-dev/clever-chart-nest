import { cn } from "@/lib/utils";
import ltrIcon from "@/assets/ltr-icon.png";
import ltrTerminalLogo from "@/assets/ltr-terminal-pro-logo.png";
import ixLtrProLogo from "@/assets/ix-ltr-pro-logo.png";

interface Props {
  /**
   * "full"     — horizontal logo + "LTR Terminal Pro" wordmark (uses the
   *              brand PNG exactly as designed: gold-rimmed LTR badge,
   *              vertical gold stripe, gold/silver wordmark, soft glow).
   * "icon"     — compact LTR monogram only (square gold-rimmed mark)
   * "wordmark" — small inline wordmark for sidebars/footers (text-only)
   */
  variant?: "full" | "icon" | "wordmark";
  className?: string;
  /** Adds a subtle gold glow drop-shadow underneath the mark */
  glow?: boolean;
}

/**
 * Brand mark for **LTR Terminal Pro** — the premium professional trading
 * terminal. The "full" variant renders the official horizontal lockup
 * PNG verbatim; size it with Tailwind height utilities (e.g. `h-10`,
 * `h-14`) — width is auto from the natural ~6.5:1 aspect ratio.
 */
const LtrLogo = ({ variant = "full", className, glow = true }: Props) => {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "font-heading text-[13px] font-extrabold uppercase tracking-[0.14em] leading-none",
          className,
        )}
      >
        <span className="text-[#FFCD05]">LTR</span>{" "}
        <span className="text-[#F5F5F5]">Terminal Pro</span>
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <img
        src={ltrIcon}
        alt="LTR Terminal Pro"
        draggable={false}
        className={cn(
          "select-none object-contain",
          glow && "drop-shadow-[0_0_16px_rgba(255,205,5,0.5)]",
          className,
        )}
      />
    );
  }

  // "full" — official horizontal lockup PNG, transparent background.
  // Default to a sensible height so it never collapses; consumers can
  // override via className (e.g. "h-10 w-auto", "h-14 w-auto").
  return (
    <img
      src={ltrFullLogo}
      alt="LTR Terminal Pro"
      draggable={false}
      className={cn(
        "h-10 w-auto select-none object-contain",
        glow && "drop-shadow-[0_0_18px_rgba(255,205,5,0.35)]",
        className,
      )}
    />
  );
};

export default LtrLogo;
