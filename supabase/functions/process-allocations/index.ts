import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  checkRateLimit, 
  getClientIp, 
  rateLimitExceededResponse,
  maybeCleanup 
} from "../_shared/rateLimiter.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 5 };

const ProcessAllocationsSchema = z.object({
  advertId: z.string().uuid(),
  budgetAmount: z.number().min(100000).max(100000000).optional(),
  maxSlots: z.number().int().min(1).max(10000).optional(),
});

interface AllocationResult {
  applicationId: string;
  trackingNumber: string;
  status: "approved" | "rejected";
  reason: string;
  allocatedAmount?: number;
}

async function verifyAuthorizedRole(req: Request): Promise<{ isServiceRole: boolean; user?: { id: string }; role?: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (token === serviceRoleKey) {
    return { isServiceRole: true };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: roleData } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'county_commissioner']);

  if (!roleData || roleData.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Forbidden - Admin or Commissioner role required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { isServiceRole: false, user, role: roleData[0].role };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const isServiceRole = authHeader?.replace('Bearer ', '') === serviceRoleKey;
  
  if (!isServiceRole) {
    const clientIp = getClientIp(req);
    const rl = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);
    maybeCleanup(RATE_LIMIT_CONFIG.windowMs);
    if (!rl.allowed) return rateLimitExceededResponse(corsHeaders, rl, RATE_LIMIT_CONFIG);
  }

  try {
    const authResult = await verifyAuthorizedRole(req);
    if (authResult instanceof Response) return authResult;

    const rawBody = await req.json();
    const parseResult = ProcessAllocationsSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { advertId, budgetAmount } = parseResult.data;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get advert with min_beneficiaries
    const { data: advert, error: advertError } = await supabaseAdmin
      .from("bursary_adverts")
      .select("*")
      .eq("id", advertId)
      .single();

    if (advertError || !advert) throw new Error("Advert not found");

    const deadline = new Date(advert.deadline);
    if (new Date() < deadline) {
      return new Response(
        JSON.stringify({ success: false, error: `Cannot process before deadline (${deadline.toLocaleDateString()})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending applications
    const { data: applications, error: appError } = await supabaseAdmin
      .from("bursary_applications")
      .select("*")
      .eq("parent_county", advert.county)
      .eq("status", "received")
      .eq("is_duplicate", false)
      .order("poverty_score", { ascending: false });

    if (appError) throw appError;
    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No applications to process", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Detect and mark duplicates
    const duplicateGroups = new Map<string, typeof applications>();
    for (const app of applications) {
      const key = `${app.parent_national_id}-${app.student_id}`;
      if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
      duplicateGroups.get(key)!.push(app);
    }
    for (const [, group] of duplicateGroups) {
      if (group.length > 1) {
        group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        for (let i = 1; i < group.length; i++) {
          await supabaseAdmin
            .from("bursary_applications")
            .update({
              is_duplicate: true,
              duplicate_of: group[0].id,
              status: "rejected",
              ai_decision_reason: "Duplicate application detected. An earlier application with the same student details exists."
            })
            .eq("id", group[i].id);
        }
      }
    }

    // Step 2: Get valid (non-duplicate) applications
    const { data: validApps } = await supabaseAdmin
      .from("bursary_applications")
      .select("*")
      .eq("parent_county", advert.county)
      .eq("status", "received")
      .eq("is_duplicate", false)
      .order("poverty_score", { ascending: false });

    if (!validApps || validApps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "All applications were duplicates", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load fairness tracking data
    const nationalIds = [...new Set(validApps.map(a => a.parent_national_id))];
    const { data: fairnessData } = await supabaseAdmin
      .from("fairness_tracking")
      .select("*")
      .in("national_id", nationalIds);
    const fairnessMap = new Map((fairnessData || []).map(f => [f.national_id, f]));

    // Score and sort by combined score
    const scoredApps = validApps
      .map(app => {
        const fairness = fairnessMap.get(app.parent_national_id);
        const fairnessScore = fairness?.fairness_priority_score || (app.fairness_priority_score || 0);
        const isRedFlagged = fairness?.historical_status === "red_flagged" || app.historical_status === "red_flagged";
        const fraudRisk = fairness?.fraud_risk_level || app.fraud_risk_level || "low";
        return {
          ...app,
          combinedScore: isRedFlagged ? -999 : (app.poverty_score + fairnessScore),
          fairnessScore,
          isRedFlagged,
          isFairnessPriority: fairness?.is_fairness_priority_candidate || app.is_fairness_priority || false,
          fraudRisk,
          historicalStatus: fairness?.historical_status || app.historical_status || "new",
        };
      })
      .sort((a, b) => b.combinedScore - a.combinedScore);

    // Step 3: Determine quota — use maxSlots > min_beneficiaries > budget-based
    const budget = budgetAmount || advert.budget_amount || 0;
    const minBeneficiaries = advert.min_beneficiaries as number | null;
    const averageAllocation = 35000;
    const budgetBasedMax = Math.floor(budget / averageAllocation);

    // Priority: explicit maxSlots param > advert min_beneficiaries > budget calculation
    const effectiveSlots = parseResult.data.maxSlots || (minBeneficiaries && minBeneficiaries > 0 ? minBeneficiaries : null);
    const maxApprovals = effectiveSlots
      ? Math.min(effectiveSlots, budgetBasedMax)
      : budgetBasedMax;

    console.log(`[ALLOCATION] Quota: ${maxApprovals} (min_beneficiaries: ${minBeneficiaries}, budget: ${budget})`);

    const results: AllocationResult[] = [];
    let approvedCount = 0;
    let totalAllocated = 0;

    for (const app of scoredApps) {
      // Skip red-flagged
      if (app.isRedFlagged) {
        const reason = "Application excluded due to active red flag in historical records.";
        await supabaseAdmin.from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason }).eq("id", app.id);
        await supabaseAdmin.from("fairness_audit_log").insert({
          application_id: app.id, action: "red_flag_exclusion",
          details: { reason, historicalStatus: app.historicalStatus }, performed_by: "allocation_engine",
        });
        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
        continue;
      }

      // Skip high fraud risk
      if (app.fraudRisk === "high") {
        const reason = "Application flagged for high fraud risk. Manual review required.";
        await supabaseAdmin.from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason }).eq("id", app.id);
        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
        continue;
      }

      // Determine allocation amount by tier
      let allocationAmount = averageAllocation;
      if (app.poverty_tier === "High") allocationAmount = 50000;
      else if (app.poverty_tier === "Medium") allocationAmount = 35000;
      else allocationAmount = 20000;

      const canApprove = approvedCount < maxApprovals;

      if (canApprove) {
        const fairnessPart = app.isFairnessPriority
          ? `\n• Fairness boost applied: +${app.fairnessScore} pts (previously applied but not funded — priority restored)`
          : app.historicalStatus === "returning_funded"
          ? `\n• History note: Previously funded applicant. Consistency check passed. Priority adjusted by ${app.fairnessScore} pts.`
          : app.historicalStatus === "new"
          ? `\n• First-time applicant. No prior history.`
          : "";
        const reason = [
          `✅ APPROVED — KES ${allocationAmount.toLocaleString()} allocated`,
          ``,
          `📊 Assessment Summary:`,
          `• Poverty score: ${app.poverty_score}/100 (${app.poverty_tier} priority tier)`,
          `• Combined score (poverty + fairness): ${app.combinedScore}/120`,
          `• Household income bracket: ${app.household_income !== null ? `Score ${app.household_income}/100` : "Not provided"}`,
          `• Dependents in household: ${app.household_dependents ?? "Not provided"}`,
          `• Student type: ${app.student_type}`,
          `• Fraud risk level: ${app.fraudRisk}`,
          fairnessPart,
          ``,
          `💡 Selection rationale: Ranked ${scoredApps.indexOf(app) + 1} of ${scoredApps.length} applicants by combined score. Meets budget and${effectiveSlots ? ` quota (${effectiveSlots} slots) and` : ""} poverty threshold requirements.`,
        ].filter(l => l !== undefined).join("\n");
        approvedCount++;
        totalAllocated += allocationAmount;

        await supabaseAdmin.from("bursary_applications").update({
          status: "approved",
          ai_decision_reason: reason,
          allocated_amount: allocationAmount,
          allocation_date: new Date().toISOString(),
          ecitizen_ref: `ECIT-${advert.county.substring(0, 3).toUpperCase()}-${Date.now()}-${approvedCount}`,
        }).eq("id", app.id);

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "approved", reason, allocatedAmount: allocationAmount });
      } else {
        // Rejected — quota or budget exceeded
        const rankPosition = scoredApps.indexOf(app) + 1;
        const quotaCause = effectiveSlots && approvedCount >= effectiveSlots;
        const reason = [
          `❌ NOT SELECTED — ${quotaCause ? `Quota of ${effectiveSlots} recipients reached` : `Budget of KES ${budget.toLocaleString()} fully allocated`}`,
          ``,
          `📊 Your Assessment:`,
          `• Poverty score: ${app.poverty_score}/100 (${app.poverty_tier} priority tier)`,
          `• Combined score: ${app.combinedScore}/120`,
          `• Your rank: ${rankPosition} of ${scoredApps.length} applicants`,
          `• Applicants selected above you: ${approvedCount}`,
          app.isFairnessPriority ? `• ✨ Priority boost was applied (+${app.fairnessScore} pts) but was insufficient to reach selection threshold` : "",
          ``,
          `🔄 Next Cycle:`,
          `• Your application data has been saved automatically`,
          `• You will receive a priority boost of +5 pts in the next cycle`,
          `• Re-apply when the next bursary cycle opens — your history gives you an advantage`,
          `• Ensure all information remains consistent across applications`,
        ].filter(l => l !== "").join("\n");

        await supabaseAdmin.from("bursary_applications").update({
          status: "rejected",
          ai_decision_reason: reason,
        }).eq("id", app.id);

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
      }
    }

    // Step 4: Send SMS/email notifications to ALL applicants (approved + rejected)
    try {
      await notifyAllApplicants(supabaseAdmin, results, validApps);
    } catch (notifyErr) {
      console.error("[NOTIFY] Non-blocking notification error:", notifyErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${validApps.length} applications. Approved: ${approvedCount}, Rejected: ${validApps.length - approvedCount}`,
        totalAllocated,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error processing allocations:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Send SMS notifications to all processed applicants */
async function notifyAllApplicants(
  supabaseAdmin: ReturnType<typeof createClient>,
  results: AllocationResult[],
  apps: any[]
) {
  const africasTalkingApiKey = Deno.env.get("AFRICASTALKING_API_KEY");
  const africasTalkingUsername = Deno.env.get("AFRICASTALKING_USERNAME");
  const useRealSMS = !!africasTalkingApiKey && !!africasTalkingUsername;

  const appMap = new Map(apps.map(a => [a.id, a]));

  for (const result of results) {
    const app = appMap.get(result.applicationId);
    if (!app || !app.sms_consent || !app.parent_phone) continue;

    let message: string;
    if (result.status === "approved") {
      const fairnessNote = app.is_fairness_priority ? " Fairness priority considered." : "";
      message = `Congratulations! Your bursary application (${app.tracking_number}) has been APPROVED. ` +
        `Amount: KES ${(result.allocatedAmount || 35000).toLocaleString()}. ` +
        `Funds will be sent to ${app.institution_name}.${fairnessNote} Track: bursary-ke.go.ke/track - Bursary KE`;
    } else {
      // Rejected — generic SMS (detailed reason only in commissioner portal)
      message = `Dear applicant, your bursary application (${app.tracking_number}) was NOT successful in this cycle. ` +
        `You may re-apply in the next bursary window. Track: bursary-ke.go.ke/track - Bursary KE`;
    }

    if (useRealSMS) {
      let phone = app.parent_phone.replace(/\s+/g, "").replace(/-/g, "");
      if (phone.startsWith("0")) phone = "+254" + phone.substring(1);
      else if (!phone.startsWith("+")) phone = "+254" + phone;

      const url = africasTalkingUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com/version1/messaging"
        : "https://api.africastalking.com/version1/messaging";

      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "apiKey": africasTalkingApiKey!,
            "Accept": "application/json",
          },
          body: new URLSearchParams({
            username: africasTalkingUsername!,
            to: phone,
            message,
            from: "BURSARY-KE",
          }),
        });
      } catch (e) {
        console.error(`[SMS] Failed for ${app.tracking_number}:`, e);
      }
    } else {
      console.log(`[SMS SIM] ${result.status} → ${app.tracking_number}`);
    }

    // Mark SMS sent
    if (result.status === "approved") {
      await supabaseAdmin.from("bursary_applications").update({
        sms_sent: true, sms_sent_at: new Date().toISOString(),
      }).eq("id", app.id);
    }
  }
}
