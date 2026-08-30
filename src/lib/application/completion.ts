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
  /** Plain-language explanation of what raises the meter in this section. */
  hint: string;
  /** Named items still outstanding in this section. */
  missing: string[];
}

/** Non-colour indicator of the completion band (shape + text + symbol). */
export interface CompletionLevel {
  key: "empty" | "started" | "halfway" | "nearly" | "complete";
  label: string;
  /** Text symbol usable without relying on colour. */
  symbol: string;
  /** Filled blocks out of 4, for a text/shape based gauge. */
  steps: number;
}

export interface CompletionResult {
  /** 0..100, rounded */
  percent: number;
  sections: CompletionSection[];
  /** First section that is not fully complete (used for the hint text). */
  nextSection?: CompletionSection;
  /** Non-colour completion band. */
  level: CompletionLevel;
  /** Flat, ordered list of what is still outstanding across all sections. */
  remaining: Array<{ sectionKey: string; sectionLabel: string; item: string }>;
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

function studentFilled(s: StudentEntry): { filled: number; total: number; missing: string[] } {
  const required: Array<[string, unknown]> =
    s.studentType === "secondary"
      ? [
          ["Student name", s.studentName],
          ["NEMIS ID", s.identifier],
          ["School", s.institution],
          ["Class / Form", s.classForm],
        ]
      : [
          ["Student name", s.studentName],
          ["Student ID", s.identifier],
          ["Institution", s.institution],
          ["Year of study", s.yearOfStudy],
        ];
  const missing = required.filter(([, v]) => !nonEmpty(v)).map(([k]) => k);
  return { filled: required.length - missing.length, total: required.length, missing };
}

function levelFor(percent: number): CompletionLevel {
  if (percent <= 0) return { key: "empty", label: "Not started", symbol: "○", steps: 0 };
  if (percent < 40) return { key: "started", label: "Just started", symbol: "◔", steps: 1 };
  if (percent < 70) return { key: "halfway", label: "Halfway there", symbol: "◑", steps: 2 };
  if (percent < 100) return { key: "nearly", label: "Almost done", symbol: "◕", steps: 3 };
  return { key: "complete", label: "Ready to submit", symbol: "●", steps: 4 };
}

export function computeCompletion(input: CompletionInput): CompletionResult {
  const { data, liveParent, liveStudents, requiredDocsCount = 0, uploadedDocsCount = 0 } = input;

  // ---- Guardian ------------------------------------------------------
  const parent = { ...(data.parentGuardian ?? {}), ...(liveParent ?? {}) } as LiveParentFields;
  const parentRequired: Array<[string, unknown]> = [
    ["Full name", parent.fullName],
    ["National ID", parent.nationalId],
    ["Phone number", parent.phoneNumber],
    ["County", parent.county],
    ["Ward", parent.ward],
    ["Bursary advert", parent.selectedAdvertId],
  ];
  const parentMissing = parentRequired.filter(([, v]) => !nonEmpty(v)).map(([k]) => k);
  const parentSection: CompletionSection = {
    key: "parent",
    label: "Guardian details",
    weight: 30,
    filled: parentRequired.length - parentMissing.length,
    total: parentRequired.length,
    ratio: ratio(parentRequired.length - parentMissing.length, parentRequired.length),
    hint: "Each guardian field you complete — name, National ID, phone, county, ward and the bursary you are applying to — adds about 5% to the meter.",
    missing: parentMissing,
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
    hint: "Choosing Secondary, University/College or Both adds 10% and decides which student steps appear next.",
    missing: eduPicked ? [] : ["Choose Secondary, University/College or Both"],
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
  const studentMissing: string[] = [];
  if (students.length > 0) {
    students.forEach((s, i) => {
      const r = studentFilled(s);
      sFilled += r.filled;
      sTotal += r.total;
      for (const m of r.missing) {
        studentMissing.push(`Student ${i + 1}: ${m}`);
      }
    });
  }
  // Any selected level with no student yet still counts as outstanding work.
  for (const t of expectedTypes) {
    if (!students.some((s) => s.studentType === t)) {
      sTotal += 4;
      studentMissing.push(
        t === "secondary" ? "Add a secondary school student" : "Add a university/college student"
      );
    }
  }
  if (sTotal === 0) {
    sTotal = 4;
    if (studentMissing.length === 0) studentMissing.push("Add at least one student");
  }
  const studentSection: CompletionSection = {
    key: "students",
    label: "Student details",
    weight: 25,
    filled: sFilled,
    total: sTotal,
    ratio: ratio(sFilled, sTotal),
    hint: "Adding each student and filling their name, ID, institution and class/year moves the meter — this stage is worth 25% in total.",
    missing: studentMissing,
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
    hint: "Completing the household assessment questions adds 20%. Answers must be consistent before you can continue.",
    missing: assessmentDone ? [] : ["Answer the household assessment questions"],
  };

  // ---- Documents -------------------------------------------------------
  const docTotal = Math.max(1, requiredDocsCount);
  const uploaded = Math.min(uploadedDocsCount, docTotal);
  const docSection: CompletionSection = {
    key: "documents",
    label: "Supporting documents",
    weight: 15,
    filled: uploaded,
    total: docTotal,
    ratio: ratio(uploadedDocsCount, docTotal),
    hint: `Each supporting document you upload adds an equal share of 15% (${docTotal} required in total).`,
    missing:
      uploaded >= docTotal
        ? []
        : [`Upload ${docTotal - uploaded} more supporting document${docTotal - uploaded === 1 ? "" : "s"}`],
  };

  const sections = [parentSection, eduSection, studentSection, assessmentSection, docSection];
  const totalWeight = sections.reduce((a, s) => a + s.weight, 0);
  const score = sections.reduce((a, s) => a + s.ratio * s.weight, 0);
  const percent = Math.round((score / totalWeight) * 100);

  const remaining = sections.flatMap((s) =>
    s.missing.map((item) => ({ sectionKey: s.key, sectionLabel: s.label, item }))
  );

  return {
    percent,
    sections,
    nextSection: sections.find((s) => s.ratio < 1),
    level: levelFor(percent),
    remaining,
  };
}
