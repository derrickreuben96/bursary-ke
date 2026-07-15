/**
 * Cross-field consistency checker (Phase 1 · Household model).
 *
 * These are *soft* warnings surfaced on the Review step — never hard blocks.
 * The applicant can acknowledge and submit, or go back and edit. The intent
 * is to guide, not punish. All logic is defensive: missing data returns no
 * warning for that rule.
 */

import type { ApplicationData, StudentEntry } from "@/context/ApplicationContext";

export interface ConsistencyWarning {
  code: string;
  message: string;
  /** Optional student identifier for warnings scoped to one child. */
  studentId?: string;
}

/** Read a poverty answer by key, case-insensitively, tolerating null/undefined. */
function answer(
  bag: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!bag) return undefined;
  const v = (bag as Record<string, unknown>)[key];
  if (v === null || v === undefined) return undefined;
  return String(v).trim().toLowerCase();
}

/** True when a disability declaration is present but incomplete for a student. */
function disabilityIncomplete(s: StudentEntry): boolean {
  const declared = Boolean(
    s.ncpwdRegistrationNumber || s.disabilityType || s.disabilityCardUrl,
  );
  if (!declared) return false;
  return !s.ncpwdRegistrationNumber || !s.disabilityType || !s.disabilityCardUrl;
}

export function detectConsistencyWarnings(
  data: ApplicationData,
): ConsistencyWarning[] {
  const out: ConsistencyWarning[] = [];
  const pq = (data.povertyQuestionnaire ?? null) as Record<string, unknown> | null;
  const students = data.students ?? [];

  // 1. Orphan status vs "parent alive" contradictions
  const orphan = answer(pq, "orphanStatus") || answer(pq, "orphan_status");
  const parentsAlive =
    answer(pq, "parentsAlive") || answer(pq, "parents_alive");
  if (orphan === "double" && parentsAlive === "both") {
    out.push({
      code: "orphan_vs_parents_alive",
      message:
        "You indicated the student is a double orphan but also that both parents are alive. Please review these answers.",
    });
  }

  // 2. Employment "unemployed" but income > 0
  const employment =
    answer(pq, "parentalEmployment") || answer(pq, "parental_employment");
  const rawIncome = pq?.["householdIncome"] ?? pq?.["household_income"];
  const income = typeof rawIncome === "number" ? rawIncome : Number(rawIncome);
  if (
    (employment === "both unemployed" || employment === "unemployed") &&
    Number.isFinite(income) &&
    income > 0
  ) {
    out.push({
      code: "unemployed_with_income",
      message: `You indicated no employment in the household but reported a monthly income of ${income}. Please review.`,
    });
  }

  // 3. Boarding declared but fee balance zero
  const boarding = answer(pq, "boarding") || answer(pq, "boarding_status");
  if (boarding === "boarding") {
    const secondaryWithZeroFees = students.filter(
      (s) => s.studentType === "secondary" && (s.feeBalance ?? 0) === 0,
    );
    for (const s of secondaryWithZeroFees) {
      out.push({
        code: "boarding_no_fees",
        studentId: s.id,
        message: `${s.studentName || "This student"} is listed as a boarder but has no fee balance. Please confirm the outstanding amount.`,
      });
    }
  }

  // 4. Disability declared but NCPWD number OR card missing
  for (const s of students) {
    if (disabilityIncomplete(s)) {
      out.push({
        code: "disability_incomplete",
        studentId: s.id,
        message: `${s.studentName || "One student"}: disability declared but NCPWD number, disability type, or card upload is missing.`,
      });
    }
  }

  // 5. HELB received but no higher-ed student on the application
  const helb = answer(pq, "helbReceived") || answer(pq, "helb_received");
  const hasHigherEd = students.some((s) => s.studentType === "university");
  if (helb === "yes" && !hasHigherEd) {
    out.push({
      code: "helb_without_higher_ed",
      message:
        "You indicated HELB has been received, but no University/College/TVET student is on this application. Please review.",
    });
  }

  return out;
}
