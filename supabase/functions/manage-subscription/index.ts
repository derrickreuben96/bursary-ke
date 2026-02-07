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

// Rate limit config: 15 requests per minute per IP
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15,
};

// Validation schemas
const LookupSchema = z.object({
  action: z.literal("lookup"),
  contactValue: z.string().min(1),
  contactType: z.enum(["phone", "email"]),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  subscriptionId: z.string().uuid(),
  contactValue: z.string().min(1),
  contactType: z.enum(["phone", "email"]),
});

const RequestSchema = z.discriminatedUnion("action", [LookupSchema, DeleteSchema]);

// Helper to mask contact info for response
function maskContact(value: string, type: "phone" | "email"): string {
  if (type === "email") {
    const [local, domain] = value.split("@");
    if (!local || !domain) return "****";
    return local.substring(0, 2) + "****@" + domain;
  } else {
    if (value.length < 6) return "****";
    return value.substring(0, 6) + "****";
  }
}

// Helper to format phone for comparison
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

  // Apply rate limiting
  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(clientIp, RATE_LIMIT_CONFIG);
  maybeCleanup(RATE_LIMIT_CONFIG.windowMs);

  if (!rateLimitResult.allowed) {
    return rateLimitExceededResponse(corsHeaders, rateLimitResult, RATE_LIMIT_CONFIG);
  }

  try {
    const rawBody = await req.json();
    const parseResult = RequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid input", details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const data = parseResult.data;

    if (data.action === "lookup") {
      // Lookup subscriptions by contact
      let query = supabaseAdmin
        .from("bursary_subscriptions")
        .select("id, county, email, phone, is_active, created_at");

      if (data.contactType === "email") {
        query = query.eq("email", data.contactValue.toLowerCase());
      } else {
        const formattedPhone = formatPhone(data.contactValue);
        query = query.or(`phone.eq.${formattedPhone},phone.eq.${data.contactValue}`);
      }

      const { data: subscriptions, error } = await query;

      if (error) {
        console.error("[SUBSCRIPTION] Lookup error:", error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to lookup subscriptions" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mask sensitive data in response
      const maskedSubscriptions = (subscriptions || []).map(sub => ({
        id: sub.id,
        county: sub.county,
        contact: sub.email 
          ? maskContact(sub.email, "email")
          : sub.phone 
            ? maskContact(sub.phone, "phone")
            : "N/A",
        isActive: sub.is_active,
        createdAt: sub.created_at,
      }));

      return new Response(
        JSON.stringify({ success: true, subscriptions: maskedSubscriptions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (data.action === "delete") {
      // Verify ownership before deleting
      let query = supabaseAdmin
        .from("bursary_subscriptions")
        .select("id, email, phone")
        .eq("id", data.subscriptionId);

      const { data: subscription, error: lookupError } = await query.maybeSingle();

      if (lookupError || !subscription) {
        return new Response(
          JSON.stringify({ success: false, error: "Subscription not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify contact matches
      let isOwner = false;
      if (data.contactType === "email" && subscription.email) {
        isOwner = subscription.email.toLowerCase() === data.contactValue.toLowerCase();
      } else if (data.contactType === "phone" && subscription.phone) {
        const formattedInput = formatPhone(data.contactValue);
        const formattedStored = formatPhone(subscription.phone);
        isOwner = formattedInput === formattedStored || subscription.phone === data.contactValue;
      }

      if (!isOwner) {
        return new Response(
          JSON.stringify({ success: false, error: "Not authorized to delete this subscription" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete the subscription
      const { error: deleteError } = await supabaseAdmin
        .from("bursary_subscriptions")
        .delete()
        .eq("id", data.subscriptionId);

      if (deleteError) {
        console.error("[SUBSCRIPTION] Delete error:", deleteError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to delete subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Subscription deleted successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SUBSCRIPTION] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
