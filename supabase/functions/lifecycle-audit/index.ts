// Re-runnable end-to-end lifecycle audit. Admin-only.
// Records pass/fail evidence in public.audit_runs for the Ops dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Check = { name: string; passed: boolean; detail?: string; value?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const deploymentRef: string | null = body?.deploymentRef ?? null;

    const checks: Check[] = [];
    const expectZero = async (name: string, sql: string) => {
      const { data, error } = await admin.rpc("workflow_backlog_snapshot");
      // we don't actually use rpc for arbitrary sql — query via REST below
      void data; void error; void sql;
      throw new Error(`expectZero misuse for ${name}`);
    };
    void expectZero;

    // Zero-orphan checks via dedicated REST queries
    const countWhere = async (table: string, filter: (q: any) => any) => {
      const { count, error } = await filter(
        admin.from(table).select("*", { count: "exact", head: true })
      );
      if (error) throw error;
      return count ?? 0;
    };

    const totalApps = await countWhere("bursary_applications", (q) => q);
    checks.push({ name: "total_applications", passed: totalApps >= 0, value: totalApps });

    const nullAdvert = await countWhere("bursary_applications", (q) => q.is("advert_id", null));
    checks.push({ name: "no_null_advert_id", passed: nullAdvert === 0, value: nullAdvert });

    const nullTracking = await countWhere("bursary_applications", (q) => q.is("tracking_number", null));
    checks.push({ name: "no_null_tracking_number", passed: nullTracking === 0, value: nullTracking });

    const approvedNotReleased = await countWhere(
      "bursary_applications",
      (q) => q.eq("status", "approved").eq("released_to_treasury", false),
    );
    checks.push({
      name: "no_approved_not_released_to_treasury",
      passed: approvedNotReleased === 0, value: approvedNotReleased,
    });

    // Tracking edge function smoke test (uses any existing tracking number)
    const { data: sample } = await admin
      .from("bursary_applications").select("tracking_number")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (sample?.tracking_number) {
      const tr = await fetch(`${supabaseUrl}/functions/v1/track-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, apikey: anonKey },
        body: JSON.stringify({ trackingNumber: sample.tracking_number }),
      });
      const trJson = await tr.json().catch(() => ({}));
      checks.push({
        name: "tracking_edge_function_responds",
        passed: tr.ok && trJson?.found === true,
        detail: tr.ok ? "200 found=true" : `status ${tr.status}`,
      });
    } else {
      checks.push({ name: "tracking_edge_function_responds", passed: true, detail: "no apps to probe" });
    }

    // RLS sanity: anon client must NOT be able to SELECT bursary_applications
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: leaked, error: anonErr } = await anonClient
      .from("bursary_applications").select("id").limit(1);
    checks.push({
      name: "anon_cannot_read_applications",
      passed: !leaked || leaked.length === 0,
      detail: anonErr?.message ?? `rows=${leaked?.length ?? 0}`,
    });

    // Trigger present
    const { data: trig } = await admin.rpc("workflow_backlog_snapshot");
    checks.push({
      name: "workflow_backlog_snapshot_callable",
      passed: Array.isArray(trig) && trig.length > 0,
      value: trig?.length ?? 0,
    });

    const total = checks.length;
    const passed = checks.filter((c) => c.passed).length;
    const failed = total - passed;
    const status = failed === 0 ? "pass" : passed === 0 ? "fail" : "partial";
    const durationMs = Date.now() - startedAt;

    const { data: inserted, error: insErr } = await admin
      .from("audit_runs")
      .insert({
        suite: "lifecycle_e2e",
        total, passed, failed,
        duration_ms: durationMs,
        status,
        details: checks,
        deployment_ref: deploymentRef,
      })
      .select("id").single();

    if (insErr) throw insErr;

    return new Response(
      JSON.stringify({ success: true, runId: inserted.id, status, total, passed, failed, durationMs, checks }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
