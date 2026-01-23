import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get all approved applications that haven't been notified and have SMS consent
    const { data: applications, error } = await supabaseAdmin
      .from("bursary_applications")
      .select("*")
      .eq("status", "approved")
      .eq("sms_consent", true)
      .eq("sms_sent", false);

    if (error) {
      throw error;
    }

    if (!applications || applications.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No pending SMS notifications",
          sent: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const app of applications) {
      // In production, this would integrate with an SMS gateway like Africa's Talking
      // For now, we simulate the SMS send
      const message = `Congratulations! Your bursary application (${app.tracking_number}) has been APPROVED. ` +
                      `Amount: KES ${(app.allocated_amount || 35000).toLocaleString()}. ` +
                      `Funds will be sent to ${app.institution_name}. - Bursary KE`;

      console.log(`[SMS] To: ${app.parent_phone}, Message: ${message}`);

      // Mark as sent
      await supabaseAdmin
        .from("bursary_applications")
        .update({ 
          sms_sent: true,
          sms_sent_at: new Date().toISOString()
        })
        .eq("id", app.id);

      results.push({
        trackingNumber: app.tracking_number,
        phone: app.parent_phone?.substring(0, 6) + "****", // Masked phone
        status: "sent"
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${results.length} SMS notifications`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error sending SMS notifications:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
