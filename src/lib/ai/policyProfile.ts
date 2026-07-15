// Phase 4 — Policy Profile.
// Every threshold, weight and cap the AI uses is declared here and can be
// overridden per policy profile. NEVER hard-code these in the engine.
//
// A future admin UI can persist edited profiles to a `policy_profiles` table
// and pass them into `evaluateHousehold`. Until then the DEFAULT_POLICY_PROFILE
// is used, which mirrors the current live rules.

export interface EducationFactorWeights {
  boarding: number;
  tuition: number;
  transport: number;
  walking_distance: number;
  exam_class: number;
  special_school: number;
  disability_support: number;
  fee_balance: number;
}

export interface HigherEdFactorWeights {
  accommodation_hostel: number;
  accommodation_private: number;
  accommodation_rental: number;
  accommodation_family: number;
  food: number;
  transport: number;
  outstanding_fees: number;
  helb_offset: number; // negative — reduces score
  scholarship_offset: number; // negative — reduces score
  medical: number;
  disability: number;
}

export interface HouseholdContextWeights {
  income_below_threshold: number;
  parent_unemployed: number;
  single_parent: number;
  orphan_status: number;
  many_dependents: number;
  disabled_member: number;
  multiple_students: number;
}

export interface FundingHistoryPolicy {
  /** Priority points added if applicant was eligible but budget-exhausted. */
  budget_exhausted_bonus: number;
  /** Max score bonus regardless of how many prior unfunded cycles. */
  max_bonus: number;
  /** Never let history push a low-need student above this ceiling. */
  history_ceiling: number;
}

export interface AllocationCaps {
  min_allocation: number;
  max_allocation: number;
  secondary_cap: number;
  higher_ed_cap: number;
  disability_bonus_amount: number;
}

export interface PolicyProfile {
  id: string;
  name: string;
  version: string;
  income_threshold_kes: number;
  secondary: EducationFactorWeights;
  higher_ed: HigherEdFactorWeights;
  household: HouseholdContextWeights;
  funding_history: FundingHistoryPolicy;
  caps: AllocationCaps;
  /** Optional reserved buckets (e.g. NG-CDF, disability). */
  reserved_buckets?: Array<{ code: string; percentage: number }>;
}

export const DEFAULT_POLICY_PROFILE: PolicyProfile = {
  id: "default",
  name: "Bursary-KE Default Policy",
  version: "4.0.0",
  income_threshold_kes: 20000,
  secondary: {
    boarding: 15,
    tuition: 10,
    transport: 5,
    walking_distance: 4,
    exam_class: 8,
    special_school: 10,
    disability_support: 12,
    fee_balance: 12,
  },
  higher_ed: {
    accommodation_hostel: 8,
    accommodation_private: 10,
    accommodation_rental: 12,
    accommodation_family: 3,
    food: 6,
    transport: 5,
    outstanding_fees: 15,
    helb_offset: -8,
    scholarship_offset: -10,
    medical: 6,
    disability: 12,
  },
  household: {
    income_below_threshold: 10,
    parent_unemployed: 8,
    single_parent: 6,
    orphan_status: 10,
    many_dependents: 5,
    disabled_member: 6,
    multiple_students: 4,
  },
  funding_history: {
    budget_exhausted_bonus: 5,
    max_bonus: 8,
    history_ceiling: 85,
  },
  caps: {
    min_allocation: 5000,
    max_allocation: 100000,
    secondary_cap: 40000,
    higher_ed_cap: 80000,
    disability_bonus_amount: 10000,
  },
};

/** Cheap in-memory cache; the loader can be swapped for a DB reader later. */
const CACHE = new Map<string, PolicyProfile>();

export function loadPolicyProfile(id = "default"): PolicyProfile {
  const cached = CACHE.get(id);
  if (cached) return cached;
  CACHE.set(id, DEFAULT_POLICY_PROFILE);
  return DEFAULT_POLICY_PROFILE;
}

export function clonePolicy(overrides: Partial<PolicyProfile>): PolicyProfile {
  return { ...DEFAULT_POLICY_PROFILE, ...overrides };
}
