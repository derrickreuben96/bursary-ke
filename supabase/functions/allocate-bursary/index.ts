import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  checkRateLimit, 
  getClientIp, 
  rateLimitExceededResponse,
  maybeCleanup 
} from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit config: 5 requests per minute per IP (stricter for admin operations)
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
};

// Input validation schemas
const AllocateBursarySchema = z.object({
  action: z.enum(['analyze', 'allocate', 'generate-treasury-report']),
  budget: z.number().min(100000).max(100000000).optional().default(10000000),
  fiscalYear: z.string().regex(/^\d{4}\/\d{4}$/).optional().default("2024/2025"),
});

interface AllocationResult {
  trackingNumber: string;
  studentName: string;
  institution: string;
  county: string;
  povertyScore: number;
  povertyTier: string;
  recommendedAmount: number;
  allocationReason: string;
}

interface TreasuryReport {
  generatedAt: string;
  fiscalYear: string;
  totalBudget: number;
  totalAllocated: number;
  totalApplicants: number;
  selectedApplicants: number;
  allocations: AllocationResult[];
  countyBreakdown: Record<string, { count: number; amount: number }>;
  tierBreakdown: Record<string, { count: number; amount: number }>;
  summary: string;
}

// Helper function to verify admin role
async function verifyAdminRole(req: Request): Promise<{ user: { id: string } } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create authenticated client to verify JWT
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
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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

  return { user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Apply rate limiting
  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);
  maybeCleanup(RATE_LIMIT_CONFIG.windowMs);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(corsHeaders, rateLimitResult, RATE_LIMIT_CONFIG);
  }

  try {
    // Verify admin authentication
    const authResult = await verifyAdminRole(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    // Parse and validate input
    const rawBody = await req.json();
    const parseResult = AllocateBursarySchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, budget, fiscalYear } = parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === "analyze") {
      // Get all pending applications
      const { data: applications, error } = await supabase
        .from("bursary_applications")
        .select("*")
        .in("status", ["received", "review", "verification"])
        .order("poverty_score", { ascending: false });

      if (error) throw error;

      // AI-powered allocation logic
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      let aiSummary = "";
      if (LOVABLE_API_KEY && applications && applications.length > 0) {
        try {
          // Prepare data summary for AI
          const dataSummary = {
            totalApplicants: applications.length,
            byTier: {
              High: applications.filter(a => a.poverty_tier === "High").length,
              Medium: applications.filter(a => a.poverty_tier === "Medium").length,
              Low: applications.filter(a => a.poverty_tier === "Low").length,
            },
            byType: {
              secondary: applications.filter(a => a.student_type === "secondary").length,
              university: applications.filter(a => a.student_type === "university").length,
            },
            avgPovertyScore: Math.round(
              applications.reduce((sum, a) => sum + a.poverty_score, 0) / applications.length
            ),
            budget,
          };

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `You are a bursary allocation advisor for Kenya's Ministry of Education. 
                  Provide strategic recommendations for fair and efficient bursary distribution.
                  Focus on equity, need-based allocation, and regional balance.
                  Be concise but thorough.`,
                },
                {
                  role: "user",
                  content: `Analyze this bursary application data and provide allocation recommendations:
                  
                  Budget: KES ${budget.toLocaleString()}
                  ${JSON.stringify(dataSummary, null, 2)}
                  
                  Provide:
                  1. Recommended allocation strategy
                  2. Priority groups
                  3. Suggested per-student amounts by tier
                  4. Any concerns or recommendations`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            aiSummary = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (aiError) {
          console.error("AI analysis error:", aiError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            totalApplicants: applications?.length || 0,
            pendingApplications: applications || [],
            budget,
            aiRecommendations: aiSummary,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "allocate") {
      // Get all pending applications sorted by poverty score
      const { data: applications, error } = await supabase
        .from("bursary_applications")
        .select("*")
        .in("status", ["received", "review", "verification"])
        .order("poverty_score", { ascending: false });

      if (error) throw error;
      if (!applications || applications.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No pending applications found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Allocation amounts by tier and type
      const allocationRates = {
        High: { secondary: 35000, university: 80000 },
        Medium: { secondary: 25000, university: 50000 },
        Low: { secondary: 15000, university: 30000 },
      };

      const allocations: AllocationResult[] = [];
      let remainingBudget = budget;
      const countyBreakdown: Record<string, { count: number; amount: number }> = {};
      const tierBreakdown: Record<string, { count: number; amount: number }> = {
        High: { count: 0, amount: 0 },
        Medium: { count: 0, amount: 0 },
        Low: { count: 0, amount: 0 },
      };

      // Process applications in priority order
      for (const app of applications) {
        const tier = app.poverty_tier as "High" | "Medium" | "Low";
        const type = app.student_type as "secondary" | "university";
        const amount = allocationRates[tier][type];

        if (remainingBudget >= amount) {
          // Allocate to this applicant
          allocations.push({
            trackingNumber: app.tracking_number,
            studentName: app.student_full_name,
            institution: app.institution_name,
            county: app.parent_county,
            povertyScore: app.poverty_score,
            povertyTier: tier,
            recommendedAmount: amount,
            allocationReason: `${tier} priority ${type} student with poverty score ${app.poverty_score}`,
          });

          remainingBudget -= amount;

          // Update breakdown stats
          if (!countyBreakdown[app.parent_county]) {
            countyBreakdown[app.parent_county] = { count: 0, amount: 0 };
          }
          countyBreakdown[app.parent_county].count++;
          countyBreakdown[app.parent_county].amount += amount;

          tierBreakdown[tier].count++;
          tierBreakdown[tier].amount += amount;

          // Update application status to approved
          await supabase
            .from("bursary_applications")
            .update({ 
              status: "approved",
              reviewed_at: new Date().toISOString(),
            })
            .eq("id", app.id);
        }
      }

      // Generate treasury report
      const report: TreasuryReport = {
        generatedAt: new Date().toISOString(),
        fiscalYear,
        totalBudget: budget,
        totalAllocated: budget - remainingBudget,
        totalApplicants: applications.length,
        selectedApplicants: allocations.length,
        allocations,
        countyBreakdown,
        tierBreakdown,
        summary: `
BURSARY ALLOCATION REPORT - ${fiscalYear}
==========================================

Generated: ${new Date().toLocaleString("en-KE")}

EXECUTIVE SUMMARY
-----------------
Total Budget: KES ${budget.toLocaleString()}
Total Allocated: KES ${(budget - remainingBudget).toLocaleString()}
Remaining: KES ${remainingBudget.toLocaleString()}

APPLICANT STATISTICS
--------------------
Total Applicants: ${applications.length}
Selected for Funding: ${allocations.length}
Selection Rate: ${((allocations.length / applications.length) * 100).toFixed(1)}%

ALLOCATION BY PRIORITY TIER
---------------------------
High Priority: ${tierBreakdown.High.count} students - KES ${tierBreakdown.High.amount.toLocaleString()}
Medium Priority: ${tierBreakdown.Medium.count} students - KES ${tierBreakdown.Medium.amount.toLocaleString()}
Low Priority: ${tierBreakdown.Low.count} students - KES ${tierBreakdown.Low.amount.toLocaleString()}

REGIONAL DISTRIBUTION
---------------------
${Object.entries(countyBreakdown)
  .sort((a, b) => b[1].amount - a[1].amount)
  .map(([county, data]) => `${county}: ${data.count} students - KES ${data.amount.toLocaleString()}`)
  .join("\n")}

NOTES
-----
- Allocations prioritized by poverty assessment score
- Secondary students: KES 15,000 - 35,000 based on tier
- University students: KES 30,000 - 80,000 based on tier
- All selected applicants have been marked as "Approved" in the system

This report is for submission to the National Treasury for fund disbursement.
        `.trim(),
      };

      return new Response(
        JSON.stringify({ success: true, report }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate-treasury-report") {
      // Get all approved applications for treasury report
      const { data: approved, error } = await supabase
        .from("bursary_applications")
        .select("*")
        .eq("status", "approved");

      if (error) throw error;

      // Use AI to generate a professional treasury report
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let professionalReport = "";

      if (LOVABLE_API_KEY && approved && approved.length > 0) {
        const reportData = {
          fiscalYear,
          approvedCount: approved.length,
          totalAmount: approved.reduce((sum, a) => {
            const tier = a.poverty_tier;
            const type = a.student_type;
            const rates: Record<string, Record<string, number>> = {
              High: { secondary: 35000, university: 80000 },
              Medium: { secondary: 25000, university: 50000 },
              Low: { secondary: 15000, university: 30000 },
            };
            return sum + (rates[tier]?.[type] || 0);
          }, 0),
          byCounty: approved.reduce((acc, a) => {
            acc[a.parent_county] = (acc[a.parent_county] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byTier: {
            High: approved.filter(a => a.poverty_tier === "High").length,
            Medium: approved.filter(a => a.poverty_tier === "Medium").length,
            Low: approved.filter(a => a.poverty_tier === "Low").length,
          },
        };

        try {
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                {
                  role: "system",
                  content: `You are an official report writer for Kenya's Ministry of Education. 
                  Generate professional, formal treasury reports suitable for government submission.
                  Use official government language and formatting.`,
                },
                {
                  role: "user",
                  content: `Generate a professional treasury disbursement request report with this data:
                  
                  ${JSON.stringify(reportData, null, 2)}
                  
                  Include:
                  1. Official header and reference number
                  2. Executive summary
                  3. Detailed breakdown by county and tier
                  4. Disbursement schedule recommendation
                  5. Accountability measures
                  6. Authorized signatory section`,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            professionalReport = aiData.choices?.[0]?.message?.content || "";
          }
        } catch (aiError) {
          console.error("AI report generation error:", aiError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          approvedApplications: approved?.length || 0,
          treasuryReport: professionalReport,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'analyze', 'allocate', or 'generate-treasury-report'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Allocation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
