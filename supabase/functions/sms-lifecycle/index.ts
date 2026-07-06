// SMS Lifecycle router — sends stage-aware SMS via Africa's Talking and
// records every attempt in public.sms_logs. Idempotent per (application_id, stage).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AT_USERNAME = Deno.env.get("AFRICASTALKING_USERNAME") ?? "";
const AT_API_KEY = Deno.env.get("AFRICASTALKING_API_KEY") ?? "";
const IPN_SECRET = Deno.env.get("IPN_INTERNAL_SECRET") ?? "";

const STAGES = [
  "submitted", "under_review", "verified", "shortlisted",
  "approved", "rejected", "disbursed",
] as const;
type Stage = typeof STAGES[number];

const BodySchema = z.object({
  application_id: z.string().uuid(),
  stage: z.enum(STAGES),
  extra: z.record(z.string()).optional(),
});

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("254") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+254" + digits.slice(1);
  if (digits.length === 9) return "+254" + digits;
  if (raw.startsWith("+")) return raw;
  return null;
}

function renderTemplate(stage: Stage, ctx: Record<string, string>): string {
  const tn = ctx.tracking_number ?? "";
  const name = ctx.parent_full_name?.split(" ")[0] ?? "Mzazi";
  switch (stage) {
    case "submitted":
      return `Bursary KE: Hi ${name}, application ${tn} received. Track: bursaryke.xyz/track`;
    case "under_review":
      return `Bursary KE: ${tn} is now under review. We'll SMS you at each stage.`;
    case "verified":
      return `Bursary KE: Documents for ${tn} verified. Awaiting shortlisting.`;
    case "shortlisted":
      return `Bursary KE: Good news — ${tn} has been shortlisted for allocation.`;
    case "approved":
      return `Bursary KE: ${tn} APPROVED${ctx.amount ? ` for KES ${ctx.amount}` : ""}. Funds will disburse to your school shortly.`;
    case "rejected":
      return `Bursary KE: ${tn} was not selected this cycle. Reason: ${ctx.reason ?? "quota reached"}. You may re-apply next cycle.`;
    case "disbursed":
      return `Bursary KE: Funds for ${tn}${ctx.amount ? ` (KES ${ctx.amount})` : ""} have been disbursed to your institution.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Internal-only: require IPN secret OR a valid service-role invocation.
  const providedSecret = req.headers.get("x-internal-secret") ?? "";
  if (!IPN_SECRET || providedSecret !== IPN_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { application_id, stage, extra } = parsed.data;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Fetch parent application + consent + phone
  const { data: pa, error: paErr } = await supabase
    .from("parent_applications")
    .select("id, tracking_number, parent_full_name, parent_phone, sms_consent")
    .eq("id", application_id).maybeSingle();
  if (paErr || !pa) {
    return new Response(JSON.stringify({ error: "application_not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!pa.sms_consent) {
    return new Response(JSON.stringify({ skipped: "no_consent" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Idempotency: skip if already sent successfully for this (application, stage)
  const { data: existing } = await supabase
    .from("sms_logs").select("id, status")
    .eq("application_id", application_id).eq("stage", stage)
    .in("status", ["sent", "delivered"]).limit(1).maybeSingle();
  if (existing) {
    return new Response(JSON.stringify({ skipped: "already_sent", log_id: existing.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phone = normalizePhone(pa.parent_phone ?? "");
  const message = renderTemplate(stage, {
    tracking_number: pa.tracking_number ?? "",
    parent_full_name: pa.parent_full_name ?? "",
    ...(extra ?? {}),
  });

  if (!phone) {
    await supabase.from("sms_logs").insert({
      application_id, stage, phone_masked: "invalid", message, status: "failed",
      provider: "africastalking", error: "invalid_phone",
    });
    return new Response(JSON.stringify({ error: "invalid_phone" }), {
      status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phone_masked = phone.replace(/(\+\d{4})\d+(\d{3})/, "$1***$2");
  let status = "queued";
  let providerRef: string | null = null;
  let error: string | null = null;

  if (AT_USERNAME && AT_API_KEY) {
    try {
      const form = new URLSearchParams({
        username: AT_USERNAME, to: phone, message,
        ...(AT_USERNAME !== "sandbox" ? { from: "BursaryKE" } : {}),
      });
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: {
          apiKey: AT_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: form.toString(),
      });
      const json = await res.json().catch(() => ({}));
      const recipient = json?.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === "Success") {
        status = "sent";
        providerRef = recipient.messageId ?? null;
      } else {
        status = "failed";
        error = recipient?.status || `http_${res.status}`;
      }
    } catch (e) {
      status = "failed";
      error = String((e as Error).message ?? e).slice(0, 240);
    }
  } else {
    status = "skipped";
    error = "provider_not_configured";
  }

  const { data: logRow } = await supabase.from("sms_logs").insert({
    application_id, stage, phone_masked, message, status,
    provider: "africastalking", provider_ref: providerRef, error,
  }).select("id").maybeSingle();

  return new Response(JSON.stringify({ ok: status === "sent", status, log_id: logRow?.id ?? null }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
