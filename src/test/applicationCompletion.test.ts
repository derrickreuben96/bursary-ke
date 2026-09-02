import { describe, it, expect } from "vitest";
import { computeCompletion } from "@/lib/application/completion";
import type { ApplicationData } from "@/context/ApplicationContext";

const empty: ApplicationData = { students: [] };

const completeParent = {
  fullName: "Jane",
  nationalId: "12345678",
  phoneNumber: "0712345678",
  county: "Nairobi",
  ward: "Embakasi North",
  selectedAdvertId: "advert-1",
};

const completeStudent = {
  id: "1",
  studentType: "secondary" as const,
  studentName: "Amina",
  identifier: "00200020002",
  institution: "Kwale Secondary",
  classForm: "Form 2",
};

describe("application completion meter", () => {
  it("starts at 0% and reports the empty completion band", () => {
    const result = computeCompletion({ data: empty });

    expect(result.percent).toBe(0);
    expect(result.level.key).toBe("empty");
    expect(result.level.label).toBe("Not started");
  });

  it("moves as guardian fields are typed live, before the step is submitted", () => {
    const a = computeCompletion({ data: empty, liveParent: { fullName: "Jane" } }).percent;
    const b = computeCompletion({
      data: empty,
      liveParent: { fullName: "Jane", nationalId: "12345678" },
    }).percent;

    expect(a).toBe(5);
    expect(b).toBe(10);
    expect(b).toBeGreaterThan(a);
  });

  it("credits the education step and uses the halfway threshold at 40%", () => {
    const result = computeCompletion({
      data: { ...empty, parentGuardian: completeParent, educationLevels: { secondary: true, higherEd: false } },
    });

    expect(result.percent).toBe(40);
    expect(result.level.key).toBe("halfway");
    expect(result.level.label).toBe("Halfway there");
  });

  it("updates for live student details and reaches 65% after the student step", () => {
    const data: ApplicationData = {
      parentGuardian: completeParent as never,
      educationLevels: { secondary: true, higherEd: false },
      students: [],
    };
    const before = computeCompletion({ data }).percent;
    const after = computeCompletion({ data, liveStudents: [completeStudent] });

    expect(before).toBe(40);
    expect(after.percent).toBe(65);
    expect(after.level.key).toBe("halfway");
  });

  it("adds the assessment step and reaches the almost-done threshold at 85%", () => {
    const result = computeCompletion({
      data: {
        parentGuardian: completeParent as never,
        educationLevels: { secondary: true, higherEd: false },
        students: [completeStudent],
        povertyQuestionnaire: { q1: "yes" } as never,
      },
    });

    expect(result.percent).toBe(85);
    expect(result.level.key).toBe("nearly");
    expect(result.level.label).toBe("Almost done");
  });

  it("reaches 100% only when supporting documents are complete", () => {
    const result = computeCompletion({
      data: {
        parentGuardian: completeParent as never,
        educationLevels: { secondary: true, higherEd: false },
        students: [completeStudent],
        povertyQuestionnaire: { q1: "yes" } as never,
      },
      requiredDocsCount: 3,
      uploadedDocsCount: 3,
    });

    expect(result.percent).toBe(100);
    expect(result.level.key).toBe("complete");
    expect(result.level.label).toBe("Ready to submit");
    expect(result.nextSection).toBeUndefined();
    expect(result.remaining).toHaveLength(0);
  });

  it("never exceeds 100% with extra documents", () => {
    const res = computeCompletion({ data: empty, requiredDocsCount: 2, uploadedDocsCount: 9 });
    expect(res.percent).toBeLessThanOrEqual(100);
  });
});
