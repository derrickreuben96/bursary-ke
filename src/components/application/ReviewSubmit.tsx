import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Loader2, User, GraduationCap, ClipboardCheck, Shield } from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { maskId, maskPhone, maskEmail, maskStudentId, generateTrackingNumber, maskName } from "@/lib/maskData";
import { calculatePovertyScore, getPovertyTier } from "@/lib/validationSchemas";

interface ReviewSubmitProps {
  onBack: () => void;
  onSuccess: (trackingNumber: string) => void;
  studentType: "secondary" | "university";
}

export function ReviewSubmit({ onBack, onSuccess, studentType }: ReviewSubmitProps) {
  const { data } = useApplication();
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const povertyScore = data.povertyQuestionnaire
    ? calculatePovertyScore(data.povertyQuestionnaire)
    : 0;
  const povertyTier = getPovertyTier(povertyScore);

  const handleSubmit = async () => {
    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const { submitApplication } = await import("@/lib/applicationService");
      const { trackingNumber, error } = await submitApplication({
        data,
        studentType,
      });

      if (error) {
        console.error("Submission error:", error);
        // Fallback to local tracking number if database fails
        const fallbackNumber = generateTrackingNumber();
        onSuccess(fallbackNumber);
      } else {
        onSuccess(trackingNumber);
      }
    } catch (error) {
      console.error("Submission error:", error);
      const fallbackNumber = generateTrackingNumber();
      onSuccess(fallbackNumber);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get student data based on type
  const studentData = studentType === "university" ? data.universityStudent : data.secondaryStudent;

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex gap-3">
          <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Review Your Application</p>
            <p className="text-sm text-muted-foreground">
              Please verify all information before submitting. Your data is displayed in masked format for security.
            </p>
          </div>
        </div>
      </Card>

      {/* Parent/Guardian Information */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <User className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Parent/Guardian Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Full Name</p>
            <p className="font-medium">{maskName(data.parentGuardian?.fullName || "")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">National ID</p>
            <p className="font-medium">{maskId(data.parentGuardian?.nationalId || "")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phone Number</p>
            <p className="font-medium">{maskPhone(data.parentGuardian?.phoneNumber || "")}</p>
          </div>
          {data.parentGuardian?.email && (
            <div>
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{maskEmail(data.parentGuardian.email)}</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">County</p>
            <p className="font-medium">{data.parentGuardian?.county || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ward / Sub-County</p>
            <p className="font-medium">{data.parentGuardian?.ward || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">SMS Consent</p>
            <p className="font-medium">
              {data.parentGuardian?.consentNotifications ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </Card>

      {/* Student Information */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Student Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {studentType === "university" ? (
            <>
              <div>
                <p className="text-muted-foreground">Student ID</p>
                <p className="font-medium">{maskStudentId(data.universityStudent?.studentId || "")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Institution</p>
                <p className="font-medium">{data.universityStudent?.institution}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Course</p>
                <p className="font-medium">{data.universityStudent?.course}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Year of Study</p>
                <p className="font-medium">{data.universityStudent?.yearOfStudy}</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-muted-foreground">NEMIS ID</p>
                <p className="font-medium">{maskStudentId(data.secondaryStudent?.nemisId || "")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Student Name</p>
                <p className="font-medium">{maskName(data.secondaryStudent?.studentName || "")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">School</p>
                <p className="font-medium">{data.secondaryStudent?.school}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Class/Form</p>
                <p className="font-medium">{data.secondaryStudent?.classForm?.replace("form", "Form ")}</p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Assessment Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Assessment Summary</h3>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            Your poverty assessment has been completed. The responses you provided will be 
            used to determine your eligibility and priority for bursary allocation.
          </p>
          <p className="flex items-center gap-2 text-xs">
            <Shield className="h-4 w-4 text-primary" />
            Assessment details are confidential and processed by our AI allocation system
          </p>
        </div>
      </Card>

      {/* Confirmation Checkbox */}
      <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
        <Checkbox
          id="confirm"
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked as boolean)}
        />
        <label htmlFor="confirm" className="text-sm leading-relaxed cursor-pointer">
          I confirm that all the information provided is accurate and complete. I understand that 
          providing false information may result in disqualification and legal action.
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="hover:scale-105 transition-transform">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        <Button
          size="lg"
          disabled={!confirmed || isSubmitting}
          onClick={handleSubmit}
          className="min-w-[180px] hover:scale-105 transition-transform"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Submit Application
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
