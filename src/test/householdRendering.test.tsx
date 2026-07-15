import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HouseholdCard } from "@/components/household/HouseholdCard";
import type { Household } from "@/lib/household/types";
import { displayStatus, recommendedAllocation } from "@/lib/household/statusEngine";

function makeHousehold(partial: Partial<Household>): Household {
  return {
    id: "hh-1",
    tracking_number: "BKE-ABC123",
    parent_name_masked: "Jane D***",
    parent_county: "Nairobi",
    parent_ward: "Kileleshwa",
    household_income: 15000,
    household_dependents: 4,
    poverty_tier: "moderate",
    poverty_score: 62,
    total_students: partial.students?.length ?? 0,
    released_to_treasury: false,
    ai_decision_reason: null,
    advert_id: null,
    created_at: new Date("2026-06-01").toISOString(),
    updated_at: new Date("2026-06-01").toISOString(),
    status: "received",
    current_stage: "submitted",
    students: [],
    ...partial,
  } as Household;
}

const stu = (id: string, cohort: "secondary" | "higher_ed", overrides: Partial<Household["students"][number]> = {}) => ({
  id, name_masked: `S ${id}***`, student_type: cohort === "secondary" ? "secondary" : "university",
  cohort, institution_name: "Test Inst", class_form: null, year_of_study: null,
  status: "received", allocated_amount: null, released_to_treasury: false,
  ai_decision_reason: null, fraud_score: null, disability_status: null,
  ncpwd_registration_number: null, disability_card_url: null, dvl_verified_at: null,
  ...overrides,
});

describe("HouseholdCard cohort rendering", () => {
  it("hides Higher Education section when household has secondary only", () => {
    const h = makeHousehold({ students: [stu("s1", "secondary"), stu("s2", "secondary")] });
    render(<HouseholdCard household={h} role="commissioner" expanded={false} onToggle={() => {}} onAction={() => {}} />);
    expect(screen.getByText("Secondary Students")).toBeInTheDocument();
    expect(screen.queryByText("Higher Education Students")).not.toBeInTheDocument();
  });

  it("hides Secondary section when household has higher-ed only", () => {
    const h = makeHousehold({ students: [stu("u1", "higher_ed")] });
    render(<HouseholdCard household={h} role="commissioner" expanded={false} onToggle={() => {}} onAction={() => {}} />);
    expect(screen.getByText("Higher Education Students")).toBeInTheDocument();
    expect(screen.queryByText("Secondary Students")).not.toBeInTheDocument();
  });

  it("shows both sections for mixed households", () => {
    const h = makeHousehold({ students: [stu("s1", "secondary"), stu("u1", "higher_ed")] });
    render(<HouseholdCard household={h} role="commissioner" expanded={false} onToggle={() => {}} onAction={() => {}} />);
    expect(screen.getByText("Secondary Students")).toBeInTheDocument();
    expect(screen.getByText("Higher Education Students")).toBeInTheDocument();
  });
});

describe("statusEngine", () => {
  it("never shows 'Allocated' in commissioner view", () => {
    const h = makeHousehold({ status: "approved", released_to_treasury: true, students: [stu("s", "secondary", { status: "disbursed" })] });
    const s = displayStatus(h, "commissioner");
    expect(s.label.toLowerCase()).not.toBe("allocated");
    expect(s.label).toContain("Pending Treasurer Allocation");
  });

  it("treasury shows 'Allocated' once every student is disbursed", () => {
    const h = makeHousehold({ status: "approved", released_to_treasury: true, students: [stu("s", "secondary", { status: "disbursed", released_to_treasury: true, allocated_amount: 5000 })] });
    const s = displayStatus(h, "treasury");
    expect(s.label).toBe("Allocated");
  });

  it("recommendedAllocation sums student amounts", () => {
    const h = makeHousehold({ students: [stu("s1", "secondary", { allocated_amount: 5000 }), stu("s2", "higher_ed", { allocated_amount: 12000 })] });
    expect(recommendedAllocation(h)).toBe(17000);
  });
});
