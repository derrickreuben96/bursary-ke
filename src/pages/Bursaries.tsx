import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import {
  MapPin,
  Calendar,
  Wallet,
  FileText,
  Building2,
  Clock,
  Filter,
  GraduationCap,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { wardsByCounty } from "@/lib/kenyanWards";

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

const KENYA_COUNTIES = ["All Counties", ...Object.keys(wardsByCounty).sort()];

const DEADLINE_FILTERS = [
  { value: "all", label: "All Deadlines" },
  { value: "7", label: "Within 7 days" },
  { value: "14", label: "Within 14 days" },
  { value: "30", label: "Within 30 days" },
  { value: "90", label: "Within 3 months" },
];

export default function Bursaries() {
  const { t } = useI18n();
  const [adverts, setAdverts] = useState<BursaryAdvert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [countyFilter, setCountyFilter] = useState("All Counties");
  const [wardFilter, setWardFilter] = useState("All Wards");
  const [deadlineFilter, setDeadlineFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const availableWards = useMemo(() => {
    if (countyFilter === "All Counties") return [];
    return wardsByCounty[countyFilter] || [];
  }, [countyFilter]);

  const handleCountyChange = (value: string) => {
    setCountyFilter(value);
    setWardFilter("All Wards");
  };

  const clearFilters = () => {
    setCountyFilter("All Counties");
    setWardFilter("All Wards");
    setDeadlineFilter("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    countyFilter !== "All Counties" ||
    wardFilter !== "All Wards" ||
    searchQuery.trim() !== "" ||
    deadlineFilter !== "all";

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
          console.error("Error fetching bursary adverts:", error);
          return;
        }

        const mappedData: BursaryAdvert[] = (data || []).map((item) => ({
          id: item.id,
          county: item.county,
          ward: item.ward,
          title: item.title,
          description: item.description,
          deadline: item.deadline,
          budget_amount: item.budget_amount ? Number(item.budget_amount) : null,
          venues: Array.isArray(item.venues) ? (item.venues as unknown as Venue[]) : [],
          required_documents: item.required_documents || [],
          is_active: item.is_active ?? true,
        }));

        setAdverts(mappedData);
      } catch (err) {
        console.error("Failed to fetch adverts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdverts();
  }, []);

  const filteredAdverts = useMemo(() => {
    return adverts.filter((advert) => {
      if (countyFilter !== "All Counties" && advert.county !== countyFilter) {
        return false;
      }

      if (wardFilter !== "All Wards" && advert.ward !== wardFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = advert.title.toLowerCase().includes(q);
        const matchesDesc = advert.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }

      if (deadlineFilter !== "all") {
        const daysRemaining = differenceInDays(new Date(advert.deadline), new Date());
        if (daysRemaining > parseInt(deadlineFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [adverts, countyFilter, wardFilter, deadlineFilter]);

  const getDaysRemaining = (deadline: string): number => {
    return differenceInDays(new Date(deadline), new Date());
  };

  const getUrgencyBadge = (daysRemaining: number) => {
    if (daysRemaining <= 3) {
      return <Badge variant="destructive" className="animate-pulse">{t("bursaries.urgent")} - {daysRemaining} {t("bursaries.days_left")}</Badge>;
    } else if (daysRemaining <= 7) {
      return <Badge className="bg-destructive/80 hover:bg-destructive text-destructive-foreground">{daysRemaining} {t("bursaries.days_left")}</Badge>;
    } else if (daysRemaining <= 14) {
      return <Badge className="bg-accent hover:bg-accent/80 text-accent-foreground">{daysRemaining} {t("bursaries.days_left")}</Badge>;
    }
    return <Badge variant="secondary">{daysRemaining} {t("bursaries.days_left")}</Badge>;
  };

  const formatBudget = (amount: number | null) => {
    if (!amount) return t("bursaries.not_specified");
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-12">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                  {t("bursaries.title")}
                </h1>
                <p className="text-muted-foreground">
                  {t("bursaries.subtitle")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="border-b border-border bg-card/50 sticky top-16 z-40">
          <div className="container py-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">{t("bursaries.filters")}</span>
              </div>
              
              <div className="flex flex-wrap gap-3 flex-1">
                <div className="relative w-full sm:w-[250px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("bursaries.search_placeholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>
                <Select value={countyFilter} onValueChange={handleCountyChange}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select County" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50 max-h-[300px]">
                    {KENYA_COUNTIES.map((county) => (
                      <SelectItem key={county} value={county}>
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {countyFilter !== "All Counties" && availableWards.length > 0 && (
                  <Select value={wardFilter} onValueChange={setWardFilter}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select Ward" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border z-50 max-h-[300px]">
                      <SelectItem value="All Wards">All Wards</SelectItem>
                      {availableWards.map((ward) => (
                        <SelectItem key={ward} value={ward}>
                          {ward}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Select value={deadlineFilter} onValueChange={setDeadlineFilter}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Deadline" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border border-border z-50">
                    {DEADLINE_FILTERS.map((filter) => (
                      <SelectItem key={filter.value} value={filter.value}>
                        {filter.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t("bursaries.clear")}
                  </Button>
                )}
              </div>

              <div className="ml-auto text-sm text-muted-foreground">
                {filteredAdverts.length} {filteredAdverts.length !== 1 ? t("bursaries.programs_found_plural") : t("bursaries.programs_found")} {t("bursaries.found")}
              </div>
            </div>
          </div>
        </section>

        {/* Bursaries Grid */}
        <section className="py-8">
          <div className="container">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-8 w-full mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredAdverts.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 rounded-full bg-muted">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{t("bursaries.no_found")}</h3>
                    <p className="text-muted-foreground mt-1">
                      {hasActiveFilters
                        ? t("bursaries.adjust_filters")
                        : t("bursaries.no_active")}
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                      {t("bursaries.clear_filters")}
                    </Button>
                  )}
                </div>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredAdverts.map((advert) => {
                  const daysRemaining = getDaysRemaining(advert.deadline);
                  return (
                    <Card
                      key={advert.id}
                      className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50 overflow-hidden"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {advert.county}
                            {advert.ward && ` - ${advert.ward}`}
                          </Badge>
                          {getUrgencyBadge(daysRemaining)}
                        </div>
                        <CardTitle className="text-lg mt-3 group-hover:text-primary transition-colors line-clamp-2">
                          {advert.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {advert.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {advert.description}
                          </p>
                        )}

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span>
                              {t("bursaries.deadline")} {format(new Date(advert.deadline), "PPP")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Wallet className="h-4 w-4 text-primary" />
                            <span>{t("bursaries.budget")} {formatBudget(advert.budget_amount)}</span>
                          </div>

                          {advert.venues.length > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <Building2 className="h-4 w-4 text-primary mt-0.5" />
                              <span>
                                {advert.venues.length} {advert.venues.length !== 1 ? t("bursaries.assistance_centers") : t("bursaries.assistance_center")}
                              </span>
                            </div>
                          )}

                          {advert.required_documents.length > 0 && (
                            <div className="flex items-start gap-2 text-muted-foreground">
                              <FileText className="h-4 w-4 text-primary mt-0.5" />
                              <span>
                                {advert.required_documents.length} {advert.required_documents.length !== 1 ? t("bursaries.required_docs") : t("bursaries.required_doc")}
                              </span>
                              </span>
                            </div>
                          )}
                        </div>

                        <Button asChild className="w-full mt-4">
                          <Link to="/apply/secondary">{t("bursaries.apply_now")}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
