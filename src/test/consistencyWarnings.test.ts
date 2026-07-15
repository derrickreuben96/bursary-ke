import { describe, it, expect } from "vitest";
import { detectConsistencyWarnings } from "@/lib/validation/consistency";
import type { ApplicationData, StudentEntry } from "@/context/ApplicationContext";

const student = (over: Partial<StudentEntry> = {}): StudentEntry => ({
  id: over.id || "s1",
  studentType: over.studentType || "secondary",
  educationCategory: over.educationCategory,
  studentName: over.studentName ?? "Test Child",
  identifier: over.identifier ?? "12345678901",
  institution: over.institution ?? "Test School",
  admissionNumber: over.admissionNumber,
  classForm: over.classForm,
  yearOfStudy: over.yearOfStudy,
  course: over.course,
  feeBalance: over.feeBalance ?? 0,
  ncpwdRegistrationNumber: over.ncpwdRegistrationNumber,
  disabilityType: over.disabilityType,
  disabilityCardUrl: over.disabilityCardUrl,
});

describe("detectConsistencyWarnings", () => {
  it("returns no warnings on a clean application", () => {
    const data: ApplicationData = {
      students: [student()],
      povertyQuestionnaire: {} as never,
    };
    expect(detectConsistencyWarnings(data)).toEqual([]);
  });

  it("flags orphan vs parents-alive contradiction", () => {
    const data: ApplicationData = {
      students: [student()],
      povertyQuestionnaire: {
        orphanStatus: "double",
        parentsAlive: "both",
      } as never,
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "orphan_vs_parents_alive")).toBe(true);
  });

  it("flags unemployed with income > 0", () => {
    const data: ApplicationData = {
      students: [student()],
      povertyQuestionnaire: {
        parentalEmployment: "Both Unemployed",
        householdIncome: 15000,
      } as never,
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "unemployed_with_income")).toBe(true);
  });

  it("flags incomplete disability declaration", () => {
    const data: ApplicationData = {
      students: [student({ disabilityType: "physical" })],
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "disability_incomplete")).toBe(true);
  });

  it("does not flag when disability declaration is complete", () => {
    const data: ApplicationData = {
      students: [
        student({
          disabilityType: "physical",
          ncpwdRegistrationNumber: "NCPWD/2024/123",
          disabilityCardUrl: "path/to/card.pdf",
        }),
      ],
    };
    expect(detectConsistencyWarnings(data)).toEqual([]);
  });

  it("flags HELB received without a higher-ed student", () => {
    const data: ApplicationData = {
      students: [student({ studentType: "secondary" })],
      povertyQuestionnaire: { helbReceived: "yes" } as never,
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "helb_without_higher_ed")).toBe(true);
  });

  it("does not flag HELB when a university student is present", () => {
    const data: ApplicationData = {
      students: [student({ studentType: "university" })],
      povertyQuestionnaire: { helbReceived: "yes" } as never,
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "helb_without_higher_ed")).toBe(false);
  });

  it("flags boarding with zero fee balance for a secondary student", () => {
    const data: ApplicationData = {
      students: [student({ studentType: "secondary", feeBalance: 0 })],
      povertyQuestionnaire: { boarding: "boarding" } as never,
    };
    const w = detectConsistencyWarnings(data);
    expect(w.some((x) => x.code === "boarding_no_fees")).toBe(true);
  });
});
