import { Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const AnnouncementBanner = () => {
  const { t } = useLanguage();

  return (
    <div className="bg-primary py-3 text-center">
      <div className="container flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
        <p className="font-heading text-sm font-semibold text-primary-foreground uppercase tracking-wide">
          {t("announcement.text")}
        </p>
        <a href="#" className="ml-1 text-sm font-medium text-primary-foreground underline underline-offset-4 hover:opacity-80">
          {t("announcement.link")}
        </a>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
