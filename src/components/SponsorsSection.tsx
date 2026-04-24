import sponsorsStrip from "@/assets/sponsors-strip.png";
import { useLanguage } from "@/i18n/LanguageContext";

const SponsorsSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative border-y border-border/30 py-16">
      <div className="container relative">
        <p className="mb-8 text-center text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
          {t("sponsors.label")}
        </p>
        <div className="mx-auto max-w-5xl">
          <img
            src={sponsorsStrip}
            alt="Infinox sponsors and partners including Tottenham Hotspur, Porsche Carrera Cup Brasil, and Chestertons Polo"
            className="mx-auto w-full object-contain"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;
