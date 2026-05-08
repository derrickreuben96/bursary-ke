import { supabase } from "@/integrations/supabase/client";
import type { ApplicationData } from "@/context/ApplicationContext";
import { calculatePovertyScore, getPovertyTier } from "@/lib/validationSchemas";

export interface SubmitApplicationParams {
  data: ApplicationData;
  studentType: "secondary" | "university";
}

// Module-level guard: prevents concurrent submissions from the same tab
// (e.g. double-clicks, fast retries while the locations dataset is loading).
// Keyed by `${nationalId}:${advertId}` so a second click returns the
// in-flight promise instead of starting a duplicate INSERT.
const inflightSubmissions = new Map<
  string,
  Promise<{ trackingNumber: string; error: Error | null }>
>();

export async function submitApplication(
  params: SubmitApplicationParams
): Promise<{ trackingNumber: string; error: Error | null }> {
  const { data } = params;
  const nationalId = data.parentGuardian?.nationalId || "";
  const advertId = data.parentGuardian?.selectedAdvertId || data.advertId || "";
  const dedupeKey = `${nationalId}:${advertId}`;

  const existing = inflightSubmissions.get(dedupeKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      // 1. Idempotency check — if the applicant already submitted for this
      //    advert, return the existing tracking number instead of re-inserting.
      if (nationalId && advertId) {
        const { data: existingRow } = await supabase
          .from("bursary_applications")
          .select("tracking_number, status")
          .eq("parent_national_id", nationalId)
          .eq("advert_id", advertId)
          .neq("status", "rejected")
          .maybeSingle();
        if (existingRow?.tracking_number) {
          return { trackingNumber: existingRow.tracking_number, error: null };
        }
      }

      // 2. Generate tracking number via DB function
      const { data: trackingData, error: trackingError } = await supabase.rpc(
        "generate_tracking_number"
      );
      if (trackingError) {
        console.error("Error generating tracking number:", trackingError);
        throw new Error("Failed to generate tracking number");
      }
      const trackingNumber = trackingData as string;

      const povertyScore = data.povertyQuestionnaire
        ? calculatePovertyScore(data.povertyQuestionnaire)
        : 0;
      const povertyTier = getPovertyTier(povertyScore);
      const studentType = params.studentType;

      // Build students array. Prefer multi-student repeater data when present.
      const repeaterStudents = (data.students && data.students.length > 0)
        ? data.students
        : [
            {
              id: "legacy",
              studentType,
              studentName:
                studentType === "university"
                  ? data.universityStudent?.studentName || "N/A"
                  : data.secondaryStudent?.studentName || "N/A",
              identifier:
                (studentType === "university"
                  ? data.universityStudent?.studentId
                  : data.secondaryStudent?.nemisId) || trackingNumber + "-S1",
              institution:
                studentType === "university"
                  ? data.universityStudent?.institution || "Unknown"
                  : data.secondaryStudent?.school || "Unknown",
              admissionNumber: "",
              classForm:
                studentType === "secondary" ? data.secondaryStudent?.classForm : undefined,
              yearOfStudy:
                studentType === "university" ? data.universityStudent?.yearOfStudy : undefined,
              course: studentType === "university" ? data.universityStudent?.course : undefined,
              feeBalance: 0,
            },
          ];

      // 3a. NEW: insert into parent_applications + student_beneficiaries via RPC
      //         (also enforces per-advert duplicate lock + max-3 + cross-parent uniqueness)
      const { error: rpcError } = await supabase.rpc("submit_parent_application", {
        _advert_id: advertId,
        _tracking: trackingNumber,
        _parent: {
          parent_national_id: nationalId,
          parent_full_name: data.parentGuardian?.fullName || "Guardian",
          parent_phone: data.parentGuardian?.phoneNumber || "",
          parent_email: data.parentGuardian?.email || null,
          parent_county: data.parentGuardian?.county || "Not Specified",
          parent_ward: data.parentGuardian?.ward || null,
          sms_consent: data.parentGuardian?.consentNotifications || false,
          household_income: data.povertyQuestionnaire?.householdIncome || 0,
          household_dependents: data.povertyQuestionnaire?.numberOfDependents || 0,
          poverty_score: povertyScore,
          poverty_tier: povertyTier,
        },
        _students: repeaterStudents.map((s) => ({
          student_full_name: s.studentName,
          student_identifier: s.identifier,
          student_type: s.studentType,
          institution_name: s.institution,
          admission_number: s.admissionNumber || null,
          class_form: s.classForm || null,
          year_of_study: s.yearOfStudy || null,
          fee_balance: s.feeBalance || 0,
        })),
      });

      if (rpcError) {
        const msg = (rpcError as { message?: string }).message || "";
        if (
          (rpcError as { code?: string }).code === "23505" ||
          msg.includes("already submitted")
        ) {
          throw new Error(
            "You have already submitted the maximum allowed bursary application for this cycle."
          );
        }
        if (msg.includes("Maximum of 3 students")) {
          throw new Error("Maximum of 3 students allowed per application.");
        }
        if (msg.includes("already registered for this bursary cycle")) {
          throw new Error("One of the students is already registered under another application for this bursary.");
        }
        console.error("submit_parent_application failed:", rpcError);
        throw new Error(msg || "Failed to submit application");
      }

      // 3b. LEGACY mirror — keep one row in bursary_applications so existing
      //     commissioner/admin/treasury views continue to function until they
      //     migrate to the parent_applications schema.
      const firstStudent = repeaterStudents[0];
      const { error: legacyInsertError } = await supabase
        .from("bursary_applications")
        .insert({
          tracking_number: trackingNumber,
          student_type: firstStudent.studentType,
          status: "received",
          advert_id: advertId || null,
          parent_national_id: nationalId,
          parent_full_name: data.parentGuardian?.fullName || "Guardian",
          parent_phone: data.parentGuardian?.phoneNumber || "",
          parent_email: data.parentGuardian?.email || null,
          parent_county: data.parentGuardian?.county || "Not Specified",
          parent_ward: data.parentGuardian?.ward || null,
          sms_consent: data.parentGuardian?.consentNotifications || false,
          student_full_name: firstStudent.studentName,
          student_id: firstStudent.identifier,
          institution_name: firstStudent.institution,
          year_of_study: firstStudent.yearOfStudy || null,
          class_form: firstStudent.classForm || null,
          household_income: data.povertyQuestionnaire?.householdIncome || 0,
          household_dependents: data.povertyQuestionnaire?.numberOfDependents || 0,
          poverty_score: povertyScore,
          poverty_tier: povertyTier,
        });
      if (legacyInsertError) {
        // Non-fatal — parent_applications row already saved. Just log.
        console.warn("Legacy mirror insert failed (non-fatal):", legacyInsertError);
      }

      return { trackingNumber, error: null };
    } catch (error) {
      console.error("Application submission error:", error);
      return { trackingNumber: "", error: error as Error };
    } finally {
      setTimeout(() => inflightSubmissions.delete(dedupeKey), 0);
    }
  })();

  inflightSubmissions.set(dedupeKey, promise);
  return promise;
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
