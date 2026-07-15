// Central household types — one source of truth for all dashboards.
// Sourced from the get_parent_applications_for_commissioner RPC and normalized
// so Commissioner / Treasury / Admin all consume the same shape.

export type HouseholdCohort = "secondary" | "higher_ed";

export interface HouseholdStudent {
  id: string;
  name_masked: string;
  student_type: string; // 'secondary' | 'university' | 'college' | 'tvet'
  cohort: HouseholdCohort;
  institution_name: string | null;
  class_form: string | null;
  year_of_study: string | null;
  status: string;
  allocated_amount: number | null;
  released_to_treasury: boolean;
  ai_decision_reason: string | null;
  fraud_score: number | null;
  disability_status: string | null;
  ncpwd_registration_number: string | null;
  disability_card_url: string | null;
  dvl_verified_at: string | null;
}

export interface Household {
  id: string;
  tracking_number: string;
  parent_name_masked: string;
  parent_county: string;
  parent_ward: string | null;
  household_income: number | null;
  household_dependents: number | null;
  poverty_tier: string | null;
  poverty_score: number | null;
  total_students: number;
  released_to_treasury: boolean;
  ai_decision_reason: string | null;
  advert_id: string | null;
  created_at: string;
  updated_at: string;
  status: string; // raw parent status
  current_stage: string | null;
  students: HouseholdStudent[];
}

export const cohortOf = (student_type: string): HouseholdCohort =>
  student_type?.toLowerCase() === "secondary" ? "secondary" : "higher_ed";

export const cohortLabel = (c: HouseholdCohort): string =>
  c === "secondary" ? "Secondary Students" : "Higher Education Students";
