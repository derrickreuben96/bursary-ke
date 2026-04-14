/**
 * Mock data for demonstration purposes
 * This data will be replaced with real API calls when backend is connected
 */

// Platform statistics
export const platformStats = {
  totalDistributed: 25000000,
  totalBeneficiaries: 5247,
  successRate: 0.95,
  pendingApplications: 342,
  approvedThisMonth: 128,
};

// Beneficiary reviews/testimonials (anonymized)
export const beneficiaryReviews = [
  {
    id: 1,
    name: "M***a K.",
    county: { en: "Kiambu County", sw: "Kaunti ya Kiambu" },
    message: {
      en: "This bursary helped me complete my Form 4 education. I am now pursuing a degree in Engineering. Thank you Bursary-KE!",
      sw: "Bursari hii ilinisaidia kumaliza elimu yangu ya Kidato cha 4. Sasa ninasomea shahada ya Uhandisi. Asante Bursary-KE!",
    },
    rating: 5,
    date: new Date("2025-12-15"),
  },
  {
    id: 2,
    name: "J***n O.",
    county: { en: "Kisumu County", sw: "Kaunti ya Kisumu" },
    message: {
      en: "The application process was simple and transparent. Within weeks, my fees were paid directly to my school.",
      sw: "Mchakato wa maombi ulikuwa rahisi na wa uwazi. Ndani ya wiki, ada yangu ililipwa moja kwa moja shuleni.",
    },
    rating: 5,
    date: new Date("2025-11-28"),
  },
  {
    id: 3,
    name: "A***a W.",
    county: { en: "Mombasa County", sw: "Kaunti ya Mombasa" },
    message: {
      en: "As a single mother, I couldn't afford university fees for my daughter. Bursary-KE made her dreams possible.",
      sw: "Kama mama mzazi peke yangu, sikuweza kumudu ada ya chuo kikuu kwa binti yangu. Bursary-KE ilifanya ndoto zake ziwezekane.",
    },
    rating: 5,
    date: new Date("2025-10-20"),
  },
  {
    id: 4,
    name: "P***r M.",
    county: { en: "Nakuru County", sw: "Kaunti ya Nakuru" },
    message: {
      en: "Transparent tracking system let me know exactly where my application was. Funds were disbursed on time.",
      sw: "Mfumo wa ufuatiliaji wa uwazi ulinijulisha mahali maombi yangu yalikuwa. Fedha zilitolewa kwa wakati.",
    },
    rating: 4,
    date: new Date("2025-09-14"),
  },
  {
    id: 5,
    name: "G***e N.",
    county: { en: "Nairobi County", sw: "Kaunti ya Nairobi" },
    message: {
      en: "I applied for three of my children and all were approved. The poverty assessment was fair and accurate.",
      sw: "Niliomba kwa watoto wangu watatu na wote walipitishwa. Tathmini ya umaskini ilikuwa ya haki na sahihi.",
    },
    rating: 5,
    date: new Date("2025-08-30"),
  },
];

// FAQ items (bilingual)
export const faqItems = [
  {
    question: { en: "Who is eligible to apply for a bursary?", sw: "Nani anastahili kuomba bursari?" },
    answer: {
      en: "Any Kenyan student enrolled in a registered secondary school, university, or college is eligible to apply. Applicants must demonstrate financial need through our poverty assessment questionnaire. Both day scholars and boarding students can apply.",
      sw: "Mwanafunzi yeyote wa Kenya aliyeandikishwa katika shule ya sekondari, chuo kikuu, au chuo iliyosajiliwa anastahili kuomba. Waombaji lazima waonyeshe uhitaji wa kifedha kupitia dodoso letu la tathmini ya umaskini. Wanafunzi wa kutwa na wa bweni wanaweza kuomba.",
    },
  },
  {
    question: { en: "What documents do I need to apply?", sw: "Ninahitaji nyaraka gani kuomba?" },
    answer: {
      en: "You will need your parent/guardian's National ID number, your NEMIS ID (for secondary students) or Student ID (for university students), and accurate information about your household circumstances. No physical documents need to be uploaded during application.",
      sw: "Utahitaji nambari ya Kitambulisho cha Taifa ya mzazi/mlezi wako, NEMIS ID yako (kwa wanafunzi wa sekondari) au Student ID (kwa wanafunzi wa chuo kikuu), na taarifa sahihi kuhusu hali ya kaya yako. Hakuna nyaraka za kimwili zinazohitajika kupakiwa wakati wa maombi.",
    },
  },
  {
    question: { en: "How long does the application process take?", sw: "Mchakato wa maombi unachukua muda gani?" },
    answer: {
      en: "Most applications are processed within 2-4 weeks. You can track your application status in real-time using the tracking number provided after submission. Complex cases may require additional verification time.",
      sw: "Maombi mengi yanashughulikiwa ndani ya wiki 2-4. Unaweza kufuatilia hali ya maombi yako kwa wakati halisi kwa kutumia nambari ya ufuatiliaji inayotolewa baada ya kuwasilisha. Kesi ngumu zinaweza kuhitaji muda wa ziada wa uthibitishaji.",
    },
  },
  {
    question: { en: "How is the bursary amount determined?", sw: "Kiasi cha bursari kinaamuliwa vipi?" },
    answer: {
      en: "The bursary amount is determined based on your poverty tier (assessed through the questionnaire), the type of institution, and available funds. Secondary students may receive KES 10,000-30,000, while university students may receive KES 20,000-80,000 per year.",
      sw: "Kiasi cha bursari kinaamuliwa kulingana na kiwango chako cha umaskini (kinachopimwa kupitia dodoso), aina ya taasisi, na fedha zilizopo. Wanafunzi wa sekondari wanaweza kupokea KES 10,000-30,000, huku wanafunzi wa chuo kikuu wanaweza kupokea KES 20,000-80,000 kwa mwaka.",
    },
  },
  {
    question: { en: "Can I apply for multiple children?", sw: "Ninaweza kuomba kwa watoto wengi?" },
    answer: {
      en: "Yes, parents/guardians can submit separate applications for each eligible child. Each application will be assessed independently based on the student's details and your household circumstances.",
      sw: "Ndiyo, wazazi/walezi wanaweza kuwasilisha maombi tofauti kwa kila mtoto anayestahili. Kila maombi yatapimwa kwa kujitegemea kulingana na maelezo ya mwanafunzi na hali ya kaya yako.",
    },
  },
  {
    question: { en: "How are funds disbursed?", sw: "Fedha zinatolewa vipi?" },
    answer: {
      en: "Funds are disbursed directly to the educational institution, not to individuals. This ensures transparency and that funds are used for educational purposes. Schools receive payments electronically.",
      sw: "Fedha zinatolewa moja kwa moja kwa taasisi ya elimu, si kwa watu binafsi. Hii inahakikisha uwazi na kwamba fedha zinatumika kwa madhumuni ya kielimu. Shule zinapokea malipo kielektroniki.",
    },
  },
  {
    question: { en: "What happens if my application is rejected?", sw: "Nini kinatokea maombi yangu yakikataliwa?" },
    answer: {
      en: "If your application is rejected, you will receive a notification with the reason. You may appeal the decision within 14 days by providing additional information or clarification. Most rejections can be resolved through the appeal process.",
      sw: "Ikiwa maombi yako yamekataliwa, utapokea arifa na sababu. Unaweza kukata rufaa ya uamuzi ndani ya siku 14 kwa kutoa taarifa au ufafanuzi wa ziada. Kukataliwa mengi kunaweza kutatuliwa kupitia mchakato wa rufaa.",
    },
  },
  {
    question: { en: "Is my personal information secure?", sw: "Je, taarifa zangu za kibinafsi ziko salama?" },
    answer: {
      en: "Yes, we take privacy seriously. All personal data is encrypted and stored securely. Only aggregated statistics are visible to administrators—no individual names, ID numbers, or contact details are accessible. We comply with Kenya's Data Protection Act.",
      sw: "Ndiyo, tunachukulia faragha kwa uzito. Data zote za kibinafsi zimesimbwa na kuhifadhiwa kwa usalama. Takwimu zilizojumlishwa pekee ndizo zinazoonekana kwa wasimamizi—hakuna majina ya mtu binafsi, nambari za kitambulisho, au maelezo ya mawasiliano yanayopatikana. Tunazingatia Sheria ya Ulinzi wa Data ya Kenya.",
    },
  },
];

// Kenyan counties
export const kenyanCounties = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans-Nzoia", "Turkana", "Uasin Gishu", "Vihiga",
  "Wajir", "West Pokot",
];

// Kenyan universities and colleges
export const kenyanInstitutions = [
  // Public Universities
  "University of Nairobi",
  "Kenyatta University",
  "Moi University",
  "Jomo Kenyatta University of Agriculture and Technology",
  "Egerton University",
  "Maseno University",
  "Masinde Muliro University of Science and Technology",
  "Dedan Kimathi University of Technology",
  "Technical University of Kenya",
  "Technical University of Mombasa",
  "Machakos University",
  "Karatina University",
  "Kisii University",
  "Laikipia University",
  "South Eastern Kenya University",
  "Pwani University",
  "Chuka University",
  "Kirinyaga University",
  "Multimedia University of Kenya",
  "University of Eldoret",
  // Private Universities
  "Strathmore University",
  "United States International University - Africa",
  "Daystar University",
  "Kenya Methodist University",
  "Mount Kenya University",
  "Africa Nazarene University",
  "Catholic University of Eastern Africa",
  "KCA University",
  "Pan Africa Christian University",
  "Riara University",
  // Colleges
  "Kenya Medical Training College",
  "Kenya Institute of Management",
  "Kenya Polytechnic University College",
  "Nairobi Technical Training Institute",
  "Mombasa Technical Training Institute",
  "Eldoret Polytechnic",
  "Kisumu Polytechnic",
  "Other (specify)",
];

// Sample tracking data
export const sampleTrackingData: Record<string, TrackingInfo> = {
  "BKE-ABC123": {
    trackingNumber: "BKE-ABC123",
    studentType: "secondary",
    currentStage: 3,
    stages: [
      {
        name: "Application Received",
        status: "completed",
        date: new Date("2026-01-10"),
        message: "Your application has been received and is in our system.",
      },
      {
        name: "Under Review",
        status: "completed",
        date: new Date("2026-01-15"),
        message: "Your application is being reviewed by our team.",
      },
      {
        name: "Verification",
        status: "current",
        date: new Date("2026-01-20"),
        message: "We are verifying the information provided.",
      },
      {
        name: "Approval Decision",
        status: "pending",
        date: null,
        message: "Awaiting final approval decision.",
      },
      {
        name: "Funds Disbursed",
        status: "pending",
        date: null,
        message: "Funds will be sent to your institution.",
      },
    ],
  },
  "BKE-XYZ789": {
    trackingNumber: "BKE-XYZ789",
    studentType: "university",
    currentStage: 5,
    stages: [
      {
        name: "Application Received",
        status: "completed",
        date: new Date("2025-12-01"),
        message: "Your application has been received.",
      },
      {
        name: "Under Review",
        status: "completed",
        date: new Date("2025-12-08"),
        message: "Application reviewed successfully.",
      },
      {
        name: "Verification",
        status: "completed",
        date: new Date("2025-12-15"),
        message: "All information verified.",
      },
      {
        name: "Approved",
        status: "completed",
        date: new Date("2025-12-20"),
        message: "Congratulations! Your application has been approved for KES 45,000.",
      },
      {
        name: "Funds Disbursed",
        status: "completed",
        date: new Date("2026-01-05"),
        message: "Funds of KES 45,000 have been sent to University of Nairobi.",
      },
    ],
  },
};

export interface TrackingStage {
  name: string;
  status: "completed" | "current" | "pending";
  date: Date | null;
  message: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  studentType: "secondary" | "university";
  currentStage: number;
  stages: TrackingStage[];
}

// Admin dashboard mock data
export const adminDashboardData = {
  totalApplications: 5847,
  approvedApplications: 5247,
  pendingApplications: 342,
  rejectedApplications: 258,
  totalBudgetDisbursed: 25000000,
  povertyDistribution: [
    { tier: "High Priority", count: 2124, percentage: 40 },
    { tier: "Medium Priority", count: 2093, percentage: 40 },
    { tier: "Low Priority", count: 1030, percentage: 20 },
  ],
  applicationsByCounty: [
    { county: "Nairobi", count: 892 },
    { county: "Kiambu", count: 654 },
    { county: "Nakuru", count: 523 },
    { county: "Mombasa", count: 467 },
    { county: "Kisumu", count: 412 },
    { county: "Others", count: 2899 },
  ],
  monthlyTrends: [
    { month: "Aug", applications: 420 },
    { month: "Sep", applications: 580 },
    { month: "Oct", applications: 720 },
    { month: "Nov", applications: 890 },
    { month: "Dec", applications: 650 },
    { month: "Jan", applications: 540 },
  ],
};
