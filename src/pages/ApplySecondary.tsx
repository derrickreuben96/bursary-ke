import { useEffect, useMemo, useState } from "react";
import { usePersistedStep } from "@/hooks/usePersistedStep";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ApplicationProvider, useApplication } from "@/context/ApplicationContext";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { ParentGuardianForm } from "@/components/application/ParentGuardianForm";
import { EducationLevelSelect } from "@/components/application/EducationLevelSelect";
import { StudentsRepeater } from "@/components/application/StudentsRepeater";
import { PovertyQuestionnaire } from "@/components/application/PovertyQuestionnaire";
import { DocumentUpload } from "@/components/application/DocumentUpload";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SuccessModal } from "@/components/application/SuccessModal";
import { FormAssistant } from "@/components/chat/FormAssistant";
import { Button } from "@/components/ui/button";
import { GraduationCap, Shield, Lock, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Seo } from "@/components/seo/Seo";

const DEFAULT_DOCS = [
  "National ID (Parent/Guardian)",
  "Birth Certificate",
  "School Admission Letter",
  "Fee Structure",
  "Academic Transcripts",
];

type StepKey =
  | "parent"
  | "education"
  | "secondary"
  | "university"
  | "assessment"
  | "documents"
  | "review";

function ApplicationFormContent() {
  const [searchParams] = useSearchParams();
  const advertId = searchParams.get("advert");
  const { data, updateData } = useApplication();
  const [currentStep, setCurrentStep] = usePersistedStep("bursary-ke-apply-secondary-step-v1", 1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [advertTitle, setAdvertTitle] = useState<string | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<string[]>(DEFAULT_DOCS);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const { t } = useI18n();

  // Build the dynamic step flow based on the applicant's Education Level
  // selection. Parent + Education steps always show; student-detail sub-steps
  // are inserted per selection; shared stages (assessment/docs/review) follow.
  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = ["parent", "education"];
    const levels = data.educationLevels;
    if (levels?.secondary) f.push("secondary");
    if (levels?.higherEd) f.push("university");
    f.push("assessment", "documents", "review");
    return f;
  }, [data.educationLevels]);

  const stepLabels: Record<StepKey, string> = {
    parent: t("step.parent_guardian"),
    education: t("step.education_level"),
    secondary: t("step.secondary_student"),
    university: t("step.university_student"),
    assessment: t("step.assessment"),
    documents: t("step.documents"),
    review: t("step.review"),
  };

  const steps = flow.map((k) => stepLabels[k]);
  const activeKey = flow[currentStep - 1] ?? "parent";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertId]);

  const handleSuccess = (tracking: string) => {
    setTrackingNumber(tracking);
    setShowSuccess(true);
  };

  // Mirror ApplyUniversity: dismissing the success modal resets the wizard
  // to step 1 so the (now-cleared) review page never renders with blanks.
  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setCurrentStep(1);
  };


  const goNext = () => setCurrentStep((s) => Math.min(s + 1, flow.length));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // For ReviewSubmit's top-level `studentType` tag: prefer secondary when
  // present (entry route), else university. Per-student type is preserved
  // inside `data.students` and consumed server-side.
  const reviewStudentType: "secondary" | "university" =
    data.educationLevels?.secondary ? "secondary" : "university";

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
            {t("apply.secondary_title")}
          </h1>
          {advertTitle && (
            <p className="text-sm text-primary font-medium mb-1">
              {t("apply.applying_to")} {advertTitle}
            </p>
          )}
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("apply.form_desc")}
          </p>
          <div className="flex justify-center items-center gap-6 mt-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>{t("apply.secure_form")}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>{t("apply.data_encrypted")}</span>
            </div>
            <FormAssistant context="Secondary school bursary application form" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <ApplicationStepper steps={steps} currentStep={currentStep} />
        </div>

        <div className="max-w-2xl mx-auto">
          {activeKey === "parent" && <ParentGuardianForm onNext={goNext} />}
          {activeKey === "education" && (
            <EducationLevelSelect onNext={goNext} onBack={goBack} />
          )}
          {activeKey === "secondary" && (
            <StudentsRepeater defaultType="secondary" onNext={goNext} onBack={goBack} />
          )}
          {activeKey === "university" && (
            <StudentsRepeater defaultType="university" onNext={goNext} onBack={goBack} />
          )}
          {activeKey === "assessment" && (
            <PovertyQuestionnaire onNext={goNext} onBack={goBack} />
          )}
          {activeKey === "documents" && (
            <div className="space-y-6 py-6">
              <DocumentUpload
                requiredDocs={requiredDocs}
                onDocumentsChange={setUploadedDocs}
              />
              <div className="flex justify-between">
                <Button variant="outline" onClick={goBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />{t("apply.back")}
                </Button>
                <Button onClick={goNext}>
                  {t("apply.continue_review")}<ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
          {activeKey === "review" && (
            <ReviewSubmit
              onBack={goBack}
              onSuccess={handleSuccess}
              studentType={reviewStudentType}
            />
          )}
        </div>

        <SuccessModal
          isOpen={showSuccess}
          trackingNumber={trackingNumber}
          onClose={handleCloseSuccess}
          studentType={reviewStudentType}
        />
      </main>
      <Footer />
    </div>
  );
}

export default function ApplySecondary() {
  return (
    <ApplicationProvider>
      <Seo
        title="Apply for a Secondary School Bursary | Bursary-KE"
        description="Submit a secondary school bursary application using your NEMIS ID. Free, secure, and processed within 2–4 weeks."
        path="/apply/secondary"
      />
      <ApplicationFormContent />
    </ApplicationProvider>
  );
}
