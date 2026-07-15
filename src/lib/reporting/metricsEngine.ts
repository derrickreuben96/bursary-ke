// Metrics + row derivation for the reporting engine.
// Pure functions — no I/O, easy to unit-test.

import type { Household, HouseholdStudent } from "@/lib/household/types";
import type {
  BeneficiaryRow,
  BeneficiaryEducationLevel,
  ReportMetrics,
  ReportFilter,
} from "./types";
import { cohortOf } from "@/lib/household/types";

const RECOMMENDED_PER_SECONDARY = 20000;
const RECOMMENDED_PER_HIGHER_ED = 35000;

export function educationLevelOf(student: HouseholdStudent): BeneficiaryEducationLevel {
  const t = (student.student_type || "").toLowerCase();
  if (t === "secondary") return "secondary";
  if (t === "university") return "university";
  if (t === "college") return "college";
  if (t === "tvet") return "tvet";
  return "other";
}

function recommendedFor(student: HouseholdStudent): number {
  return student.cohort === "secondary"
    ? RECOMMENDED_PER_SECONDARY
    : RECOMMENDED_PER_HIGHER_ED;
}

/** Flatten households → per-beneficiary rows for Dimension 2 reporting. */
export function toBeneficiaryRows(households: Household[]): BeneficiaryRow[] {
  const out: BeneficiaryRow[] = [];
  for (const h of households) {
    for (const s of h.students) {
      out.push({
        household_id: h.id,
        tracking_number: h.tracking_number,
        parent_name_masked: h.parent_name_masked,
        parent_county: h.parent_county,
        parent_ward: h.parent_ward,
        student_id: s.id,
        student_name_masked: s.name_masked,
        student_type: s.student_type,
        education_level: educationLevelOf(s),
        cohort: cohortOf(s.student_type),
        institution: s.institution_name,
        class_form: s.class_form,
        year_of_study: s.year_of_study,
        status: s.status,
        recommended_amount: recommendedFor(s),
        allocated_amount: s.allocated_amount,
        has_disability: Boolean(
          s.disability_status && s.disability_status !== "none",
        ),
        ncpwd_number: s.ncpwd_registration_number,
      });
    }
  }
  return out;
}

function isApproved(status: string): boolean {
  const s = status.toLowerCase();
  return s === "approved" || s === "allocated" || s === "disbursed" || s === "released";
}
function isRejected(status: string): boolean {
  return status.toLowerCase() === "rejected";
}
function isPending(status: string): boolean {
  const s = status.toLowerCase();
  return s === "received" || s === "under_review" || s === "pending";
}

export function computeReportMetrics(households: Household[]): ReportMetrics {
  const rows = toBeneficiaryRows(households);

  let budgetRequested = 0;
  let budgetRecommended = 0;
  let budgetAllocated = 0;
  let disabled = 0;
  const cohortCount = { secondary: 0, university: 0, college: 0, tvet: 0, other: 0 };

  for (const r of rows) {
    budgetRequested += r.recommended_amount ?? 0;
    budgetRecommended += r.recommended_amount ?? 0;
    budgetAllocated += r.allocated_amount ?? 0;
    if (r.has_disability) disabled++;
    cohortCount[r.education_level]++;
  }

  const approved = households.filter((h) => isApproved(h.status)).length;
  const rejected = households.filter((h) => isRejected(h.status)).length;
  const pending = households.filter((h) => isPending(h.status)).length;

  const secondary = cohortCount.secondary;
  const higherEd = cohortCount.university + cohortCount.college + cohortCount.tvet;

  return {
    households: households.length,
    beneficiaries: rows.length,
    secondaryBeneficiaries: secondary,
    higherEdBeneficiaries: higherEd,
    universityBeneficiaries: cohortCount.university,
    collegeBeneficiaries: cohortCount.college,
    tvetBeneficiaries: cohortCount.tvet,
    disabledBeneficiaries: disabled,
    avgBeneficiariesPerHousehold:
      households.length > 0 ? +(rows.length / households.length).toFixed(2) : 0,
    budgetRequested,
    budgetRecommended,
    budgetAllocated,
    budgetRemaining: Math.max(0, budgetRecommended - budgetAllocated),
    approvedHouseholds: approved,
    rejectedHouseholds: rejected,
    pendingHouseholds: pending,
  };
}

/** Apply the standard report filters to a list of households (household-first). */
export function filterHouseholds(
  households: Household[],
  filter: ReportFilter,
): Household[] {
  const q = (filter.search || "").trim().toLowerCase();
  return households.filter((h) => {
    if (filter.ward && h.parent_ward !== filter.ward) return false;
    if (filter.county && h.parent_county !== filter.county) return false;
    if (filter.status && h.status.toLowerCase() !== filter.status.toLowerCase())
      return false;
    if (filter.fromDate && h.created_at < filter.fromDate) return false;
    if (filter.toDate && h.created_at > filter.toDate) return false;

    if (filter.institution) {
      const match = h.students.some(
        (s) =>
          (s.institution_name || "")
            .toLowerCase()
            .includes(filter.institution!.toLowerCase()),
      );
      if (!match) return false;
    }
    if (filter.educationLevel) {
      const match = h.students.some(
        (s) => educationLevelOf(s) === filter.educationLevel,
      );
      if (!match) return false;
    }
    if (filter.hasDisability != null) {
      const match = h.students.some(
        (s) =>
          Boolean(s.disability_status && s.disability_status !== "none") ===
          filter.hasDisability,
      );
      if (!match) return false;
    }
    if (q) {
      const hay = `${h.tracking_number} ${h.parent_name_masked} ${h.parent_county} ${h.parent_ward ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type GroupKey =
  | "ward"
  | "county"
  | "institution"
  | "education_level"
  | "status"
  | "academic_year";

export function groupBeneficiaries(
  rows: BeneficiaryRow[],
  key: GroupKey,
): Record<string, BeneficiaryRow[]> {
  const out: Record<string, BeneficiaryRow[]> = {};
  for (const r of rows) {
    let k = "Unspecified";
    switch (key) {
      case "ward": k = r.parent_ward || "Unspecified"; break;
      case "county": k = r.parent_county || "Unspecified"; break;
      case "institution": k = r.institution || "Unspecified"; break;
      case "education_level": k = r.education_level; break;
      case "status": k = r.status; break;
      case "academic_year": k = new Date().getFullYear().toString(); break;
    }
    (out[k] ??= []).push(r);
  }
  return out;
}
