import React, { createContext, useContext, useState, ReactNode } from "react";
import type { ParentGuardianFormData, UniversityStudentFormData, PovertyQuestionnaireFormData } from "@/lib/validationSchemas";

export interface SecondaryStudentFormData {
  nemisId: string;
  studentName: string;
  classForm: string;
  school: string;
}

export interface ApplicationData {
  parentGuardian?: ParentGuardianFormData;
  universityStudent?: UniversityStudentFormData;
  secondaryStudent?: SecondaryStudentFormData;
  povertyQuestionnaire?: PovertyQuestionnaireFormData;
  trackingNumber?: string;
  advertId?: string;
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
  const [data, setData] = useState<ApplicationData>({});
  const [currentStep, setCurrentStep] = useState(1);

  const updateData = (newData: Partial<ApplicationData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  };

  const resetApplication = () => {
    setData({});
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
