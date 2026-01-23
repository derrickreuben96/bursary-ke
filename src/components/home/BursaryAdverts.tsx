import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, MapPin, Clock, FileText, Building2, 
  Phone, ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
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

export function BursaryAdverts() {
  const [adverts, setAdverts] = useState<BursaryAdvert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdverts = async () => {
      try {
        console.log("[BursaryAdverts] Fetching active bursary adverts...");
        
        const { data, error } = await supabase
          .from("bursary_adverts")
          .select("*")
          .eq("is_active", true)
          .gte("deadline", new Date().toISOString())
          .order("deadline", { ascending: true });

        console.log("[BursaryAdverts] Query result:", { data, error });

        if (error) {
          console.error("[BursaryAdverts] Error fetching adverts:", error);
          setIsLoading(false);
          return;
        }

        if (data && data.length > 0) {
          setAdverts(data.map(d => ({
            ...d,
            venues: (d.venues as unknown as Venue[]) || [],
            required_documents: d.required_documents || []
          })));
        } else {
          console.log("[BursaryAdverts] No active adverts found");
        }
      } catch (err) {
        console.error("[BursaryAdverts] Unexpected error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdverts();
  }, []);

  const getDaysRemaining = (deadline: string) => {
    const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatDeadline = (deadline: string) => {
    return new Date(deadline).toLocaleDateString("en-KE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-b from-background to-secondary/30">
        <div className="container">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3 mx-auto"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </section>
    );
  }

  if (adverts.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-gradient-to-b from-background to-secondary/30">
      <div className="container">
        <div className="text-center mb-10">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/30">
            Open Applications
          </Badge>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            County Bursary Programs
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Browse active bursary opportunities in your county. Apply online or visit our assistance centers.
          </p>
        </div>

        <Carousel className="w-full max-w-5xl mx-auto">
          <CarouselContent>
            {adverts.map((advert) => {
              const daysRemaining = getDaysRemaining(advert.deadline);
              const isUrgent = daysRemaining <= 7;

              return (
                <CarouselItem key={advert.id} className="md:basis-1/2 lg:basis-1/2">
                  <Card className="h-full border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <Badge variant="outline" className="mb-2">
                          <MapPin className="h-3 w-3 mr-1" />
                          {advert.county}
                          {advert.ward && ` - ${advert.ward}`}
                        </Badge>
                        {isUrgent && (
                          <Badge variant="destructive" className="animate-pulse">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {daysRemaining} days left!
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg leading-tight">
                        {advert.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {advert.description && (
                        <p className="text-sm text-muted-foreground">
                          {advert.description}
                        </p>
                      )}

                      {/* Deadline */}
                      <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                        <Calendar className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="text-xs text-muted-foreground">Application Deadline</p>
                          <p className="font-semibold text-destructive">
                            {formatDeadline(advert.deadline)}
                          </p>
                        </div>
                      </div>

                      {/* Budget */}
                      {advert.budget_amount && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>Budget: KES {advert.budget_amount.toLocaleString()}</span>
                        </div>
                      )}

                      {/* Venues for Physical Assistance */}
                      {advert.venues && advert.venues.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Physical Assistance Centers:
                          </p>
                          <div className="space-y-2 pl-6">
                            {advert.venues.slice(0, 2).map((venue, idx) => (
                              <div key={idx} className="text-xs bg-muted p-2 rounded">
                                <p className="font-medium">{venue.name}</p>
                                <p className="text-muted-foreground">{venue.address}</p>
                                <p className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {venue.phone}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Required Documents */}
                      {advert.required_documents && advert.required_documents.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Documents Required (In-Person):
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 pl-6">
                            {advert.required_documents.slice(0, 5).map((doc, idx) => (
                              <li key={idx} className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {doc}
                              </li>
                            ))}
                            {advert.required_documents.length > 5 && (
                              <li className="text-primary">
                                +{advert.required_documents.length - 5} more...
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Apply Button */}
                      <Button asChild className="w-full mt-4">
                        <Link to="/apply/secondary">
                          Apply Now
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex" />
          <CarouselNext className="hidden md:flex" />
        </Carousel>

        {/* All Counties Notice */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Showing {adverts.length} active bursary programs. More counties coming soon.
          </p>
        </div>
      </div>
    </section>
  );
}
