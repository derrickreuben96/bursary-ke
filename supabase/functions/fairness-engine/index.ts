import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
  maybeCleanup,
} from "../_shared/rateLimiter.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_CONFIG = { windowMs: 60_000, maxRequests: 10 };

interface FairnessResult {
  applicationId: string;
  nationalId: string;
  previousAttempts: number;
  previousFunded: number;
  fairnessPriorityScore: number;
  isFairnessPriorityCandidate: boolean;
  fraudRiskLevel: "low" | "medium" | "high";
  historicalStatus: "new" | "returning_unfunded" | "returning_funded" | "red_flagged";
  adjustments: string[];
}

/** Verify caller is admin or service-role */
async function verifyAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const token = authHeader.replace("Bearer ", "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (token === serviceKey) return { ok: true };

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user)
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "county_commissioner"]);
  if (!roles?.length)
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  // Rate limit (skip service role)
  const authHeader = req.headers.get("Authorization");
  const isService =
    authHeader?.replace("Bearer ", "") ===
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!isService) {
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, RATE_LIMIT_CONFIG);
    maybeCleanup(RATE_LIMIT_CONFIG.windowMs);
    if (!rl.allowed) return rateLimitExceededResponse(corsHeaders, rl, RATE_LIMIT_CONFIG);
  }

  try {
    const auth = await verifyAuth(req);
    if (auth instanceof Response) return auth;

    const { action, advertId, cycleId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (action === "evaluate") {
      // Run fairness evaluation for all applications linked to an advert's county
      const { data: advert } = await supabaseAdmin
        .from("bursary_adverts")
        .select("county")
        .eq("id", advertId)
        .single();
      if (!advert) throw new Error("Advert not found");

      // Get current pending applications
      const { data: applications } = await supabaseAdmin
        .from("bursary_applications")
        .select("id, parent_national_id, parent_phone, poverty_score, household_dependents")
        .eq("parent_county", advert.county)
        .eq("status", "received")
        .eq("is_duplicate", false);

      if (!applications?.length) {
        return new Response(
          JSON.stringify({ success: true, results: [], message: "No applications to evaluate" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const results: FairnessResult[] = [];

      for (const app of applications) {
        // Look up historical records by national ID
        const { data: history } = await supabaseAdmin
          .from("applicant_history")
          .select("funding_status, red_flag, red_flag_reason, ai_score, cycle_id")
          .eq("national_id", app.parent_national_id)
          .order("created_at", { ascending: false });

        const previousAttempts = history?.length || 0;
        const previousFunded = history?.filter((h) => h.funding_status === "funded").length || 0;
        const hasRedFlag = history?.some((h) => h.red_flag) || false;
        const adjustments: string[] = [];

        // Determine historical status
        let historicalStatus: FairnessResult["historicalStatus"] = "new";
        if (hasRedFlag) {
          historicalStatus = "red_flagged";
        } else if (previousFunded > 0) {
          historicalStatus = "returning_funded";
        } else if (previousAttempts > 0) {
          historicalStatus = "returning_unfunded";
        }

        // Calculate fairness priority score adjustment
        let fairnessPriorityScore = 0;
        let isFairnessPriorityCandidate = false;

        if (hasRedFlag) {
          fairnessPriorityScore = -100; // excluded
          adjustments.push("RED FLAG: Excluded from priority system");
        } else if (previousAttempts > 0 && previousFunded === 0) {
          // Previously rejected, clean record → priority boost
          const boost = Math.min(previousAttempts * 5, 20); // max +20
          fairnessPriorityScore = boost;
          isFairnessPriorityCandidate = true;
          adjustments.push(
            `Priority boost +${boost} (${previousAttempts} previous unfunded attempt(s))`
          );
        } else if (previousFunded > 0) {
          // Previously funded → reduced priority
          const penalty = Math.min(previousFunded * 10, 30); // max -30
          fairnessPriorityScore = -penalty;
          adjustments.push(
            `Reduced priority -${penalty} (funded ${previousFunded} time(s) previously)`
          );
        }

        // Fraud risk assessment
        let fraudRiskLevel: FairnessResult["fraudRiskLevel"] = "low";
        if (app.parent_phone) {
          const { count } = await supabaseAdmin
            .from("bursary_applications")
            .select("id", { count: "exact", head: true })
            .eq("parent_phone", app.parent_phone)
            .neq("parent_national_id", app.parent_national_id)
            .eq("status", "received");
          if ((count || 0) > 1) {
            fraudRiskLevel = "high";
            adjustments.push("HIGH FRAUD RISK: Same phone linked to multiple National IDs");
          } else if ((count || 0) === 1) {
            fraudRiskLevel = "medium";
            adjustments.push("MEDIUM FRAUD RISK: Phone number used by another applicant");
          }
        }

        // --- Data Consistency Check ---
        let dataConsistencyScore = 100;
        const consistencyFlags: string[] = [];

        const { data: prevHistory } = await supabaseAdmin
          .from("applicant_history")
          .select("ai_score, allocated_amount")
          .eq("national_id", app.parent_national_id)
          .order("created_at", { ascending: false })
          .limit(3);

        const { data: prevFairness } = await supabaseAdmin
          .from("fairness_tracking")
          .select("previous_poverty_score, previous_income_bracket, previous_household_size")
          .eq("national_id", app.parent_national_id)
          .maybeSingle();

        if (prevFairness && prevHistory && prevHistory.length > 0) {
          if (prevFairness.previous_poverty_score !== null) {
            const scoreDelta = Math.abs(app.poverty_score - prevFairness.previous_poverty_score);
            if (scoreDelta > 40) {
              dataConsistencyScore -= 30;
              consistencyFlags.push(`Poverty score changed significantly: ${prevFairness.previous_poverty_score} → ${app.poverty_score} (delta: ${scoreDelta})`);
            } else if (scoreDelta > 20) {
              dataConsistencyScore -= 10;
              consistencyFlags.push(`Poverty score changed moderately: ${prevFairness.previous_poverty_score} → ${app.poverty_score}`);
            }
          }

          if (prevFairness.previous_household_size !== null && app.household_dependents !== null) {
            const sizeDelta = Math.abs(app.household_dependents - prevFairness.previous_household_size);
            if (sizeDelta > 4) {
              dataConsistencyScore -= 20;
              consistencyFlags.push(`Household size changed significantly: ${prevFairness.previous_household_size} → ${app.household_dependents}`);
            }
          }
        }

        dataConsistencyScore = Math.max(0, dataConsistencyScore);

        let consistencyAdjustment = 0;
        if (dataConsistencyScore < 70) {
          consistencyAdjustment = -15;
          adjustments.push(`Consistency deduction: -15 pts (score: ${dataConsistencyScore}/100 — significant data changes across cycles detected)`);
        } else if (dataConsistencyScore < 90) {
          consistencyAdjustment = -5;
          adjustments.push(`Minor consistency deduction: -5 pts (score: ${dataConsistencyScore}/100)`);
        }

        fairnessPriorityScore += consistencyAdjustment;

        await supabaseAdmin.from("fairness_tracking").upsert(
          {
            national_id: app.parent_national_id,
            application_id: app.id,
            previous_attempts_count: previousAttempts,
            previous_funded_count: previousFunded,
            priority_boost_applied: fairnessPriorityScore > 0,
            fairness_priority_score: fairnessPriorityScore,
            eligibility_adjustments_log: adjustments,
            is_fairness_priority_candidate: isFairnessPriorityCandidate,
            fraud_risk_level: fraudRiskLevel,
            historical_status: historicalStatus,
            data_consistency_score: dataConsistencyScore,
            consistency_flags: consistencyFlags,
            previous_poverty_score: app.poverty_score,
            previous_household_size: app.household_dependents ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "national_id" }
        );

        // Update application with fairness data
        await supabaseAdmin
          .from("bursary_applications")
          .update({
            fairness_priority_score: fairnessPriorityScore,
            is_fairness_priority: isFairnessPriorityCandidate,
            fraud_risk_level: fraudRiskLevel,
            historical_status: historicalStatus,
          })
          .eq("id", app.id);

        // Audit log
        await supabaseAdmin.from("fairness_audit_log").insert({
          application_id: app.id,
          action: "fairness_evaluation",
          details: {
            previousAttempts,
            previousFunded,
            fairnessPriorityScore,
            isFairnessPriorityCandidate,
            fraudRiskLevel,
            historicalStatus,
            adjustments,
          },
          performed_by: "fairness_engine",
        });

        results.push({
          applicationId: app.id,
          nationalId: app.parent_national_id.slice(-3).padStart(app.parent_national_id.length, "*"),
          previousAttempts,
          previousFunded,
          fairnessPriorityScore,
          isFairnessPriorityCandidate,
          fraudRiskLevel,
          historicalStatus,
          adjustments,
        });
      }

      const priorityCandidates = results.filter((r) => r.isFairnessPriorityCandidate).length;
      const redFlagged = results.filter((r) => r.historicalStatus === "red_flagged").length;

      return new Response(
        JSON.stringify({
          success: true,
          message: `Evaluated ${results.length} applications. ${priorityCandidates} priority candidates, ${redFlagged} red-flagged.`,
          results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "record_cycle") {
      // Record completed allocation cycle in history
      const { data: cycle } = await supabaseAdmin
        .from("allocation_cycles")
        .select("*")
        .eq("id", cycleId)
        .single();
      if (!cycle) throw new Error("Cycle not found");

      // Get all applications that were processed in this cycle's county
      const { data: processedApps } = await supabaseAdmin
        .from("bursary_applications")
        .select("id, parent_national_id, parent_phone, poverty_score, status, allocated_amount, parent_county, is_duplicate")
        .eq("parent_county", cycle.county)
        .in("status", ["approved", "rejected", "disbursed"]);

      if (!processedApps?.length) {
        return new Response(
          JSON.stringify({ success: true, message: "No processed applications to record" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let recorded = 0;
      for (const app of processedApps) {
        const fundingStatus = app.is_duplicate
          ? "duplicate"
          : app.status === "approved" || app.status === "disbursed"
          ? "funded"
          : "not_funded";

        await supabaseAdmin.from("applicant_history").insert({
          national_id: app.parent_national_id,
          phone_number: app.parent_phone,
          cycle_id: cycleId,
          application_id: app.id,
          funding_status: fundingStatus,
          ai_score: app.poverty_score,
          county: app.parent_county,
          allocated_amount: app.allocated_amount || 0,
        });
        recorded++;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Recorded ${recorded} applications in history for cycle ${cycle.cycle_name}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'evaluate' or 'record_cycle'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Fairness engine error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
