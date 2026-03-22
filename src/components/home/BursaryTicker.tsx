import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCountyEmblem } from "@/lib/countyEmblems";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCountdown } from "@/hooks/useCountdown";

interface TickerAdvert {
  id: string;
  county: string;
  ward: string | null;
  title: string;
  deadline: string;
  budget_amount: number | null;
}

function TickerItem({ advert }: { advert: TickerAdvert }) {
  const { days, hours, isExpired } = useCountdown(advert.deadline);
  const emblem = getCountyEmblem(advert.county);
  const isUrgent = days <= 7;

  if (isExpired) return null;

  return (
    <Link
      to={`/apply/secondary?advert=${advert.id}`}
      className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-card border border-border/50 rounded-xl hover:border-primary/50 hover:shadow-md transition-all duration-300 group min-w-[320px]"
    >
      {/* County Emblem */}
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-border group-hover:border-primary/30 transition-colors">
        {emblem ? (
          <img src={emblem} alt={`${advert.county} County`} className="w-10 h-10 object-contain" />
        ) : (
          <MapPin className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
          {advert.county} County
        </p>
        <p className="text-xs text-muted-foreground truncate">{advert.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-medium flex items-center gap-1 ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
            <Clock className="h-3 w-3" />
            {days}d {hours}h left
          </span>
          {advert.budget_amount && (
            <span className="text-xs text-muted-foreground">
              • KES {(advert.budget_amount / 1000000).toFixed(0)}M
            </span>
          )}
        </div>
      </div>

      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </Link>
  );
}

export function BursaryTicker() {
  const [adverts, setAdverts] = useState<TickerAdvert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdverts = async () => {
      try {
        const { data, error } = await supabase
          .from("bursary_adverts")
          .select("id, county, ward, title, deadline, budget_amount")
          .eq("is_active", true)
          .gte("deadline", new Date().toISOString())
          .order("deadline", { ascending: true });

        if (!error && data) {
          setAdverts(data);
        }
      } catch (err) {
        console.error("[BursaryTicker] Error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdverts();
  }, []);

  if (isLoading || adverts.length === 0) return null;

  // Double the adverts for seamless infinite scroll
  const tickerAdverts = [...adverts, ...adverts];

  return (
    <section className="py-6 bg-secondary/30 border-y border-border/50 overflow-hidden">
      <div className="container mb-4">
        <div className="flex items-center gap-3">
          <Badge className="bg-destructive text-destructive-foreground animate-pulse text-xs">
            LIVE
          </Badge>
          <h3 className="text-sm font-semibold text-foreground">
            Open Bursary Applications Across Kenya
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            ({adverts.length} counties accepting applications)
          </span>
        </div>
      </div>

      {/* Scrolling Ticker */}
      <div className="relative">
        <div className="flex gap-4 animate-ticker hover:[animation-play-state:paused]">
          {tickerAdverts.map((advert, index) => (
            <TickerItem key={`${advert.id}-${index}`} advert={advert} />
          ))}
        </div>
      </div>
    </section>
  );
}
