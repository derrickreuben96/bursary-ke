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
}

interface ApplicationContextType {
  data: ApplicationData;
  updateData: (newData: Partial<ApplicationData>) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  resetApplication: () => void;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ApplicationData>({ students: [] });
  const [currentStep, setCurrentStep] = useState(1);

  const updateData = (newData: Partial<ApplicationData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetApplication = () => {
    setData({ students: [] });
    setCurrentStep(1);
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
