// Public webhook: payment gateway calls this to update disbursement status,
// then we fire IPN to the school ERP. Signature/secret validation in production.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Mandatory shared-secret check
    const expected = Deno.env.get('DISBURSEMENT_WEBHOOK_SECRET');
    if (!expected) {
      console.error('DISBURSEMENT_WEBHOOK_SECRET is not configured');
      return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500, headers: corsHeaders });
    }
    const provided = req.headers.get('x-webhook-secret');
    if (provided !== expected) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { payment_reference, status, provider_reference } = body || {};
    if (!payment_reference || !status) {
      return new Response(JSON.stringify({ error: 'payment_reference and status required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const allowed = ['paid', 'failed'];
    const normalized = allowed.includes(status) ? status : 'failed';

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: disb, error: dErr } = await admin
      .from('disbursements')
      .select('*')
      .eq('payment_reference', payment_reference)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!disb) {
      return new Response(JSON.stringify({ error: 'unknown reference' }), { status: 404, headers: corsHeaders });
    }

    const update: Record<string, unknown> = {
      status: normalized,
      last_error: normalized === 'failed' ? (body.error || 'gateway failure') : null,
    };
    if (normalized === 'paid') update.completed_at = new Date().toISOString();
    if (normalized === 'failed') update.retry_count = (disb.retry_count || 0) + 1;

    await admin.from('disbursements').update(update).eq('id', disb.id);

    await admin.from('payment_transactions').insert({
      disbursement_id: disb.id,
      provider: disb.provider || 'mock-gateway',
      provider_reference: provider_reference || payment_reference,
      status: normalized,
      request_payload: body,
      response_payload: { acknowledged: true },
    });

    // Async fan-out to ERP only on success — never block payment status
    if (normalized === 'paid') {
      const payload = {
        student_id: disb.student_id,
        amount: Number(disb.amount),
        reference: disb.payment_reference,
        school: disb.school_name,
        status: 'PAID',
      };
      const { data: erp, error: eErr } = await admin.from('erp_notifications').insert({
        disbursement_id: disb.id,
        school_name: disb.school_name,
        student_id: disb.student_id,
        payload_json: payload,
        delivery_status: 'sent',
      }).select().single();
      if (eErr) console.error('erp insert failed', eErr);

      // Simulated ack (school ERP integration would go here)
      if (erp) {
        await admin.from('erp_notifications').update({
          delivery_status: 'acknowledged',
          ack_timestamp: new Date().toISOString(),
        }).eq('id', erp.id);
      }

      // Mirror to student_beneficiaries as disbursed (does not change approval)
      await admin.from('student_beneficiaries').update({
        status: 'disbursed',
        allocation_date: new Date().toISOString(),
      }).eq('id', disb.student_id);
    }

    return new Response(JSON.stringify({ ok: true, status: normalized }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('disbursement-webhook error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
