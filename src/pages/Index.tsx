import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import TradingProgram from "@/components/TradingProgram";
import FeaturesSection from "@/components/FeaturesSection";
import MentoringSection from "@/components/MentoringSection";
import TeamSection from "@/components/TeamSection";
import PricingSection from "@/components/PricingSection";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <AnnouncementBanner />
    <TradingProgram />
    <FeaturesSection />
    <MentoringSection />
    <TeamSection />
    <PricingSection />
    <NewsletterSection />
    <Footer />
  </div>
);

export default Index;
