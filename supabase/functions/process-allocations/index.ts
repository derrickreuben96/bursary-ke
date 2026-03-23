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

// Rate limit config: 5 requests per minute per IP (stricter for admin operations)
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
};

// Input validation schema
const ProcessAllocationsSchema = z.object({
  advertId: z.string().uuid(),
  budgetAmount: z.number().min(100000).max(100000000).optional(),
});

interface AllocationResult {
  applicationId: string;
  trackingNumber: string;
  status: "approved" | "rejected";
  reason: string;
  allocatedAmount?: number;
}

// Helper function to verify admin/commissioner role or service role key (for internal cron calls)
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

  // Check if this is an internal service role call (from cron jobs)
  if (token === serviceRoleKey) {
    console.log('[AUTH] Service role key authenticated - internal cron call');
    return { isServiceRole: true };
  }

  // Otherwise verify as user JWT
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } },
    }
  );

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check admin or commissioner role using service role client for RLS bypass
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
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

  const userRole = roleData[0].role;
  return { isServiceRole: false, user, role: userRole };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Apply rate limiting (skip for service role calls from cron)
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const isServiceRole = authHeader?.replace('Bearer ', '') === serviceRoleKey;
  
  if (!isServiceRole) {
    const clientIp = getClientIp(req);
    const rateLimitResult = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);
    maybeCleanup(RATE_LIMIT_CONFIG.windowMs);

    if (!rateLimitResult.allowed) {
      return rateLimitExceededResponse(corsHeaders, rateLimitResult, RATE_LIMIT_CONFIG);
    }
  }

  try {
    // Verify admin/commissioner authentication or service role (for cron)
    const authResult = await verifyAuthorizedRole(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Parse and validate input
    const rawBody = await req.json();
    const parseResult = ProcessAllocationsSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { advertId, budgetAmount } = parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the advert to check deadline
    const { data: advert, error: advertError } = await supabaseAdmin
      .from("bursary_adverts")
      .select("*")
      .eq("id", advertId)
      .single();

    if (advertError || !advert) {
      throw new Error("Advert not found");
    }

    const deadline = new Date(advert.deadline);
    const now = new Date();

    if (now < deadline) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Cannot process allocations before deadline. Deadline is ${deadline.toLocaleDateString()}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all applications for this county that haven't been processed
    const { data: applications, error: appError } = await supabaseAdmin
      .from("bursary_applications")
      .select("*")
      .eq("parent_county", advert.county)
      .eq("status", "received")
      .eq("is_duplicate", false)
      .order("poverty_score", { ascending: false });

    if (appError) {
      throw appError;
    }

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No applications to process",
          results: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Detect and mark duplicates
    const duplicateGroups = new Map<string, typeof applications>();
    
    for (const app of applications) {
      const key = `${app.parent_national_id}-${app.student_id}`;
      if (!duplicateGroups.has(key)) {
        duplicateGroups.set(key, []);
      }
      duplicateGroups.get(key)!.push(app);
    }

    // Mark duplicates (keep earliest, discard later ones)
    for (const [, group] of duplicateGroups) {
      if (group.length > 1) {
        // Sort by created_at, keep first
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

    // Step 2: Get non-duplicate applications with fairness data, sorted by combined score
    const { data: validApps } = await supabaseAdmin
      .from("bursary_applications")
      .select("*")
      .eq("parent_county", advert.county)
      .eq("status", "received")
      .eq("is_duplicate", false)
      .order("poverty_score", { ascending: false });

    if (!validApps || validApps.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All applications were duplicates",
          results: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2b: Load fairness tracking data for all valid applicants
    const nationalIds = [...new Set(validApps.map(a => a.parent_national_id))];
    const { data: fairnessData } = await supabaseAdmin
      .from("fairness_tracking")
      .select("*")
      .in("national_id", nationalIds);

    const fairnessMap = new Map(
      (fairnessData || []).map(f => [f.national_id, f])
    );

    // Step 2c: Sort by combined score (poverty_score + fairness_priority_score)
    // Exclude red-flagged applicants
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

    // Step 3: Allocate based on budget and combined score
    const budget = budgetAmount || advert.budget_amount || 0;
    const averageAllocation = 35000;
    const maxApprovals = Math.floor(budget / averageAllocation);

    const results: AllocationResult[] = [];
    let approvedCount = 0;
    let totalAllocated = 0;

    for (const app of scoredApps) {
      // Skip red-flagged applicants
      if (app.isRedFlagged) {
        const reason = "Application excluded due to active red flag in historical records. No exceptions.";
        await supabaseAdmin
          .from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason })
          .eq("id", app.id);

        await supabaseAdmin.from("fairness_audit_log").insert({
          application_id: app.id,
          action: "red_flag_exclusion",
          details: { reason, historicalStatus: app.historicalStatus },
          performed_by: "allocation_engine",
        });

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
        continue;
      }

      // Skip high fraud risk
      if (app.fraudRisk === "high") {
        const reason = "Application flagged for high fraud risk. Manual review required.";
        await supabaseAdmin
          .from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason })
          .eq("id", app.id);
        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
        continue;
      }

      const canApprove = approvedCount < maxApprovals && totalAllocated + averageAllocation <= budget;

      let allocationAmount = averageAllocation;
      if (app.poverty_tier === "High") allocationAmount = 50000;
      else if (app.poverty_tier === "Medium") allocationAmount = 35000;
      else allocationAmount = 20000;

      let status: "approved" | "rejected";
      let reason: string;

      if (canApprove && totalAllocated + allocationAmount <= budget) {
        status = "approved";
        const fairnessNote = app.isFairnessPriority
          ? ` Fairness priority boost applied (+${app.fairnessScore}).`
          : app.historicalStatus === "returning_funded"
          ? ` Returning funded applicant (priority adjusted by ${app.fairnessScore}).`
          : "";
        reason = `Application approved. Poverty score: ${app.poverty_score}/100. Combined score: ${app.combinedScore}. ` +
                 `Tier: ${app.poverty_tier}. Household income: KES ${app.household_income?.toLocaleString() || 'N/A'}. ` +
                 `Dependents: ${app.household_dependents}. Amount: KES ${allocationAmount.toLocaleString()}.${fairnessNote}`;
        approvedCount++;
        totalAllocated += allocationAmount;

        await supabaseAdmin
          .from("bursary_applications")
          .update({
            status: "approved",
            ai_decision_reason: reason,
            allocated_amount: allocationAmount,
            allocation_date: new Date().toISOString(),
            ecitizen_ref: `ECIT-${advert.county.substring(0, 3).toUpperCase()}-${Date.now()}-${approvedCount}`,
          })
          .eq("id", app.id);

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "approved", reason, allocatedAmount: allocationAmount });
      } else {
        status = "rejected";
        reason = approvedCount >= maxApprovals
          ? `Not approved due to budget constraints. All ${maxApprovals} slots allocated to higher-scoring applicants. ` +
            `Your combined score was ${app.combinedScore} (poverty: ${app.poverty_score}, fairness: ${app.fairnessScore}).`
          : `Not approved. Budget exhausted. Total: KES ${budget.toLocaleString()}, allocated: KES ${totalAllocated.toLocaleString()}.`;

        await supabaseAdmin
          .from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason })
          .eq("id", app.id);

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
      }
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
