import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ProgressTimeline } from "@/components/tracking/ProgressTimeline";
import { Search, AlertCircle, Loader2, FileSearch, GraduationCap, School, Shield } from "lucide-react";
import { isValidTrackingNumber } from "@/lib/maskData";
import { sampleTrackingData, type TrackingInfo } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export default function Track() {
  const [searchParams] = useSearchParams();
  const initialNumber = searchParams.get("number") || "";
  const { t } = useI18n();
  
  const [trackingNumber, setTrackingNumber] = useState(initialNumber);
  const [verificationValue, setVerificationValue] = useState("");
  const [verificationType, setVerificationType] = useState<"phone" | "national_id">("phone");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TrackingInfo | null>(
    initialNumber ? sampleTrackingData[initialNumber] || null : null
  );
  const [notFound, setNotFound] = useState(false);

  const handleTrack = async () => {
    setError("");
    setResult(null);
    setNotFound(false);

    const normalizedNumber = trackingNumber.toUpperCase().trim();

    if (!normalizedNumber) {
      setError(t("track.error_enter_tracking"));
      return;
    }

    if (!isValidTrackingNumber(normalizedNumber)) {
      setError(t("track.error_invalid_format"));
      return;
    }

    if (!verificationValue.trim()) {
      setError(`${t(verificationType === "phone" ? "track.phone_number" : "track.national_id")} ${t("track.error_enter_verification")}`);
      return;
    }

    setIsLoading(true);

    try {
      const { data: funcData, error: funcError } = await supabase.functions.invoke(
        "track-application",
        {
          body: {
            trackingNumber: normalizedNumber,
            verificationValue: verificationValue.trim(),
            verificationType,
          },
        }
      );

      if (funcError) {
        if (funcData && funcData.found === false) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        console.error("Tracking function error:", funcError);
        throw new Error("Failed to lookup application");
      }

      if (funcData?.found) {
        const stageKeyMap: Record<string, string> = {
          "Application Received": "received",
          "Under Review": "review",
          "Verification & Screening": "verification",
          "Approval Decision": "approved",
          "Application Not Successful": "rejected",
          "Funds Disbursed": "disbursed",
        };
        setResult({
          trackingNumber: funcData.trackingNumber,
          studentType: funcData.studentType,
          currentStage: funcData.stages.findIndex((s: { status: string }) => s.status === "current") + 1 || 1,
          stages: funcData.stages.map((s: { name: string; status: string; date: string | null; message: string }) => ({
            ...s,
            name: s.name, // Keep original for key lookup
            _key: stageKeyMap[s.name] || s.name,
            date: s.date ? new Date(s.date) : null,
          })),
        });
      } else {
        const sampleData = sampleTrackingData[normalizedNumber];
        if (sampleData) {
          setResult(sampleData);
        } else {
          setNotFound(true);
        }
      }
    } catch (err) {
      console.error("Tracking lookup error:", err);
      const sampleData = sampleTrackingData[trackingNumber.toUpperCase().trim()];
      if (sampleData) {
        setResult(sampleData);
      } else {
        setNotFound(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-3xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <FileSearch className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t("track.page_title")}
            </h1>
            <p className="text-muted-foreground">
              {t("track.page_subtitle")}
            </p>
          </div>

          {/* Search Card */}
          <Card className="p-6 mb-8 shadow-card">
            <div className="space-y-4">
              <div>
                <Label htmlFor="tracking" className="text-sm font-medium mb-2 block">
                  {t("track.tracking_number")}
                </Label>
                <Input
                  id="tracking"
                  placeholder={t("tracking.placeholder")}
                  value={trackingNumber}
                  onChange={(e) => {
                    setTrackingNumber(e.target.value.toUpperCase());
                    setError("");
                    setNotFound(false);
                  }}
                  className="h-12 text-base"
                />
              </div>

              {/* Verification Section */}
              <div className="p-4 bg-secondary/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{t("track.verification_required")}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {t("track.verification_desc")}
                </p>

                <RadioGroup
                  value={verificationType}
                  onValueChange={(v) => setVerificationType(v as "phone" | "national_id")}
                  className="flex gap-4 mb-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phone" id="phone" />
                    <Label htmlFor="phone" className="text-sm cursor-pointer">{t("track.phone_number")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="national_id" id="national_id" />
                    <Label htmlFor="national_id" className="text-sm cursor-pointer">{t("track.national_id")}</Label>
                  </div>
                </RadioGroup>

                <Input
                  placeholder={verificationType === "phone" ? t("track.enter_phone") : t("track.enter_national_id")}
                  value={verificationValue}
                  onChange={(e) => {
                    setVerificationValue(e.target.value);
                    setError("");
                  }}
                  className="h-10"
                />
              </div>

              <Button
                onClick={handleTrack}
                disabled={isLoading}
                className="w-full h-12 hover:scale-[1.02] transition-transform"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    {t("track.track_button")}
                  </>
                )}
              </Button>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Not Found State */}
          {notFound && (
            <Card className="p-8 text-center animate-fade-in">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("track.not_found_title")}</h2>
              <p className="text-muted-foreground mb-4">
                {t("track.not_found_desc")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("track.not_found_hint")}{" "}
                <a href="/faq" className="text-primary hover:underline">
                  {t("track.contact_support")}
                </a>.
              </p>
            </Card>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-6 animate-fade-in">
              <Card className="p-6 shadow-card">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    {result.studentType === "secondary" ? (
                      <School className="h-6 w-6 text-primary" />
                    ) : (
                      <GraduationCap className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {t("track.application_details")}
                    </h2>
                    <p className="text-muted-foreground">
                      {t("track.tracking_number")}:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {result.trackingNumber}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("track.application_type")}</p>
                    <p className="font-medium">
                      {result.studentType === "secondary" ? t("track.secondary_student") : t("track.university_student")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t("track.current_stage")}</p>
                    <p className="font-medium text-primary">
                      {result.stages[result.currentStage - 1]?.name}
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 shadow-card">
                <h3 className="text-lg font-semibold mb-6">{t("track.progress")}</h3>
                <ProgressTimeline stages={result.stages} currentStage={result.currentStage} />
              </Card>

              <div className="text-center text-sm text-muted-foreground">
                <p>
                  {t("track.need_help")}{" "}
                  <a href="/faq" className="text-primary hover:underline">
                    {t("track.visit_faq")}
                  </a>{" "}
                  {t("track.or_contact")}{" "}
                  <a href="mailto:support@bursary-ke.go.ke" className="text-primary hover:underline">
                    support@bursary-ke.go.ke
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Demo Help */}
          {!result && !notFound && (
            <Card className="p-6 bg-primary/5 border-primary/20">
              <h3 className="font-semibold text-foreground mb-2">{t("track.demo_title")}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t("track.demo_desc")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTrackingNumber("BKE-ABC123");
                    setError("");
                  }}
                  className="font-mono hover:scale-105 transition-transform"
                >
                  BKE-ABC123
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTrackingNumber("BKE-XYZ789");
                    setError("");
                  }}
                  className="font-mono hover:scale-105 transition-transform"
                >
                  BKE-XYZ789
                </Button>
              </div>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
