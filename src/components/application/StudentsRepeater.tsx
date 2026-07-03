import { useState, useId } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GraduationCap, ArrowLeft, ArrowRight, AlertCircle, Loader2, Check, School, Upload, ShieldCheck } from "lucide-react";
import { useApplication, type StudentEntry } from "@/context/ApplicationContext";
import { useToast } from "@/hooks/use-toast";
import { lookupNemisId, validateNemisFormat, formatNemisId } from "@/lib/nemisApi";
import { maskName } from "@/lib/maskData";
import { kenyanInstitutions, kenyanCourses } from "@/lib/mockData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


interface Props {
  onNext: () => void;
  onBack: () => void;
  defaultType: "secondary" | "university";
}

const MAX_STUDENTS = 3;
const newStudent = (defaultType: "secondary" | "university"): StudentEntry => ({
  id: crypto.randomUUID(),
  studentType: defaultType,
  educationCategory: defaultType === "secondary" ? "high_school" : "university",
  studentName: "",
  identifier: "",
  institution: "",
  admissionNumber: "",
  classForm: "",
  yearOfStudy: "",
  course: "",
});

export function StudentsRepeater({ onNext, onBack, defaultType }: Props) {
  const { data, updateData } = useApplication();
  const instListId = useId();
  const courseListId = useId();

  const { toast } = useToast();
  const isSecondary = defaultType === "secondary";
  const [students, setStudents] = useState<StudentEntry[]>(
    data.students && data.students.length > 0 ? data.students : [newStudent(defaultType)]
  );
  const [lookupState, setLookupState] = useState<Record<string, { loading: boolean; error?: string; verified?: boolean }>>({});

  const [dvlUploading, setDvlUploading] = useState<Record<string, boolean>>({});

  const update = (id: string, patch: Partial<StudentEntry>) =>
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const uploadDisabilityCard = async (studentId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 5 MB." });
      return;
    }
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast({ variant: "destructive", title: "Unsupported format", description: "Use JPG, PNG, or PDF." });
      return;
    }
    setDvlUploading((p) => ({ ...p, [studentId]: true }));
    const key = `ncpwd/${studentId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("applicant-documents").upload(key, file, { upsert: false });
    setDvlUploading((p) => ({ ...p, [studentId]: false }));
    if (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message });
      return;
    }
    update(studentId, { disabilityCardUrl: key });
    toast({ title: "Card uploaded", description: "NCPWD verification document received." });
  };

  const handleNemisChange = async (id: string, raw: string) => {
    const value = raw.replace(/\D/g, "").slice(0, 11);
    update(id, { identifier: value, studentName: "", institution: "" });
    setLookupState((p) => ({ ...p, [id]: { loading: false, verified: false } }));

    if (value.length < 11) return;

    const fmt = validateNemisFormat(value);
    if (!fmt.isValid) {
      setLookupState((p) => ({ ...p, [id]: { loading: false, error: fmt.error } }));
      return;
    }

    setLookupState((p) => ({ ...p, [id]: { loading: true } }));
    const res = await lookupNemisId(value);
    if (res.success && res.data) {
      update(id, { studentName: res.data.studentName, institution: res.data.schoolName });
      setLookupState((p) => ({ ...p, [id]: { loading: false, verified: true } }));
    } else {
      setLookupState((p) => ({ ...p, [id]: { loading: false, error: res.error } }));
    }
  };

  const add = () => {
    if (students.length >= MAX_STUDENTS) return;
    setStudents((prev) => [...prev, newStudent(defaultType)]);
  };

  const remove = (id: string) => {
    if (students.length <= 1) return;
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setLookupState((p) => { const { [id]: _, ...rest } = p; return rest; });
  };

  const handleNext = () => {
    const ids = new Set<string>();
    for (const s of students) {
      // For university students the admission number IS the identifier going forward.
      const universityId = (s.admissionNumber || s.identifier || "").trim();
      const idOk = isSecondary ? s.identifier.trim() : universityId;
      if (!s.studentName.trim() || !idOk || !s.institution.trim()) {
        toast({
          variant: "destructive",
          title: "Missing student info",
          description: isSecondary
            ? "Each student needs a verified NEMIS ID."
            : "Each student needs a name, admission number, and institution.",
        });
        return;
      }
      if (isSecondary && s.identifier.length !== 11) {
        toast({ variant: "destructive", title: "Invalid NEMIS ID", description: "NEMIS ID must be 11 digits." });
        return;
      }
      const k = (isSecondary ? s.identifier : universityId).trim().toUpperCase();
      if (ids.has(k)) {
        toast({
          variant: "destructive",
          title: isSecondary ? "Duplicate NEMIS ID" : "Duplicate Admission Number",
          description: `${isSecondary ? formatNemisId(k) : k} appears more than once. Each student must be unique.`,
        });
        return;
      }
      ids.add(k);

      // DVL: if the user declared *any* disability field, require the full triple.
      const declaredDisability = Boolean(s.ncpwdRegistrationNumber || s.disabilityType || s.disabilityCardUrl);
      if (declaredDisability) {
        if (!s.ncpwdRegistrationNumber?.trim() || !s.disabilityType?.trim() || !s.disabilityCardUrl?.trim()) {
          toast({
            variant: "destructive",
            title: "Disability verification incomplete",
            description: `Student ${s.studentName || ""}: NCPWD number, disability type, and card upload are all required.`,
          });
          return;
        }
        if (!/^[A-Z0-9/\-]{4,24}$/.test(s.ncpwdRegistrationNumber.trim())) {
          toast({
            variant: "destructive",
            title: "Invalid NCPWD number",
            description: "Use only letters, numbers, dashes and slashes (4–24 chars).",
          });
          return;
        }
      }

    // Ensure university identifier == admission number for downstream services.
    const normalized = students.map((s) =>
      s.studentType === "university"
        ? { ...s, identifier: (s.admissionNumber || s.identifier).trim(), admissionNumber: (s.admissionNumber || s.identifier).trim() }
        : s,
    );

    const first = normalized[0];
    updateData({
      students: normalized,
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
            {isSecondary
              ? "Add up to 3 secondary students. Enter NEMIS ID to auto-fill name & school."
              : "Add up to 3 students under this single application."}
          </p>
        </div>
      </div>

      {students.map((s, idx) => {
        const ls: { loading?: boolean; error?: string; verified?: boolean } = lookupState[s.id] || {};
        return (
          <Card key={s.id} className="p-5 space-y-4 shadow-card">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Student {idx + 1}</h4>
              {students.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(s.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Remove
                </Button>
              )}
            </div>

            {isSecondary ? (
              <div className="space-y-4">
                <div>
                  <Label>NEMIS ID *</Label>
                  <div className="relative">
                    <Input
                      value={formatNemisId(s.identifier)}
                      onChange={(e) => handleNemisChange(s.id, e.target.value)}
                      placeholder="CCC-NNNN-SSSS"
                      maxLength={13}
                      inputMode="numeric"
                      aria-label="NEMIS ID"
                      className={cn("font-mono tracking-wider", ls.error && "border-destructive", ls.loading && "pr-10")}
                    />
                    {ls.loading && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: CCC-NNNN-SSSS (County–School–Student)
                    {s.identifier.length > 0 && s.identifier.length < 11 && (
                      <span className="ml-2">({s.identifier.length}/11 digits)</span>
                    )}
                  </p>
                  {ls.error && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" /> <span>{ls.error}</span>
                    </div>
                  )}
                </div>

                {ls.verified && s.studentName && (
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1 animate-in fade-in-50">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Check className="h-4 w-4 text-primary" /> Verified via NEMIS
                    </div>
                    <p className="font-semibold">{maskName(s.studentName)}</p>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <School className="h-4 w-4" /> {s.institution}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Class / Form</Label>
                  <Select value={s.classForm || ""} onValueChange={(v) => update(s.id, { classForm: v })}>
                    <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
                    <SelectContent>
                      {["Form 1", "Form 2", "Form 3", "Form 4"].map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    NEMIS ID is the universal admission number — no separate admission number required.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Education Level *</Label>
                  <Select
                    value={s.educationCategory || "university"}
                    onValueChange={(v) => update(s.id, { educationCategory: v as StudentEntry["educationCategory"] })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="college">College</SelectItem>
                      <SelectItem value="tvet">TVET</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This routes your application into the correct assessment pipeline (Higher Education).
                  </p>
                </div>
                <div>
                  <Label>Full Name *</Label>
                  <Input value={s.studentName} onChange={(e) => update(s.id, { studentName: e.target.value })} placeholder="Student full name" />
                </div>
                <div>
                  <Label>Admission Number *</Label>
                  <Input
                    value={s.admissionNumber || ""}
                    onChange={(e) => update(s.id, { admissionNumber: e.target.value, identifier: e.target.value })}
                    placeholder="e.g. CS/123/2024"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the admission number issued by your institution.
                  </p>
                </div>
                <div>
                  <Label>Institution *</Label>
                  <Input
                    list={instListId}
                    value={s.institution}
                    onChange={(e) => update(s.id, { institution: e.target.value })}
                    placeholder="Start typing — e.g. University of Nairobi"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label>Year of Study</Label>
                  <Select value={s.yearOfStudy || ""} onValueChange={(v) => update(s.id, { yearOfStudy: v })}>
                    <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {["Year 1","Year 2","Year 3","Year 4","Year 5","Year 6"].map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Course / Program</Label>
                  <Input
                    list={courseListId}
                    value={s.course || ""}
                    onChange={(e) => update(s.id, { course: e.target.value })}
                    placeholder="Start typing — e.g. Bachelor of Science in Computer Science"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* Disability Verification Layer (DVL) — optional per student */}
            <div className="rounded-lg border border-dashed p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium m-0">Registered disability (NCPWD)</Label>
                </div>
                <Switch
                  checked={Boolean(s.ncpwdRegistrationNumber || s.disabilityType || s.disabilityCardUrl)}
                  onCheckedChange={(on) => {
                    if (!on) {
                      update(s.id, { ncpwdRegistrationNumber: "", disabilityType: "", disabilityCardUrl: "" });
                    } else {
                      update(s.id, { disabilityType: s.disabilityType || "physical" });
                    }
                  }}
                />
              </div>
              {(s.ncpwdRegistrationNumber || s.disabilityType || s.disabilityCardUrl) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">NCPWD Registration Number *</Label>
                    <Input
                      value={s.ncpwdRegistrationNumber || ""}
                      onChange={(e) => update(s.id, { ncpwdRegistrationNumber: e.target.value.toUpperCase().slice(0, 24) })}
                      placeholder="e.g. NCPWD/2024/12345"
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Disability Type *</Label>
                    <Select
                      value={s.disabilityType || ""}
                      onValueChange={(v) => update(s.id, { disabilityType: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="visual">Visual</SelectItem>
                        <SelectItem value="hearing">Hearing</SelectItem>
                        <SelectItem value="intellectual">Intellectual</SelectItem>
                        <SelectItem value="multiple">Multiple</SelectItem>
                        <SelectItem value="albinism">Albinism</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">NCPWD Card Upload * (JPG, PNG, or PDF, ≤5 MB)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadDisabilityCard(s.id, f);
                          e.currentTarget.value = "";
                        }}
                        disabled={dvlUploading[s.id]}
                      />
                      {dvlUploading[s.id] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {s.disabilityCardUrl && (
                      <p className="text-xs text-primary mt-1 flex items-center gap-1">
                        <Check className="h-3 w-3" /> Card uploaded — awaiting verification.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {!isSecondary && (
        <>
          <datalist id={instListId}>
            {kenyanInstitutions.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <datalist id={courseListId}>
            {kenyanCourses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </>
      )}


      <div className="flex flex-col items-start gap-2">
        <Button type="button" variant="outline" onClick={add} disabled={atMax} className="hover:scale-[1.02] transition-transform">
          <Plus className="h-4 w-4 mr-1" /> Add another student
        </Button>
        {atMax && (
          <p className="text-xs flex items-center gap-1 text-muted-foreground">
            <AlertCircle className="h-3 w-3" /> Maximum of 3 students allowed per application.
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
