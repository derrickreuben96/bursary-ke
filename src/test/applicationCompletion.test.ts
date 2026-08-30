import { describe, it, expect } from "vitest";
import { computeCompletion } from "@/lib/application/completion";
import type { ApplicationData } from "@/context/ApplicationContext";

const empty: ApplicationData = { students: [] };

describe("application completion meter", () => {
  it("starts at 0%", () => {
    expect(computeCompletion({ data: empty }).percent).toBe(0);
  });

  it("moves as guardian fields are typed (live, before submit)", () => {
    const a = computeCompletion({ data: empty, liveParent: { fullName: "Jane" } }).percent;
    const b = computeCompletion({
      data: empty,
      liveParent: { fullName: "Jane", nationalId: "12345678" },
    }).percent;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });

  it("credits education level and live student entries", () => {
    const data: ApplicationData = {
      students: [],
      educationLevels: { secondary: true, higherEd: false },
    };
    const before = computeCompletion({ data }).percent;
    const after = computeCompletion({
      data,
      liveStudents: [
        {
          id: "1",
          studentType: "secondary",
          studentName: "Amina",
          identifier: "00200020002",
          institution: "Kwale Secondary",
          classForm: "Form 2",
        },
      ],
    }).percent;
    expect(after).toBeGreaterThan(before);
  });

  it("reaches 100% when every stage is complete", () => {
    const data: ApplicationData = {
      parentGuardian: {
        fullName: "Jane",
        nationalId: "12345678",
        phoneNumber: "0712345678",
        county: "Nairobi",
        ward: "Embakasi North",
        selectedAdvertId: "advert-1",
      } as never,
      educationLevels: { secondary: true, higherEd: false },
      students: [
        {
          id: "1",
          studentType: "secondary",
          studentName: "Amina",
          identifier: "00200020002",
          institution: "Kwale Secondary",
          classForm: "Form 2",
        },
      ],
      povertyQuestionnaire: { q1: "yes" } as never,
    };
    const res = computeCompletion({ data, requiredDocsCount: 3, uploadedDocsCount: 3 });
    expect(res.percent).toBe(100);
    expect(res.nextSection).toBeUndefined();
  });

  it("never exceeds 100% with extra documents", () => {
    const res = computeCompletion({ data: empty, requiredDocsCount: 2, uploadedDocsCount: 9 });
    expect(res.percent).toBeLessThanOrEqual(100);
  });
});
