import { describe, it, expect } from "vitest";
import { calculatePovertyScore, getPovertyTier } from "@/lib/validationSchemas";
import type { PovertyQuestionnaireFormData } from "@/lib/validationSchemas";
import { maskName, maskId, maskPhone, isValidTrackingNumber } from "@/lib/maskData";

function makeQuestionnaire(overrides: Partial<PovertyQuestionnaireFormData> = {}): PovertyQuestionnaireFormData {
  return {
    householdIncome: 50,
    numberOfDependents: 2,
    housingType: "Rented",
    accessToUtilities: { electricity: true, water: true, internet: true },
    parentalEmployment: "One Employed",
    otherChildrenInSchool: 1,
    receivesOtherAid: false,
    ...overrides,
  };
}

describe("calculatePovertyScore", () => {
  it("maximum hardship returns score >= 70", () => {
    const score = calculatePovertyScore(makeQuestionnaire({
      householdIncome: 0,
      numberOfDependents: 5,
      housingType: "Informal",
      accessToUtilities: { electricity: false, water: false, internet: false },
      parentalEmployment: "Both Unemployed",
      otherChildrenInSchool: 3,
      receivesOtherAid: false,
    }));
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("minimal hardship returns score <= 30", () => {
    const score = calculatePovertyScore(makeQuestionnaire({
      householdIncome: 80,
      numberOfDependents: 1,
      housingType: "Owned",
      accessToUtilities: { electricity: true, water: true, internet: true },
      parentalEmployment: "Both Employed",
      otherChildrenInSchool: 0,
      receivesOtherAid: false,
    }));
    expect(score).toBeLessThanOrEqual(30);
  });

  it("middle case returns score between 40 and 69", () => {
    const score = calculatePovertyScore(makeQuestionnaire({
      householdIncome: 50,
      numberOfDependents: 3,
      housingType: "Rented",
      accessToUtilities: { electricity: true, water: false, internet: false },
      parentalEmployment: "One Employed",
      otherChildrenInSchool: 2,
      receivesOtherAid: false,
    }));
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(69);
  });

  it("result is always between 0 and 100", () => {
    const extremes = [
      makeQuestionnaire({ householdIncome: 0, numberOfDependents: 20, housingType: "Informal", accessToUtilities: { electricity: false, water: false, internet: false }, parentalEmployment: "Both Unemployed", otherChildrenInSchool: 15 }),
      makeQuestionnaire({ householdIncome: 100, numberOfDependents: 0, housingType: "Owned", accessToUtilities: { electricity: true, water: true, internet: true }, parentalEmployment: "Both Employed", otherChildrenInSchool: 0 }),
    ];
    for (const data of extremes) {
      const score = calculatePovertyScore(data);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("getPovertyTier", () => {
  it.each([
    [70, "High"], [100, "High"],
    [69, "Medium"], [40, "Medium"],
    [39, "Low"], [0, "Low"],
  ] as const)("score %i → %s", (score, tier) => {
    expect(getPovertyTier(score)).toBe(tier);
  });
});

describe("maskName", () => {
  it("masks multi-word name", () => expect(maskName("John Kamau")).toBe("John K***"));
  it("masks single name", () => expect(maskName("Alice")).toBe("A***"));
  it("handles empty string", () => expect(maskName("")).toBe("***"));
});

describe("maskId", () => {
  it("masks 8-digit ID", () => expect(maskId("12345678")).toBe("*****678"));
});

describe("maskPhone", () => {
  it("masks +254 format", () => expect(maskPhone("+254712345678")).toBe("+254***678"));
  it("masks 0-prefix format", () => expect(maskPhone("0712345678")).toBe("0***678"));
});

describe("isValidTrackingNumber", () => {
  it("accepts valid uppercase", () => expect(isValidTrackingNumber("BKE-ABC123")).toBe(true));
  it("accepts valid lowercase (via toUpperCase)", () => expect(isValidTrackingNumber("BKE-abc123")).toBe(true));
  it("rejects too short", () => expect(isValidTrackingNumber("BKE-12")).toBe(false));
  it("rejects wrong prefix", () => expect(isValidTrackingNumber("ABC-123456")).toBe(false));
});
