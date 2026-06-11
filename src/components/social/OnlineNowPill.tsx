import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { useOnlineCount } from "@/hooks/useOnlineCount";

interface Props {
  className?: string;
}

const OnlineNowPill = ({ className }: Props) => {
  const { t } = useLanguage();
  const count = useOnlineCount();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 backdrop-blur-md shadow-[0_0_25px_hsl(45_100%_50%/0.25)]",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <Users className="h-4 w-4 text-primary" />
      <span className="text-sm font-bold tabular-nums text-foreground">
        {count == null ? "…" : count.toLocaleString()}
      </span>
      <span className="text-xs text-foreground/70">{t("hero.onlineNow")}</span>
    </div>
  );
};

export default OnlineNowPill;
