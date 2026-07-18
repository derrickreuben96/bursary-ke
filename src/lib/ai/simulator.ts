// Phase 6B — Policy & Budget Simulator.
//
// Pure, in-memory dry-run over a snapshot of households. Never writes to
// allocation tables. Given a policy profile (draft or active) and a set of
// households + optional budget, returns aggregate outcomes officers can use
// to compare policy variants before activating them.

import { evaluateHousehold, type HouseholdContext, type StudentContext } from "./decisionEngine";
import type { PolicyProfile } from "./policyProfile";
import type { Household } from "@/lib/household/types";

export interface SimulationInput {
  profile: PolicyProfile;
  households: Household[];
  household_ctx?: Record<string, HouseholdContext>;
  student_ctx?: Record<string, StudentContext>;
  /** Total programme budget (KES). Applied greedily by descending score. */
  budget?: number;
}

export interface CohortBreakdown {
  cohort: "secondary" | "higher_ed";
  beneficiaries: number;
  total_allocation: number;
  avg_allocation: number;
  avg_score: number;
}

export interface SimulationResult {
  policy_id: string;
  policy_version: string;
  households_evaluated: number;
  students_evaluated: number;
  students_funded: number;
  total_allocation: number;
  avg_allocation: number;
  avg_needs_score: number;
  score_distribution: Record<"0-24" | "25-49" | "50-74" | "75-100", number>;
  confidence_distribution: Record<"high" | "medium" | "low", number>;
  cohort_breakdown: CohortBreakdown[];
  budget?: number;
  budget_used?: number;
  budget_remaining?: number;
  budget_deficit?: number;
  generated_at: string;
}

const bucketFor = (score: number): "0-24" | "25-49" | "50-74" | "75-100" => {
  if (score < 25) return "0-24";
  if (score < 50) return "25-49";
  if (score < 75) return "50-74";
  return "75-100";
};

export function simulatePolicy(input: SimulationInput): SimulationResult {
  const perStudent: Array<{
    cohort: "secondary" | "higher_ed";
    score: number;
    allocation: number;
    confidence: "high" | "medium" | "low";
    eligible: boolean;
  }> = [];

  for (const hh of input.households) {
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: input.household_ctx?.[hh.id],
      student_ctx: input.student_ctx,
      profile: input.profile,
    });
    for (const p of rec.per_student) {
      const student = hh.students.find((s) => s.id === p.student_id);
      const cohort = student?.cohort === "secondary" ? "secondary" : "higher_ed";
      perStudent.push({
        cohort,
        score: p.needs_score,
        allocation: p.recommended_allocation,
        confidence: p.confidence,
        eligible: p.eligible,
      });
    }
  }

  // Budget optimisation: greedy by score across the whole cohort.
  let budgetUsed = 0;
  let budgetRemaining: number | undefined;
  let budgetDeficit: number | undefined;
  if (input.budget && input.budget > 0) {
    const sorted = [...perStudent]
      .filter((p) => p.eligible)
      .sort((a, b) => b.score - a.score);
    let remaining = input.budget;
    for (const p of sorted) {
      if (remaining >= p.allocation) {
        remaining -= p.allocation;
        budgetUsed += p.allocation;
      } else if (remaining > 0) {
        budgetUsed += remaining;
        p.allocation = remaining;
        remaining = 0;
      } else {
        p.allocation = 0;
      }
    }
    budgetRemaining = Math.max(0, remaining);
    const requested = sorted.reduce((n, p) => n + p.allocation, 0);
    budgetDeficit = Math.max(0, requested - input.budget);
  }

  const funded = perStudent.filter((p) => p.eligible && p.allocation > 0);
  const total = funded.reduce((n, p) => n + p.allocation, 0);

  const dist: SimulationResult["score_distribution"] = {
    "0-24": 0, "25-49": 0, "50-74": 0, "75-100": 0,
  };
  const conf: SimulationResult["confidence_distribution"] = { high: 0, medium: 0, low: 0 };
  for (const p of perStudent.filter((p) => p.eligible)) {
    dist[bucketFor(p.score)] += 1;
    conf[p.confidence] += 1;
  }

  const cohorts: Array<"secondary" | "higher_ed"> = ["secondary", "higher_ed"];
  const cohort_breakdown: CohortBreakdown[] = cohorts.map((c) => {
    const rows = funded.filter((p) => p.cohort === c);
    const sum = rows.reduce((n, p) => n + p.allocation, 0);
    const scores = rows.reduce((n, p) => n + p.score, 0);
    return {
      cohort: c,
      beneficiaries: rows.length,
      total_allocation: sum,
      avg_allocation: rows.length ? Math.round(sum / rows.length) : 0,
      avg_score: rows.length ? Math.round(scores / rows.length) : 0,
    };
  });

  const totalEligible = perStudent.filter((p) => p.eligible);
  const avgScore = totalEligible.length
    ? Math.round(totalEligible.reduce((n, p) => n + p.score, 0) / totalEligible.length)
    : 0;

  return {
    policy_id: input.profile.id,
    policy_version: input.profile.version,
    households_evaluated: input.households.length,
    students_evaluated: perStudent.length,
    students_funded: funded.length,
    total_allocation: total,
    avg_allocation: funded.length ? Math.round(total / funded.length) : 0,
    avg_needs_score: avgScore,
    score_distribution: dist,
    confidence_distribution: conf,
    cohort_breakdown,
    budget: input.budget,
    budget_used: input.budget ? budgetUsed : undefined,
    budget_remaining: budgetRemaining,
    budget_deficit: budgetDeficit,
    generated_at: new Date().toISOString(),
  };
}
