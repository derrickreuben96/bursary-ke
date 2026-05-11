// Admin-only edge function to wipe submission data + dashboard metrics.
// Two-step protection: caller must be authenticated admin AND post the exact
// confirmation phrase "RESET SUBMISSIONS" in the request body.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIRM_PHRASE = "RESET SUBMISSIONS";

const TABLES = [
  "application_status_history",
  "student_beneficiaries",
  "parent_applications",
  "bursary_applications",
  "ai_allocation_runs",
  "allocation_cycles",
  "applicant_history",
  "fairness_tracking",
  "fairness_audit_log",
  "sync_metrics",
  "audit_runs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "missing_token" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Identify caller
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "unauthenticated" }, 401);
    const userId = userRes.user.id;

    // 2. Admin role check
    const admin = createClient(url, service);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "forbidden" }, 403);

    // 3. Validate typed confirmation phrase
    let body: { confirm?: string } = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid_body" }, 400);
    }
    if ((body.confirm ?? "").trim() !== CONFIRM_PHRASE) {
      return json(
        { error: "confirmation_mismatch", expected: CONFIRM_PHRASE },
        400,
      );
    }

    // 4. Wipe — service role bypasses RLS
    const deleted: Record<string, number | string> = {};
    for (const t of TABLES) {
      const { error, count } = await admin
        .from(t)
        .delete({ count: "exact" })
        .not("id", "is", null);
      deleted[t] = error ? `error:${error.message}` : (count ?? 0);
    }

    // 5. Audit trail
    await admin.from("security_events").insert({
      event_type: "admin_reset_submissions",
      severity: "critical",
      source: "admin-reset-submissions",
      details: { actor: userId, deleted },
    });

    return json({ ok: true, deleted });
  } catch (e) {
    return json({ error: "server_error", message: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
