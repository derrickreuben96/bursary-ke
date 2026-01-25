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

    console.log("[CRON] Checking for expired bursary deadlines...");

    // Find all adverts with deadlines that have passed and are still active
    const { data: expiredAdverts, error: advertError } = await supabaseAdmin
      .from("bursary_adverts")
      .select("*")
      .eq("is_active", true)
      .lt("deadline", new Date().toISOString());

    if (advertError) {
      throw advertError;
    }

    if (!expiredAdverts || expiredAdverts.length === 0) {
      console.log("[CRON] No expired adverts found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No expired adverts to process",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CRON] Found ${expiredAdverts.length} expired adverts to process`);

    const results = [];

    for (const advert of expiredAdverts) {
      console.log(`[CRON] Processing advert: ${advert.title} (${advert.county})`);

      try {
        // Call the process-allocations function with service role key for internal server-to-server calls
        const allocationResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-allocations`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              advertId: advert.id,
              budgetAmount: advert.budget_amount,
            }),
          }
        );

        const allocationResult = await allocationResponse.json();
        console.log(`[CRON] Allocation result for ${advert.county}:`, allocationResult);

        // Mark the advert as inactive after processing
        await supabaseAdmin
          .from("bursary_adverts")
          .update({ is_active: false })
          .eq("id", advert.id);

        // Trigger SMS notifications for approved applicants with service role key
        const smsResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-sms-notifications`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
          }
        );

        const smsResult = await smsResponse.json();
        console.log(`[CRON] SMS notification result:`, smsResult);

        results.push({
          advertId: advert.id,
          county: advert.county,
          title: advert.title,
          allocationResult,
          smsResult,
          status: "processed"
        });
      } catch (err) {
        console.error(`[CRON] Error processing advert ${advert.id}:`, err);
        results.push({
          advertId: advert.id,
          county: advert.county,
          title: advert.title,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error"
        });
      }
    }

    const successCount = results.filter(r => r.status === "processed").length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${successCount}/${expiredAdverts.length} expired adverts`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[CRON] Error checking deadlines:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
