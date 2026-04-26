// Admin AI Summary edge function
// Generates a detailed natural-language summary of platform/advert data using Lovable AI
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  scope: "system" | "advert";
  advert_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as SummaryRequest;
    const scope = body.scope === "advert" ? "advert" : "system";

    // Aggregate data (no PII — only counts, sums, status breakdowns)
    let context: Record<string, unknown> = {};
    let title = "Bursary-KE — System Overview";

    if (scope === "advert") {
      if (!body.advert_id) {
        return new Response(JSON.stringify({ error: "advert_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: advert } = await admin
        .from("bursary_adverts")
        .select("id,title,county,ward,deadline,budget_amount,min_beneficiaries,is_active,description")
        .eq("id", body.advert_id)
        .maybeSingle();
      if (!advert) {
        return new Response(JSON.stringify({ error: "Advert not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: apps } = await admin
        .from("bursary_applications")
        .select("status,allocated_amount,poverty_tier,student_type,parent_county,parent_ward,household_income,household_dependents,poverty_score,is_fairness_priority")
        .eq("advert_id", body.advert_id);

      const list = apps ?? [];
      const byStatus: Record<string, number> = {};
      const byTier: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byWard: Record<string, number> = {};
      let totalAllocated = 0;
      let priorityCount = 0;
      let incomeSum = 0;
      let depSum = 0;
      let scoreSum = 0;
      for (const a of list) {
        byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
        byTier[a.poverty_tier] = (byTier[a.poverty_tier] ?? 0) + 1;
        byType[a.student_type] = (byType[a.student_type] ?? 0) + 1;
        const w = a.parent_ward ?? "Unknown";
        byWard[w] = (byWard[w] ?? 0) + 1;
        totalAllocated += Number(a.allocated_amount ?? 0);
        if (a.is_fairness_priority) priorityCount++;
        incomeSum += Number(a.household_income ?? 0);
        depSum += Number(a.household_dependents ?? 0);
        scoreSum += Number(a.poverty_score ?? 0);
      }
      title = `Bursary Advert — ${advert.title}`;
      context = {
        advert,
        totals: {
          applicants: list.length,
          allocated_kes: totalAllocated,
          fairness_priority_count: priorityCount,
          avg_household_income: list.length ? Math.round(incomeSum / list.length) : 0,
          avg_dependents: list.length ? +(depSum / list.length).toFixed(1) : 0,
          avg_poverty_score: list.length ? Math.round(scoreSum / list.length) : 0,
        },
        breakdown: { byStatus, byTier, byType, byWard },
      };
    } else {
      const [appsRes, advertsRes, cyclesRes] = await Promise.all([
        admin
          .from("bursary_applications")
          .select("status,allocated_amount,poverty_tier,student_type,parent_county,is_fairness_priority,created_at"),
        admin.from("bursary_adverts").select("id,title,county,is_active,budget_amount,deadline"),
        admin
          .from("allocation_cycles")
          .select("county,total_allocated,total_approved,total_applicants,total_budget,completed_at"),
      ]);
      const apps = appsRes.data ?? [];
      const adverts = advertsRes.data ?? [];
      const cycles = cyclesRes.data ?? [];
      const byStatus: Record<string, number> = {};
      const byTier: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const byCounty: Record<string, number> = {};
      let totalAllocated = 0;
      let priorityCount = 0;
      for (const a of apps) {
        byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
        byTier[a.poverty_tier] = (byTier[a.poverty_tier] ?? 0) + 1;
        byType[a.student_type] = (byType[a.student_type] ?? 0) + 1;
        byCounty[a.parent_county] = (byCounty[a.parent_county] ?? 0) + 1;
        totalAllocated += Number(a.allocated_amount ?? 0);
        if (a.is_fairness_priority) priorityCount++;
      }
      const now = Date.now();
      const activeAdverts = adverts.filter((x) => x.is_active && new Date(x.deadline).getTime() > now).length;
      const expiredAdverts = adverts.filter((x) => new Date(x.deadline).getTime() <= now).length;
      const totalBudget = adverts.reduce((s, x) => s + Number(x.budget_amount ?? 0), 0);

      context = {
        totals: {
          applications: apps.length,
          adverts: adverts.length,
          active_adverts: activeAdverts,
          expired_adverts: expiredAdverts,
          allocated_kes: totalAllocated,
          total_advertised_budget_kes: totalBudget,
          fairness_priority_count: priorityCount,
          completed_cycles: cycles.filter((c) => c.completed_at).length,
        },
        breakdown: { byStatus, byTier, byType, byCounty },
      };
    }

    const systemPrompt = `You are a senior data analyst for the Bursary-KE platform — a Kenyan government bursary management system.
Generate a clear, well-structured executive summary in plain English suitable for a PDF report.
Use short paragraphs and bullet points. Be specific with numbers. Avoid PII (no names, IDs, phones).
Cover: 1) Headline metrics, 2) Status / funding breakdown, 3) Equity & fairness observations,
4) Geographic / demographic patterns, 5) Risks and recommendations.
Currency is KES. Keep tone professional and concise (target ~500 words).`;

    const userPrompt = `Title: ${title}\n\nAggregate data (JSON):\n${JSON.stringify(context, null, 2)}\n\nWrite the executive summary now.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const summary: string = aiData.choices?.[0]?.message?.content ?? "(no summary)";

    return new Response(
      JSON.stringify({ title, scope, context, summary, generated_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("admin-summary error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
