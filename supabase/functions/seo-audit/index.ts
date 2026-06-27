// SEO regression auditor.
// - Runs Google PageSpeed Insights (Lighthouse) against the target URL.
// - Fetches the rendered HTML and validates JSON-LD blocks (Rich Results).
// - Compares to the previous run; flags regressions on thresholds or drops.
// - Persists every run to seo_audit_results.
// - Returns 200 (clean) or 409 (regression) so CI can fail the build.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_URL = "https://www.bursaryke.xyz/";
const THRESHOLD = 90; // Balanced: any of P/A/SEO < 90 = regression.

interface LighthouseScores {
  performance: number | null;
  accessibility: number | null;
  best_practices: number | null;
  seo: number | null;
}

interface RichResultsIssue {
  block: number;
  message: string;
}

async function runLighthouse(url: string): Promise<LighthouseScores> {
  const params = new URLSearchParams({
    url,
    strategy: "mobile",
  });
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", c);
  }
  const res = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
  );
  if (!res.ok) {
    throw new Error(`PageSpeed Insights failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const cat = data?.lighthouseResult?.categories ?? {};
  const pct = (v: unknown) =>
    typeof v === "number" ? Math.round(v * 100) : null;
  return {
    performance: pct(cat.performance?.score),
    accessibility: pct(cat.accessibility?.score),
    best_practices: pct(cat["best-practices"]?.score),
    seo: pct(cat.seo?.score),
  };
}

async function validateRichResults(url: string): Promise<RichResultsIssue[]> {
  const res = await fetch(url, { headers: { "user-agent": "Lovable-SEO-Audit/1.0" } });
  if (!res.ok) {
    return [{ block: -1, message: `fetch failed: HTTP ${res.status}` }];
  }
  const html = await res.text();
  const issues: RichResultsIssue[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) blocks.push(m[1].trim());
  if (blocks.length === 0) {
    issues.push({ block: -1, message: "No JSON-LD structured data found on page" });
    return issues;
  }
  blocks.forEach((raw, i) => {
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      items.forEach((item, j) => {
        const label = `block ${i + 1}${items.length > 1 ? `.${j + 1}` : ""}`;
        if (!item || typeof item !== "object") {
          issues.push({ block: i + 1, message: `${label}: not an object` });
          return;
        }
        if (!item["@context"]) {
          issues.push({ block: i + 1, message: `${label}: missing @context` });
        }
        if (!item["@type"]) {
          issues.push({ block: i + 1, message: `${label}: missing @type` });
        }
        // Type-specific minimal required fields.
        const type = String(item["@type"] ?? "");
        if (type === "FAQPage" && !Array.isArray(item.mainEntity)) {
          issues.push({ block: i + 1, message: `${label}: FAQPage missing mainEntity[]` });
        }
        if (type === "Organization" && !item.name) {
          issues.push({ block: i + 1, message: `${label}: Organization missing name` });
        }
        if (type === "Article" && !item.headline) {
          issues.push({ block: i + 1, message: `${label}: Article missing headline` });
        }
      });
    } catch (e) {
      issues.push({
        block: i + 1,
        message: `block ${i + 1}: invalid JSON — ${(e as Error).message}`,
      });
    }
  });
  return issues;
}

function evaluateRegression(
  curr: LighthouseScores,
  prev: { performance_score: number | null; accessibility_score: number | null; best_practices_score: number | null; seo_score: number | null } | null,
  richIssues: RichResultsIssue[],
): { isRegression: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const check = (name: string, v: number | null) => {
    if (v !== null && v < THRESHOLD) reasons.push(`${name} score ${v} < ${THRESHOLD}`);
  };
  check("Performance", curr.performance);
  check("Accessibility", curr.accessibility);
  check("SEO", curr.seo);

  if (richIssues.length > 0) {
    reasons.push(`${richIssues.length} structured-data issue(s)`);
  }

  if (prev) {
    const drop = (name: string, c: number | null, p: number | null) => {
      if (c !== null && p !== null && c < p - 5) {
        reasons.push(`${name} dropped ${p} → ${c}`);
      }
    };
    drop("Performance", curr.performance, prev.performance_score);
    drop("Accessibility", curr.accessibility, prev.accessibility_score);
    drop("SEO", curr.seo, prev.seo_score);
  }

  return { isRegression: reasons.length > 0, reasons };
}

// Strict allowlist of URLs this auditor is permitted to fetch.
// Prevents SSRF: any caller-supplied URL outside this list is rejected,
// regardless of scheme, host, or IP.
const ALLOWED_URLS = new Set<string>([
  "https://www.bursaryke.xyz/",
  "https://bursaryke.xyz/",
  "https://bursary-kenya-connect.lovable.app/",
]);

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    // Normalize trailing slash for comparison
    const normalized = u.origin + (u.pathname === "" ? "/" : u.pathname) + u.search;
    return ALLOWED_URLS.has(normalized) || ALLOWED_URLS.has(u.origin + "/");
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url: string = body.url ?? DEFAULT_URL;
    const source: string = body.source ?? "manual";

    if (!isAllowedUrl(url)) {
      return new Response(
        JSON.stringify({ error: "URL not permitted. Only known application domains may be audited." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [scores, richIssues] = await Promise.all([
      runLighthouse(url),
      validateRichResults(url),
    ]);



    const { data: prev } = await supabase
      .from("seo_audit_results")
      .select("performance_score, accessibility_score, best_practices_score, seo_score")
      .eq("url", url)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { isRegression, reasons } = evaluateRegression(scores, prev, richIssues);

    const { error: insertErr } = await supabase.from("seo_audit_results").insert({
      url,
      performance_score: scores.performance,
      accessibility_score: scores.accessibility,
      best_practices_score: scores.best_practices,
      seo_score: scores.seo,
      rich_results_errors: richIssues,
      is_regression: isRegression,
      regression_reasons: reasons,
      source,
    });
    if (insertErr) console.error("insert failed:", insertErr);

    if (isRegression) {
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "seo-regression-alert",
            recipientEmail: "derrickreuben96@gmail.com",
            idempotencyKey: `seo-regression-${new Date().toISOString().slice(0, 16)}`,
            templateData: { url, scores, reasons, richIssues },
          },
        });
      } catch (e) {
        console.error("alert email failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ url, scores, richIssues, isRegression, reasons }),
      {
        status: isRegression ? 409 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("seo-audit error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
