import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Language = "en" | "sw";

const translations: Record<string, Record<Language, string>> = {
  // Header
  "nav.home": { en: "Home", sw: "Nyumbani" },
  "nav.browse": { en: "Browse Bursaries", sw: "Tazama Bursari" },
  "nav.apply_secondary": { en: "Apply (Secondary)", sw: "Omba (Sekondari)" },
  "nav.apply_university": { en: "Apply (University)", sw: "Omba (Chuo Kikuu)" },
  "nav.track": { en: "Track Application", sw: "Fuatilia Maombi" },
  "nav.faq": { en: "FAQ", sw: "Maswali" },

  // Hero
  "hero.badge": { en: "Government of Kenya Initiative", sw: "Mpango wa Serikali ya Kenya" },
  "hero.title_1": { en: "Empowering Kenyan Students Through", sw: "Kuwawezesha Wanafunzi wa Kenya Kupitia" },
  "hero.title_2": { en: "Transparent Bursaries", sw: "Bursari za Uwazi" },
  "hero.subtitle": {
    en: "Access educational funding through a fair, transparent, and secure platform. Apply for bursaries for secondary school, university, or college education.",
    sw: "Pata ufadhili wa elimu kupitia jukwaa la haki, uwazi, na salama. Omba bursari za shule za upili, chuo kikuu, au elimu ya chuo.",
  },
  "hero.apply_now": { en: "Apply Now", sw: "Omba Sasa" },
  "hero.track": { en: "Track Application", sw: "Fuatilia Maombi" },
  "hero.free": { en: "100% Free Application", sw: "Maombi ya Bure 100%" },
  "hero.secure": { en: "Secure & Private", sw: "Salama na Faragha" },
  "hero.realtime": { en: "Real-time Tracking", sw: "Ufuatiliaji wa Wakati Halisi" },
  "hero.live_programs": { en: "Open Bursary Programs Across Kenya", sw: "Programu za Bursari Zilizo Wazi Kenya" },

  // Stats
  "stats.applications": { en: "Applications Processed", sw: "Maombi Yaliyoshughulikiwa" },
  "stats.approved": { en: "Students Funded", sw: "Wanafunzi Waliofadhiliwa" },
  "stats.counties": { en: "Counties Covered", sw: "Kaunti Zilizoshughulikiwa" },
  "stats.disbursed": { en: "Total Disbursed", sw: "Jumla Iliyotolewa" },

  // Application Form
  "form.parent_title": { en: "Parent/Guardian Information", sw: "Taarifa za Mzazi/Mlezi" },
  "form.student_title": { en: "Student Information", sw: "Taarifa za Mwanafunzi" },
  "form.assessment": { en: "Poverty Assessment", sw: "Tathmini ya Umaskini" },
  "form.review": { en: "Review & Submit", sw: "Kagua na Wasilisha" },
  "form.next": { en: "Next", sw: "Endelea" },
  "form.back": { en: "Back", sw: "Rudi" },
  "form.submit": { en: "Submit Application", sw: "Wasilisha Maombi" },

  // Tracking
  "track.title": { en: "Track Your Application", sw: "Fuatilia Maombi Yako" },
  "track.enter_number": { en: "Enter your tracking number", sw: "Ingiza nambari yako ya ufuatiliaji" },
  "track.search": { en: "Search", sw: "Tafuta" },

  // Footer
  "footer.rights": { en: "All rights reserved.", sw: "Haki zote zimehifadhiwa." },
  "footer.privacy": { en: "Privacy Policy", sw: "Sera ya Faragha" },
  "footer.terms": { en: "Terms of Service", sw: "Masharti ya Huduma" },
  "footer.data_protection": { en: "Data Protection", sw: "Ulinzi wa Data" },

  // Document Upload
  "docs.upload_title": { en: "Upload Required Documents", sw: "Pakia Nyaraka Zinazohitajika" },
  "docs.upload_desc": { en: "Upload clear scans or photos of required documents", sw: "Pakia picha au skani za nyaraka zinazohitajika" },
  "docs.national_id": { en: "National ID (Parent/Guardian)", sw: "Kitambulisho cha Taifa (Mzazi/Mlezi)" },
  "docs.birth_cert": { en: "Birth Certificate", sw: "Cheti cha Kuzaliwa" },
  "docs.admission_letter": { en: "School Admission Letter", sw: "Barua ya Kuandikishwa Shuleni" },
  "docs.fee_structure": { en: "Fee Structure", sw: "Muundo wa Ada" },
  "docs.transcripts": { en: "Academic Transcripts", sw: "Nakala za Kielimu" },
  "docs.max_size": { en: "Max 5MB per file. PDF, JPG, PNG accepted.", sw: "Upeo wa 5MB kwa faili. PDF, JPG, PNG zinakubalika." },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("bursary-lang");
    return (saved === "sw" ? "sw" : "en") as Language;
  });

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("bursary-lang", lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[key]?.[language] || key;
    },
    [language]
  );

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useI18n();

  return (
    <button
      onClick={() => setLanguage(language === "en" ? "sw" : "en")}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border bg-background hover:bg-secondary transition-colors"
      aria-label={`Switch to ${language === "en" ? "Swahili" : "English"}`}
    >
      <span className="text-base">{language === "en" ? "🇰🇪" : "🇬🇧"}</span>
      <span>{language === "en" ? "SW" : "EN"}</span>
    </button>
  );
}
