import { describe, it, expect } from "vitest";
import {
  computeReportMetrics,
  filterHouseholds,
  toBeneficiaryRows,
  groupBeneficiaries,
} from "@/lib/reporting/metricsEngine";
import { detectDataQualityFlags } from "@/lib/reporting/duplicateDetector";
import type { Household, HouseholdStudent } from "@/lib/household/types";

const student = (over: Partial<HouseholdStudent> = {}): HouseholdStudent => ({
  id: over.id ?? "s1",
  name_masked: over.name_masked ?? "Student",
  student_type: over.student_type ?? "secondary",
  cohort: over.cohort ?? "secondary",
  institution_name: over.institution_name ?? "Test School",
  class_form: over.class_form ?? null,
  year_of_study: over.year_of_study ?? null,
  status: over.status ?? "received",
  allocated_amount: over.allocated_amount ?? null,
  released_to_treasury: over.released_to_treasury ?? false,
  ai_decision_reason: null,
  fraud_score: null,
  disability_status: over.disability_status ?? null,
  ncpwd_registration_number: over.ncpwd_registration_number ?? null,
  disability_card_url: over.disability_card_url ?? null,
  dvl_verified_at: null,
});

const household = (over: Partial<Household> = {}): Household => ({
  id: over.id ?? "h1",
  tracking_number: over.tracking_number ?? "BKE-000001",
  parent_name_masked: over.parent_name_masked ?? "G*** A***",
  parent_county: over.parent_county ?? "Nairobi",
  parent_ward: over.parent_ward ?? "Kileleshwa",
  household_income: over.household_income ?? 0,
  household_dependents: over.household_dependents ?? null,
  poverty_tier: over.poverty_tier ?? "tier_1",
  poverty_score: over.poverty_score ?? 80,
  total_students: (over.students ?? []).length,
  released_to_treasury: over.released_to_treasury ?? false,
  ai_decision_reason: null,
  advert_id: null,
  created_at: over.created_at ?? "2025-01-01",
  updated_at: over.updated_at ?? "2025-01-01",
  status: over.status ?? "received",
  current_stage: null,
  students: over.students ?? [],
});

describe("Reporting engine — metrics", () => {
  it("counts households and beneficiaries separately (two-dimension model)", () => {
    const hs = [
      household({
        id: "h1",
        students: [
          student({ id: "s1", cohort: "secondary", student_type: "secondary" }),
          student({ id: "s2", cohort: "higher_ed", student_type: "university" }),
        ],
      }),
      household({
        id: "h2",
        students: [student({ id: "s3", cohort: "secondary", student_type: "secondary" })],
      }),
    ];
    const m = computeReportMetrics(hs);
    expect(m.households).toBe(2);
    expect(m.beneficiaries).toBe(3);
    expect(m.secondaryBeneficiaries).toBe(2);
    expect(m.higherEdBeneficiaries).toBe(1);
    expect(m.universityBeneficiaries).toBe(1);
    expect(m.avgBeneficiariesPerHousehold).toBe(1.5);
  });

  it("computes budget requested/allocated/remaining", () => {
    const hs = [
      household({
        students: [
          student({ cohort: "secondary", student_type: "secondary", allocated_amount: 20000 }),
          student({ id: "s2", cohort: "higher_ed", student_type: "university", allocated_amount: 15000 }),
        ],
      }),
    ];
    const m = computeReportMetrics(hs);
    expect(m.budgetRecommended).toBe(20000 + 35000);
    expect(m.budgetAllocated).toBe(35000);
    expect(m.budgetRemaining).toBe(20000 + 35000 - 35000);
  });

  it("counts approved / pending / rejected households by status", () => {
    const hs = [
      household({ id: "h1", status: "approved", students: [student()] }),
      household({ id: "h2", status: "rejected", students: [student()] }),
      household({ id: "h3", status: "received", students: [student()] }),
    ];
    const m = computeReportMetrics(hs);
    expect(m.approvedHouseholds).toBe(1);
    expect(m.rejectedHouseholds).toBe(1);
    expect(m.pendingHouseholds).toBe(1);
  });
});

describe("Reporting engine — filters and grouping", () => {
  const hs = [
    household({ id: "h1", parent_ward: "Kileleshwa", students: [student()] }),
    household({ id: "h2", parent_ward: "Kibra", students: [student({ id: "s2" })] }),
  ];

  it("filters households by ward", () => {
    expect(filterHouseholds(hs, { ward: "Kibra" }).length).toBe(1);
  });

  it("groups beneficiaries by ward", () => {
    const rows = toBeneficiaryRows(hs);
    const g = groupBeneficiaries(rows, "ward");
    expect(Object.keys(g).sort()).toEqual(["Kibra", "Kileleshwa"]);
  });
});

describe("Data quality detector", () => {
  it("flags duplicate student identifier across households", () => {
    const s1 = student({ id: "s1" }) as HouseholdStudent & { identifier: string };
    s1.identifier = "12345678901";
    const s2 = student({ id: "s2" }) as HouseholdStudent & { identifier: string };
    s2.identifier = "12345678901";
    const hs = [household({ id: "h1", students: [s1] }), household({ id: "h2", students: [s2] })];
    const flags = detectDataQualityFlags(hs);
    expect(flags.some((f) => f.code === "duplicate_nemis" || f.code === "duplicate_admission")).toBe(true);
  });

  it("flags disability declared without evidence", () => {
    const hs = [
      household({
        students: [
          student({
            disability_status: "physical",
            ncpwd_registration_number: "NCPWD/2024/1",
            disability_card_url: null,
          }),
        ],
      }),
    ];
    const flags = detectDataQualityFlags(hs);
    expect(flags.some((f) => f.code === "missing_disability_evidence")).toBe(true);
  });

  it("flags orphan household with no students", () => {
    const hs = [household({ students: [] })];
    const flags = detectDataQualityFlags(hs);
    expect(flags.some((f) => f.code === "orphan_household")).toBe(true);
  });
});
