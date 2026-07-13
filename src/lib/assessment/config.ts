/**
 * Configuration-Driven Assessment Engine — Question Registry
 * ----------------------------------------------------------
 * Central, declarative catalogue of assessment questions. The renderer
 * (see `engine.ts` + `AssessmentRenderer.tsx`) reads this config and
 * generates the correct set of questions per application based on:
 *   - Application composition (household)
 *   - Each student's education category (secondary / university / tvet / …)
 *
 * Placeholders inside a question's text are interpolated at runtime:
 *   {studentName}  → e.g. "Brian Otieno"
 *   {institution}  → e.g. "Kisumu Boys High School"
 *
 * FUTURE ADMIN MANAGEABILITY:
 * This file is intentionally a plain array of typed objects so a future
 * admin UI (or a DB table mirror) can add/disable/reorder items without
 * touching any rendering code. Adding a new education category only
 * requires appending items with the appropriate `appliesTo` — no page or
 * form rewrites required.
 */

/** Education categories currently supported. Extend freely — the engine
 *  will pick up new values automatically as long as StudentEntry uses
 *  the same identifier. */
export type AssessmentEducationCategory =
  | "high_school"
  | "university"
  | "college"
  | "tvet"
  | "diploma"
  | "certificate"
  | "postgraduate"
  | "special_needs";

/** Where a question applies. Household questions render exactly once;
 *  per-student questions render once per matching student. */
export type AssessmentScope = "household" | "per_student";

export interface AssessmentOption {
  value: string;
  label: string;
}

export interface AssessmentQuestion {
  /** Stable identifier — used as the storage key suffix. */
  id: string;
  /** Human question text. May contain {studentName} / {institution}. */
  text: string;
  /** Household (asked once) or per-student (asked for each matching student). */
  scope: AssessmentScope;
  /** For per-student questions: which education categories this applies to.
   *  Use ["*"] for all. Ignored for household questions. */
  appliesTo?: (AssessmentEducationCategory | "*")[];
  /** Optional grouping label for the UI. */
  section?: string;
  /** UI ordering (lower = earlier). Default 100. */
  order?: number;
  /** Whether an answer is required. Default true. */
  required?: boolean;
  /** Options for dropdowns. Omit for free-text/numeric. */
  options?: AssessmentOption[];
  /** Set false to hide without deleting. Default true. */
  active?: boolean;
}

const YES_NO: AssessmentOption[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/**
 * The declarative registry. Order here is a hint; `engine.ts` sorts by
 * `order` then by declaration position.
 */
export const assessmentQuestions: AssessmentQuestion[] = [
  // ---------------- HOUSEHOLD (once per application) ----------------
  {
    id: "hh_monthly_expenses",
    scope: "household",
    section: "Household",
    order: 10,
    text: "Approximately what are your household's total monthly expenses?",
    options: [
      { value: "below_5000", label: "Below KES 5,000" },
      { value: "5000_15000", label: "KES 5,000 – 15,000" },
      { value: "15000_30000", label: "KES 15,000 – 30,000" },
      { value: "30000_60000", label: "KES 30,000 – 60,000" },
      { value: "above_60000", label: "Above KES 60,000" },
    ],
  },
  {
    id: "hh_financial_challenge",
    scope: "household",
    section: "Household",
    order: 20,
    text: "What is the biggest financial challenge your household currently faces?",
    options: [
      { value: "food", label: "Putting food on the table" },
      { value: "rent", label: "Paying rent / housing" },
      { value: "medical", label: "Medical / healthcare costs" },
      { value: "school_fees", label: "School fees" },
      { value: "debt", label: "Debt / loans" },
      { value: "none", label: "No major challenge" },
    ],
  },

  // ---------------- SECONDARY (per high-school student) ----------------
  {
    id: "sec_boarding",
    scope: "per_student",
    appliesTo: ["high_school"],
    section: "Secondary",
    order: 30,
    text: "Does {studentName} currently board at {institution}?",
    options: YES_NO,
  },
  {
    id: "sec_other_bursary",
    scope: "per_student",
    appliesTo: ["high_school"],
    section: "Secondary",
    order: 31,
    text: "Has {studentName} received another Secondary School bursary this academic year?",
    options: YES_NO,
  },
  {
    id: "sec_travel_distance",
    scope: "per_student",
    appliesTo: ["high_school"],
    section: "Secondary",
    order: 32,
    text: "How far does {studentName} travel to school?",
    options: [
      { value: "under_1km", label: "Less than 1 km" },
      { value: "1_5km", label: "1 – 5 km" },
      { value: "5_15km", label: "5 – 15 km" },
      { value: "over_15km", label: "More than 15 km" },
      { value: "boarding", label: "Boards — not applicable" },
    ],
  },

  // ---------------- UNIVERSITY / HIGHER-ED (per student) ----------------
  {
    id: "uni_helb",
    scope: "per_student",
    appliesTo: ["university", "college", "tvet", "diploma", "certificate", "postgraduate"],
    section: "Higher Education",
    order: 40,
    text: "Does {studentName} currently receive HELB funding?",
    options: YES_NO,
  },
  {
    id: "uni_accommodation",
    scope: "per_student",
    appliesTo: ["university", "college", "tvet", "diploma", "certificate", "postgraduate"],
    section: "Higher Education",
    order: 41,
    text: "Does {studentName} reside in {institution} accommodation?",
    options: YES_NO,
  },
  {
    id: "uni_outstanding_fees",
    scope: "per_student",
    appliesTo: ["university", "college", "tvet", "diploma", "certificate", "postgraduate"],
    section: "Higher Education",
    order: 42,
    text: "Does {studentName} have outstanding tuition fees at {institution}?",
    options: YES_NO,
  },

  // ---------------- SPECIAL NEEDS (extensibility example) ----------------
  {
    id: "sn_support_plan",
    scope: "per_student",
    appliesTo: ["special_needs"],
    section: "Special Needs",
    order: 50,
    text: "Does {studentName} have an active individualised support plan at {institution}?",
    options: YES_NO,
  },
];
