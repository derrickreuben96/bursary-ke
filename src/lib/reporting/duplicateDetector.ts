// Duplicate & data-quality detection over households + beneficiaries.
import type { Household } from "@/lib/household/types";

export interface DataQualityFlag {
  code:
    | "duplicate_nemis"
    | "duplicate_admission"
    | "missing_institution"
    | "missing_disability_evidence"
    | "orphan_household"
    | "broken_relationship";
  message: string;
  household_id?: string;
  student_id?: string;
}

export function detectDataQualityFlags(households: Household[]): DataQualityFlag[] {
  const out: DataQualityFlag[] = [];
  const seenIdentifiers = new Map<string, { hh: string; st: string }>();

  for (const h of households) {
    if (h.students.length === 0) {
      out.push({
        code: "orphan_household",
        household_id: h.id,
        message: `Household ${h.tracking_number} has no student records attached.`,
      });
      continue;
    }
    for (const s of h.students) {
      const idKey = (s as unknown as { identifier?: string }).identifier;
      if (idKey) {
        const dup = seenIdentifiers.get(idKey);
        if (dup) {
          out.push({
            code: s.cohort === "secondary" ? "duplicate_nemis" : "duplicate_admission",
            household_id: h.id,
            student_id: s.id,
            message: `Duplicate student identifier detected across households (${h.tracking_number}).`,
          });
        } else {
          seenIdentifiers.set(idKey, { hh: h.id, st: s.id });
        }
      }
      if (!s.institution_name) {
        out.push({
          code: "missing_institution",
          household_id: h.id,
          student_id: s.id,
          message: `Student in ${h.tracking_number} is missing an institution reference.`,
        });
      }
      const claimsDisability =
        Boolean(s.disability_status && s.disability_status !== "none") ||
        Boolean(s.ncpwd_registration_number);
      if (claimsDisability && !s.disability_card_url) {
        out.push({
          code: "missing_disability_evidence",
          household_id: h.id,
          student_id: s.id,
          message: `Disability declared in ${h.tracking_number} but no NCPWD card evidence uploaded.`,
        });
      }
    }
  }
  return out;
}
