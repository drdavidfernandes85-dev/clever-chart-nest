import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

const AnnouncementBanner = () => {
  const { t } = useLanguage();
  const [override, setOverride] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (supabase.from as any)("site_settings")
      .select("value")
      .eq("key", "announcement")
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.value && typeof data.value === "object" && data.value.text) {
          setOverride(data.value.text as string);
        }
      });
  }, []);

  if (dismissed) return null;

  const text = override ?? t("announcement.text");
  if (!text) return null;

  return (
    <div className="relative bg-primary py-3 text-center">
      <div className="container flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
        <p className="font-heading text-sm font-semibold text-primary-foreground uppercase tracking-wide">
          {text}
        </p>
        {!override && (
          <a href="#" className="ml-1 text-sm font-medium text-primary-foreground underline underline-offset-4 hover:opacity-80">
            {t("announcement.link")}
          </a>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-foreground/80 hover:text-primary-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default AnnouncementBanner;
