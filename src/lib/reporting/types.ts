// Reporting Engine — Phase 3
// Two-dimensional reporting model: Households AND Individual Beneficiaries.
// One Tracking Number = One Household = One or more Beneficiaries.

import type { Household, HouseholdStudent, HouseholdCohort } from "@/lib/household/types";

export type BeneficiaryEducationLevel =
  | "secondary"
  | "university"
  | "college"
  | "tvet"
  | "other";

export interface BeneficiaryRow {
  household_id: string;
  tracking_number: string;
  parent_name_masked: string;
  parent_county: string;
  parent_ward: string | null;
  student_id: string;
  student_name_masked: string;
  student_type: string;
  education_level: BeneficiaryEducationLevel;
  cohort: HouseholdCohort;
  institution: string | null;
  class_form: string | null;
  year_of_study: string | null;
  status: string;
  recommended_amount: number | null;
  allocated_amount: number | null;
  has_disability: boolean;
  ncpwd_number: string | null;
}

export interface ReportMetrics {
  households: number;
  beneficiaries: number;
  secondaryBeneficiaries: number;
  higherEdBeneficiaries: number;
  universityBeneficiaries: number;
  collegeBeneficiaries: number;
  tvetBeneficiaries: number;
  disabledBeneficiaries: number;
  avgBeneficiariesPerHousehold: number;
  budgetRequested: number;
  budgetRecommended: number;
  budgetAllocated: number;
  budgetRemaining: number;
  approvedHouseholds: number;
  rejectedHouseholds: number;
  pendingHouseholds: number;
}

export interface ReportFilter {
  ward?: string | null;
  county?: string | null;
  institution?: string | null;
  educationLevel?: BeneficiaryEducationLevel | null;
  status?: string | null;
  hasDisability?: boolean | null;
  fromDate?: string | null;
  toDate?: string | null;
  academicYear?: string | null;
  search?: string | null;
}

export interface GeneratedReportMeta {
  generatedAt: string;
  generatedBy: string;
  filters: ReportFilter;
  format: "pdf" | "excel" | "print" | "screen";
  version: string;
}

export type { Household, HouseholdStudent };
