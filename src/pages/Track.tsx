import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProgressTimeline } from "@/components/tracking/ProgressTimeline";
import { Search, AlertCircle, Loader2, FileSearch, GraduationCap, School } from "lucide-react";
import { isValidTrackingNumber } from "@/lib/maskData";
import { lookupApplication, type TrackingResult } from "@/lib/applicationService";
import { sampleTrackingData, type TrackingInfo } from "@/lib/mockData";

export default function Track() {
  const [searchParams] = useSearchParams();
  const initialNumber = searchParams.get("number") || "";
  
  const [trackingNumber, setTrackingNumber] = useState(initialNumber);
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

    setIsLoading(true);

    try {
      // First try to lookup in database
      const dbResult = await lookupApplication(normalizedNumber);
      
      if (dbResult) {
        // Convert database result to TrackingInfo format
        setResult({
          trackingNumber: dbResult.trackingNumber,
          studentType: dbResult.studentType,
          currentStage: dbResult.stages.findIndex(s => s.status === "current") + 1 || 1,
          stages: dbResult.stages,
        });
      } else {
        // Fallback to sample data for demo
        const sampleData = sampleTrackingData[normalizedNumber];
        if (sampleData) {
          setResult(sampleData);
        } else {
          setNotFound(true);
        }
      }
    } catch (err) {
      console.error("Tracking lookup error:", err);
      // Fallback to sample data
      const sampleData = sampleTrackingData[normalizedNumber];
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
              Enter your tracking number to see the current status of your bursary application
            </p>
          </div>

          {/* Search Card */}
          <Card className="p-6 mb-8 shadow-card">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter tracking number (e.g., BKE-ABC123)"
                  value={trackingNumber}
                  onChange={(e) => {
                    setTrackingNumber(e.target.value.toUpperCase());
                    setError("");
                    setNotFound(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                  className="h-12 text-base"
                />
              </div>
              <Button
                onClick={handleTrack}
                disabled={isLoading}
                className="h-12 px-8 hover:scale-105 transition-transform"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Track
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
                We couldn't find an application with tracking number{" "}
                <span className="font-mono font-semibold">{trackingNumber}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Please check your tracking number and try again. If you believe this is an error,{" "}
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
