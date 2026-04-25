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

const Index = () => (
  <div className="min-h-screen">
    <SEO
      title="IX Live Trading Room | Real-Time Forex by INFINOX"
      description="Real-time forex analysis, expert signals, live chatroom, and pro tools — join the IX Live Trading Room powered by INFINOX."
      canonical="https://elitelivetradingroom.com/"
      image="https://elitelivetradingroom.com/og-image.jpg"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "FinancialService",
        name: "IX Live Trading Room",
        url: "https://elitelivetradingroom.com",
        areaServed: "Worldwide",
        serviceType: "Forex education and live trading community",
      }}
    />
    <Navbar />
    <HeroSection />
    <ScrollReveal><SponsorsSection /></ScrollReveal>
    <ScrollReveal delay={100}><FeaturesSection /></ScrollReveal>
    <ScrollReveal delay={100}><TeamSection /></ScrollReveal>
    <ScrollReveal delay={100}><MentoringSection /></ScrollReveal>
    <ScrollReveal delay={100}><TrustpilotSection /></ScrollReveal>
    <ScrollReveal delay={100}><FAQSection /></ScrollReveal>
    <ScrollReveal><CTASection /></ScrollReveal>
    <ScrollReveal><ContactSection /></ScrollReveal>
    <ScrollReveal><NewsletterSection /></ScrollReveal>
    <Footer />
  </div>
);

export default Index;
