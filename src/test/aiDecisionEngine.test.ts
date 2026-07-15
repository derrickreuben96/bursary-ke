import { describe, it, expect } from "vitest";
import {
  evaluateHousehold,
  applicantExplanation,
} from "@/lib/ai/decisionEngine";
import { DEFAULT_POLICY_PROFILE, clonePolicy } from "@/lib/ai/policyProfile";
import type { Household, HouseholdStudent } from "@/lib/household/types";

const student = (over: Partial<HouseholdStudent> = {}): HouseholdStudent => ({
  id: over.id ?? "s1",
  name_masked: over.name_masked ?? "Test Student",
  student_type: over.student_type ?? "secondary",
  cohort: over.cohort ?? "secondary",
  institution_name: over.institution_name ?? "Test School",
  class_form: over.class_form ?? null,
  year_of_study: over.year_of_study ?? null,
  status: "received",
  allocated_amount: null,
  released_to_treasury: false,
  ai_decision_reason: null,
  fraud_score: null,
  disability_status: over.disability_status ?? null,
  ncpwd_registration_number: null,
  disability_card_url: null,
  dvl_verified_at: null,
});

const household = (students: HouseholdStudent[]): Household => ({
  id: "h1",
  tracking_number: "BKE-000042",
  parent_name_masked: "G*** A***",
  parent_county: "Nairobi",
  parent_ward: "Kibra",
  household_income: 0,
  household_dependents: null,
  poverty_tier: null,
  poverty_score: null,
  total_students: students.length,
  released_to_treasury: false,
  ai_decision_reason: null,
  advert_id: null,
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
  status: "received",
  current_stage: null,
  students,
});

describe("AI decision engine — per-student independence", () => {
  it("scores two students in the same household differently by their own factors", () => {
    const hh = household([
      student({ id: "a", cohort: "secondary", student_type: "secondary" }),
      student({ id: "b", cohort: "secondary", student_type: "secondary" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: { monthly_income: 5000, parent_employment: "unemployed" },
      student_ctx: {
        a: { school_type: "boarding", fee_balance: 40000, exam_class: true },
        b: { school_type: "day", fee_balance: 2000 },
      },
    });
    const a = rec.per_student.find((p) => p.student_id === "a")!;
    const b = rec.per_student.find((p) => p.student_id === "b")!;
    expect(a.needs_score).toBeGreaterThan(b.needs_score);
    expect(a.recommended_allocation).toBeGreaterThan(b.recommended_allocation);
    expect(a.reasons.some((r) => r.code === "boarding_student")).toBe(true);
  });
});

describe("AI decision engine — funding history is capped", () => {
  it("caps the history bonus at profile.max_bonus", () => {
    const profile = clonePolicy({ funding_history: { budget_exhausted_bonus: 20, max_bonus: 5, history_ceiling: 85 } });
    const hh = household([student({ id: "a" })]);
    const rec = evaluateHousehold({
      household: hh,
      student_ctx: { a: { history: "budget_exhausted", school_type: "day" } },
      profile,
    });
    expect(rec.per_student[0].history_adjustment).toBe(5);
  });

  it("does not push a low-need student above the history_ceiling", () => {
    const hh = household([student({ id: "a" })]);
    const rec = evaluateHousehold({
      household: hh,
      student_ctx: { a: { history: "budget_exhausted" } }, // no other factors
    });
    expect(rec.per_student[0].needs_score).toBeLessThanOrEqual(
      DEFAULT_POLICY_PROFILE.funding_history.history_ceiling,
    );
  });
});

describe("AI decision engine — HELB & scholarships reduce higher-ed score", () => {
  it("applies negative offset for HELB receivers", () => {
    const hh = household([student({ id: "u", cohort: "higher_ed", student_type: "university" })]);
    const with_helb = evaluateHousehold({
      household: hh,
      student_ctx: { u: { accommodation: "rental", fee_balance: 40000, helb_received: true } },
    });
    const without = evaluateHousehold({
      household: hh,
      student_ctx: { u: { accommodation: "rental", fee_balance: 40000, helb_received: false } },
    });
    expect(with_helb.per_student[0].needs_score).toBeLessThan(without.per_student[0].needs_score);
  });
});

describe("AI decision engine — budget optimization respects household cap", () => {
  it("scales down proportionally when total exceeds the household budget", () => {
    const hh = household([
      student({ id: "a", cohort: "secondary" }),
      student({ id: "b", cohort: "higher_ed", student_type: "university" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: { monthly_income: 3000, parent_employment: "unemployed" },
      student_ctx: {
        a: { school_type: "boarding", fee_balance: 40000, exam_class: true },
        b: { accommodation: "rental", fee_balance: 50000 },
      },
      household_budget: 30000,
    });
    const total = rec.per_student.reduce((n, p) => n + p.recommended_allocation, 0);
    expect(total).toBeLessThanOrEqual(30000);
  });
});

describe("AI decision engine — auditability & applicant view", () => {
  it("returns a stable input hash + policy version for reproducibility", () => {
    const hh = household([student({ id: "a", school_type: "boarding" } as never)]);
    const r1 = evaluateHousehold({ household: hh });
    const r2 = evaluateHousehold({ household: hh });
    expect(r1.input_hash).toBe(r2.input_hash);
    expect(r1.policy_version).toBe(DEFAULT_POLICY_PROFILE.version);
  });

  it("provides a simplified applicant-facing explanation (no numbers)", () => {
    const txt = applicantExplanation();
    expect(txt).toMatch(/approved bursary evaluation criteria/i);
    expect(txt).not.toMatch(/\d+/);
  });
});

describe("AI decision engine — eligibility gate", () => {
  it("marks a student without an institution as ineligible", () => {
    const hh = household([student({ id: "a", institution_name: null })]);
    const rec = evaluateHousehold({ household: hh });
    expect(rec.per_student[0].eligible).toBe(false);
    expect(rec.per_student[0].recommended_allocation).toBe(0);
  });
});
