import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { ParentGuardianForm } from "@/components/application/ParentGuardianForm";
import { UniversityStudentForm } from "@/components/application/UniversityStudentForm";
import { PovertyQuestionnaire } from "@/components/application/PovertyQuestionnaire";
import { DocumentUpload } from "@/components/application/DocumentUpload";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SuccessModal } from "@/components/application/SuccessModal";
import { ApplicationProvider, useApplication } from "@/context/ApplicationContext";
import { FormAssistant } from "@/components/chat/FormAssistant";
import { GraduationCap, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const DEFAULT_DOCS = [
  "National ID (Parent/Guardian)",
  "Birth Certificate",
  "University/College Admission Letter",
  "Fee Structure",
  "Academic Transcripts",
];

function ApplicationFormContent() {
  const { currentStep, setCurrentStep, updateData, resetApplication } = useApplication();
  const [showSuccess, setShowSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const { t } = useI18n();

  const steps = [t("step.parent_info"), t("step.student_info"), t("step.assessment"), t("step.documents"), t("step.review")];

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
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t("apply.university_title")}
            </h1>
            <p className="text-muted-foreground mb-4">
              {t("apply.university_subtitle")}
            </p>
            <FormAssistant context="University/College bursary application form" />
          </div>

          <ApplicationStepper steps={steps} currentStep={currentStep} />

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
              <div className="space-y-6">
                <DocumentUpload
                  requiredDocs={DEFAULT_DOCS}
                  onDocumentsChange={setUploadedDocs}
                />
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(3)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />{t("apply.back")}
                  </Button>
                  <Button onClick={() => setCurrentStep(5)}>
                    {t("apply.continue_review")}<ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
            {currentStep === 5 && (
              <ReviewSubmit
                onBack={() => setCurrentStep(4)}
                onSuccess={handleSuccess}
                studentType="university"
              />
            )}
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t("apply.need_help")}{" "}
            <a href="/faq" className="text-primary hover:underline">
              {t("apply.view_faq")}
            </a>{" "}
            {t("apply.or_contact")}{" "}
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
