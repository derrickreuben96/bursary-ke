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

export default function Track() {
  const [searchParams] = useSearchParams();
  const initialNumber = searchParams.get("number") || "";
  
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
      setError("Please enter a tracking number");
      return;
    }

    if (!isValidTrackingNumber(normalizedNumber)) {
      setError("Invalid format. Use BKE-XXXXXX (e.g., BKE-ABC123)");
      return;
    }

    if (!verificationValue.trim()) {
      setError(`Please enter your ${verificationType === "phone" ? "phone number" : "national ID"} for verification`);
      return;
    }

    setIsLoading(true);

    try {
      // Call the secure tracking edge function
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
        console.error("Tracking function error:", funcError);
        throw new Error("Failed to lookup application");
      }

      if (funcData?.found) {
        // Convert API result to TrackingInfo format
        setResult({
          trackingNumber: funcData.trackingNumber,
          studentType: funcData.studentType,
          currentStage: funcData.stages.findIndex((s: { status: string }) => s.status === "current") + 1 || 1,
          stages: funcData.stages.map((s: { name: string; status: string; date: string | null; message: string }) => ({
            ...s,
            date: s.date ? new Date(s.date) : null,
          })),
        });
      } else {
        // Check sample data for demo
        const sampleData = sampleTrackingData[normalizedNumber];
        if (sampleData) {
          setResult(sampleData);
        } else {
          setNotFound(true);
        }
      }
    } catch (err) {
      console.error("Tracking lookup error:", err);
      // Fallback to sample data for demo
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
              Track Your Application
            </h1>
            <p className="text-muted-foreground">
              Enter your tracking number and verification details to see your bursary application status
            </p>
          </div>

          {/* Search Card */}
          <Card className="p-6 mb-8 shadow-card">
            <div className="space-y-4">
              {/* Tracking Number Input */}
              <div>
                <Label htmlFor="tracking" className="text-sm font-medium mb-2 block">
                  Tracking Number
                </Label>
                <Input
                  id="tracking"
                  placeholder="Enter tracking number (e.g., BKE-ABC123)"
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
                  <span className="text-sm font-medium">Verification Required</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  For security, please verify your identity using the phone number or national ID used during application.
                </p>

                <RadioGroup
                  value={verificationType}
                  onValueChange={(v) => setVerificationType(v as "phone" | "national_id")}
                  className="flex gap-4 mb-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phone" id="phone" />
                    <Label htmlFor="phone" className="text-sm cursor-pointer">Phone Number</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="national_id" id="national_id" />
                    <Label htmlFor="national_id" className="text-sm cursor-pointer">National ID</Label>
                  </div>
                </RadioGroup>

                <Input
                  placeholder={verificationType === "phone" ? "Enter phone (e.g., 0712345678)" : "Enter National ID"}
                  value={verificationValue}
                  onChange={(e) => {
                    setVerificationValue(e.target.value);
                    setError("");
                  }}
                  className="h-10"
                />
              </div>

              {/* Track Button */}
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
                    Track Application
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
              <h2 className="text-xl font-semibold mb-2">Application Not Found</h2>
              <p className="text-muted-foreground mb-4">
                We couldn't find an application matching your tracking number and verification details.
              </p>
              <p className="text-sm text-muted-foreground">
                Please verify your tracking number and ensure you're using the same phone number or national ID 
                that was provided during application. If you believe this is an error,{" "}
                <a href="/faq" className="text-primary hover:underline">
                  contact support
                </a>.
              </p>
            </Card>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-6 animate-fade-in">
              {/* Application Info Card */}
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
                      Application Details
                    </h2>
                    <p className="text-muted-foreground">
                      Tracking Number:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {result.trackingNumber}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Application Type</p>
                    <p className="font-medium capitalize">{result.studentType} Student</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Stage</p>
                    <p className="font-medium text-primary">
                      {result.stages[result.currentStage - 1]?.name}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Timeline Card */}
              <Card className="p-6 shadow-card">
                <h3 className="text-lg font-semibold mb-6">Application Progress</h3>
                <ProgressTimeline stages={result.stages} currentStage={result.currentStage} />
              </Card>

              {/* Help Text */}
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Need help with your application?{" "}
                  <a href="/faq" className="text-primary hover:underline">
                    Visit our FAQ
                  </a>{" "}
                  or contact support at{" "}
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
              <h3 className="font-semibold text-foreground mb-2">Demo Tracking Numbers</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Try these sample tracking numbers to see the tracking system in action:
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
