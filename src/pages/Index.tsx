import { Suspense, type ReactNode } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { track } from "@/lib/analytics";
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
import CapitalSection from "@/components/CapitalSection";
import SocialProofSection from "@/components/SocialProofSection";
import WebinarUrgencyStrip from "@/components/WebinarUrgencyStrip";
import ScrollReveal from "@/components/ScrollReveal";
import DeferredSection from "@/components/DeferredSection";
import Scrollspy from "@/components/home/Scrollspy";
import { useLanguage } from "@/i18n/LanguageContext";

const SITE_URL = "https://elitelivetradingroom.com";
const SponsorsSection = lazy(() => import("@/components/SponsorsSection"));
const TeamSection = lazy(() => import("@/components/TeamSection"));
const MentoringSection = lazy(() => import("@/components/MentoringSection"));
const TrustpilotSection = lazy(() => import("@/components/TrustpilotSection"));
const FAQSection = lazy(() => import("@/components/FAQSection"));

const ContactSection = lazy(() => import("@/components/ContactSection"));
const NewsletterSection = lazy(() => import("@/components/NewsletterSection"));
const Footer = lazy(() => import("@/components/Footer"));
const PlatformPillars = lazy(() => import("@/components/home/PlatformPillars"));
const ComplianceBlock = lazy(() => import("@/components/home/ComplianceBlock"));

const LazyHomeSection = ({
  children,
  minHeight,
  delay,
}: {
  children: ReactNode;
  minHeight: number;
  delay?: number;
}) => (
  <DeferredSection minHeight={minHeight}>
    <Suspense fallback={<div style={{ minHeight }} aria-hidden="true" />}>
      <ScrollReveal delay={delay}>{children}</ScrollReveal>
    </Suspense>
  </DeferredSection>
);

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
      name: "IX LTR",
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
          ? "Plataforma educativa de trading y comunidad de traders"
          : locale === "pt"
          ? "Plataforma educacional de trading e comunidade de traders"
          : "Educational trading platform and trader community",
      provider: {
        "@type": "Organization",
        name: "IX LTR",
        url: homeUrl,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": homeUrl + "#website",
      url: homeUrl,
      name: "IX LTR",

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

  // Launch nav focuses on the 4 core pillars in client-journey order:
  // Education → Webinars → Community → LTR Terminal Pro.
  // Analytics, Leaderboard, Video Library, and other unstable modules
  // intentionally excluded — routes remain accessible via direct URL.
  const internalLinks = [
    { to: "/education", icon: GraduationCap, label: t("seo.home.internal.education" as any) },
    { to: "/webinars", icon: PlayCircle, label: t("seo.home.internal.webinars" as any) },
    { to: "/chatroom", icon: MessagesSquare, label: t("seo.home.internal.chatroom" as any) },
    { to: "/dashboard", icon: LayoutDashboard, label: t("seo.home.internal.dashboard" as any) },
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
      <main>
      <HeroSection />
      <CapitalSection />
      <SocialProofSection />
      {/* Narrativa educativa sin duplicar capacidades: 1) Respaldo Infinox → 2) Pilares (Terminal/Comunidad/Webinars/Educación) → 3) Equipo → 4) Mentoría 1:1 → 5) Prueba social → 6) Dudas → 7) Descubre más → 8) Claridad legal → 9) Contacto / Newsletter */}
      <LazyHomeSection minHeight={260}><SponsorsSection /></LazyHomeSection>
      <LazyHomeSection minHeight={1400} delay={80}><PlatformPillars /></LazyHomeSection>
      <LazyHomeSection minHeight={320} delay={100}><TrustpilotSection /></LazyHomeSection>
      <WebinarUrgencyStrip />

      <LazyHomeSection minHeight={420}><ComplianceBlock /></LazyHomeSection>
      <LazyHomeSection minHeight={360}><NewsletterSection /></LazyHomeSection>
      </main>
      <DeferredSection minHeight={420}>
        <Suspense fallback={<div style={{ minHeight: 420 }} aria-hidden="true" />}>
          <Footer />
        </Suspense>
      </DeferredSection>
    </div>
  );
};

export default Index;

