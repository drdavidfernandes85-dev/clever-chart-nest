import { cn } from "@/lib/utils";
import ltrLogo from "@/assets/ltr-terminal-pro-logo.png";

interface Props {
  /**
   * "full"     — horizontal logo + "LTR Terminal Pro" wordmark image
   * "icon"     — compact LTR monogram only (tight crop of the same image)
   * "wordmark" — small inline wordmark for sidebars/footers (text-only)
   */
  variant?: "full" | "icon" | "wordmark";
  className?: string;
  /** Adds a subtle gold glow drop-shadow underneath the mark */
  glow?: boolean;
}

/**
 * Brand mark for **LTR Terminal Pro** — the premium professional trading
 * terminal. Replaces the legacy "INFINOX IX Terminal" lockup wherever the
 * product is named. Broker attribution ("Connected to INFINOX MT5") is
 * handled separately so the broker is never presented as the technology
 * provider.
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
    // Crop to the square LTR mark on the left of the source image
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-md",
          glow && "shadow-[0_0_18px_rgba(255,205,5,0.35)]",
          className,
        )}
        aria-label="LTR Terminal Pro"
      >
        <img
          src={ltrLogo}
          alt=""
          draggable={false}
          className="h-full w-auto object-cover object-left"
          style={{ aspectRatio: "1 / 1" }}
        />
      </span>
    );
  }

  return (
    <img
      src={ltrLogo}
      alt="LTR Terminal Pro"
      draggable={false}
      className={cn(
        "select-none object-contain",
        glow && "drop-shadow-[0_0_24px_rgba(255,205,5,0.35)]",
        className,
      )}
    />
  );
};

export default LtrLogo;
