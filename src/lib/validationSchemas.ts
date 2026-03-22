import { z } from "zod";

/**
 * Validation schemas for all forms in the Bursary-KE platform
 * Uses Zod for type-safe validation
 */

// Kenyan National ID validation (8 digits)
export const nationalIdSchema = z
  .string()
  .min(1, "National ID is required")
  .regex(/^\d{8}$/, "National ID must be exactly 8 digits");

// Kenyan phone number validation
export const phoneSchema = z
  .string()
  .min(1, "Phone number is required")
  .regex(
    /^(\+254|0)[17]\d{8}$/,
    "Enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)"
  );

// Email validation (optional)
export const optionalEmailSchema = z
  .string()
  .email("Enter a valid email address")
  .optional()
  .or(z.literal(""));

// NEMIS ID validation for secondary students (14 digits)
export const nemisIdSchema = z
  .string()
  .min(1, "NEMIS ID is required")
  .regex(/^\d{14}$/, "NEMIS ID must be exactly 14 digits");

// Student ID validation (flexible format for universities)
export const studentIdSchema = z
  .string()
  .min(1, "Student ID is required")
  .min(5, "Student ID must be at least 5 characters")
  .max(20, "Student ID must be at most 20 characters");

// Tracking number validation
export const trackingNumberSchema = z
  .string()
  .min(1, "Tracking number is required")
  .regex(/^BKE-[A-Z0-9]{6}$/i, "Invalid tracking number format (e.g., BKE-ABC123)");

// Parent/Guardian Information Schema
export const parentGuardianSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nationalId: nationalIdSchema,
  phoneNumber: phoneSchema,
  email: optionalEmailSchema,
  county: z.string().min(1, "County is required"),
  ward: z.string().min(1, "Ward is required"),
  selectedAdvertId: z.string().min(1, "Please select a bursary to apply for"),
  consentNotifications: z.boolean().default(false),
  consentDataUsage: z.boolean().refine((val) => val === true, {
    message: "You must agree to the data usage policy",
  }),
});

export type ParentGuardianFormData = z.infer<typeof parentGuardianSchema>;

// Secondary Student Schema
export const secondaryStudentSchema = z.object({
  nemisId: nemisIdSchema,
  studentName: z.string().min(1, "Student name is required"),
  classForm: z.enum(["Form 1", "Form 2", "Form 3", "Form 4"], {
    required_error: "Please select a class/form",
  }),
  schoolName: z.string().min(1, "School name is required"),
  schoolCounty: z.string().min(1, "County is required"),
});

export type SecondaryStudentFormData = z.infer<typeof secondaryStudentSchema>;

// University/College Student Schema
export const universityStudentSchema = z.object({
  studentId: studentIdSchema,
  studentName: z.string().min(1, "Student name is required"),
  institution: z.string().min(1, "Institution is required"),
  course: z.string().min(1, "Course/Program is required"),
  yearOfStudy: z.enum(["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"], {
    required_error: "Please select year of study",
  }),
});

export type UniversityStudentFormData = z.infer<typeof universityStudentSchema>;

// Poverty Questionnaire Schema
export const povertyQuestionnaireSchema = z.object({
  householdIncome: z.number().min(0).max(100),
  numberOfDependents: z.number().min(0).max(20),
  housingType: z.enum(["Owned", "Rented", "Informal", "Other"], {
    required_error: "Please select housing type",
  }),
  accessToUtilities: z.object({
    electricity: z.boolean(),
    water: z.boolean(),
    internet: z.boolean(),
  }),
  parentalEmployment: z.enum(
    ["Both Employed", "One Employed", "Both Unemployed", "Self-Employed", "Deceased/N/A"],
    { required_error: "Please select employment status" }
  ),
  otherChildrenInSchool: z.number().min(0).max(15),
  receivesOtherAid: z.boolean(),
  additionalCircumstances: z.string().max(500).optional(),
});

export type PovertyQuestionnaireFormData = z.infer<typeof povertyQuestionnaireSchema>;

// Full Application Schema (combines all steps)
export const fullApplicationSchema = z.object({
  parentGuardian: parentGuardianSchema,
  studentType: z.enum(["secondary", "university"]),
  secondaryStudent: secondaryStudentSchema.optional(),
  universityStudent: universityStudentSchema.optional(),
  povertyQuestionnaire: povertyQuestionnaireSchema,
  confirmAccuracy: z.boolean().refine((val) => val === true, {
    message: "You must confirm the information is accurate",
  }),
});

export type FullApplicationFormData = z.infer<typeof fullApplicationSchema>;

// Calculate poverty score from questionnaire (0-100, higher = more need)
export function calculatePovertyScore(data: PovertyQuestionnaireFormData): number {
  let score = 0;

  // Income contributes inversely (lower income = higher score)
  score += 100 - data.householdIncome;

  // More dependents = higher need
  score += Math.min(data.numberOfDependents * 5, 25);

  // Housing type
  const housingScores: Record<string, number> = {
    Owned: 0,
    Rented: 10,
    Informal: 25,
    Other: 15,
  };
  score += housingScores[data.housingType] || 0;

  // Utilities access (lack of = higher need)
  if (!data.accessToUtilities.electricity) score += 10;
  if (!data.accessToUtilities.water) score += 10;
  if (!data.accessToUtilities.internet) score += 5;

  // Parental employment
  const employmentScores: Record<string, number> = {
    "Both Employed": 0,
    "One Employed": 15,
    "Self-Employed": 10,
    "Both Unemployed": 30,
    "Deceased/N/A": 25,
  };
  score += employmentScores[data.parentalEmployment] || 0;

  // Other children in school
  score += Math.min(data.otherChildrenInSchool * 3, 15);

  // Normalize to 0-100
  return Math.min(Math.max(Math.round(score / 2.5), 0), 100);
}

// Get poverty tier from score
export function getPovertyTier(score: number): "Low" | "Medium" | "High" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}
