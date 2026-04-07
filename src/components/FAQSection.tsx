import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ScrollReveal from "@/components/ScrollReveal";
import { useLanguage } from "@/i18n/LanguageContext";
import { TranslationKey } from "@/i18n/translations";

const faqKeys: { q: TranslationKey; a: TranslationKey }[] = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
  { q: "faq.q5", a: "faq.a5" },
  { q: "faq.q6", a: "faq.a6" },
];

const FAQSection = () => {
  const { t } = useLanguage();

  return (
    <section id="faq" className="relative py-28">
      <div className="absolute inset-0 bg-radial-glow opacity-20" />
      <div className="container relative">
        <ScrollReveal>
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <h2 className="font-heading text-4xl font-bold text-foreground md:text-5xl uppercase tracking-tight">
              {t("faq.title1")} <span className="text-gradient">{t("faq.title2")}</span>
            </h2>
            <p className="mt-5 text-base text-muted-foreground">
              {t("faq.desc")}
            </p>
          </div>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="mx-auto max-w-3xl">
            <Accordion type="single" collapsible className="space-y-3">
              {faqKeys.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="card-glass rounded-2xl border-none px-6 transition-all duration-300"
                >
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:text-primary hover:no-underline py-5">
                    {t(faq.q)}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground pb-5">
                    {t(faq.a)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default FAQSection;
