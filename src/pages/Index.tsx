import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import HeroSection from "@/components/HeroSection";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import SponsorsSection from "@/components/SponsorsSection";
import FeaturesSection from "@/components/FeaturesSection";
import MentoringSection from "@/components/MentoringSection";
import TeamSection from "@/components/TeamSection";
import TrustpilotSection from "@/components/TrustpilotSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import NewsletterSection from "@/components/NewsletterSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";
import DeferredSection from "@/components/DeferredSection";
import { useLanguage } from "@/i18n/LanguageContext";

const SITE_URL = "https://elitelivetradingroom.com";

const Index = () => {
  const { t, locale } = useLanguage();

  // Build a FAQPage + Organization schema graph for richer SEO snippets.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      name: "IX Live Trading Room",
      url: SITE_URL,
      description: t("seo.home.description"),
      areaServed: ["LATAM", "Worldwide"],
      serviceType:
        locale === "es"
          ? "Educación de trading y comunidad de traders en vivo"
          : locale === "pt"
          ? "Educação de trading e comunidade de traders ao vivo"
          : "Trading education and live trader community",
      provider: {
        "@type": "Organization",
        name: "INFINOX",
        url: "https://www.infinox.com",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        "@type": "Question",
        name: t(`faq.q${n}` as any),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(`faq.a${n}` as any),
        },
      })),
    },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title={t("seo.home.title")}
        description={t("seo.home.description")}
        canonical={SITE_URL + "/"}
        image={`${SITE_URL}/og-image.jpg`}
        jsonLd={jsonLd}
      />
      <Navbar />
      <HeroSection />
      <DeferredSection minHeight={260}><ScrollReveal><SponsorsSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={520}><ScrollReveal delay={100}><FeaturesSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={520}><ScrollReveal delay={100}><TeamSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={520}><ScrollReveal delay={100}><MentoringSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={320}><ScrollReveal delay={100}><TrustpilotSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={620}><ScrollReveal delay={100}><FAQSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={320}><ScrollReveal><CTASection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={560}><ScrollReveal><ContactSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={360}><ScrollReveal><NewsletterSection /></ScrollReveal></DeferredSection>
      <DeferredSection minHeight={420}><Footer /></DeferredSection>
    </div>
  );
};

export default Index;
