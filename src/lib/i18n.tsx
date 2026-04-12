import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Language = "en" | "sw";

const translations: Record<string, Record<Language, string>> = {
  // Header / Nav
  "nav.home": { en: "Home", sw: "Nyumbani" },
  "nav.browse": { en: "Browse Bursaries", sw: "Tazama Bursari" },
  "nav.apply_secondary": { en: "Apply (Secondary)", sw: "Omba (Sekondari)" },
  "nav.apply_university": { en: "Apply (University)", sw: "Omba (Chuo Kikuu)" },
  "nav.track": { en: "Track Application", sw: "Fuatilia Maombi" },
  "nav.faq": { en: "FAQ", sw: "Maswali" },
  "nav.portals": { en: "Portals", sw: "Milango" },
  "nav.portal": { en: "Portal", sw: "Mlango" },

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
  "hero.county": { en: "County", sw: "Kaunti" },
  "hero.left": { en: "left", sw: "zimebaki" },

  // Stats
  "stats.title": { en: "Making a Difference", sw: "Kuleta Mabadiliko" },
  "stats.subtitle": { en: "Real impact numbers from our bursary program across Kenya", sw: "Takwimu halisi za athari za programu yetu ya bursari kote Kenya" },
  "stats.total_distributed": { en: "Total Amount Distributed", sw: "Jumla ya Fedha Zilizotolewa" },
  "stats.since_inception": { en: "Since program inception", sw: "Tangu programu kuanza" },
  "stats.students_supported": { en: "Students Supported", sw: "Wanafunzi Walioungwa Mkono" },
  "stats.across_counties": { en: "Across all 47 counties", sw: "Katika kaunti zote 47" },
  "stats.success_rate": { en: "Success Rate", sw: "Kiwango cha Mafanikio" },
  "stats.satisfaction": { en: "Beneficiary satisfaction", sw: "Kuridhika kwa wanufaika" },

  // Reviews
  "reviews.title": { en: "What Beneficiaries Say", sw: "Wanufaika Wanasema Nini" },
  "reviews.subtitle": { en: "Real stories from students and parents who have benefited from Bursary-KE", sw: "Hadithi halisi kutoka kwa wanafunzi na wazazi walionufaika na Bursary-KE" },

  // Tracking Widget
  "tracking.title": { en: "Track Your Application", sw: "Fuatilia Maombi Yako" },
  "tracking.subtitle": { en: "Enter your tracking number to check your application status", sw: "Ingiza nambari yako ya ufuatiliaji kuangalia hali ya maombi yako" },
  "tracking.placeholder": { en: "Enter tracking number (e.g., BKE-ABC123)", sw: "Ingiza nambari ya ufuatiliaji (mfano, BKE-ABC123)" },
  "tracking.button": { en: "Track", sw: "Fuatilia" },
  "tracking.error_empty": { en: "Please enter a tracking number", sw: "Tafadhali ingiza nambari ya ufuatiliaji" },
  "tracking.error_format": { en: "Invalid format. Use BKE-XXXXXX (e.g., BKE-ABC123)", sw: "Muundo batili. Tumia BKE-XXXXXX (mfano, BKE-ABC123)" },
  "tracking.found": { en: "Application Found", sw: "Maombi Yamepatikana" },
  "tracking.current_stage": { en: "Current Stage", sw: "Hatua ya Sasa" },
  "tracking.view_details": { en: "View full details →", sw: "Tazama maelezo kamili →" },
  "tracking.not_found": { en: "Application Not Found", sw: "Maombi Hayajapatikana" },
  "tracking.not_found_hint": { en: "Please check your tracking number and try again", sw: "Tafadhali kagua nambari yako ya ufuatiliaji na ujaribu tena" },
  "tracking.lost_number": { en: "Lost your tracking number?", sw: "Umepoteza nambari yako ya ufuatiliaji?" },
  "tracking.contact_support": { en: "Contact support", sw: "Wasiliana na msaada" },

  // Bursary Slider
  "bursary.programs_badge": { en: "Bursary Programs", sw: "Programu za Bursari" },
  "bursary.open_apps": { en: "Open Applications", sw: "Maombi Yaliyo Wazi" },
  "bursary.county_programs": { en: "County Bursary Programs", sw: "Programu za Bursari za Kaunti" },
  "bursary.no_active": { en: "No active bursary programs at the moment. Subscribe to get notified when new opportunities open.", sw: "Hakuna programu za bursari zinazoendelea kwa sasa. Jiandikishe kupata arifa programu mpya zinapofunguka." },
  "bursary.dont_miss": { en: "Don't miss out! Apply now for active bursary opportunities in your county.", sw: "Usikose! Omba sasa kwa fursa za bursari zinazoendelea katika kaunti yako." },
  "bursary.stay_informed": { en: "Stay Informed", sw: "Baki na Taarifa" },
  "bursary.subscribe_desc": { en: "Subscribe to receive instant notifications when new bursary opportunities become available in your county.", sw: "Jiandikishe kupokea arifa za papo hapo programu mpya za bursari zinapopatikana katika kaunti yako." },
  "bursary.view_past": { en: "View Past Bursaries", sw: "Tazama Bursari Zilizopita" },
  "bursary.quick_search": { en: "Quick Search:", sw: "Tafuta Haraka:" },
  "bursary.select_county": { en: "Select County", sw: "Chagua Kaunti" },
  "bursary.select_ward": { en: "Select Ward", sw: "Chagua Wadi" },
  "bursary.clear": { en: "Clear", sw: "Futa" },
  "bursary.clear_filters": { en: "Clear Filters", sw: "Futa Vichujio" },
  "bursary.no_results": { en: "No bursaries found for this selection.", sw: "Hakuna bursari zilizopatikana kwa chaguo hili." },
  "bursary.showing": { en: "Showing", sw: "Inaonyesha" },
  "bursary.results": { en: "results", sw: "matokeo" },
  "bursary.result": { en: "result", sw: "tokeo" },
  "bursary.in": { en: "in", sw: "katika" },
  "bursary.budget": { en: "Budget", sw: "Bajeti" },
  "bursary.apply_now": { en: "Apply Now", sw: "Omba Sasa" },
  "bursary.view_all": { en: "View All", sw: "Tazama Zote" },
  "bursary.required_docs": { en: "Required Documents", sw: "Nyaraka Zinazohitajika" },
  "bursary.more_docs": { en: "more documents...", sw: "nyaraka zaidi..." },
  "bursary.assistance_centers": { en: "Assistance Centers", sw: "Vituo vya Msaada" },
  "bursary.want_alerts": { en: "Want alerts for", sw: "Unataka arifa za" },

  // FAQ
  "faq.title": { en: "Frequently Asked Questions", sw: "Maswali Yanayoulizwa Mara kwa Mara" },
  "faq.subtitle": { en: "Find answers to common questions about the bursary application process", sw: "Pata majibu ya maswali ya kawaida kuhusu mchakato wa maombi ya bursari" },
  "faq.view_all": { en: "View All FAQs", sw: "Tazama Maswali Yote" },

  // Footer
  "footer.tagline": { en: "Empowering Kenyan students through transparent, accessible, and fair bursary distribution.", sw: "Kuwawezesha wanafunzi wa Kenya kupitia usambazaji wa bursari wenye uwazi, upatikanaji, na haki." },
  "footer.quick_links": { en: "Quick Links", sw: "Viungo vya Haraka" },
  "footer.contact_us": { en: "Contact Us", sw: "Wasiliana Nasi" },
  "footer.legal": { en: "Legal", sw: "Kisheria" },
  "footer.privacy": { en: "Privacy Policy", sw: "Sera ya Faragha" },
  "footer.terms": { en: "Terms of Service", sw: "Masharti ya Huduma" },
  "footer.data_protection": { en: "Data Protection", sw: "Ulinzi wa Data" },
  "footer.follow_us": { en: "Follow Us", sw: "Tufuate" },
  "footer.rights": { en: "All rights reserved.", sw: "Haki zote zimehifadhiwa." },
  "footer.gov_initiative": { en: "A Government of Kenya Initiative", sw: "Mpango wa Serikali ya Kenya" },
  "footer.compliance": {
    en: "This platform complies with the Kenya Data Protection Act, 2019. All personal data collected is processed lawfully, used solely for bursary administration, and protected in accordance with the principles set out by the Office of the Data Protection Commissioner (ODPC). By using this platform, you consent to the collection and processing of your data for the purposes stated herein.",
    sw: "Jukwaa hili linazingatia Sheria ya Ulinzi wa Data ya Kenya, 2019. Data zote za kibinafsi zinazokusanywa zinashughulikiwa kisheria, zinatumika tu kwa usimamizi wa bursari, na zinalindwa kulingana na kanuni zilizowekwa na Ofisi ya Kamishna wa Ulinzi wa Data (ODPC). Kwa kutumia jukwaa hili, unakubali ukusanyaji na usindikaji wa data yako kwa madhumuni yaliyoelezwa hapa.",
  },

  // Application Form
  "form.parent_title": { en: "Parent/Guardian Information", sw: "Taarifa za Mzazi/Mlezi" },
  "form.student_title": { en: "Student Information", sw: "Taarifa za Mwanafunzi" },
  "form.assessment": { en: "Poverty Assessment", sw: "Tathmini ya Umaskini" },
  "form.review": { en: "Review & Submit", sw: "Kagua na Wasilisha" },
  "form.next": { en: "Next", sw: "Endelea" },
  "form.back": { en: "Back", sw: "Rudi" },
  "form.submit": { en: "Submit Application", sw: "Wasilisha Maombi" },

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
