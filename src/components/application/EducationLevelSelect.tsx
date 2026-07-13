import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, ArrowLeft, ArrowRight, School, BookOpen } from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { cn } from "@/lib/utils";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

/**
 * Step 2 of the application wizard — Education Level Selection.
 * The applicant explicitly declares which cohort(s) they are applying for.
 * The parent wizard uses `data.educationLevels` to compute which
 * student-detail sub-steps to render next (Secondary, Higher Ed, or both).
 */
export function EducationLevelSelect({ onNext, onBack }: Props) {
  const { data, updateData } = useApplication();
  const [secondary, setSecondary] = useState<boolean>(data.educationLevels?.secondary ?? false);
  const [higherEd, setHigherEd] = useState<boolean>(data.educationLevels?.higherEd ?? false);

  const canProceed = secondary || higherEd;

  const handleNext = () => {
    if (!canProceed) return;
    // If the selection changed, drop any previously-collected students of a
    // now-unselected type to keep the wizard state consistent.
    const keep = (data.students || []).filter((s) =>
      s.studentType === "secondary" ? secondary : higherEd,
    );
    updateData({
      educationLevels: { secondary, higherEd },
      students: keep,
    });
    onNext();
  };

  const Option = ({
    checked,
    onToggle,
    icon: Icon,
    title,
    subtitle,
  }: {
    checked: boolean;
    onToggle: (v: boolean) => void;
    icon: typeof School;
    title: string;
    subtitle: string;
  }) => (
    <label
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all",
        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onToggle(Boolean(v))}
        className="mt-1"
      />
      <div className="flex items-center gap-3 flex-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        </div>
      </div>
    </label>
  );

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Education Level</h3>
          <p className="text-sm text-muted-foreground">
            Select all that apply. Do you have child/children applying for bursary in:
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-3 shadow-card">
        <Option
          checked={secondary}
          onToggle={setSecondary}
          icon={School}
          title="Secondary School"
          subtitle="Form 1 – Form 4"
        />
        <Option
          checked={higherEd}
          onToggle={setHigherEd}
          icon={BookOpen}
          title="University / College / TVET / Higher Education"
          subtitle="Diploma, degree, or technical/vocational training"
        />
        {!canProceed && (
          <p className="text-xs text-muted-foreground pl-1">
            Please select at least one option to continue.
          </p>
        )}
      </Card>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button type="button" onClick={handleNext} disabled={!canProceed}>
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
