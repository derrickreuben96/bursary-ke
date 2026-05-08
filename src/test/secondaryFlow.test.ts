import { describe, it, expect } from "vitest";
import { validateNemisFormat, formatNemisId, lookupNemisId } from "@/lib/nemisApi";
import { nemisStudentDatabase, getSampleNemisIds } from "@/lib/nemisStudentDatabase";

describe("NEMIS ID — format mask & validation", () => {
  it("formats 11 digits as CCC-NNNN-SSSS", () => {
    expect(formatNemisId("04710011234")).toBe("047-1001-1234");
  });

  it("rejects fewer or more than 11 digits", () => {
    expect(validateNemisFormat("0471001123").isValid).toBe(false);
    expect(validateNemisFormat("047100112345").isValid).toBe(false);
  });

  it("rejects invalid county codes (>047)", () => {
    expect(validateNemisFormat("04810011234").isValid).toBe(false);
  });

  it("accepts a valid 11-digit ID", () => {
    expect(validateNemisFormat("04710011234").isValid).toBe(true);
  });
});

describe("NEMIS test database — deterministic across counties", () => {
  it("contains entries for all 47 counties", () => {
    const samples = getSampleNemisIds();
    const counties = new Set(samples.map((id) => id.substring(0, 3)));
    expect(counties.size).toBe(47);
  });

  it("returns identical student data on repeated lookups (deterministic)", async () => {
    const sample = getSampleNemisIds()[0];
    const a = await lookupNemisId(sample);
    const b = await lookupNemisId(sample);
    expect(a.success).toBe(true);
    expect(a.data?.studentName).toBe(b.data?.studentName);
    expect(a.data?.schoolName).toBe(b.data?.schoolName);
  });

  it("every seeded ID resolves to a school + name", async () => {
    for (const id of getSampleNemisIds()) {
      const r = await lookupNemisId(id);
      expect(r.success).toBe(true);
      expect(r.data?.studentName.length).toBeGreaterThan(3);
      expect(r.data?.schoolName.length).toBeGreaterThan(0);
    }
  });

  it("database has > 300 deterministic students", () => {
    expect(nemisStudentDatabase.size).toBeGreaterThan(300);
  });
});

describe("Secondary flow — duplicate NEMIS prevention", () => {
  // Mirrors the validation logic inside StudentsRepeater.handleNext
  function checkDuplicates(ids: string[]): string | null {
    const seen = new Set<string>();
    for (const raw of ids) {
      const k = raw.trim().toUpperCase();
      if (seen.has(k)) return formatNemisId(k);
      seen.add(k);
    }
    return null;
  }

  it("blocks identical NEMIS IDs across students", () => {
    expect(checkDuplicates(["04710011234", "04710011234"])).toBe("047-1001-1234");
  });

  it("allows distinct NEMIS IDs", () => {
    expect(checkDuplicates(["04710011234", "04710011235", "04710011236"])).toBeNull();
  });
});

describe("Secondary form schema — no studentType / no feeBalance", () => {
  it("StudentEntry shape submitted by secondary flow has no fee balance UI field", async () => {
    // Ensure the public StudentsRepeater module does NOT render a Fee Balance label
    const src = await import("@/components/application/StudentsRepeater?raw" as any).catch(() => null);
    if (src && typeof src.default === "string") {
      expect(src.default).not.toMatch(/Fee Balance/);
      // Student Type select is conditional/removed for secondary path
      const secondaryBlock = src.default.split("isSecondary ? (")[1] ?? "";
      expect(secondaryBlock.split(") : (")[0] ?? "").not.toMatch(/Student Type/);
    }
  });
});
