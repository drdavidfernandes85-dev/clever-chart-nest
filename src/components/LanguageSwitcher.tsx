import { useLanguage } from "@/i18n/LanguageContext";
import { LOCALE_FLAGS, LOCALE_LABELS, Locale } from "@/i18n/translations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

const locales: Locale[] = ["en", "es", "pt"];

const LanguageSwitcher = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary">
          <span>{LOCALE_FLAGS[locale]}</span>
          <span>{locale.toUpperCase()}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l)}
            className={`flex items-center gap-2 text-sm ${
              locale === l ? "text-primary font-semibold" : ""
            }`}
          >
            <span>{LOCALE_FLAGS[l]}</span>
            <span>{LOCALE_LABELS[l]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
