import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  Video,
  MessagesSquare,
  LineChart,
  PlayCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import SEO from "@/components/SEO";
import HeroSection from "@/components/HeroSection";
import ScrollReveal from "@/components/ScrollReveal";
import DeferredSection from "@/components/DeferredSection";
import { useLanguage } from "@/i18n/LanguageContext";

const SITE_URL = "https://elitelivetradingroom.com";
const SponsorsSection = lazy(() => import("@/components/SponsorsSection"));
const FeaturesSection = lazy(() => import("@/components/FeaturesSection"));
const TeamSection = lazy(() => import("@/components/TeamSection"));
const MentoringSection = lazy(() => import("@/components/MentoringSection"));
const TrustpilotSection = lazy(() => import("@/components/TrustpilotSection"));
const FAQSection = lazy(() => import("@/components/FAQSection"));
const CTASection = lazy(() => import("@/components/CTASection"));
const ContactSection = lazy(() => import("@/components/ContactSection"));
const NewsletterSection = lazy(() => import("@/components/NewsletterSection"));
const Footer = lazy(() => import("@/components/Footer"));

const Index = () => {
  const { t, locale } = useLanguage();
  const inLanguage = locale === "pt" ? "pt-BR" : locale;
  const homeUrl = SITE_URL + "/";

  // Schema.org graph: FinancialService + WebSite + FAQPage + BreadcrumbList.
  // Fields validated against Google Search Central's structured-data docs.
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FinancialService",
      "@id": homeUrl + "#organization",
      name: "IX Live Trading Room",
      url: homeUrl,
      logo: SITE_URL + "/pwa-512.png",
      image: SITE_URL + "/og-image.jpg",
      description: t("seo.home.description"),
      inLanguage,
      areaServed: [
        { "@type": "Place", name: "LATAM" },
        { "@type": "Place", name: "Worldwide" },
      ],
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
      "@type": "WebSite",
      "@id": homeUrl + "#website",
      url: homeUrl,
      name: "IX Live Trading Room",
      inLanguage,
      publisher: { "@id": homeUrl + "#organization" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": homeUrl + "#faq",
      inLanguage,
      mainEntity: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        "@type": "Question",
        name: t(`faq.q${n}` as any),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(`faq.a${n}` as any),
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": homeUrl + "#breadcrumb",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: homeUrl,
        },
      ],
    },
  ];

  // Keyword-focused internal links — boosts topical relevance & crawlability.
  const internalLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("seo.home.internal.dashboard" as any) },
    { to: "/education", icon: GraduationCap, label: t("seo.home.internal.education" as any) },
    { to: "/webinars", icon: PlayCircle, label: t("seo.home.internal.webinars" as any) },
    { to: "/chatroom", icon: MessagesSquare, label: t("seo.home.internal.chatroom" as any) },
    { to: "/signals", icon: LineChart, label: t("seo.home.internal.signals" as any) },
    { to: "/videos", icon: Video, label: t("seo.home.internal.videos" as any) },
  ];

  return (
    <div className="min-h-screen">
      <SEO
        title={t("seo.home.title")}
        description={t("seo.home.description")}
        keywords={t("seo.home.keywords" as any)}
        canonical={homeUrl}
        image={`${SITE_URL}/og-image.jpg`}
        jsonLd={jsonLd}
      />
      <Navbar />
      <HeroSection />
      <Suspense fallback={null}>
        <DeferredSection minHeight={260}><ScrollReveal><SponsorsSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={520}><ScrollReveal delay={100}><FeaturesSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={520}><ScrollReveal delay={100}><TeamSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={520}><ScrollReveal delay={100}><MentoringSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={320}><ScrollReveal delay={100}><TrustpilotSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={620}><ScrollReveal delay={100}><FAQSection /></ScrollReveal></DeferredSection>

        {/* Keyword-focused internal links — strengthens topical relevance & crawlability */}
        <section
          aria-labelledby="home-internal-links-title"
          className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8"
        >
          <div className="rounded-3xl border border-primary/20 bg-card/40 p-6 backdrop-blur-2xl shadow-[0_30px_120px_-50px_hsl(48_100%_51%/0.45)] md:p-8">
            <h2
              id="home-internal-links-title"
              className="font-heading text-xl md:text-2xl font-bold text-foreground"
            >
              {t("seo.home.internal.title" as any)}
            </h2>
            <nav aria-label="Home internal links" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {internalLinks.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex items-center gap-3 rounded-xl border border-primary/20 bg-background/40 px-4 py-3 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="leading-snug">{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <DeferredSection minHeight={320}><ScrollReveal><CTASection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={560}><ScrollReveal><ContactSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={360}><ScrollReveal><NewsletterSection /></ScrollReveal></DeferredSection>
        <DeferredSection minHeight={420}><Footer /></DeferredSection>
      </Suspense>
    </div>
  );
};

export default Index;

