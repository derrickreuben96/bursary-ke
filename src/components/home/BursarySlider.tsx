import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, FileText, Building2, Phone, GraduationCap, 
  ChevronLeft, ChevronRight, ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { CountdownTimer } from "./CountdownTimer";
import { Skeleton } from "@/components/ui/skeleton";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface Venue {
  name: string;
  address: string;
  phone: string;
}

interface BursaryAdvert {
  id: string;
  county: string;
  ward: string | null;
  title: string;
  description: string | null;
  deadline: string;
  budget_amount: number | null;
  venues: Venue[];
  required_documents: string[];
  is_active: boolean;
}

export function BursarySlider() {
  const [adverts, setAdverts] = useState<BursaryAdvert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const fetchAdverts = async () => {
      try {
        const { data, error } = await supabase
          .from("bursary_adverts")
          .select("*")
          .eq("is_active", true)
          .gte("deadline", new Date().toISOString())
          .order("deadline", { ascending: true });

        if (error) {
          console.error("[BursarySlider] Error fetching adverts:", error);
          setIsLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setAdverts(data.map(d => ({
            ...d,
            venues: (d.venues as unknown as Venue[]) || [],
            required_documents: d.required_documents || []
          })));
        }
      } catch (err) {
        console.error("[BursarySlider] Unexpected error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdverts();
  }, []);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-secondary/20">
        <div className="container">
          <div className="text-center mb-10">
            <Skeleton className="h-6 w-32 mx-auto mb-4" />
            <Skeleton className="h-10 w-64 mx-auto mb-3" />
            <Skeleton className="h-5 w-96 mx-auto" />
          </div>
          <Skeleton className="h-[450px] max-w-5xl mx-auto rounded-2xl" />
        </div>
      </section>
    );
  }

  if (adverts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 via-background to-secondary/20 overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-10">
          <Badge className="mb-4 bg-primary text-primary-foreground shadow-lg animate-fade-in">
            <GraduationCap className="h-3 w-3 mr-1" />
            Open Applications
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            County Bursary Programs
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Don't miss out! Apply now for active bursary opportunities in your county.
          </p>
        </div>

        {/* Auto-Sliding Carousel */}
        <Carousel
          setApi={setApi}
          opts={{
            align: "center",
            loop: true,
          }}
          plugins={[
            Autoplay({
              delay: 5000,
              stopOnInteraction: true,
              stopOnMouseEnter: true,
            }),
          ]}
          className="w-full max-w-5xl mx-auto"
        >
          <CarouselContent className="-ml-4">
            {adverts.map((advert) => (
              <CarouselItem key={advert.id} className="pl-4 md:basis-1/1 lg:basis-1/1">
                <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-card to-card/95 overflow-hidden hover:shadow-2xl transition-all duration-300">
                  <CardContent className="p-0">
                    <div className="grid md:grid-cols-2 gap-0">
                      {/* Left: Main Info */}
                      <div className="p-6 md:p-8 space-y-5">
                        {/* County Badge */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-background shadow-sm text-sm py-1">
                            <MapPin className="h-3.5 w-3.5 mr-1 text-primary" />
                            {advert.county}
                            {advert.ward && ` • ${advert.ward}`}
                          </Badge>
                        </div>

                        {/* Title */}
                        <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                          {advert.title}
                        </h3>

                        {/* Description */}
                        {advert.description && (
                          <p className="text-muted-foreground leading-relaxed">
                            {advert.description}
                          </p>
                        )}

                        {/* Budget */}
                        {advert.budget_amount && (
                          <div className="inline-flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-full">
                            <Building2 className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-foreground">
                              Budget: KES {advert.budget_amount.toLocaleString()}
                            </span>
                          </div>
                        )}

                        {/* Countdown Timer */}
                        <CountdownTimer deadline={advert.deadline} />

                        {/* CTA Buttons */}
                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button asChild size="lg" className="shadow-lg hover:scale-105 transition-transform">
                            <Link to="/apply/secondary">
                              Apply Now
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="lg" className="hover:scale-105 transition-transform">
                            <Link to="/bursaries">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View All Bursaries
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {/* Right: Documents & Venues */}
                      <div className="bg-muted/30 p-6 md:p-8 border-l border-border/50 space-y-5">
                        {/* Required Documents */}
                        {advert.required_documents && advert.required_documents.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-foreground">
                              <FileText className="h-4 w-4 text-primary" />
                              Required Documents
                            </h4>
                            <ul className="space-y-2">
                              {advert.required_documents.slice(0, 6).map((doc, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                                  {doc}
                                </li>
                              ))}
                              {advert.required_documents.length > 6 && (
                                <li className="text-sm text-primary font-medium">
                                  +{advert.required_documents.length - 6} more documents...
                                </li>
                              )}
                            </ul>
                          </div>
                        )}

                        {/* Assistance Venues */}
                        {advert.venues && advert.venues.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold flex items-center gap-2 text-foreground">
                              <MapPin className="h-4 w-4 text-primary" />
                              Assistance Centers
                            </h4>
                            <div className="space-y-2">
                              {advert.venues.slice(0, 2).map((venue, idx) => (
                                <div key={idx} className="bg-background/80 p-3 rounded-lg shadow-sm">
                                  <p className="font-medium text-foreground text-sm">{venue.name}</p>
                                  <p className="text-xs text-muted-foreground">{venue.address}</p>
                                  <p className="flex items-center gap-1 text-xs text-primary mt-1">
                                    <Phone className="h-3 w-3" />
                                    {venue.phone}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Navigation Arrows */}
          <CarouselPrevious className="hidden md:flex -left-4 lg:-left-12 h-12 w-12 bg-background shadow-lg border-2 hover:bg-primary hover:text-primary-foreground transition-colors" />
          <CarouselNext className="hidden md:flex -right-4 lg:-right-12 h-12 w-12 bg-background shadow-lg border-2 hover:bg-primary hover:text-primary-foreground transition-colors" />
        </Carousel>

        {/* Pagination Dots */}
        {adverts.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {adverts.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  current === index 
                    ? 'w-8 bg-primary' 
                    : 'w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {adverts.length} active bursary program{adverts.length !== 1 ? 's' : ''}. 
            <Link to="/bursaries" className="text-primary hover:underline ml-1 font-medium">
              Browse all opportunities →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
