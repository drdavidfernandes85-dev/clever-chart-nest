import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, LayoutDashboard, PlayCircle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import MagneticButton from "@/components/MagneticButton";
import { track } from "@/lib/analytics";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Reusable landing-page CTAs.
 * One source of truth for label, styling, destination and analytics
 * so the same action looks and behaves identically across sections.
 */

type BaseProps = {
  section: string;
  size?: "default" | "lg";
  className?: string;
  children?: ReactNode;
};

const primaryCls =
  "h-12 md:h-14 gap-2 rounded-full px-7 md:px-9 text-sm md:text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.5),0_0_30px_hsl(45_100%_50%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8)] transition-shadow";

const secondaryCls =
  "h-12 md:h-14 gap-2 rounded-full border-primary/60 bg-[#FFCD05]/10 px-6 md:px-7 text-sm md:text-base font-bold text-primary hover:bg-primary/20 hover:border-primary backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.2)]";

export const OpenTerminalCTA = ({ section, className = "" }: BaseProps) => {
  const { t } = useLanguage();
  const label = t("home.cta.openTerminal");
  return (
    <MagneticButton strength={0.25}>
      <Button size="lg" className={`${primaryCls} cta-pulse ${className}`} asChild>
        <Link
          to="/dashboard"
          aria-label={label}
          onClick={() =>
            track("cta_click", { cta: "open_terminal", section, destination: "/dashboard" })
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          {label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </MagneticButton>
  );
};


export const WatchWebinarsCTA = ({ section, className = "" }: BaseProps) => {
  const { t } = useLanguage();
  const label = t("home.cta.watchWebinars");
  return (
    <MagneticButton strength={0.22}>
      <Button size="lg" variant="outline" className={`${secondaryCls} ${className}`} asChild>
        <Link
          to="/webinars"
          aria-label={label}
          onClick={() =>
            track("cta_click", { cta: "view_webinars", section, destination: "/webinars" })
          }
        >
          <PlayCircle className="h-4 w-4" />
          {label}
        </Link>
      </Button>
    </MagneticButton>
  );
};

export const BookMentoringCTA = ({
  section,
  onClick,
  label,
  className = "",
}: BaseProps & { onClick?: () => void; label?: string }) => {
  const { t } = useLanguage();
  const finalLabel = label ?? t("home.cta.bookMentoring");
  return (
    <Button
      size="lg"
      className={`${primaryCls} ${className}`}
      onClick={() => {
        track("cta_click", { cta: "book_mentoring", section, destination: "#mentoria_form" });
        onClick?.();
      }}
    >
      <GraduationCap className="h-4 w-4" />
      {finalLabel}
    </Button>
  );
};
