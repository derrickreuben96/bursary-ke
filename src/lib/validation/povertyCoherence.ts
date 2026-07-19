/**
 * Poverty-questionnaire coherence checker.
 *
 * Runs inline on the Poverty Assessment step (before proceeding) to flag
 * answers that logically contradict each other. Warnings block the "Next"
 * button until the applicant either fixes the answers or explicitly
 * acknowledges the mismatch. This is *soft* validation — no server round-
 * trip — designed to catch obvious data-entry errors early.
 */

import type { PovertyQuestion } from "@/lib/povertyQuestions";

export interface CoherenceIssue {
  code: string;
  message: string;
  /** Question ids involved (used to scroll/highlight). */
  relatedIds: string[];
}

/** Consolidate per-student answers ("id::s0", "id::s1", ...) into a set. */
function collectStudentAnswers(
  answers: Record<string, string>,
  id: string,
  studentCount: number,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < studentCount; i++) {
    const v = answers[`${id}::s${i}`];
    if (v) out.push(v);
  }
  if (answers[id]) out.push(answers[id]);
  return out;
}

/** True when the question is present in the current session. */
function isAsked(questions: PovertyQuestion[], id: string): boolean {
  return questions.some((q) => q.id === id);
}

/**
 * Detect logical contradictions across the currently-shown answers.
 * We only compare pairs that are both present — otherwise return no issue.
 */
export function detectPovertyCoherenceIssues(
  answers: Record<string, string>,
  questions: PovertyQuestion[],
  studentCount: number,
): CoherenceIssue[] {
  const issues: CoherenceIssue[] = [];

  // --- Disability contradictions --------------------------------------
  // A student is declared with a disability but "family members with
  // disabilities" is answered "no". Since the student is a family member,
  // this is a contradiction.
  if (isAsked(questions, "disability_student") && isAsked(questions, "disability_family")) {
    const studentVals = collectStudentAnswers(answers, "disability_student", studentCount);
    const anyDisabled = studentVals.some((v) => v && v !== "no_disability");
    const familyAns = answers["disability_family"];
    if (anyDisabled && familyAns === "no") {
      issues.push({
        code: "disability_student_vs_family",
        message:
          "You indicated a student has a disability but also that no family members have disabilities. Since the student is a family member, please review these answers.",
        relatedIds: ["disability_student", "disability_family"],
      });
    }
  }

  // --- Orphan status vs breadwinner -----------------------------------
  if (isAsked(questions, "orphan_status") && isAsked(questions, "breadwinner")) {
    const orphan = answers["orphan_status"];
    const bread = answers["breadwinner"];
    if (orphan === "parents_alive" && bread === "orphan_self") {
      issues.push({
        code: "orphan_vs_breadwinner",
        message:
          "You indicated both parents are alive but also that the student is a self-supporting orphan. Please review.",
        relatedIds: ["orphan_status", "breadwinner"],
      });
    }
    if (orphan === "total_orphan" && bread === "both_parents") {
      issues.push({
        code: "total_orphan_vs_both_parents",
        message:
          "You indicated the student is a total orphan but also that both parents are the breadwinners. Please review.",
        relatedIds: ["orphan_status", "breadwinner"],
      });
    }
  }

  // --- Orphan status vs parent employment -----------------------------
  if (isAsked(questions, "orphan_status") && isAsked(questions, "parent_employment")) {
    const orphan = answers["orphan_status"];
    const emp = answers["parent_employment"];
    if (orphan === "total_orphan" && (emp === "both_employed" || emp === "one_employed")) {
      issues.push({
        code: "total_orphan_vs_employment",
        message:
          "You indicated the student is a total orphan but also that a parent is employed. Please review.",
        relatedIds: ["orphan_status", "parent_employment"],
      });
    }
    if (orphan === "parents_alive" && emp === "deceased_na") {
      issues.push({
        code: "parents_alive_vs_deceased",
        message:
          "You indicated both parents are alive but also that parents are deceased or not applicable. Please review.",
        relatedIds: ["orphan_status", "parent_employment"],
      });
    }
  }

  // --- Income vs food security ----------------------------------------
  if (isAsked(questions, "monthly_income") && isAsked(questions, "food_security")) {
    const inc = answers["monthly_income"];
    const food = answers["food_security"];
    if (inc === "above_60000" && food === "severe_insecurity") {
      issues.push({
        code: "high_income_vs_hunger",
        message:
          "A monthly income above KES 60,000 combined with going hungry daily is unusual. Please review.",
        relatedIds: ["monthly_income", "food_security"],
      });
    }
    if (inc === "below_5000" && food === "secure") {
      issues.push({
        code: "low_income_vs_secure",
        message:
          "A monthly income below KES 5,000 combined with full food security is unusual. Please review.",
        relatedIds: ["monthly_income", "food_security"],
      });
    }
  }

  // --- Income source vs stability -------------------------------------
  if (isAsked(questions, "income_source") && isAsked(questions, "income_stability")) {
    const src = answers["income_source"];
    const stab = answers["income_stability"];
    if (src === "none" && stab === "stable") {
      issues.push({
        code: "no_source_vs_stable",
        message:
          "You indicated no regular income but also that income is stable and reliable. Please review.",
        relatedIds: ["income_source", "income_stability"],
      });
    }
  }

  // --- Housing rooms vs occupants -------------------------------------
  if (isAsked(questions, "housing_rooms") && isAsked(questions, "housing_occupants")) {
    const rooms = answers["housing_rooms"];
    const occ = answers["housing_occupants"];
    if (rooms === "four_plus" && occ === "1") {
      issues.push({
        code: "many_rooms_one_person",
        message:
          "Four or more rooms for a single-person household is unusual. Please review.",
        relatedIds: ["housing_rooms", "housing_occupants"],
      });
    }
  }

  return issues;
}
