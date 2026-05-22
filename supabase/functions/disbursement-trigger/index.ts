import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Authorize admin
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', claims.claims.sub)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const studentIds: string[] = Array.isArray(body.student_ids) ? body.student_ids : [];
    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'student_ids required' }), { status: 400, headers: corsHeaders });
    }

    // Load approved students that are released to treasury
    const { data: students, error: stuErr } = await admin
      .from('student_beneficiaries')
      .select('id, parent_application_id, institution_name, allocated_amount, status, released_to_treasury')
      .in('id', studentIds);
    if (stuErr) throw stuErr;

    const eligible = (students || []).filter(
      (s) => s.status === 'approved' && s.released_to_treasury && Number(s.allocated_amount) > 0
    );
    if (eligible.length === 0) {
      return new Response(JSON.stringify({ error: 'No eligible students' }), { status: 400, headers: corsHeaders });
    }

    // Load parent county
    const parentIds = [...new Set(eligible.map((s) => s.parent_application_id))];
    const { data: parents } = await admin
      .from('parent_applications')
      .select('id, parent_county')
      .in('id', parentIds);
    const countyById = new Map((parents || []).map((p) => [p.id, p.parent_county]));

    const created: any[] = [];
    for (const s of eligible) {
      const reference = `IPN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data: disb, error: dErr } = await admin
        .from('disbursements')
        .insert({
          parent_application_id: s.parent_application_id,
          student_id: s.id,
          school_name: s.institution_name,
          county: countyById.get(s.parent_application_id) || null,
          amount: s.allocated_amount,
          status: 'processing',
          provider: 'mock-gateway',
          payment_reference: reference,
          triggered_by: claims.claims.sub,
        })
        .select()
        .single();
      if (dErr) {
        console.error('disbursement insert failed', dErr);
        continue;
      }

      // Log the (mock) gateway request asynchronously
      await admin.from('payment_transactions').insert({
        disbursement_id: disb.id,
        provider: 'mock-gateway',
        provider_reference: reference,
        status: 'submitted',
        request_payload: { amount: s.allocated_amount, reference, school: s.institution_name },
        response_payload: { accepted: true, queued: true },
      });

      created.push({ id: disb.id, reference, amount: s.allocated_amount });
    }

    return new Response(JSON.stringify({ created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('disbursement-trigger error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
