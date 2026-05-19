import { cn } from "@/lib/utils";
import ltrIcon from "@/assets/ltr-icon.png";
import ltrTerminalLogo from "@/assets/ltr-terminal-pro-logo.png";
import ixLtrProLogo from "@/assets/ix-ltr-pro-logo.png";

interface Props {
  /**
   * "platform" — IX LTR PRO horizontal lockup (gold LTR badge + "IX LTR PRO"
   *              wordmark). Use across public website, dashboard, auth
   *              screens, footer, and general brand surfaces.
   * "full"     — LTR Terminal Pro horizontal lockup (gold LTR badge +
   *              "LTR Terminal Pro" wordmark). Use ONLY inside the trading
   *              terminal product surfaces.
   * "icon"     — compact LTR monogram only (square gold-rimmed mark)
   * "wordmark" — small inline wordmark for sidebars/footers (text-only)
   */
  variant?: "platform" | "full" | "icon" | "wordmark";
  className?: string;
  /** Adds a subtle gold glow drop-shadow underneath the mark */
  glow?: boolean;
  /** Override alt text (defaults are i18n-friendly brand strings). */
  alt?: string;
}

/**
 * Brand mark system for the IX LTR ecosystem.
 *
 *   - `platform` → main ecosystem brand (IX LTR PRO)
 *   - `full`     → trading terminal product (LTR Terminal Pro)
 *   - `icon`     → favicon / collapsed states / loading screens
 *   - `wordmark` → tiny inline text-only fallback
 *
 * Size with Tailwind height utilities; width is `auto` to preserve the
 * natural aspect ratio of the horizontal lockup (~6.5:1).
 */
const LtrLogo = ({ variant = "platform", className, glow = true, alt }: Props) => {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "font-heading text-[13px] font-extrabold uppercase tracking-[0.14em] leading-none",
          className,
        )}
      >
        <span className="text-[#FFCD05]">IX</span>{" "}
        <span className="text-[#F5F5F5]">LTR PRO</span>
      </span>
    );
  }

  if (variant === "icon") {
    return (
      <img
        src={ltrIcon}
        alt={alt ?? "LTR icon"}
        draggable={false}
        className={cn(
          "select-none object-contain",
          glow && "drop-shadow-[0_0_16px_rgba(255,205,5,0.5)]",
          className,
        )}
      />
    );
  }

  if (variant === "full") {
    return (
      <img
        src={ltrTerminalLogo}
        alt={alt ?? "LTR Terminal Pro trading terminal"}
        draggable={false}
        className={cn(
          "h-10 w-auto select-none object-contain",
          glow && "drop-shadow-[0_0_18px_rgba(255,205,5,0.35)]",
          className,
        )}
      />
    );
  }

  // "platform" — IX LTR PRO ecosystem lockup
  return (
    <img
      src={ixLtrProLogo}
      alt={alt ?? "IX LTR PRO educational trading platform"}
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
