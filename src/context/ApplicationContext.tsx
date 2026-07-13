import React, { createContext, useContext, useState, ReactNode } from "react";
import type { ParentGuardianFormData, UniversityStudentFormData, PovertyQuestionnaireFormData } from "@/lib/validationSchemas";

export interface SecondaryStudentFormData {
  nemisId: string;
  studentName: string;
  classForm: string;
  school: string;
}

/**
 * Generic per-student record used by the multi-student repeater.
 * Either secondary or university shape; max 3 per parent application.
 */
export type EducationCategory = "high_school" | "university" | "college" | "tvet";

export interface StudentEntry {
  id: string; // local-only uuid for React keys
  studentType: "secondary" | "university";
  /** Fine-grained education level. For secondary: always 'high_school'. For higher-ed: user picks. */
  educationCategory?: EducationCategory;
  studentName: string;
  identifier: string; // NEMIS/birth-cert OR university student id
  institution: string;
  admissionNumber?: string;
  classForm?: string;
  yearOfStudy?: string;
  course?: string;
  feeBalance?: number;
  // Disability Verification Layer (optional; required when applicant declares disability)
  ncpwdRegistrationNumber?: string;
  disabilityType?: string;
  disabilityCardUrl?: string;
}

export interface ApplicationData {
  parentGuardian?: ParentGuardianFormData;
  // Legacy single-student fields (kept for back-compat; mirror students[0])
  universityStudent?: UniversityStudentFormData;
  secondaryStudent?: SecondaryStudentFormData;
  povertyQuestionnaire?: PovertyQuestionnaireFormData;
  trackingNumber?: string;
  advertId?: string;
  // New: 1-3 students
  students?: StudentEntry[];
  /**
   * Feature: Education Level Selection (Step 2 of the wizard).
   * Explicit applicant choice that determines which student-detail sub-steps
   * appear next. Both flags may be true (mixed household).
   */
  educationLevels?: { secondary: boolean; higherEd: boolean };
}

interface ApplicationContextType {
  data: ApplicationData;
  updateData: (newData: Partial<ApplicationData>) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  resetApplication: () => void;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

/**
 * Draft persistence (B-2 fix).
 * Applicants often lose progress to accidental refresh, phone context switches,
 * or auto-locking on shared/public devices. We persist the in-progress form
 * data to sessionStorage — NOT localStorage — because the storage clears when
 * the tab is closed, avoiding PII (National ID, phone, poverty answers) being
 * left behind on cybercafé/kiosk devices. It still survives page refresh,
 * back/forward navigation, and short accidental closes within the same tab.
 * The draft is cleared explicitly after a successful submission.
 */
const DRAFT_STORAGE_KEY = "bursary-ke-application-draft-v1";

function loadDraft(): ApplicationData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as ApplicationData;
    return null;
  } catch {
    return null;
  }
}

function saveDraft(data: ApplicationData) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private-mode / disabled storage — silently ignore */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function ApplicationProvider({ children }: { children: ReactNode }) {
  // Hydrate from sessionStorage on first mount. If nothing is saved we start
  // with an empty students array, matching the previous behaviour exactly.
  const [data, setData] = useState<ApplicationData>(() => {
    const restored = loadDraft();
    return restored ?? { students: [] };
  });
  const [currentStep, setCurrentStep] = useState(1);

  const updateData = (newData: Partial<ApplicationData>) => {
    setData((prev) => {
      const next = { ...prev, ...newData };
      // Persist every update so a refresh mid-form loses nothing.
      saveDraft(next);
      return next;
    });
  };

  const resetApplication = () => {
    setData({ students: [] });
    setCurrentStep(1);
    // Wipe the draft — called after a successful submission or explicit reset.
    clearDraft();
  };

  return (
    <ApplicationContext.Provider
      value={{ data, updateData, currentStep, setCurrentStep, resetApplication }}
    >
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplication() {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error("useApplication must be used within an ApplicationProvider");
  }
  return context;
}
