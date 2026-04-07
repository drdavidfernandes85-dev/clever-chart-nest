import Navbar from "@/components/Navbar";
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
