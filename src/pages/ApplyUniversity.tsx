import { useEffect, useMemo, useState } from "react";
import { usePersistedStep } from "@/hooks/usePersistedStep";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApplicationStepper } from "@/components/application/ApplicationStepper";
import { ParentGuardianForm } from "@/components/application/ParentGuardianForm";
import { EducationLevelSelect } from "@/components/application/EducationLevelSelect";
import { StudentsRepeater } from "@/components/application/StudentsRepeater";
import { PovertyQuestionnaire } from "@/components/application/PovertyQuestionnaire";
import { DocumentUpload } from "@/components/application/DocumentUpload";
import { ReviewSubmit } from "@/components/application/ReviewSubmit";
import { SuccessModal } from "@/components/application/SuccessModal";
import { LeaveApplicationGuard } from "@/components/application/LeaveApplicationGuard";
import { ApplicationProvider, useApplication } from "@/context/ApplicationContext";
import { FormAssistant } from "@/components/chat/FormAssistant";
import { GraduationCap, ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Seo } from "@/components/seo/Seo";

const DEFAULT_DOCS = [
  "National ID (Parent/Guardian)",
  "Birth Certificate",
  "University/College Admission Letter",
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
  const { data, updateData, resetApplication } = useApplication();
  const [currentStep, setCurrentStep] = usePersistedStep("bursary-ke-apply-university-step-v1", 1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const { t } = useI18n();

  // Dynamic step flow driven by the Education Level selection.
  const flow = useMemo<StepKey[]>(() => {
    const f: StepKey[] = ["parent", "education"];
    const levels = data.educationLevels;
    if (levels?.secondary) f.push("secondary");
    if (levels?.higherEd) f.push("university");
    f.push("assessment", "documents", "review");
    return f;
  }, [data.educationLevels]);

  const stepLabels: Record<StepKey, string> = {
    parent: t("step.parent_info"),
    education: t("step.education_level"),
    secondary: t("step.secondary_student"),
    university: t("step.university_student"),
    assessment: t("step.assessment"),
    documents: t("step.documents"),
    review: t("step.review"),
  };

  const steps = flow.map((k) => stepLabels[k]);
  const activeKey = flow[currentStep - 1] ?? "parent";

  // Guard: if sessionStorage restores a step whose prerequisites are
  // missing (empty parent form, unset education level, no student added),
  // snap back so the applicant never skips Education Level → Student.
  useEffect(() => {
    const idxOf = (k: StepKey) => flow.indexOf(k);
    if (currentStep > 1 && !data.parentGuardian) {
      setCurrentStep(1);
      return;
    }
    const eduIdx = idxOf("education");
    if (eduIdx >= 0 && currentStep > eduIdx + 1 && !data.educationLevels) {
      setCurrentStep(eduIdx + 1);
      return;
    }
    const needsSecondary = data.educationLevels?.secondary;
    const needsHigher = data.educationLevels?.higherEd;
    const hasSecondaryStudent = (data.students || []).some((s) => s.studentType === "secondary");
    const hasHigherStudent = (data.students || []).some((s) => s.studentType === "university");
    const secIdx = idxOf("secondary");
    const uniIdx = idxOf("university");
    if (needsSecondary && secIdx >= 0 && currentStep > secIdx + 1 && !hasSecondaryStudent) {
      setCurrentStep(secIdx + 1);
      return;
    }
    if (needsHigher && uniIdx >= 0 && currentStep > uniIdx + 1 && !hasHigherStudent) {
      setCurrentStep(uniIdx + 1);
    }
  }, [currentStep, flow, data.parentGuardian, data.educationLevels, data.students, setCurrentStep]);


  const goNext = () => setCurrentStep((s) => Math.min(s + 1, flow.length));
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const handleSuccess = (tracking: string) => {
    setTrackingNumber(tracking);
    updateData({ trackingNumber: tracking });
    setShowSuccess(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    resetApplication();
    setCurrentStep(1);
  };

  // If both cohorts are selected we keep the top-level `studentType` tag as
  // "university" for this entry route; per-student types remain accurate.
  const reviewStudentType: "secondary" | "university" =
    data.educationLevels?.higherEd ? "university" : "secondary";

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
              <div className="space-y-6">
                <DocumentUpload
                  requiredDocs={DEFAULT_DOCS}
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
        studentType={reviewStudentType}
      />
    </div>
  );
}

export default function ApplyUniversity() {
  return (
    <ApplicationProvider>
      <Seo
        title="Apply for a University Bursary | Bursary-KE"
        description="Apply for a university or college bursary in Kenya. Use your Student ID and household details — fully online and tracked in real time."
        path="/apply/university"
      />
      <ApplicationFormContent />
    </ApplicationProvider>
  );
}
