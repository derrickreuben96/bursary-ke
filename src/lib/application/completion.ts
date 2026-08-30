/**
 * Document Intelligence — application completion model.
 *
 * Produces a 0-100 completion percentage for the multi-step bursary
 * application so the applicant always sees how far along they are, and which
 * section still needs attention. The model is intentionally pure (no React,
 * no network) so it can be unit-tested and reused by any step.
 *
 * Weighting rationale: each *wizard stage* carries a weight, and inside a
 * stage every required field contributes an equal share of that weight. That
 * means typing the guardian's full name immediately nudges the bar (~5-10%)
 * rather than waiting for a whole step to be submitted.
 */

import type { ApplicationData, StudentEntry } from "@/context/ApplicationContext";

export interface CompletionSection {
  key: string;
  label: string;
  /** 0..1 */
  ratio: number;
  weight: number;
  filled: number;
  total: number;
}

export interface CompletionResult {
  /** 0..100, rounded */
  percent: number;
  sections: CompletionSection[];
  /** First section that is not fully complete (used for the hint text). */
  nextSection?: CompletionSection;
}

export interface LiveParentFields {
  fullName?: string;
  nationalId?: string;
  phoneNumber?: string;
  email?: string;
  county?: string;
  ward?: string;
  selectedAdvertId?: string;
}

export interface CompletionInput {
  data: ApplicationData;
  /** Values currently typed into the parent step but not yet committed. */
  liveParent?: LiveParentFields;
  /** Uncommitted student-step entries (live typing on the students step). */
  liveStudents?: StudentEntry[];
  requiredDocsCount?: number;
  uploadedDocsCount?: number;
}

const nonEmpty = (v: unknown) =>
  typeof v === "string" ? v.trim().length > 0 : v !== undefined && v !== null && v !== false;

function ratio(filled: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, filled / total));
}

function studentFilled(s: StudentEntry): { filled: number; total: number } {
  const required: unknown[] =
    s.studentType === "secondary"
      ? [s.studentName, s.identifier, s.institution, s.classForm]
      : [s.studentName, s.identifier, s.institution, s.yearOfStudy];
  return { filled: required.filter(nonEmpty).length, total: required.length };
}

export function computeCompletion(input: CompletionInput): CompletionResult {
  const { data, liveParent, liveStudents, requiredDocsCount = 0, uploadedDocsCount = 0 } = input;

  // ---- Guardian ------------------------------------------------------
  const parent = { ...(data.parentGuardian ?? {}), ...(liveParent ?? {}) } as LiveParentFields;
  const parentRequired = [
    parent.fullName,
    parent.nationalId,
    parent.phoneNumber,
    parent.county,
    parent.ward,
    parent.selectedAdvertId,
  ];
  const parentSection: CompletionSection = {
    key: "parent",
    label: "Guardian details",
    weight: 30,
    filled: parentRequired.filter(nonEmpty).length,
    total: parentRequired.length,
    ratio: ratio(parentRequired.filter(nonEmpty).length, parentRequired.length),
  };

  // ---- Education level ------------------------------------------------
  const levels = data.educationLevels;
  const eduPicked = !!(levels && (levels.secondary || levels.higherEd));
  const eduSection: CompletionSection = {
    key: "education",
    label: "Education level",
    weight: 10,
    filled: eduPicked ? 1 : 0,
    total: 1,
    ratio: eduPicked ? 1 : 0,
  };

  // ---- Students --------------------------------------------------------
  const committed = data.students ?? [];
  // Live entries replace committed entries of the same education type so the
  // meter reacts while the applicant types, before the step is submitted.
  const liveTypes = new Set((liveStudents ?? []).map((s) => s.studentType));
  const students =
    liveStudents && liveStudents.length > 0
      ? [...committed.filter((s) => !liveTypes.has(s.studentType)), ...liveStudents]
      : committed;
  const expectedTypes: Array<"secondary" | "university"> = [];
  if (levels?.secondary) expectedTypes.push("secondary");
  if (levels?.higherEd) expectedTypes.push("university");

  let sFilled = 0;
  let sTotal = 0;
  if (students.length > 0) {
    for (const s of students) {
      const r = studentFilled(s);
      sFilled += r.filled;
      sTotal += r.total;
    }
  }
  // Any selected level with no student yet still counts as outstanding work.
  for (const t of expectedTypes) {
    if (!students.some((s) => s.studentType === t)) sTotal += 4;
  }
  if (sTotal === 0) sTotal = 4;
  const studentSection: CompletionSection = {
    key: "students",
    label: "Student details",
    weight: 25,
    filled: sFilled,
    total: sTotal,
    ratio: ratio(sFilled, sTotal),
  };

  // ---- Assessment ------------------------------------------------------
  const answers = (data.povertyQuestionnaire as Record<string, unknown> | undefined) ?? undefined;
  const answerCount = answers ? Object.values(answers).filter(nonEmpty).length : 0;
  const assessmentDone = answerCount > 0;
  const assessmentSection: CompletionSection = {
    key: "assessment",
    label: "Household assessment",
    weight: 20,
    filled: assessmentDone ? 1 : 0,
    total: 1,
    ratio: assessmentDone ? 1 : 0,
  };

  // ---- Documents -------------------------------------------------------
  const docTotal = Math.max(1, requiredDocsCount);
  const docSection: CompletionSection = {
    key: "documents",
    label: "Supporting documents",
    weight: 15,
    filled: Math.min(uploadedDocsCount, docTotal),
    total: docTotal,
    ratio: ratio(uploadedDocsCount, docTotal),
  };

  const sections = [parentSection, eduSection, studentSection, assessmentSection, docSection];
  const totalWeight = sections.reduce((a, s) => a + s.weight, 0);
  const score = sections.reduce((a, s) => a + s.ratio * s.weight, 0);

  return {
    percent: Math.round((score / totalWeight) * 100),
    sections,
    nextSection: sections.find((s) => s.ratio < 1),
  };
}
