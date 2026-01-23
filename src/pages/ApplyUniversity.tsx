import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { ParentGuardianForm } from "@/components/application/ParentGuardianForm";
import { UniversityStudentForm } from "@/components/application/UniversityStudentForm";
import { PovertyQuestionnaire } from "@/components/application/PovertyQuestionnaire";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SuccessModal } from "@/components/application/SuccessModal";
import { ApplicationProvider, useApplication } from "@/context/ApplicationContext";
import { GraduationCap } from "lucide-react";

const steps = ["Parent Info", "Student Info", "Assessment", "Review"];

function ApplicationFormContent() {
  const { currentStep, setCurrentStep, updateData, resetApplication } = useApplication();
  const [showSuccess, setShowSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");

  const handleSuccess = (tracking: string) => {
    setTrackingNumber(tracking);
    updateData({ trackingNumber: tracking });
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    resetApplication();
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      
      <main className="flex-1 py-12">
        <div className="container max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              University/College Bursary Application
            </h1>
            <p className="text-muted-foreground">
              Apply for financial assistance for your higher education
            </p>
          </div>

          {/* Stepper */}
          <ApplicationStepper steps={steps} currentStep={currentStep} />

          {/* Form Card */}
          <Card className="p-6 md:p-8 shadow-card">
            {currentStep === 1 && (
              <ParentGuardianForm onNext={() => setCurrentStep(2)} />
            )}
            {currentStep === 2 && (
              <UniversityStudentForm
                onNext={() => setCurrentStep(3)}
                onBack={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <PovertyQuestionnaire
                onNext={() => setCurrentStep(4)}
                onBack={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 4 && (
              <ReviewSubmit
                onBack={() => setCurrentStep(3)}
                onSuccess={handleSuccess}
              />
            )}
          </Card>

          {/* Help Text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Need help?{" "}
            <a href="/faq" className="text-primary hover:underline">
              View FAQ
            </a>{" "}
            or contact{" "}
            <a href="mailto:support@bursary-ke.go.ke" className="text-primary hover:underline">
              support@bursary-ke.go.ke
            </a>
          </p>
        </div>
      </main>

      <Footer />

      <SuccessModal
        isOpen={showSuccess}
        trackingNumber={trackingNumber}
        onClose={handleCloseSuccess}
      />
    </div>
  );
}

export default function ApplyUniversity() {
  return (
    <ApplicationProvider>
      <ApplicationFormContent />
    </ApplicationProvider>
  );
}
