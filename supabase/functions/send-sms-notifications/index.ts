import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AfricasTalkingResponse {
  SMSMessageData: {
    Message: string;
    Recipients: Array<{
      statusCode: number;
      number: string;
      status: string;
      cost: string;
      messageId: string;
    }>;
  };
}

// Helper function to verify admin role or service role key (for internal cron calls)
async function verifyAdminOrServiceRole(req: Request): Promise<{ isServiceRole: boolean; user?: { id: string } } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized - Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Check if this is an internal service role call (from cron jobs)
  if (token === serviceRoleKey) {
    console.log('[AUTH] Service role key authenticated - internal cron call');
    return { isServiceRole: true };
  }

  // Otherwise verify as user JWT
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
    serviceRoleKey,
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

  return { isServiceRole: false, user };
}

async function sendSMSViaAfricasTalking(
  phone: string,
  message: string,
  apiKey: string,
  username: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Format phone number for Kenya (ensure it starts with +254)
    let formattedPhone = phone.replace(/\s+/g, "").replace(/-/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+254" + formattedPhone;
    }

    const url = username === "sandbox" 
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "apiKey": apiKey,
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        username: username,
        to: formattedPhone,
        message: message,
        from: "BURSARY-KE", // Sender ID (needs to be registered with Africa's Talking)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Africa's Talking API error:", errorText);
      return { success: false, error: errorText };
    }

    const result: AfricasTalkingResponse = await response.json();
    
    if (result.SMSMessageData?.Recipients?.[0]) {
      const recipient = result.SMSMessageData.Recipients[0];
      if (recipient.statusCode === 101) {
        return { success: true, messageId: recipient.messageId };
      } else {
        return { success: false, error: recipient.status };
      }
    }

    return { success: false, error: "Unexpected response format" };
  } catch (error) {
    console.error("SMS send error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin authentication or service role (for cron)
    const authResult = await verifyAdminOrServiceRole(req);
    if (authResult instanceof Response) {
      return authResult;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const africasTalkingApiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    const africasTalkingUsername = Deno.env.get("AFRICASTALKING_USERNAME");
    
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
    const useRealSMS = africasTalkingApiKey && africasTalkingUsername;

    for (const app of applications) {
      const message = `Congratulations! Your bursary application (${app.tracking_number}) has been APPROVED. ` +
                      `Amount: KES ${(app.allocated_amount || 35000).toLocaleString()}. ` +
                      `Funds will be sent to ${app.institution_name}. - Bursary KE`;

      let smsSuccess = true;
      let smsMessageId = "simulated";
      let smsError: string | undefined;

      if (useRealSMS) {
        // Send real SMS via Africa's Talking
        console.log(`[SMS] Sending to: ${app.parent_phone}`);
        const smsResult = await sendSMSViaAfricasTalking(
          app.parent_phone,
          message,
          africasTalkingApiKey,
          africasTalkingUsername
        );
        console.log(`[SMS] Result:`, smsResult);
        smsSuccess = smsResult.success;
        smsMessageId = smsResult.messageId || "";
        smsError = smsResult.error;
      } else {
        // Simulation mode - log the message
        console.log(`[SMS SIMULATION] To: ${app.parent_phone}, Message: ${message}`);
      }

      if (smsSuccess) {
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
          status: "sent",
          messageId: smsMessageId,
          mode: useRealSMS ? "live" : "simulation"
        });
      } else {
        results.push({
          trackingNumber: app.tracking_number,
          phone: app.parent_phone?.substring(0, 6) + "****",
          status: "failed",
          error: smsError,
          mode: useRealSMS ? "live" : "simulation"
        });
      }
    }

    const successCount = results.filter(r => r.status === "sent").length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${successCount}/${results.length} SMS notifications`,
        mode: useRealSMS ? "live" : "simulation",
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
