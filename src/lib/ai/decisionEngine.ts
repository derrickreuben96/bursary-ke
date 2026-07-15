// Phase 4 — Policy-Driven AI Decision Support Engine.
//
// A deterministic, explainable, policy-driven recommendation engine.
// The AI is a RECOMMENDATION engine — final authority stays with officers.
//
// Stage flow (see spec):
//   1. Eligibility Validation
//   2. Student Needs Assessment (per-beneficiary, independent)
//   3. Household Context Assessment
//   4. Funding History Assessment
//   5. Policy Rule Evaluation
//   6. Budget Optimization
//   7. Recommendation Generation
//   8. Explainable Recommendation
// (Stages 9-10 — Officer Review + Treasurer Allocation — are UI/workflow.)

import type { Household, HouseholdStudent } from "@/lib/household/types";
import {
  DEFAULT_POLICY_PROFILE,
  type PolicyProfile,
} from "./policyProfile";

// -------------------- Inputs & outputs --------------------

export interface StudentContext {
  /** Fee balance in KES if known. */
  fee_balance?: number | null;
  /** "boarding" | "day" for secondary. */
  school_type?: "boarding" | "day" | null;
  /** Exam year (Form 4, Grade 12, final year). */
  exam_class?: boolean;
  /** Special-needs school. */
  special_school?: boolean;
  /** Higher-ed accommodation. */
  accommodation?: "hostel" | "private" | "rental" | "family" | null;
  /** True if HELB confirmed. */
  helb_received?: boolean;
  /** True if a private scholarship covers part of the fees. */
  scholarship_received?: boolean;
  /** Distance walked to school in km. */
  walking_km?: number | null;
  /** Prior cycles: "budget_exhausted" | "funded" | "rejected" | "new". */
  history?: "budget_exhausted" | "funded" | "rejected" | "new";
}

export interface HouseholdContext {
  monthly_income?: number | null;
  parent_employment?: "employed" | "unemployed" | "informal" | null;
  single_parent?: boolean;
  orphan_status?: "none" | "single" | "double";
  dependents?: number | null;
  disabled_member?: boolean;
}

export interface ReasonCode {
  code: string;
  weight: number;
  message: string;
}

export interface StudentRecommendation {
  student_id: string;
  student_name_masked: string;
  needs_score: number; // 0-100
  priority_rank: number; // populated after budget pass
  recommended_allocation: number; // KES, capped
  confidence: "high" | "medium" | "low";
  reasons: ReasonCode[];
  policy_profile_id: string;
  history_adjustment: number;
  eligible: boolean;
  ineligibility_reason?: string;
}

export interface HouseholdRecommendation {
  household_id: string;
  tracking_number: string;
  household_needs_score: number;
  household_recommended_total: number;
  per_student: StudentRecommendation[];
  policy_profile_id: string;
  generated_at: string;
  policy_version: string;
  input_hash: string;
}

// -------------------- Stage 1: Eligibility --------------------

function checkEligibility(
  s: HouseholdStudent,
  ctx: StudentContext,
): { ok: true } | { ok: false; reason: string } {
  if (!s.institution_name) {
    return { ok: false, reason: "Missing institution reference." };
  }
  if (ctx.fee_balance != null && ctx.fee_balance < 0) {
    return { ok: false, reason: "Invalid fee balance." };
  }
  // Duplicate/NEMIS checks would be enforced upstream (data-quality engine).
  return { ok: true };
}

// -------------------- Stage 2: Student needs (per-student) --------------------

function scoreSecondary(
  ctx: StudentContext,
  profile: PolicyProfile,
): ReasonCode[] {
  const w = profile.secondary;
  const rs: ReasonCode[] = [];
  if (ctx.school_type === "boarding") {
    rs.push({ code: "boarding_student", weight: w.boarding, message: "Boarding student" });
  }
  if (ctx.exam_class) {
    rs.push({ code: "exam_class", weight: w.exam_class, message: "Examination class" });
  }
  if (ctx.special_school) {
    rs.push({ code: "special_school", weight: w.special_school, message: "Special-needs school" });
  }
  const fb = ctx.fee_balance ?? 0;
  if (fb >= 30000) {
    rs.push({ code: "high_fee_balance", weight: w.fee_balance, message: "High outstanding fee balance" });
  } else if (fb >= 10000) {
    rs.push({
      code: "fee_balance",
      weight: Math.round(w.fee_balance * 0.6),
      message: "Outstanding fee balance",
    });
  }
  if ((ctx.walking_km ?? 0) >= 5) {
    rs.push({ code: "long_walking_distance", weight: w.walking_distance, message: "Walks >5km to school" });
  } else if ((ctx.walking_km ?? 0) >= 2) {
    rs.push({
      code: "walking_distance",
      weight: Math.round(w.walking_distance * 0.6),
      message: "Long walking distance to school",
    });
  }
  return rs;
}

function scoreHigherEd(
  ctx: StudentContext,
  profile: PolicyProfile,
): ReasonCode[] {
  const w = profile.higher_ed;
  const rs: ReasonCode[] = [];
  switch (ctx.accommodation) {
    case "hostel":
      rs.push({ code: "acc_hostel", weight: w.accommodation_hostel, message: "University hostel accommodation" });
      break;
    case "private":
      rs.push({ code: "acc_private", weight: w.accommodation_private, message: "Private hostel accommodation" });
      break;
    case "rental":
      rs.push({ code: "acc_rental", weight: w.accommodation_rental, message: "Rental accommodation" });
      break;
    case "family":
      rs.push({ code: "acc_family", weight: w.accommodation_family, message: "Living with family" });
      break;
    default:
      break;
  }
  if ((ctx.fee_balance ?? 0) >= 30000) {
    rs.push({ code: "outstanding_fees", weight: w.outstanding_fees, message: "Outstanding tuition fees" });
  }
  if (ctx.helb_received) {
    rs.push({ code: "helb_offset", weight: w.helb_offset, message: "HELB already received (score reduced)" });
  }
  if (ctx.scholarship_received) {
    rs.push({
      code: "scholarship_offset",
      weight: w.scholarship_offset,
      message: "Existing scholarship (score reduced)",
    });
  }
  return rs;
}

// -------------------- Stage 3: Household context --------------------

function scoreHousehold(
  ctx: HouseholdContext,
  studentCount: number,
  profile: PolicyProfile,
): ReasonCode[] {
  const w = profile.household;
  const rs: ReasonCode[] = [];
  if ((ctx.monthly_income ?? Infinity) < profile.income_threshold_kes) {
    rs.push({
      code: "income_below_threshold",
      weight: w.income_below_threshold,
      message: `Household income below KES ${profile.income_threshold_kes.toLocaleString()}`,
    });
  }
  if (ctx.parent_employment === "unemployed") {
    rs.push({ code: "parent_unemployed", weight: w.parent_unemployed, message: "Parent unemployed" });
  }
  if (ctx.single_parent) {
    rs.push({ code: "single_parent", weight: w.single_parent, message: "Single parent household" });
  }
  if (ctx.orphan_status === "double") {
    rs.push({ code: "double_orphan", weight: w.orphan_status, message: "Double orphan" });
  } else if (ctx.orphan_status === "single") {
    rs.push({
      code: "single_orphan",
      weight: Math.round(w.orphan_status * 0.6),
      message: "Single orphan",
    });
  }
  if ((ctx.dependents ?? 0) >= 4) {
    rs.push({ code: "many_dependents", weight: w.many_dependents, message: "Many dependents" });
  }
  if (ctx.disabled_member) {
    rs.push({ code: "disabled_household_member", weight: w.disabled_member, message: "Disabled household member" });
  }
  if (studentCount >= 2) {
    rs.push({ code: "multiple_students", weight: w.multiple_students, message: `Household supports ${studentCount} learners` });
  }
  return rs;
}

// -------------------- Stage 4: Funding history --------------------

function historyAdjustment(
  ctx: StudentContext,
  profile: PolicyProfile,
): { delta: number; reason?: ReasonCode } {
  if (ctx.history !== "budget_exhausted") return { delta: 0 };
  const delta = Math.min(profile.funding_history.budget_exhausted_bonus, profile.funding_history.max_bonus);
  return {
    delta,
    reason: {
      code: "prior_budget_exhausted",
      weight: delta,
      message: "Eligible in previous cycle but budget exhausted",
    },
  };
}

// -------------------- Stage 5 + 7: Score → Allocation --------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function confidenceFor(score: number, reasons: ReasonCode[]): "high" | "medium" | "low" {
  if (reasons.length < 3) return "low";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

/** Recommend allocation from score using cohort caps and disability bonus. */
function allocationFromScore(
  score: number,
  student: HouseholdStudent,
  profile: PolicyProfile,
): number {
  const cap = student.cohort === "secondary" ? profile.caps.secondary_cap : profile.caps.higher_ed_cap;
  const base = Math.round((score / 100) * cap);
  const bonus =
    student.disability_status && student.disability_status !== "none"
      ? profile.caps.disability_bonus_amount
      : 0;
  return clamp(base + bonus, profile.caps.min_allocation, profile.caps.max_allocation);
}

// -------------------- Public: evaluate household --------------------

export interface EvaluateInput {
  household: Household;
  household_ctx?: HouseholdContext;
  student_ctx?: Record<string, StudentContext>;
  profile?: PolicyProfile;
  /** Total household budget cap (optional). Applied in stage 6 across students. */
  household_budget?: number;
}

export function evaluateHousehold(input: EvaluateInput): HouseholdRecommendation {
  const profile = input.profile ?? DEFAULT_POLICY_PROFILE;
  const hh = input.household;
  const hhCtx = input.household_ctx ?? {};

  const householdReasons = scoreHousehold(hhCtx, hh.students.length, profile);
  const householdScore = householdReasons.reduce((n, r) => n + r.weight, 0);

  const per: StudentRecommendation[] = hh.students.map((s) => {
    const ctx = input.student_ctx?.[s.id] ?? {};
    const elig = checkEligibility(s, ctx);
    if (!elig.ok) {
      return {
        student_id: s.id,
        student_name_masked: s.name_masked,
        needs_score: 0,
        priority_rank: 999,
        recommended_allocation: 0,
        confidence: "low",
        reasons: [],
        policy_profile_id: profile.id,
        history_adjustment: 0,
        eligible: false,
        ineligibility_reason: "reason" in elig ? elig.reason : "Ineligible",
      };
    }

    const studentReasons =
      s.cohort === "secondary" ? scoreSecondary(ctx, profile) : scoreHigherEd(ctx, profile);
    const hist = historyAdjustment(ctx, profile);
    const reasons = [...studentReasons, ...householdReasons];
    if (hist.reason) reasons.push(hist.reason);

    // Needs score is the sum of positive+negative weighted reason codes, clamped 0..100.
    // Note: household-context reasons are ADDED to each student score deliberately —
    // the spec is that household context influences per-student scores but never forces
    // equal scores (per-student factors differ, so final scores diverge).
    const raw = reasons.reduce((n, r) => n + r.weight, 0);
    let score = clamp(raw, 0, 100);

    // History ceiling: never let history push low-need into high-score territory.
    if (hist.delta > 0 && raw - hist.delta < 40) {
      score = Math.min(score, profile.funding_history.history_ceiling);
    }

    const recommended = allocationFromScore(score, s, profile);
    return {
      student_id: s.id,
      student_name_masked: s.name_masked,
      needs_score: score,
      priority_rank: 0,
      recommended_allocation: recommended,
      confidence: confidenceFor(score, reasons),
      reasons,
      policy_profile_id: profile.id,
      history_adjustment: hist.delta,
      eligible: true,
    };
  });

  // Stage 6 — Budget optimisation across household. If a household cap is set
  // and total exceeds it, scale each eligible allocation proportionally to score.
  if (input.household_budget && input.household_budget > 0) {
    const total = per.reduce((n, p) => n + p.recommended_allocation, 0);
    if (total > input.household_budget) {
      const scale = input.household_budget / total;
      for (const p of per) {
        p.recommended_allocation = Math.max(
          profile.caps.min_allocation,
          Math.round(p.recommended_allocation * scale),
        );
      }
    }
  }

  // Priority ranking: eligible students sorted by score desc.
  const rank = [...per].filter((p) => p.eligible).sort((a, b) => b.needs_score - a.needs_score);
  rank.forEach((p, i) => (p.priority_rank = i + 1));

  return {
    household_id: hh.id,
    tracking_number: hh.tracking_number,
    household_needs_score: Math.min(100, householdScore),
    household_recommended_total: per.reduce((n, p) => n + p.recommended_allocation, 0),
    per_student: per,
    policy_profile_id: profile.id,
    generated_at: new Date().toISOString(),
    policy_version: profile.version,
    input_hash: hashInputs(input),
  };
}

// Reproducibility: a stable, non-cryptographic hash so an officer can verify the
// same inputs + policy produced the same recommendation.
function hashInputs(input: EvaluateInput): string {
  const material = JSON.stringify({
    hh: input.household.id,
    ver: input.profile?.version ?? DEFAULT_POLICY_PROFILE.version,
    ctx: input.household_ctx ?? {},
    st: input.student_ctx ?? {},
    budget: input.household_budget ?? null,
  });
  let hash = 0;
  for (let i = 0; i < material.length; i++) {
    hash = (hash * 31 + material.charCodeAt(i)) | 0;
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

// -------------------- Applicant-safe explanation --------------------

/** Simplified public-facing sentence for applicants — no numbers or weights. */
export function applicantExplanation(): string {
  return (
    "Your application was assessed using approved bursary evaluation criteria, " +
    "including household circumstances, educational costs, vulnerability indicators " +
    "and funding history."
  );
}
