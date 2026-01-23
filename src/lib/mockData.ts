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
    county: "Kiambu County",
    message:
      "This bursary helped me complete my Form 4 education. I am now pursuing a degree in Engineering. Thank you Bursary-KE!",
    rating: 5,
    date: new Date("2025-12-15"),
  },
  {
    id: 2,
    name: "J***n O.",
    county: "Kisumu County",
    message:
      "The application process was simple and transparent. Within weeks, my fees were paid directly to my school.",
    rating: 5,
    date: new Date("2025-11-28"),
  },
  {
    id: 3,
    name: "A***a W.",
    county: "Mombasa County",
    message:
      "As a single mother, I couldn't afford university fees for my daughter. Bursary-KE made her dreams possible.",
    rating: 5,
    date: new Date("2025-10-20"),
  },
  {
    id: 4,
    name: "P***r M.",
    county: "Nakuru County",
    message:
      "Transparent tracking system let me know exactly where my application was. Funds were disbursed on time.",
    rating: 4,
    date: new Date("2025-09-14"),
  },
  {
    id: 5,
    name: "G***e N.",
    county: "Nairobi County",
    message:
      "I applied for three of my children and all were approved. The poverty assessment was fair and accurate.",
    rating: 5,
    date: new Date("2025-08-30"),
  },
];

// FAQ items
export const faqItems = [
  {
    question: "Who is eligible to apply for a bursary?",
    answer:
      "Any Kenyan student enrolled in a registered secondary school, university, or college is eligible to apply. Applicants must demonstrate financial need through our poverty assessment questionnaire. Both day scholars and boarding students can apply.",
  },
  {
    question: "What documents do I need to apply?",
    answer:
      "You will need your parent/guardian's National ID number, your NEMIS ID (for secondary students) or Student ID (for university students), and accurate information about your household circumstances. No physical documents need to be uploaded during application.",
  },
  {
    question: "How long does the application process take?",
    answer:
      "Most applications are processed within 2-4 weeks. You can track your application status in real-time using the tracking number provided after submission. Complex cases may require additional verification time.",
  },
  {
    question: "How is the bursary amount determined?",
    answer:
      "The bursary amount is determined based on your poverty tier (assessed through the questionnaire), the type of institution, and available funds. Secondary students may receive KES 10,000-30,000, while university students may receive KES 20,000-80,000 per year.",
  },
  {
    question: "Can I apply for multiple children?",
    answer:
      "Yes, parents/guardians can submit separate applications for each eligible child. Each application will be assessed independently based on the student's details and your household circumstances.",
  },
  {
    question: "How are funds disbursed?",
    answer:
      "Funds are disbursed directly to the educational institution, not to individuals. This ensures transparency and that funds are used for educational purposes. Schools receive payments electronically.",
  },
  {
    question: "What happens if my application is rejected?",
    answer:
      "If your application is rejected, you will receive a notification with the reason. You may appeal the decision within 14 days by providing additional information or clarification. Most rejections can be resolved through the appeal process.",
  },
  {
    question: "Is my personal information secure?",
    answer:
      "Yes, we take privacy seriously. All personal data is encrypted and stored securely. Only aggregated statistics are visible to administrators—no individual names, ID numbers, or contact details are accessible. We comply with Kenya's Data Protection Act.",
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
