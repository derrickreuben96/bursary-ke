import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/home/HeroSection";
import { StatsSection } from "@/components/home/StatsSection";
import { ReviewCarousel } from "@/components/home/ReviewCarousel";
import { TrackingWidget } from "@/components/home/TrackingWidget";
import { FAQSection } from "@/components/home/FAQSection";
import { BursarySlider } from "@/components/home/BursarySlider";
import { Seo } from "@/components/seo/Seo";
import { faqItems } from "@/lib/mockData";

const Index = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.slice(0, 6).map((f) => ({
      "@type": "Question",
      name: f.question.en,
      acceptedAnswer: { "@type": "Answer", text: f.answer.en },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Seo
        title="Bursary-KE — Transparent Bursaries for Kenyan Students"
        description="Apply for secondary and university bursaries across all 47 Kenyan counties. Track your application in real time on Bursary-KE."
        path="/"
        jsonLd={faqJsonLd}
      />
      <Header />
      <main className="flex-1">
        <HeroSection />
        <BursarySlider />
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
