import { Link } from "react-router-dom";
import { ArrowRight, Check, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

const CapitalSection = () => {
  const { t } = useLanguage();

  const leftItems = [
    { name: t("home.capital.leftItem1.name" as any), price: t("home.capital.leftItem1.price" as any) },
    { name: t("home.capital.leftItem2.name" as any), price: t("home.capital.leftItem2.price" as any) },
    { name: t("home.capital.leftItem3.name" as any), price: t("home.capital.leftItem3.price" as any) },
    { name: t("home.capital.leftItem4.name" as any), price: t("home.capital.leftItem4.price" as any) },
  ];

  const rightItems = [
    { name: t("home.capital.rightItem1.name" as any), price: t("home.capital.rightItem1.price" as any) },
    { name: t("home.capital.rightItem2.name" as any), price: t("home.capital.rightItem2.price" as any) },
    { name: t("home.capital.rightItem3.name" as any), price: t("home.capital.rightItem3.price" as any) },
    { name: t("home.capital.rightItem4.name" as any), price: t("home.capital.rightItem4.price" as any) },
  ];

  const stats = [
    { value: t("home.capital.stat1.value" as any), label: t("home.capital.stat1.label" as any) },
    { value: t("home.capital.stat2.value" as any), label: t("home.capital.stat2.label" as any) },
    { value: t("home.capital.stat3.value" as any), label: t("home.capital.stat3.label" as any) },
  ];

  return (
    <section
      id="capital"
      className="relative mx-auto w-full max-w-[1400px] bg-background py-14 sm:py-20 lg:py-24"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t("home.capital.title" as any)}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
            {t("home.capital.subhead" as any)}
          </p>
        </div>

        {/* Comparison cards */}
        <div className="mt-12 grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10">
          {/* Left — Other platforms */}
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white/50">
              {t("home.capital.leftLabel" as any)}
            </h3>
            <ul className="mt-5 space-y-3">
              {leftItems.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 text-sm sm:text-base"
                >
                  <span className="flex items-center gap-2 text-white/80">
                    <X className="h-4 w-4 shrink-0 text-red-400" />
                    {item.name}
                  </span>
                  <span className="shrink-0 font-semibold text-red-400">
                    {item.price}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-right text-lg font-bold text-red-400">
                {t("home.capital.leftTotalAmount" as any)}
                <span className="text-sm font-medium text-white/50">
                  {t("home.capital.leftTotalLabel" as any)}
                </span>
              </p>
            </div>
          </div>

          {/* Right — IX LTR */}
          <div className="relative rounded-2xl border border-[#FFCD05]/30 bg-gradient-to-br from-[#FFCD05]/[0.06] to-[#FFCD05]/[0.02] p-6 sm:p-8">
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-[#FFCD05] px-3 py-1 text-xs font-bold text-black shadow-lg">
              {t("home.capital.rightBadge" as any)}
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#FFCD05]/90">
              {t("home.capital.rightLabel" as any)}
            </h3>
            <ul className="mt-5 space-y-3">
              {rightItems.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-4 text-sm sm:text-base"
                >
                  <span className="flex items-center gap-2 text-white">
                    <Check className="h-4 w-4 shrink-0 text-[#FFCD05]" />
                    {item.name}
                  </span>
                  <span className="shrink-0 font-semibold text-[#FFCD05]">
                    {item.price}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-[#FFCD05]/20 pt-4">
              <p className="text-right text-lg font-bold text-[#FFCD05]">
                {t("home.capital.rightFooter" as any)}
              </p>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center"
            >
              <span className="font-heading text-2xl font-bold text-[#FFCD05] sm:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 whitespace-pre-line text-xs font-medium uppercase tracking-wider text-white/50">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* CTA + Disclaimer */}
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <Button
            asChild
            size="lg"
            className="h-12 md:h-14 gap-2 rounded-full px-8 text-sm md:text-base font-bold bg-[#FFCD05] text-black hover:bg-[#FFE066] shadow-[0_0_0_1px_hsl(45_100%_50%/0.5),0_0_30px_hsl(45_100%_50%/0.45)] hover:shadow-[0_0_0_1px_hsl(45_100%_50%/0.9),0_0_45px_hsl(45_100%_50%/0.8)] transition-shadow"
          >
            <Link to="/register">
              {t("home.capital.cta" as any)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <p className="flex max-w-xl items-start gap-2 text-[11px] leading-relaxed text-white/40 sm:text-xs">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>{t("home.capital.disclaimer" as any)}</span>
          </p>
        </div>
      </div>
    </section>
  );
};

export default CapitalSection;
