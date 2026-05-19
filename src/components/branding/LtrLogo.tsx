import { cn } from "@/lib/utils";
import ltrFullLogo from "@/assets/ltr-terminal-pro-logo.png";
import ltrIcon from "@/assets/ltr-icon.png";

interface Props {
  /**
   * "full"     — horizontal logo + "LTR Terminal Pro" wordmark image
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

  // "full" — compose the transparent icon mark + crisp wordmark text.
  // Avoids using the wide PNG (which truncates in narrow headers and
  // carries baked-in padding/checker artifacts).
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 leading-none whitespace-nowrap",
        className,
      )}
    >
      <img
        src={ltrIcon}
        alt=""
        aria-hidden
        draggable={false}
        className={cn(
          "h-[1.4em] w-[1.4em] shrink-0 select-none object-contain",
          glow && "drop-shadow-[0_0_14px_rgba(255,205,5,0.45)]",
        )}
      />
      <span className="font-heading text-[1em] font-extrabold uppercase tracking-[0.14em]">
        <span className="text-[#FFCD05]">LTR</span>{" "}
        <span className="text-[#F5F5F5]">Terminal Pro</span>
      </span>
    </span>
  );

};

export default LtrLogo;
