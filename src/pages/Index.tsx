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
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <SponsorsSection />
    <FeaturesSection />
    <MentoringSection />
    <TeamSection />
    <TrustpilotSection />
    <FAQSection />
    <CTASection />
    <NewsletterSection />
    <Footer />
  </div>
);

export default Index;
