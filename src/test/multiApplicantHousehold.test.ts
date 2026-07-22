// Multi-applicant household regression tests.
//
// Guards two invariants that were broken previously:
//   1. Sibling protection — evaluating/allocating one student in a household
//      must never drop, zero-out, or reject another sibling.
//   2. Household total integrity — the household's recommended/allocated total
//      must always equal the sum of its per-student allocations, both from the
//      AI engine and from the shared statusEngine.recommendedAllocation helper.
//
// These tests are pure and deterministic — they run against the in-process
// decisionEngine + statusEngine and do not touch the database.

import { describe, it, expect } from "vitest";
import { evaluateHousehold, type StudentContext, type HouseholdContext } from "@/lib/ai/decisionEngine";
import { DEFAULT_POLICY_PROFILE } from "@/lib/ai/policyProfile";
import { recommendedAllocation } from "@/lib/household/statusEngine";
import type { Household, HouseholdStudent } from "@/lib/household/types";

const student = (over: Partial<HouseholdStudent>): HouseholdStudent => ({
  id: over.id ?? "s",
  name_masked: over.name_masked ?? "S***",
  student_type: over.student_type ?? "secondary",
  cohort: over.cohort ?? "secondary",
  institution_name: over.institution_name ?? "Test Institution",
  class_form: null,
  year_of_study: null,
  status: over.status ?? "received",
  allocated_amount: over.allocated_amount ?? null,
  released_to_treasury: over.released_to_treasury ?? false,
  ai_decision_reason: null,
  fraud_score: null,
  disability_status: over.disability_status ?? null,
  ncpwd_registration_number: null,
  disability_card_url: null,
  dvl_verified_at: null,
  ...over,
});

const household = (students: HouseholdStudent[], over: Partial<Household> = {}): Household => ({
  id: "hh-multi",
  tracking_number: "BKE-MULTI1",
  parent_name_masked: "P***",
  parent_county: "Nairobi",
  parent_ward: "Kileleshwa",
  household_income: 8000,
  household_dependents: 5,
  poverty_tier: "tier_1",
  poverty_score: 85,
  total_students: students.length,
  released_to_treasury: false,
  ai_decision_reason: null,
  advert_id: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  status: "received",
  current_stage: null,
  students,
  ...over,
});

const hhCtx: HouseholdContext = {
  monthly_income: 8000,
  parent_employment: "unemployed",
  single_parent: true,
  orphan_status: "single",
  dependents: 5,
  disabled_member: false,
};

describe("Multi-applicant household — sibling protection", () => {
  it("evaluates every sibling independently (no sibling is dropped)", () => {
    const hh = household([
      student({ id: "victor", name_masked: "V***", cohort: "secondary", student_type: "secondary" }),
      student({ id: "tony", name_masked: "T***", cohort: "higher_ed", student_type: "university" }),
    ]);
    const ctx: Record<string, StudentContext> = {
      victor: { school_type: "boarding", exam_class: true, fee_balance: 35000 },
      tony: { accommodation: "hostel", fee_balance: 40000 },
    };
    const rec = evaluateHousehold({ household: hh, household_ctx: hhCtx, student_ctx: ctx });

    expect(rec.per_student).toHaveLength(2);
    const ids = rec.per_student.map((p) => p.student_id).sort();
    expect(ids).toEqual(["tony", "victor"]);
    // Both must be eligible with a positive allocation — neither sibling silently zeroed.
    for (const p of rec.per_student) {
      expect(p.eligible).toBe(true);
      expect(p.recommended_allocation).toBeGreaterThan(0);
    }
  });

  it("one ineligible sibling does NOT reject the eligible siblings", () => {
    const hh = household([
      student({ id: "ok1", cohort: "secondary", institution_name: "Alliance High" }),
      student({ id: "ok2", cohort: "higher_ed", student_type: "university", institution_name: "UoN" }),
      // ineligible — missing institution
      student({ id: "bad", cohort: "secondary", institution_name: null }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: hhCtx,
      student_ctx: {
        ok1: { school_type: "boarding", fee_balance: 20000 },
        ok2: { accommodation: "hostel", fee_balance: 25000 },
      },
    });
    const byId = Object.fromEntries(rec.per_student.map((p) => [p.student_id, p]));
    expect(byId.bad.eligible).toBe(false);
    expect(byId.bad.recommended_allocation).toBe(0);
    expect(byId.ok1.eligible).toBe(true);
    expect(byId.ok1.recommended_allocation).toBeGreaterThan(0);
    expect(byId.ok2.eligible).toBe(true);
    expect(byId.ok2.recommended_allocation).toBeGreaterThan(0);
  });

  it("secondary and higher-ed siblings receive different allocations (not forced equal)", () => {
    const hh = household([
      student({ id: "sec", cohort: "secondary", student_type: "secondary" }),
      student({ id: "uni", cohort: "higher_ed", student_type: "university" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: hhCtx,
      student_ctx: {
        sec: { school_type: "boarding", exam_class: true, fee_balance: 35000, walking_km: 6 },
        uni: { accommodation: "hostel", fee_balance: 40000 },
      },
    });
    const sec = rec.per_student.find((p) => p.student_id === "sec")!;
    const uni = rec.per_student.find((p) => p.student_id === "uni")!;
    // Different cohort caps -> allocations must differ.
    expect(sec.recommended_allocation).not.toBe(uni.recommended_allocation);
    // Neither should collapse to zero because of the other.
    expect(sec.recommended_allocation).toBeGreaterThan(0);
    expect(uni.recommended_allocation).toBeGreaterThan(0);
    // Both eligible siblings should be ranked (1 and 2), not 999.
    expect([sec.priority_rank, uni.priority_rank].sort()).toEqual([1, 2]);
  });

  it("re-evaluating after one sibling is already approved/disbursed preserves that state", () => {
    // Simulates the propagate_legacy_to_students concern: a household update
    // must not wipe an individually-approved sibling.
    const hh = household([
      student({
        id: "already",
        cohort: "secondary",
        status: "approved",
        released_to_treasury: true,
        allocated_amount: 15000,
      }),
      student({ id: "new", cohort: "higher_ed", student_type: "university" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: hhCtx,
      student_ctx: { new: { accommodation: "hostel", fee_balance: 25000 } },
    });
    // Both siblings are still present in the recommendation.
    expect(rec.per_student).toHaveLength(2);
    // The already-approved sibling's stored allocation is not clobbered on the household row.
    const already = hh.students.find((s) => s.id === "already")!;
    expect(already.status).toBe("approved");
    expect(already.allocated_amount).toBe(15000);
  });
});

describe("Multi-applicant household — total integrity", () => {
  it("household_recommended_total equals the sum of per-student allocations", () => {
    const hh = household([
      student({ id: "a", cohort: "secondary" }),
      student({ id: "b", cohort: "secondary" }),
      student({ id: "c", cohort: "higher_ed", student_type: "university" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: hhCtx,
      student_ctx: {
        a: { school_type: "boarding", fee_balance: 20000 },
        b: { school_type: "day", fee_balance: 8000 },
        c: { accommodation: "rental", fee_balance: 30000 },
      },
    });
    const sum = rec.per_student.reduce((n, p) => n + p.recommended_allocation, 0);
    expect(rec.household_recommended_total).toBe(sum);
  });

  it("statusEngine.recommendedAllocation matches the sum after allocations are written back", () => {
    const alloc = { victor: 20000, tony: 35000 };
    const hh = household([
      student({ id: "victor", cohort: "secondary", allocated_amount: alloc.victor, status: "approved" }),
      student({ id: "tony", cohort: "higher_ed", student_type: "university", allocated_amount: alloc.tony, status: "approved" }),
    ]);
    expect(recommendedAllocation(hh)).toBe(alloc.victor + alloc.tony);
    // Removing one sibling's amount must not silently double-count the other.
    const hh2 = household([
      student({ id: "victor", cohort: "secondary", allocated_amount: alloc.victor }),
      student({ id: "tony", cohort: "higher_ed", student_type: "university", allocated_amount: null }),
    ]);
    expect(recommendedAllocation(hh2)).toBe(alloc.victor);
  });

  it("respects household_budget without zeroing any eligible sibling", () => {
    const hh = household([
      student({ id: "a", cohort: "higher_ed", student_type: "university" }),
      student({ id: "b", cohort: "higher_ed", student_type: "university" }),
      student({ id: "c", cohort: "secondary" }),
    ]);
    const rec = evaluateHousehold({
      household: hh,
      household_ctx: hhCtx,
      student_ctx: {
        a: { accommodation: "hostel", fee_balance: 40000 },
        b: { accommodation: "rental", fee_balance: 35000 },
        c: { school_type: "boarding", fee_balance: 30000 },
      },
      household_budget: 20000, // deliberately tight
    });
    const min = DEFAULT_POLICY_PROFILE.caps.min_allocation;
    for (const p of rec.per_student) {
      expect(p.eligible).toBe(true);
      // Scaling must respect the floor — nobody drops to zero.
      expect(p.recommended_allocation).toBeGreaterThanOrEqual(min);
    }
    // The engine preserves every eligible sibling rather than dropping one to
    // fit budget; total equals the sum of surviving per-student allocations.
    const total = rec.per_student.reduce((n, p) => n + p.recommended_allocation, 0);
    expect(rec.household_recommended_total).toBe(total);
    expect(rec.per_student.every((p) => p.recommended_allocation >= min)).toBe(true);
  });
});
