import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const TrackingSchema = z.object({
  trackingNumber: z.string().regex(/^BKE-[A-Z0-9]{6}$/, "Invalid tracking number format"),
  verificationValue: z.string().min(1, "Verification value required"),
  verificationType: z.enum(["phone", "national_id"]),
});

// Helper to format phone number to +254 format
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

  try {
    const rawBody = await req.json();
    const parseResult = TrackingSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          found: false, 
          error: "Invalid input",
          details: parseResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trackingNumber, verificationValue, verificationType } = parseResult.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Build query with verification
    let query = supabaseAdmin
      .from("bursary_applications")
      .select("tracking_number, student_type, status, created_at, updated_at")
      .eq("tracking_number", trackingNumber.toUpperCase());

    // Add verification condition based on type
    if (verificationType === "phone") {
      // Format the phone number for comparison
      const formattedPhone = formatPhone(verificationValue);
      // Check both formats - with and without +254 prefix
      query = query.or(`parent_phone.eq.${formattedPhone},parent_phone.eq.${verificationValue}`);
    } else {
      query = query.eq("parent_national_id", verificationValue);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[TRACK] Database error:", error);
      return new Response(
        JSON.stringify({ found: false, error: "Failed to lookup application" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      // Return generic not found - don't reveal if tracking number exists
      return new Response(
        JSON.stringify({ 
          found: false, 
          message: "Application not found. Please verify your tracking number and verification details." 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map status to stages for the timeline
    const statusOrder = ["received", "review", "verification", "approved", "disbursed"];
    const currentIndex = statusOrder.indexOf(data.status);

    const stages = [
      { name: "Application Received", key: "received", message: "Your application has been received and is in our system." },
      { name: "Under Review", key: "review", message: "Your application is being reviewed by our team." },
      { name: "Verification", key: "verification", message: "We are verifying the information provided." },
      { name: "Approval Decision", key: "approved", message: "Your application has been approved." },
      { name: "Funds Disbursed", key: "disbursed", message: "Funds have been sent to your institution." },
    ].map((stage, index) => ({
      name: stage.name,
      status: index < currentIndex ? "completed" : 
              index === currentIndex ? "current" : "pending",
      date: index <= currentIndex ? data.created_at : null,
      message: stage.message,
    }));

    // Return limited, non-sensitive tracking info
    return new Response(
      JSON.stringify({
        found: true,
        trackingNumber: data.tracking_number,
        studentType: data.student_type,
        status: data.status,
        createdAt: data.created_at,
        stages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
