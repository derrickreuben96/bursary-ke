import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

// Helper function to verify admin role or service role key (for internal cron calls)
async function verifyAdminOrServiceRole(req: Request): Promise<{ isServiceRole: boolean; user?: { id: string } } | Response> {
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

  // Check admin role using service role client for RLS bypass
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
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(
      JSON.stringify({ error: 'Forbidden - Admin role required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return { isServiceRole: false, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authentication or service role (for cron)
    const authResult = await verifyAdminOrServiceRole(req);
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

    // Step 2: Get non-duplicate applications sorted by poverty score
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

    // Step 3: Allocate based on budget and poverty score
    const budget = budgetAmount || advert.budget_amount || 0;
    const averageAllocation = 35000; // Average bursary per student
    const maxApprovals = Math.floor(budget / averageAllocation);

    const results: AllocationResult[] = [];
    let approvedCount = 0;
    let totalAllocated = 0;

    for (const app of validApps) {
      const canApprove = approvedCount < maxApprovals && totalAllocated + averageAllocation <= budget;
      
      // Calculate allocation amount based on poverty tier
      let allocationAmount = averageAllocation;
      if (app.poverty_tier === "High") {
        allocationAmount = 50000;
      } else if (app.poverty_tier === "Medium") {
        allocationAmount = 35000;
      } else {
        allocationAmount = 20000;
      }

      let status: "approved" | "rejected";
      let reason: string;

      if (canApprove && totalAllocated + allocationAmount <= budget) {
        status = "approved";
        reason = `Application approved based on poverty assessment score of ${app.poverty_score}/100. ` +
                 `Priority tier: ${app.poverty_tier}. Household income: KES ${app.household_income?.toLocaleString() || 'N/A'}. ` +
                 `Dependents: ${app.household_dependents}. Allocated amount: KES ${allocationAmount.toLocaleString()}.`;
        approvedCount++;
        totalAllocated += allocationAmount;

        await supabaseAdmin
          .from("bursary_applications")
          .update({ 
            status: "approved",
            ai_decision_reason: reason,
            allocated_amount: allocationAmount,
            allocation_date: new Date().toISOString(),
            ecitizen_ref: `ECIT-${advert.county.substring(0, 3).toUpperCase()}-${Date.now()}-${approvedCount}`
          })
          .eq("id", app.id);

        results.push({
          applicationId: app.id,
          trackingNumber: app.tracking_number,
          status: "approved",
          reason,
          allocatedAmount: allocationAmount
        });
      } else {
        status = "rejected";
        reason = approvedCount >= maxApprovals
          ? `Application not approved due to budget constraints. All available slots (${maxApprovals}) have been allocated to higher-priority applicants. ` +
            `Your poverty score was ${app.poverty_score}/100, priority tier: ${app.poverty_tier}.`
          : `Application not approved. Budget exhausted. Total budget: KES ${budget.toLocaleString()}, already allocated: KES ${totalAllocated.toLocaleString()}.`;

        await supabaseAdmin
          .from("bursary_applications")
          .update({ 
            status: "rejected",
            ai_decision_reason: reason
          })
          .eq("id", app.id);

        results.push({
          applicationId: app.id,
          trackingNumber: app.tracking_number,
          status: "rejected",
          reason
        });
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
