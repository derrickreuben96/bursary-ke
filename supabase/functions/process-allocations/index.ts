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

    // Jurisdiction enforcement: non-admin, non-service callers must match advert's ward/county
    if (!authResult.isServiceRole && authResult.role !== 'admin' && authResult.user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('assigned_county, assigned_ward')
        .eq('user_id', authResult.user.id)
        .single();
      const wardMatches = advert.ward && profile?.assigned_ward && advert.ward === profile.assigned_ward;
      const countyMatches = advert.county && profile?.assigned_county && advert.county === profile.assigned_county;
      // If advert is ward-specific, require ward match; else require county match
      const allowed = advert.ward ? wardMatches : countyMatches;
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: 'Forbidden – outside your jurisdiction' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }


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
    // Populate fraud_score for the students behind each application (best-effort).
    try {
      const { data: linkedStudents } = await supabaseAdmin
        .from("parent_applications")
        .select("id, tracking_number, student_beneficiaries(id)")
        .in("tracking_number", validApps.map(a => a.tracking_number));
      for (const parent of (linkedStudents || []) as Array<{ tracking_number: string; student_beneficiaries: Array<{ id: string }> }>) {
        for (const s of parent.student_beneficiaries || []) {
          const { data: score } = await supabaseAdmin.rpc("compute_fraud_score", { _student_id: s.id });
          if (typeof score === "number") {
            await supabaseAdmin.from("student_beneficiaries")
              .update({ fraud_score: score })
              .eq("id", s.id);
          }
        }
      }
    } catch (fraudErr) {
      console.error("[FRAUD] Non-blocking scoring error:", fraudErr);
    }

    // Sort applications by combined score
    const sortedApps = scoredApps.sort((a, b) => b.combinedScore - a.combinedScore);

    // Determine pipeline for each app from primary student_type
    const pipelineOf = (a: { student_type?: string }): "basic_education" | "higher_education" =>
      (a.student_type === "secondary" || a.student_type === "high_school") ? "basic_education" : "higher_education";

    // ---- Quota configuration ----
    const totalBudget = budgetAmount || advert.budget_amount || 0;
    const hsSlots = advert.high_school_quota_slots as number | null;
    const heSlots = advert.higher_education_quota_slots as number | null;
    const hsBudgetCap = advert.high_school_budget_cap as number | null;
    const heBudgetCap = advert.higher_education_budget_cap as number | null;
    const minAward = (advert.min_award_per_student as number | null) ?? 10000;
    const maxAward = (advert.max_award_per_student as number | null) ?? 100000;
    const totalSlots = advert.total_slots as number | null;

    const hasPipelineQuotas = !!(hsSlots || heSlots || hsBudgetCap || heBudgetCap);

    // Legacy fallback quota
    const minBeneficiaries = advert.min_beneficiaries as number | null;
    const legacyEffectiveSlots = parseResult.data.maxSlots || (minBeneficiaries && minBeneficiaries > 0 ? minBeneficiaries : null) || totalSlots;
    const legacyBudgetMax = Math.floor(totalBudget / 35000);
    const legacyMaxApprovals = legacyEffectiveSlots ? Math.min(legacyEffectiveSlots, legacyBudgetMax) : legacyBudgetMax;

    console.log(`[ALLOCATION] mode=${hasPipelineQuotas ? "pipeline_split" : "legacy_pool"} budget=${totalBudget} hsSlots=${hsSlots} heSlots=${heSlots} minAward=${minAward} maxAward=${maxAward}`);

    // Per-pipeline counters
    const state = {
      basic_education: { approved: 0, spent: 0, slots: hsSlots ?? Infinity, budget: hsBudgetCap ?? Infinity },
      higher_education: { approved: 0, spent: 0, slots: heSlots ?? Infinity, budget: heBudgetCap ?? Infinity },
    } as Record<"basic_education" | "higher_education", { approved: number; spent: number; slots: number; budget: number }>;

    let legacyApproved = 0;
    let totalAllocated = 0;
    const results: AllocationResult[] = [];

    const clamp = (amt: number) => Math.max(minAward, Math.min(maxAward, amt));

    for (const app of sortedApps) {
      const failIfErr = (label: string, res: { error: { message: string } | null }) => {
        if (res.error) {
          console.error(`[ALLOCATION] ${label} update failed for ${app.tracking_number}:`, res.error.message);
          throw new Error(`${label} update failed: ${res.error.message}`);
        }
      };

      // Skip red-flagged
      if (app.isRedFlagged) {
        const reason = "Application excluded due to active red flag in historical records.";
        failIfErr("red_flag", await supabaseAdmin.from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason }).eq("id", app.id));
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
        failIfErr("fraud", await supabaseAdmin.from("bursary_applications")
          .update({ status: "rejected", ai_decision_reason: reason }).eq("id", app.id));
        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
        continue;
      }

      // Base allocation from poverty tier, then clamp to [min,max]
      let allocationAmount: number;
      if (app.poverty_tier === "High") allocationAmount = 50000;
      else if (app.poverty_tier === "Medium") allocationAmount = 35000;
      else allocationAmount = 20000;
      allocationAmount = clamp(allocationAmount);

      // ---- Approval decision ----
      let canApprove = false;
      let rejectReason = "";
      let pipeline: "basic_education" | "higher_education" | null = null;

      if (hasPipelineQuotas) {
        pipeline = pipelineOf(app);
        const st = state[pipeline];
        const wouldSpend = st.spent + allocationAmount;
        const remainingTotalBudget = totalBudget > 0 ? totalBudget - totalAllocated : Infinity;
        if (st.approved >= st.slots) {
          rejectReason = `Pipeline quota exhausted (${pipeline.replace("_"," ")} slots: ${st.slots}).`;
        } else if (wouldSpend > st.budget) {
          rejectReason = `Pipeline budget cap reached (${pipeline.replace("_"," ")} cap: KES ${Number.isFinite(st.budget) ? st.budget.toLocaleString() : "n/a"}).`;
        } else if (allocationAmount > remainingTotalBudget) {
          rejectReason = `Total advert budget exhausted (KES ${totalBudget.toLocaleString()} fully allocated).`;
        } else {
          canApprove = true;
        }
      } else {
        // Legacy pool
        if (legacyApproved >= legacyMaxApprovals) {
          rejectReason = legacyEffectiveSlots && legacyApproved >= legacyEffectiveSlots
            ? `Quota of ${legacyEffectiveSlots} recipients reached`
            : `Budget of KES ${totalBudget.toLocaleString()} fully allocated`;
        } else {
          canApprove = true;
        }
      }

      if (canApprove) {
        if (hasPipelineQuotas && pipeline) {
          state[pipeline].approved += 1;
          state[pipeline].spent += allocationAmount;
        } else {
          legacyApproved += 1;
        }
        totalAllocated += allocationAmount;

        const quotaLine = hasPipelineQuotas && pipeline
          ? `• Pipeline: ${pipeline.replace("_"," ")} (${state[pipeline].approved}${Number.isFinite(state[pipeline].slots) ? `/${state[pipeline].slots}` : ""} approved, KES ${state[pipeline].spent.toLocaleString()}${Number.isFinite(state[pipeline].budget) ? ` of ${state[pipeline].budget.toLocaleString()} cap` : ""} used)`
          : `• Selected from combined pool (${legacyApproved}${legacyEffectiveSlots ? `/${legacyEffectiveSlots}` : ""} approved)`;

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
          `• Award clamped to policy range: KES ${minAward.toLocaleString()} – KES ${maxAward.toLocaleString()}`,
          quotaLine,
          `• Fraud risk level: ${app.fraudRisk}`,
          fairnessPart,
          ``,
          `💡 Selection rationale: Ranked ${sortedApps.indexOf(app) + 1} of ${sortedApps.length} applicants by combined score.`,
        ].filter(l => l !== undefined && l !== "").join("\n");

        failIfErr("approve", await supabaseAdmin.from("bursary_applications").update({
          status: "approved",
          ai_decision_reason: reason,
          allocated_amount: allocationAmount,
          allocation_date: new Date().toISOString(),
          ecitizen_ref: `ECIT-${advert.county.substring(0, 3).toUpperCase()}-${Date.now()}-${totalAllocated}`,
        }).eq("id", app.id));

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "approved", reason, allocatedAmount: allocationAmount });
      } else {
        const rankPosition = sortedApps.indexOf(app) + 1;
        const reason = [
          `❌ NOT SELECTED — ${rejectReason}`,
          ``,
          `📊 Your Assessment:`,
          `• Poverty score: ${app.poverty_score}/100 (${app.poverty_tier} priority tier)`,
          `• Combined score: ${app.combinedScore}/120`,
          `• Your rank: ${rankPosition} of ${sortedApps.length} applicants`,
          hasPipelineQuotas && pipeline ? `• Pipeline: ${pipeline.replace("_"," ")}` : "",
          app.isFairnessPriority ? `• ✨ Priority boost was applied (+${app.fairnessScore} pts) but was insufficient` : "",
          ``,
          `🔄 Next Cycle:`,
          `• Your application data has been saved automatically`,
          `• You will receive a priority boost of +5 pts in the next cycle`,
          `• Re-apply when the next bursary cycle opens — your history gives you an advantage`,
        ].filter(l => l !== "").join("\n");

        failIfErr("reject", await supabaseAdmin.from("bursary_applications").update({
          status: "rejected",
          ai_decision_reason: reason,
        }).eq("id", app.id));

        results.push({ applicationId: app.id, trackingNumber: app.tracking_number, status: "rejected", reason });
      }
    }

    const approvedCount = results.filter(r => r.status === "approved").length;

    // Step 3.5: Write immutable decision-log rows for each processed application.
    // Non-blocking — audit trail must never break allocation.
    try {
      await writeDecisionLog(supabaseAdmin, advertId, results, scoredApps, authResult);
    } catch (logErr) {
      console.error("[DECISION_LOG] Non-blocking error:", logErr);
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

/** Insert one immutable audit row per student for this allocation run. */
async function writeDecisionLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  advertId: string,
  results: AllocationResult[],
  scoredApps: any[],
  authResult: { isServiceRole: boolean; user?: { id: string } }
) {
  if (!results.length) return;

  const trackingNumbers = results.map(r => r.trackingNumber);

  // Resolve parent_applications by tracking number
  const { data: parents } = await supabaseAdmin
    .from("parent_applications")
    .select("id, tracking_number")
    .in("tracking_number", trackingNumbers);

  const parentByTracking = new Map((parents || []).map((p: any) => [p.tracking_number, p.id]));
  const parentIds = (parents || []).map((p: any) => p.id);
  if (!parentIds.length) return;

  const { data: students } = await supabaseAdmin
    .from("student_beneficiaries")
    .select("id, parent_application_id, student_type, education_category, assessment_pipeline, fraud_score")
    .in("parent_application_id", parentIds);

  const studentsByParent = new Map<string, any[]>();
  for (const s of students || []) {
    const arr = studentsByParent.get(s.parent_application_id) || [];
    arr.push(s);
    studentsByParent.set(s.parent_application_id, arr);
  }

  const scoredByTracking = new Map(scoredApps.map(a => [a.tracking_number, a]));
  const decidedBy = authResult.isServiceRole ? null : (authResult.user?.id ?? null);
  const rows: any[] = [];

  for (const r of results) {
    const parentId = parentByTracking.get(r.trackingNumber);
    if (!parentId) continue;
    const kids = studentsByParent.get(parentId) || [];
    if (!kids.length) continue;
    const scored = scoredByTracking.get(r.trackingNumber);
    const povertyScore = scored?.poverty_score ?? null;
    const rank = scored ? scoredApps.indexOf(scored) + 1 : null;
    const reasonCode = r.status === "approved"
      ? "approved"
      : (scored?.isRedFlagged ? "red_flag_exclusion"
        : scored?.fraudRisk === "high" ? "manual_review"
        : "lower_rank_or_quota_exhausted");

    for (const kid of kids) {
      rows.push({
        student_beneficiary_id: kid.id,
        parent_application_id: parentId,
        advert_id: advertId,
        decision: r.status,
        poverty_score: povertyScore,
        fraud_score: kid.fraud_score ?? scored?.fraudRisk === "high" ? 100 : 0,
        disability_score: null,
        rank_in_pipeline: rank,
        quota_category: kid.assessment_pipeline || (kid.student_type === "secondary" ? "basic_education" : "higher_education"),
        reason_code: reasonCode,
        decided_by: decidedBy,
        snapshot: {
          tracking_number: r.trackingNumber,
          allocated_amount: r.allocatedAmount ?? null,
          combined_score: scored?.combinedScore ?? null,
          fairness_score: scored?.fairnessScore ?? null,
          historical_status: scored?.historicalStatus ?? null,
          reason_text: r.reason,
        },
      });
    }
  }

  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("application_decision_log").insert(rows);
  if (error) console.error("[DECISION_LOG] insert failed:", error.message);
  else console.log(`[DECISION_LOG] Wrote ${rows.length} immutable decision rows`);
}
