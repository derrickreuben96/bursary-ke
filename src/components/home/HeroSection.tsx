import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Search, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import heroImage from "@/assets/hero-african-students.jpg";
import heroHs1 from "@/assets/hero-hs-students-1.jpg";
import heroHs2 from "@/assets/hero-hs-students-2.jpg";
import heroHs3 from "@/assets/hero-hs-students-3.jpg";
import heroUni1 from "@/assets/hero-uni-students-1.jpg";
import heroUni2 from "@/assets/hero-uni-students-2.jpg";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCountyEmblem } from "@/lib/countyEmblems";
import { useCountdown } from "@/hooks/useCountdown";
import { useI18n } from "@/lib/i18n";

const heroSlides = [heroImage, heroHs1, heroHs2, heroHs3, heroUni1, heroUni2];

interface TickerAdvert {
  id: string;
  county: string;
  title: string;
  deadline: string;
  budget_amount: number | null;
}

function TickerItem({ advert }: { advert: TickerAdvert }) {
  const { days, hours, isExpired } = useCountdown(advert.deadline);
  const emblem = getCountyEmblem(advert.county);
  const isUrgent = days <= 7;
  const { t } = useI18n();

  if (isExpired) return null;

  return (
    <Link
      to={`/apply/secondary?advert=${advert.id}`}
      className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-300 group min-w-[280px]"
    >
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
        {emblem ? (
          <img src={emblem} alt={advert.county} className="w-8 h-8 object-contain" />
        ) : (
          <MapPin className="h-4 w-4 text-white/70" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{advert.county} {t("hero.county_label")}</p>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium flex items-center gap-1 ${isUrgent ? 'text-red-300' : 'text-primary'}`}>
            <Clock className="h-3 w-3" />
            {days}d {hours}h {t("hero.days_hours_left")}
          </span>
          {advert.budget_amount && (
            <span className="text-xs text-white/60">• {t("currency.kes")} {(advert.budget_amount / 1000000).toFixed(0)}M</span>
          )}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-white/50 group-hover:text-primary transition-colors flex-shrink-0" />
    </Link>
  );
}

export function HeroSection() {
  const [adverts, setAdverts] = useState<TickerAdvert[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    supabase
      .from("bursary_adverts")
      .select("id, county, title, deadline, budget_amount")
      .eq("is_active", true)
      .gte("deadline", new Date().toISOString())
      .order("deadline", { ascending: true })
      .then(({ data }) => {
        if (data) setAdverts(data);
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const tickerAdverts = [...adverts, ...adverts];

  return (
    <section className="relative min-h-[600px] flex flex-col justify-center overflow-hidden">
      {heroSlides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${currentSlide === index ? 'animate-ken-burns' : ''}`}
          style={{
            backgroundImage: `url('${slide}')`,
            opacity: currentSlide === index ? 1 : 0,
            zIndex: currentSlide === index ? 1 : 0,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/80 z-[2]" />

      <div className="container relative z-10 py-20 text-center text-white flex-1 flex flex-col justify-center">
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary/30 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-soft" />
            <span>{t("hero.badge")}</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            {t("hero.title_1")}{" "}
            <span className="text-primary">{t("hero.title_2")}</span>
          </h1>

          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 h-14 shadow-kenya hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              <Link to="/apply/secondary">
                {t("hero.apply_now")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 hover:bg-white/20 text-white text-lg px-8 h-14 hover:scale-105 hover:shadow-xl transition-all duration-300"
            >
              <Link to="/track">
                <Search className="mr-2 h-5 w-5" />
                {t("hero.track")}
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t("hero.free")}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t("hero.secure")}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t("hero.realtime")}</span>
            </div>
          </div>

          <div className="flex justify-center gap-2 pt-2">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  currentSlide === index
                    ? 'bg-primary w-6'
                    : 'bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {adverts.length > 0 && (
        <div className="relative z-10 py-4 bg-black/40 backdrop-blur-sm border-t border-white/10">
          <div className="container mb-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-destructive text-destructive-foreground animate-pulse text-[10px] px-2 py-0.5">
                LIVE
              </Badge>
              <span className="text-xs font-medium text-white/70">
                {adverts.length} {t("hero.live_programs")}
              </span>
            </div>
          </div>
          <div className="overflow-hidden ticker-mask">
            <div className="flex gap-4 animate-ticker hover:[animation-play-state:paused] px-4">
              {tickerAdverts.map((advert, index) => (
                <TickerItem key={`${advert.id}-${index}`} advert={advert} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
