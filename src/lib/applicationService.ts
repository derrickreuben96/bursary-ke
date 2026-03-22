import { supabase } from "@/integrations/supabase/client";
import type { ApplicationData } from "@/context/ApplicationContext";
import { calculatePovertyScore, getPovertyTier } from "@/lib/validationSchemas";

export interface SubmitApplicationParams {
  data: ApplicationData;
  studentType: "secondary" | "university";
}

export async function submitApplication({ data, studentType }: SubmitApplicationParams): Promise<{ trackingNumber: string; error: Error | null }> {
  try {
    // Generate tracking number using database function
    const { data: trackingData, error: trackingError } = await supabase
      .rpc("generate_tracking_number");

    if (trackingError) {
      console.error("Error generating tracking number:", trackingError);
      throw new Error("Failed to generate tracking number");
    }

    const trackingNumber = trackingData as string;

    // Calculate poverty metrics
    const povertyScore = data.povertyQuestionnaire
      ? calculatePovertyScore(data.povertyQuestionnaire)
      : 0;
    const povertyTier = getPovertyTier(povertyScore);

    // Prepare student-specific data
    const studentData = studentType === "university" ? data.universityStudent : data.secondaryStudent;
    
    // Insert application into database
    const { error: insertError } = await supabase
      .from("bursary_applications")
      .insert({
        tracking_number: trackingNumber,
        student_type: studentType,
        status: "received",
        // Link to bursary advert
        advert_id: data.advertId || null,
        // Parent/Guardian info
        parent_national_id: data.parentGuardian?.nationalId || "",
        parent_full_name: data.parentGuardian?.fullName || "Guardian",
        parent_phone: data.parentGuardian?.phoneNumber || "",
        parent_email: data.parentGuardian?.email || null,
        parent_county: data.parentGuardian?.county || "Not Specified",
        sms_consent: data.parentGuardian?.consentNotifications || false,
        // Student info
        student_full_name: studentType === "university" 
          ? (data.universityStudent?.studentName || "N/A")
          : (data.secondaryStudent?.studentName || "N/A"),
        student_id: studentType === "university"
          ? data.universityStudent?.studentId
          : data.secondaryStudent?.nemisId,
        institution_name: studentType === "university"
          ? (data.universityStudent?.institution || "Unknown")
          : (data.secondaryStudent?.school || "Unknown"),
        year_of_study: studentType === "university"
          ? data.universityStudent?.yearOfStudy
          : null,
        class_form: studentType === "secondary"
          ? data.secondaryStudent?.classForm
          : null,
        // Poverty assessment
        household_income: data.povertyQuestionnaire?.householdIncome || 0,
        household_dependents: data.povertyQuestionnaire?.numberOfDependents || 0,
        poverty_score: povertyScore,
        poverty_tier: povertyTier,
      });

    if (insertError) {
      console.error("Error inserting application:", insertError);
      throw new Error("Failed to submit application");
    }

    return { trackingNumber, error: null };
  } catch (error) {
    console.error("Application submission error:", error);
    return { trackingNumber: "", error: error as Error };
  }
}

export interface TrackingResult {
  found: boolean;
  trackingNumber: string;
  studentType: "secondary" | "university";
  status: string;
  createdAt: Date;
  stages: {
    name: string;
    status: "completed" | "current" | "pending";
    date: Date | null;
    message: string;
  }[];
}

export async function lookupApplication(trackingNumber: string): Promise<TrackingResult | null> {
  const { data, error } = await supabase
    .from("bursary_applications")
    .select("tracking_number, student_type, status, created_at, updated_at")
    .eq("tracking_number", trackingNumber.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Map status to stages
  const statusOrder = ["received", "review", "verification", "approved", "disbursed"];
  const currentIndex = statusOrder.indexOf(data.status);

  const stages = [
    { name: "Application Received", key: "received", message: "Your application has been received and is in our system." },
    { name: "Under Review", key: "review", message: "Your application is being reviewed by our team." },
    { name: "Verification", key: "verification", message: "We are verifying the information provided." },
    { name: "Approval Decision", key: "approved", message: "Your application has been approved." },
    { name: "Funds Disbursed", key: "disbursed", message: "Funds have been sent to your institution." },
  ].map((stage, index) => ({
    name: stage.name,
    status: index < currentIndex ? "completed" as const : 
            index === currentIndex ? "current" as const : "pending" as const,
    date: index <= currentIndex ? new Date(data.created_at) : null,
    message: stage.message,
  }));

  return {
    found: true,
    trackingNumber: data.tracking_number,
    studentType: data.student_type as "secondary" | "university",
    status: data.status,
    createdAt: new Date(data.created_at),
    stages,
  };
}

// Fetch aggregated statistics for admin dashboard
export async function fetchDashboardStats() {
  // Get total counts by status
  const { data: applications, error } = await supabase
    .from("bursary_applications")
    .select("status, poverty_tier, parent_county, created_at");

  if (error) {
    console.error("Error fetching dashboard stats:", error);
    return null;
  }

  const totalApplications = applications?.length || 0;
  const approvedApplications = applications?.filter(a => a.status === "approved" || a.status === "disbursed").length || 0;
  const pendingApplications = applications?.filter(a => a.status === "received" || a.status === "review" || a.status === "verification").length || 0;
  const rejectedApplications = applications?.filter(a => a.status === "rejected").length || 0;

  // Calculate poverty distribution
  const povertyGroups = applications?.reduce((acc, app) => {
    acc[app.poverty_tier] = (acc[app.poverty_tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const povertyDistribution = [
    { tier: "High Priority", count: povertyGroups["High"] || 0, percentage: Math.round(((povertyGroups["High"] || 0) / totalApplications) * 100) || 0 },
    { tier: "Medium Priority", count: povertyGroups["Medium"] || 0, percentage: Math.round(((povertyGroups["Medium"] || 0) / totalApplications) * 100) || 0 },
    { tier: "Low Priority", count: povertyGroups["Low"] || 0, percentage: Math.round(((povertyGroups["Low"] || 0) / totalApplications) * 100) || 0 },
  ];

  // Calculate county distribution
  const countyGroups = applications?.reduce((acc, app) => {
    acc[app.parent_county] = (acc[app.parent_county] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const topCounties = Object.entries(countyGroups)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([county, count]) => ({ county, count }));

  const othersCount = totalApplications - topCounties.reduce((sum, c) => sum + c.count, 0);
  if (othersCount > 0) {
    topCounties.push({ county: "Others", count: othersCount });
  }

  // Monthly trends (last 6 months)
  const now = new Date();
  const monthlyTrends = [];
  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = month.toLocaleDateString("en-US", { month: "short" });
    const count = applications?.filter(a => {
      const appDate = new Date(a.created_at);
      return appDate.getMonth() === month.getMonth() && appDate.getFullYear() === month.getFullYear();
    }).length || 0;
    monthlyTrends.push({ month: monthName, applications: count });
  }

  return {
    totalApplications,
    approvedApplications,
    pendingApplications,
    rejectedApplications,
    totalBudgetDisbursed: approvedApplications * 35000, // Average bursary amount
    povertyDistribution,
    applicationsByCounty: topCounties,
    monthlyTrends,
  };
}
