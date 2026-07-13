/**
 * Assessment Engine
 * -----------------
 * Pure functions that transform an application (parent + students) into an
 * ordered list of assessment sections. The renderer stays presentational;
 * all "which questions apply" logic lives here so it can be unit-tested
 * and eventually swapped for a DB-backed config without UI changes.
 */

import type { StudentEntry, EducationCategory } from "@/context/ApplicationContext";
import {
  assessmentQuestions,
  type AssessmentEducationCategory,
  type AssessmentQuestion,
} from "./config";

export interface RenderedQuestion extends AssessmentQuestion {
  /** Fully-qualified storage key: `engine.<scope>.<qid>` or
   *  `engine.per_student.<qid>::s<studentIndex>`. */
  storageKey: string;
  /** Interpolated question text with student/institution filled in. */
  displayText: string;
}

export interface AssessmentSection {
  /** Stable key for React lists. */
  key: string;
  /** Heading, e.g. "Household" or "Brian Otieno · Kisumu Boys" */
  title: string;
  /** Optional sub-label (e.g. education category). */
  subtitle?: string;
  questions: RenderedQuestion[];
}

/** Basic template interpolation for {studentName} and {institution}. */
function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Map a StudentEntry to its assessment education category. */
function categoryOf(student: StudentEntry): AssessmentEducationCategory {
  if (student.educationCategory) return student.educationCategory as AssessmentEducationCategory;
  // Fall back to legacy studentType
  return (student.studentType === "secondary" ? "high_school" : "university") as AssessmentEducationCategory;
}

/** True when a per-student question should render for this category. */
function appliesToCategory(q: AssessmentQuestion, cat: AssessmentEducationCategory): boolean {
  if (!q.appliesTo || q.appliesTo.length === 0) return true;
  return q.appliesTo.includes("*") || q.appliesTo.includes(cat);
}

/** Sort helper: order asc, then declaration index for stability. */
function sortQuestions(list: AssessmentQuestion[]): AssessmentQuestion[] {
  const indexOf = new Map(assessmentQuestions.map((q, i) => [q.id, i]));
  return [...list].sort((a, b) => {
    const oa = a.order ?? 100;
    const ob = b.order ?? 100;
    if (oa !== ob) return oa - ob;
    return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
  });
}

/**
 * Build the ordered list of assessment sections for a given application.
 * Section order: Household → each student in the order they appear on the
 * application. This mirrors the flow described in the product spec:
 *
 *   Household → Secondary (Brian) → University (Derrick) → University (Mercy)
 */
export function buildAssessmentSections(students: StudentEntry[]): AssessmentSection[] {
  const active = assessmentQuestions.filter((q) => q.active !== false);
  const sections: AssessmentSection[] = [];

  // 1. Household — asked once
  const householdQs = sortQuestions(active.filter((q) => q.scope === "household")).map<RenderedQuestion>(
    (q) => ({
      ...q,
      storageKey: `engine.household.${q.id}`,
      displayText: q.text, // no placeholders expected at household scope
    }),
  );
  if (householdQs.length > 0) {
    sections.push({ key: "household", title: "Household Assessment", questions: householdQs });
  }

  // 2. Per-student sections — one section per student, filtered by category
  students.forEach((student, idx) => {
    const cat = categoryOf(student);
    const applicable = sortQuestions(
      active.filter((q) => q.scope === "per_student" && appliesToCategory(q, cat)),
    );
    if (applicable.length === 0) return;

    const name = student.studentName?.trim() || `Student ${idx + 1}`;
    const institution = student.institution?.trim() || "their institution";
    const rendered: RenderedQuestion[] = applicable.map((q) => ({
      ...q,
      storageKey: `engine.per_student.${q.id}::s${idx}`,
      displayText: interpolate(q.text, { studentName: name, institution }),
    }));

    sections.push({
      key: `student-${idx}`,
      title: `${name} · ${institution}`,
      subtitle: humanCategory(cat),
      questions: rendered,
    });
  });

  return sections;
}

function humanCategory(cat: AssessmentEducationCategory): string {
  switch (cat) {
    case "high_school":
      return "Secondary School";
    case "university":
      return "University";
    case "college":
      return "College";
    case "tvet":
      return "TVET";
    case "diploma":
      return "Diploma";
    case "certificate":
      return "Certificate";
    case "postgraduate":
      return "Postgraduate";
    case "special_needs":
      return "Special Needs Programme";
    default:
      return String(cat);
  }
}

/** Extract engine answers back out of a flat answer bag. Useful for tests
 *  and future admin analytics — not required by the renderer. */
export function extractEngineAnswers(bag: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (k.startsWith("engine.") && typeof v === "string") out[k] = v;
  }
  return out;
}

export type { EducationCategory };
