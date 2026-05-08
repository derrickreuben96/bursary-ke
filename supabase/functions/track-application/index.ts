import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { 
  checkRateLimit, 
  getClientIp, 
  rateLimitExceededResponse,
  rateLimitHeaders,
  maybeCleanup 
} from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

const TrackingSchema = z.object({
  trackingNumber: z.string().regex(/^BKE-[A-Z0-9]{6}$/i, "Invalid tracking number format").optional(),
  verificationValue: z.string().min(1).optional(),
  verificationType: z.enum(["phone", "national_id"]).optional(),
}).refine(
  (v) => !!v.trackingNumber || (!!v.verificationValue && !!v.verificationType),
  { message: "Provide a tracking number, or a phone/national ID to search by" }
);

function formatPhone(phone: string): string {
  let formatted = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (formatted.startsWith("0")) {
    formatted = "+254" + formatted.substring(1);
  } else if (formatted.startsWith("254") && !formatted.startsWith("+")) {
    formatted = "+" + formatted;
  } else if (!formatted.startsWith("+")) {
    formatted = "+254" + formatted;
  }
  return formatted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);
  maybeCleanup(RATE_LIMIT_CONFIG.windowMs);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(corsHeaders, rateLimitResult, RATE_LIMIT_CONFIG);
  }

  try {
    const rawBody = await req.json();
    const parseResult = TrackingSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ found: false, error: "Invalid input", details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trackingNumber, verificationValue, verificationType } = parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let query = supabaseAdmin
      .from("bursary_applications")
      .select("tracking_number, student_type, status, created_at, updated_at, allocated_amount, institution_name, released_to_treasury");

    if (trackingNumber) {
      query = query.eq("tracking_number", trackingNumber.toUpperCase());
      // If verification details also supplied, require them to match (defence in depth)
      if (verificationValue && verificationType === "phone") {
        const formattedPhone = formatPhone(verificationValue);
        query = query.or(`parent_phone.eq.${formattedPhone},parent_phone.eq.${verificationValue}`);
      } else if (verificationValue && verificationType === "national_id") {
        query = query.eq("parent_national_id", verificationValue);
      }
    } else if (verificationType === "phone" && verificationValue) {
      const formattedPhone = formatPhone(verificationValue);
      query = query.or(`parent_phone.eq.${formattedPhone},parent_phone.eq.${verificationValue}`);
    } else if (verificationType === "national_id" && verificationValue) {
      query = query.eq("parent_national_id", verificationValue);
    }
    // Most-recent first when searching by ID/phone alone
    query = query.order("created_at", { ascending: false }).limit(1);

    const { data: rows, error } = await query;
    const data = rows && rows.length > 0 ? rows[0] : null;

    if (error) {
      console.error("[TRACK] Database error:", error);
      return new Response(
        JSON.stringify({ found: false, error: "Failed to lookup application" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      // Log suspicious failed lookup for monitoring (no PII — only tracking number prefix)
      try {
        await supabaseAdmin.rpc("log_security_event", {
          _event_type: "tracking_lookup_failed",
          _severity: "warn",
          _source: "track-application",
          _ip: clientIp,
          _user_agent: req.headers.get("user-agent") ?? null,
          _details: {
            tracking_prefix: trackingNumber ? trackingNumber.substring(0, 4) : null,
            verification_type: verificationType ?? null,
          },
        });
      } catch (_e) { /* swallow logging errors */ }

      return new Response(
        JSON.stringify({ found: false, message: "Application not found. Please verify your tracking number and verification details." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch actual status history for real dates
    const { data: appIdRow } = await supabaseAdmin
      .from("bursary_applications")
      .select("id")
      .eq("tracking_number", data.tracking_number)
      .maybeSingle();
    const { data: historyData } = await supabaseAdmin
      .from("application_status_history")
      .select("from_status, to_status, changed_at")
      .eq("application_id", appIdRow?.id || "")
      .order("changed_at", { ascending: true });

    // Build a map of when each status was reached
    const statusDates: Record<string, string> = {
      received: data.created_at,
    };
    if (historyData) {
      for (const entry of historyData) {
        statusDates[entry.to_status] = entry.changed_at;
      }
    }

    const isRejected = data.status === "rejected";
    const statusOrder = ["received", "review", "verification", "approved", "disbursed"];
    const currentIndex = isRejected 
      ? statusOrder.indexOf("verification") // Show rejection at verification stage
      : statusOrder.indexOf(data.status);

    const stageDefinitions = [
      { name: "Application Received", key: "received", message: "Your application has been received and is in our system." },
      { name: "Under Review", key: "review", message: "Your application is being reviewed by our team." },
      { name: "Verification & Screening", key: "verification", message: "Your application is being verified and screened by the Commissioner." },
      { name: "Approval Decision", key: "approved", message: data.allocated_amount 
        ? `Your application has been approved! Amount: KES ${data.allocated_amount.toLocaleString()}.`
        : "Your application has been approved for funding." },
      { name: "Funds Disbursed", key: "disbursed", message: `Funds have been sent to ${data.institution_name || "your institution"}.` },
    ];

    const stages = stageDefinitions.map((stage, index) => {
      let status: string;
      let message = stage.message;

      if (isRejected && index >= 3) {
        // For rejected applications, show rejection at approval stage
        if (index === 3) {
          status = "current";
          message = "Your application was not successful in this funding cycle. You may apply again in the next cycle.";
          return {
            name: "Application Not Successful",
            status,
            date: statusDates["rejected"] || data.updated_at,
            message,
          };
        }
        status = "pending";
      } else if (index < currentIndex) {
        status = "completed";
      } else if (index === currentIndex) {
        status = "current";
      } else {
        status = "pending";
      }

      return {
        name: stage.name,
        status,
        date: statusDates[stage.key] || (index <= currentIndex ? data.created_at : null),
        message,
      };
    });

    return new Response(
      JSON.stringify({
        found: true,
        trackingNumber: data.tracking_number,
        studentType: data.student_type,
        status: data.status,
        createdAt: data.created_at,
        stages,
      }),
      { headers: { 
        ...corsHeaders, 
        ...rateLimitHeaders(rateLimitResult, RATE_LIMIT_CONFIG),
        "Content-Type": "application/json" 
      } }
    );
  } catch (error) {
    console.error("[TRACK] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ found: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});