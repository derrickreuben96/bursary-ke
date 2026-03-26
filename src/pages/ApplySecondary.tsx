import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ApplicationProvider, useApplication } from "@/context/ApplicationContext";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { ParentGuardianForm } from "@/components/application/ParentGuardianForm";
import { SecondaryStudentForm } from "@/components/application/SecondaryStudentForm";
import { PovertyQuestionnaire } from "@/components/application/PovertyQuestionnaire";
import { DocumentUpload } from "@/components/application/DocumentUpload";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SuccessModal } from "@/components/application/SuccessModal";
import { FormAssistant } from "@/components/chat/FormAssistant";
import { Button } from "@/components/ui/button";
import { GraduationCap, Shield, Lock, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const steps = ["Parent/Guardian", "Student Info", "Assessment", "Documents", "Review"];

const DEFAULT_DOCS = [
  "National ID (Parent/Guardian)",
  "Birth Certificate",
  "School Admission Letter",
  "Fee Structure",
  "Academic Transcripts",
];

function ApplicationFormContent() {
  const [searchParams] = useSearchParams();
  const advertId = searchParams.get("advert");
  const { updateData } = useApplication();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [advertTitle, setAdvertTitle] = useState<string | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<string[]>(DEFAULT_DOCS);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);

  useEffect(() => {
    if (advertId) {
      updateData({ advertId });
      supabase
        .from("bursary_adverts")
        .select("title, county, required_documents")
        .eq("id", advertId)
        .single()
        .then(({ data }) => {
          if (data) {
            setAdvertTitle(`${data.county} - ${data.title}`);
            if (data.required_documents?.length) {
              setRequiredDocs(data.required_documents);
            }
          }
        });
    }
  }, [advertId]);

  const handleSuccess = (tracking: string) => {
    setTrackingNumber(tracking);
    setShowSuccess(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      <Header />
      <main className="flex-1 container py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Secondary School Bursary Application
          </h1>
          {advertTitle && (
            <p className="text-sm text-primary font-medium mb-1">
              Applying to: {advertTitle}
            </p>
          )}
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Complete the form below to apply for educational funding. Your information is encrypted and protected.
          </p>
          <div className="flex justify-center items-center gap-6 mt-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Secure Form</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>Data Encrypted</span>
            </div>
            <FormAssistant context="Secondary school bursary application form" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <ApplicationStepper steps={steps} currentStep={currentStep} />
        </div>

        <div className="max-w-2xl mx-auto">
          {currentStep === 1 && (
            <ParentGuardianForm onNext={() => setCurrentStep(2)} />
          )}
          {currentStep === 2 && (
            <SecondaryStudentForm 
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
            <div className="space-y-6 py-6">
              <DocumentUpload
                requiredDocs={requiredDocs}
                onDocumentsChange={setUploadedDocs}
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />Back
                </Button>
                <Button onClick={() => setCurrentStep(5)}>
                  Continue to Review<ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          {currentStep === 5 && (
            <ReviewSubmit 
              onBack={() => setCurrentStep(4)} 
              onSuccess={handleSuccess}
              studentType="secondary"
            />
          )}
        </div>

        <SuccessModal
          isOpen={showSuccess}
          trackingNumber={trackingNumber}
          onClose={() => setShowSuccess(false)}
        />
      </main>
      <Footer />
    </div>
  );
}

export default function ApplySecondary() {
  return (
    <ApplicationProvider>
      <ApplicationFormContent />
    </ApplicationProvider>
  );
}
