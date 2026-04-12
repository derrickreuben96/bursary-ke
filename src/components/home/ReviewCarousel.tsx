import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Star, Quote } from "lucide-react";
import { beneficiaryReviews } from "@/lib/mockData";
import { getRelativeTime } from "@/lib/formatters";
import { useI18n } from "@/lib/i18n";

export function ReviewCarousel() {
  const { t } = useI18n();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
  });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    const autoPlay = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => {
      emblaApi.off("select", onSelect);
      clearInterval(autoPlay);
    };
  }, [emblaApi, onSelect]);

  return (
    <section className="py-16 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            {t("reviews.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("reviews.subtitle")}
          </p>
        </div>

        <div className="relative">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {beneficiaryReviews.map((review) => (
                <div
                  key={review.id}
                  className="flex-none w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                >
                  <Card className="h-full p-6 shadow-soft hover:shadow-card transition-shadow">
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <Quote className="h-8 w-8 text-primary/30" />
                      </div>
                      <p className="text-foreground flex-1 leading-relaxed">
                        "{review.message}"
                      </p>
                      <div className="flex gap-1 my-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "fill-accent text-accent"
                                : "text-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="border-t border-border pt-4">
                        <p className="font-semibold text-foreground">{review.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {review.county} • {getRelativeTime(review.date)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 hidden md:flex bg-background shadow-lg"
            aria-label="Previous review"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 hidden md:flex bg-background shadow-lg"
            aria-label="Next review"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="flex justify-center gap-2 mt-6">
            {beneficiaryReviews.map((_, index) => (
              <button
                key={index}
                onClick={() => emblaApi?.scrollTo(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === selectedIndex ? "bg-primary" : "bg-primary/30"
                }`}
                aria-label={`Go to review ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
