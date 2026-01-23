import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { ReviewCarousel } from "@/components/home/ReviewCarousel";
import { TrackingWidget } from "@/components/home/TrackingWidget";
import { FAQSection } from "@/components/home/FAQSection";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <StatsSection />
        <ReviewCarousel />
        <TrackingWidget />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
