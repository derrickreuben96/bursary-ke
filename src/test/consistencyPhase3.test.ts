import { describe, it, expect } from "vitest";
import { detectConsistencyWarnings } from "@/lib/validation/consistency";
import type { ApplicationData, StudentEntry } from "@/context/ApplicationContext";

const s = (o: Partial<StudentEntry> = {}): StudentEntry => ({
  id: o.id || "s1",
  studentType: o.studentType || "secondary",
  educationCategory: o.educationCategory,
  studentName: o.studentName ?? "Child",
  identifier: o.identifier ?? "12345678901",
  institution: o.institution ?? "School",
  admissionNumber: o.admissionNumber,
  classForm: o.classForm,
  yearOfStudy: o.yearOfStudy,
  course: o.course,
  feeBalance: o.feeBalance ?? 0,
  ncpwdRegistrationNumber: o.ncpwdRegistrationNumber,
  disabilityType: o.disabilityType,
  disabilityCardUrl: o.disabilityCardUrl,
});

describe("Phase 3 consistency rules", () => {
  it("flags day school with boarding-level fees", () => {
    const data: ApplicationData = {
      students: [s({ studentType: "secondary", feeBalance: 45000 })],
      povertyQuestionnaire: { schoolType: "day" } as never,
    };
    expect(
      detectConsistencyWarnings(data).some((w) => w.code === "day_school_high_fees"),
    ).toBe(true);
  });

  it("flags NCPWD without disability declaration", () => {
    const data: ApplicationData = {
      students: [s({ ncpwdRegistrationNumber: "NCPWD/2024/9" })],
      povertyQuestionnaire: { disabilityInHousehold: "no" } as never,
    };
    expect(
      detectConsistencyWarnings(data).some((w) => w.code === "ncpwd_without_declaration"),
    ).toBe(true);
  });

  it("flags declared children count less than student records", () => {
    const data: ApplicationData = {
      students: [s({ id: "a" }), s({ id: "b" }), s({ id: "c" })],
      povertyQuestionnaire: { numberOfChildren: 1 } as never,
    };
    expect(
      detectConsistencyWarnings(data).some((w) => w.code === "students_exceed_declared"),
    ).toBe(true);
  });
});
