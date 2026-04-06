import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import FeaturesSection from "@/components/FeaturesSection";
import MentoringSection from "@/components/MentoringSection";
import TeamSection from "@/components/TeamSection";
import NewsletterSection from "@/components/NewsletterSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <AnnouncementBanner />
    <FeaturesSection />
    <MentoringSection />
    <TeamSection />
    <NewsletterSection />
    <Footer />
  </div>
);

export default Index;
