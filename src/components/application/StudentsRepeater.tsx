import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, GraduationCap, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { useApplication, type StudentEntry } from "@/context/ApplicationContext";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onNext: () => void;
  onBack: () => void;
  defaultType: "secondary" | "university";
}

const MAX_STUDENTS = 3;
const newStudent = (defaultType: "secondary" | "university"): StudentEntry => ({
  id: crypto.randomUUID(),
  studentType: defaultType,
  studentName: "",
  identifier: "",
  institution: "",
  admissionNumber: "",
  classForm: "",
  yearOfStudy: "",
  course: "",
  feeBalance: 0,
});

export function StudentsRepeater({ onNext, onBack, defaultType }: Props) {
  const { data, updateData } = useApplication();
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentEntry[]>(
    data.students && data.students.length > 0 ? data.students : [newStudent(defaultType)]
  );

  const update = (id: string, patch: Partial<StudentEntry>) =>
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const add = () => {
    if (students.length >= MAX_STUDENTS) return;
    setStudents((prev) => [...prev, newStudent(defaultType)]);
  };

  const remove = (id: string) => {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleNext = () => {
    // Validate
    const ids = new Set<string>();
    for (const s of students) {
      if (!s.studentName.trim() || !s.identifier.trim() || !s.institution.trim()) {
        toast({
          variant: "destructive",
          title: "Missing student info",
          description: "Each student needs a name, ID/NEMIS/birth certificate, and institution.",
        });
        return;
      }
      const k = s.identifier.trim().toUpperCase();
      if (ids.has(k)) {
        toast({
          variant: "destructive",
          title: "Duplicate student",
          description: `Student identifier ${k} appears twice. Each student must be unique.`,
        });
        return;
      }
      ids.add(k);
    }
    // Mirror students[0] into legacy single-student fields so other parts of
    // the codebase that still read those keep working.
    const first = students[0];
    updateData({
      students,
      ...(first.studentType === "secondary"
        ? {
            secondaryStudent: {
              nemisId: first.identifier,
              studentName: first.studentName,
              classForm: first.classForm || "",
              school: first.institution,
            },
          }
        : {
            universityStudent: {
              studentId: first.identifier,
              studentName: first.studentName,
              institution: first.institution,
              course: first.course || "",
              yearOfStudy: (first.yearOfStudy as never) || "Year 1",
            },
          }),
    });
    onNext();
  };

  const atMax = students.length >= MAX_STUDENTS;

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Students ({students.length}/3)</h3>
          <p className="text-sm text-muted-foreground">
            Add up to 3 students under this single application.
          </p>
        </div>
      </div>

      {students.map((s, idx) => (
        <Card key={s.id} className="p-5 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">Student {idx + 1}</h4>
            {students.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(s.id)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Student Type *</Label>
              <Select
                value={s.studentType}
                onValueChange={(v) => update(s.id, { studentType: v as StudentEntry["studentType"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="secondary">Secondary School</SelectItem>
                  <SelectItem value="university">University / College</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Full Name *</Label>
              <Input
                value={s.studentName}
                onChange={(e) => update(s.id, { studentName: e.target.value })}
                placeholder="Student full name"
              />
            </div>

            <div>
              <Label>
                {s.studentType === "secondary" ? "NEMIS / Birth Cert No. *" : "Student ID *"}
              </Label>
              <Input
                value={s.identifier}
                onChange={(e) => update(s.id, { identifier: e.target.value })}
                placeholder={s.studentType === "secondary" ? "e.g. 12345678901" : "e.g. CS/123/2024"}
              />
            </div>

            <div>
              <Label>Institution *</Label>
              <Input
                value={s.institution}
                onChange={(e) => update(s.id, { institution: e.target.value })}
                placeholder={s.studentType === "secondary" ? "School name" : "University / College"}
              />
            </div>

            <div>
              <Label>Admission Number</Label>
              <Input
                value={s.admissionNumber || ""}
                onChange={(e) => update(s.id, { admissionNumber: e.target.value })}
                placeholder="Optional"
              />
            </div>

            {s.studentType === "secondary" ? (
              <div>
                <Label>Class / Form</Label>
                <Select
                  value={s.classForm || ""}
                  onValueChange={(v) => update(s.id, { classForm: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                  <SelectContent>
                    {["Form 1", "Form 2", "Form 3", "Form 4"].map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div>
                  <Label>Year of Study</Label>
                  <Select
                    value={s.yearOfStudy || ""}
                    onValueChange={(v) => update(s.id, { yearOfStudy: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {["Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"].map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Course / Program</Label>
                  <Input
                    value={s.course || ""}
                    onChange={(e) => update(s.id, { course: e.target.value })}
                    placeholder="e.g. BSc Computer Science"
                  />
                </div>
              </>
            )}

            <div>
              <Label>Fee Balance (KES)</Label>
              <Input
                type="number"
                min="0"
                value={s.feeBalance ?? 0}
                onChange={(e) => update(s.id, { feeBalance: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </Card>
      ))}

      <div className="flex flex-col items-start gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={atMax}
          className="hover:scale-[1.02] transition-transform"
        >
          <Plus className="h-4 w-4 mr-1" /> Add another student
        </Button>
        {atMax && (
          <p className="text-xs flex items-center gap-1 text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            Maximum of 3 students allowed per application.
          </p>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Button type="button" onClick={handleNext}>
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
