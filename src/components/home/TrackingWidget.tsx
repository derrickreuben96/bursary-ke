import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { isValidTrackingNumber } from "@/lib/maskData";
import { sampleTrackingData } from "@/lib/mockData";
import { useI18n } from "@/lib/i18n";

export function TrackingWidget() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    found: boolean;
    status?: string;
    stage?: string;
  } | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

  const handleTrack = async () => {
    setError("");
    setResult(null);

    const normalizedNumber = trackingNumber.toUpperCase().trim();

    if (!normalizedNumber) {
      setError(t("tracking.error_empty"));
      return;
    }

    if (!isValidTrackingNumber(normalizedNumber)) {
      setError(t("tracking.error_format"));
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const data = sampleTrackingData[normalizedNumber];
    
    if (data) {
      const currentStage = data.stages[data.currentStage - 1];
      setResult({
        found: true,
        status: currentStage.status === "completed" ? "Approved" : "In Progress",
        stage: currentStage.name,
      });
    } else {
      setResult({ found: false });
    }

    setIsLoading(false);
  };

  const handleViewDetails = () => {
    navigate(`/track?number=${trackingNumber.toUpperCase().trim()}`);
  };

  return (
    <section className="py-16 bg-primary/5">
      <div className="container">
        <Card className="max-w-2xl mx-auto p-8 shadow-card">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {t("tracking.title")}
            </h2>
            <p className="text-muted-foreground">
              {t("tracking.subtitle")}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder={t("tracking.placeholder")}
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value.toUpperCase());
                  setError("");
                  setResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                className="h-12 text-base"
              />
            </div>
            <Button
              onClick={handleTrack}
              disabled={isLoading}
              className="h-12 px-8"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Search className="h-5 w-5 mr-2" />
                  {t("tracking.button")}
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 mt-4 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="mt-6 p-4 rounded-lg bg-secondary/50 animate-fade-in">
              {result.found ? (
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    {result.status === "Approved" ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Clock className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {t("tracking.found")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("tracking.current_stage")}: <span className="font-medium">{result.stage}</span>
                    </p>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-primary mt-1"
                      onClick={handleViewDetails}
                    >
                      {t("tracking.view_details")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {t("tracking.not_found")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t("tracking.not_found_hint")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("tracking.lost_number")}{" "}
            <a href="/faq" className="text-primary hover:underline">
              {t("tracking.contact_support")}
            </a>
          </p>
        </Card>
      </div>
    </section>
  );
}
