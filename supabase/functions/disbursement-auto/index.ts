// Internal endpoint called by a DB trigger via pg_net when a student is
// released to treasury. Protected by a shared secret. Creates the disbursement
// row and immediately invokes the webhook path to mark it paid + fire ERP IPN.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const expected = Deno.env.get('IPN_INTERNAL_SECRET');
    if (expected) {
      const provided = req.headers.get('x-internal-secret');
      if (provided !== expected) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
      }
    }

    const body = await req.json().catch(() => ({}));
    const studentId: string | undefined = body.student_id;
    if (!studentId) {
      return new Response(JSON.stringify({ error: 'student_id required' }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: student, error: stuErr } = await admin
      .from('student_beneficiaries')
      .select('id, parent_application_id, institution_name, allocated_amount, status, released_to_treasury')
      .eq('id', studentId)
      .maybeSingle();
    if (stuErr) throw stuErr;
    if (!student || student.status !== 'approved' || !student.released_to_treasury || !(Number(student.allocated_amount) > 0)) {
      return new Response(JSON.stringify({ skipped: true, reason: 'not eligible' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency: skip if a non-failed disbursement already exists for this student
    const { data: existing } = await admin
      .from('disbursements')
      .select('id, status')
      .eq('student_id', student.id)
      .neq('status', 'failed')
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ skipped: true, existing_id: existing.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: parent } = await admin
      .from('parent_applications')
      .select('parent_county')
      .eq('id', student.parent_application_id)
      .maybeSingle();

    const reference = `IPN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: disb, error: dErr } = await admin
      .from('disbursements')
      .insert({
        parent_application_id: student.parent_application_id,
        student_id: student.id,
        school_name: student.institution_name,
        county: parent?.parent_county || null,
        amount: student.allocated_amount,
        status: 'processing',
        provider: 'auto-gateway',
        payment_reference: reference,
      })
      .select()
      .single();
    if (dErr) throw dErr;

    await admin.from('payment_transactions').insert({
      disbursement_id: disb.id,
      provider: 'auto-gateway',
      provider_reference: reference,
      status: 'submitted',
      request_payload: { amount: student.allocated_amount, reference, school: student.institution_name, auto: true },
      response_payload: { accepted: true, queued: true },
    });

    // Simulate gateway success → mark paid, fire ERP IPN, mark beneficiary disbursed
    await admin.from('disbursements').update({
      status: 'paid',
      completed_at: new Date().toISOString(),
    }).eq('id', disb.id);

    await admin.from('payment_transactions').insert({
      disbursement_id: disb.id,
      provider: 'auto-gateway',
      provider_reference: reference,
      status: 'paid',
      request_payload: { reference },
      response_payload: { acknowledged: true, auto: true },
    });

    const payload = {
      student_id: student.id,
      amount: Number(student.allocated_amount),
      reference,
      school: student.institution_name,
      status: 'PAID',
    };
    const { data: erp } = await admin.from('erp_notifications').insert({
      disbursement_id: disb.id,
      school_name: student.institution_name,
      student_id: student.id,
      payload_json: payload,
      delivery_status: 'sent',
    }).select().single();

    if (erp) {
      await admin.from('erp_notifications').update({
        delivery_status: 'acknowledged',
        ack_timestamp: new Date().toISOString(),
      }).eq('id', erp.id);
    }

    await admin.from('student_beneficiaries').update({
      status: 'disbursed',
      allocation_date: new Date().toISOString(),
    }).eq('id', student.id);

    return new Response(JSON.stringify({ ok: true, disbursement_id: disb.id, reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('disbursement-auto error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
