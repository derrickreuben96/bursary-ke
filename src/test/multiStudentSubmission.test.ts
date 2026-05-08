import { describe, it, expect } from "vitest";

/**
 * Mirrors the parent_applications submit_parent_application RPC validation:
 *  - Must include between 1 and 3 students
 *  - No duplicate student identifiers within one parent submission
 *  - parent_national_id required
 */
function validateSubmission(input: {
  parent_national_id: string;
  students: { student_identifier: string }[];
}): { ok: true } | { ok: false; reason: string } {
  if (!input.parent_national_id) return { ok: false, reason: "parent_national_id required" };
  const n = input.students.length;
  if (n < 1) return { ok: false, reason: "at least 1 student required" };
  if (n > 3) return { ok: false, reason: "max 3 students allowed" };
  const ids = new Set<string>();
  for (const s of input.students) {
    if (!s.student_identifier) return { ok: false, reason: "student_identifier required" };
    if (ids.has(s.student_identifier)) {
      return { ok: false, reason: "duplicate student_identifier in submission" };
    }
    ids.add(s.student_identifier);
  }
  return { ok: true };
}

describe("multi-student submission matrix", () => {
  const parent = "12345678";
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ student_identifier: `STD-${i + 1}` }));

  it("accepts 1 student", () => {
    expect(validateSubmission({ parent_national_id: parent, students: mk(1) })).toEqual({ ok: true });
  });

  it("accepts 2 students", () => {
    expect(validateSubmission({ parent_national_id: parent, students: mk(2) })).toEqual({ ok: true });
  });

  it("accepts 3 students", () => {
    expect(validateSubmission({ parent_national_id: parent, students: mk(3) })).toEqual({ ok: true });
  });

  it("rejects 4 students", () => {
    const r = validateSubmission({ parent_national_id: parent, students: mk(4) });
    expect(r.ok).toBe(false);
  });

  it("rejects 0 students", () => {
    const r = validateSubmission({ parent_national_id: parent, students: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects duplicate student identifiers within one parent", () => {
    const r = validateSubmission({
      parent_national_id: parent,
      students: [{ student_identifier: "X" }, { student_identifier: "X" }],
    });
    expect(r).toEqual({ ok: false, reason: "duplicate student_identifier in submission" });
  });

  it("rejects missing parent national id", () => {
    const r = validateSubmission({ parent_national_id: "", students: mk(1) });
    expect(r.ok).toBe(false);
  });
});
