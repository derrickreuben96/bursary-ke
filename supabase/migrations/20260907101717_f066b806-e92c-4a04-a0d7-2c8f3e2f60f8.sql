
-- 1) Auto-release approved households to Treasury
CREATE OR REPLACE FUNCTION public.auto_release_approved_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(NEW.released_to_treasury, false) = false THEN
    NEW.released_to_treasury := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_release_approved_household ON public.parent_applications;
CREATE TRIGGER trg_auto_release_approved_household
BEFORE INSERT OR UPDATE OF status ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.auto_release_approved_household();

CREATE OR REPLACE FUNCTION public.propagate_household_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.released_to_treasury = true AND COALESCE(OLD.released_to_treasury, false) = false THEN
    UPDATE public.student_beneficiaries
       SET released_to_treasury = true
     WHERE parent_application_id = NEW.id
       AND status = 'approved'
       AND released_to_treasury = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_household_release ON public.parent_applications;
CREATE TRIGGER trg_propagate_household_release
AFTER UPDATE OF released_to_treasury ON public.parent_applications
FOR EACH ROW EXECUTE FUNCTION public.propagate_household_release();

-- 2) Treasury disbursement RPC (creates real payment records)
CREATE OR REPLACE FUNCTION public.treasury_disburse_students(_student_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_county text;
  v_is_admin boolean;
  v_rec record;
  v_ref text;
  v_disb public.disbursements%ROWTYPE;
  v_paid int := 0;
  v_skipped int := 0;
  v_total numeric := 0;
  v_refs jsonb := '[]'::jsonb;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT (v_is_admin OR public.has_role(auth.uid(), 'county_treasury')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  v_county := public.get_user_assigned_county(auth.uid());

  FOR v_rec IN
    SELECT sb.id, sb.allocated_amount, sb.institution_name, sb.parent_application_id,
           pa.parent_county
      FROM public.student_beneficiaries sb
      JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
     WHERE sb.id = ANY(_student_ids)
       AND sb.status = 'approved'
       AND sb.released_to_treasury = true
       AND COALESCE(sb.allocated_amount, 0) > 0
       AND (v_is_admin OR pa.parent_county = v_county)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.disbursements d
       WHERE d.student_id = v_rec.id AND d.status <> 'failed'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_ref := 'TRS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    INSERT INTO public.disbursements (
      parent_application_id, student_id, school_name, county, amount,
      status, provider, payment_reference, triggered_by, completed_at
    ) VALUES (
      v_rec.parent_application_id, v_rec.id, v_rec.institution_name, v_rec.parent_county,
      v_rec.allocated_amount, 'paid', 'treasury-portal', v_ref, auth.uid(), now()
    ) RETURNING * INTO v_disb;

    INSERT INTO public.payment_transactions (
      disbursement_id, provider, provider_reference, status, request_payload, response_payload
    ) VALUES (
      v_disb.id, 'treasury-portal', v_ref, 'paid',
      jsonb_build_object('student_id', v_rec.id, 'amount', v_rec.allocated_amount, 'school', v_rec.institution_name),
      jsonb_build_object('accepted', true, 'reference', v_ref)
    );

    INSERT INTO public.erp_notifications (
      disbursement_id, school_name, student_id, payload_json, delivery_status
    ) VALUES (
      v_disb.id, v_rec.institution_name, v_rec.id,
      jsonb_build_object('student_id', v_rec.id, 'amount', v_rec.allocated_amount, 'reference', v_ref, 'status', 'PAID'),
      'sent'
    );

    UPDATE public.student_beneficiaries
       SET status = 'disbursed', allocation_date = COALESCE(allocation_date, now())
     WHERE id = v_rec.id;

    v_paid := v_paid + 1;
    v_total := v_total + v_rec.allocated_amount;
    v_refs := v_refs || jsonb_build_object('student_id', v_rec.id, 'reference', v_ref, 'amount', v_rec.allocated_amount);
  END LOOP;

  PERFORM public.log_audit('treasury_disbursement', 'disbursement', NULL,
    jsonb_build_object('paid', v_paid, 'skipped', v_skipped, 'total', v_total));

  RETURN jsonb_build_object('paid', v_paid, 'skipped', v_skipped, 'total_amount', v_total, 'payments', v_refs);
END;
$$;

REVOKE ALL ON FUNCTION public.treasury_disburse_students(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.treasury_disburse_students(uuid[]) TO authenticated;

-- 3) Guardian self-service profile update (identity verified by ID + phone on file)
CREATE OR REPLACE FUNCTION public.update_guardian_profile(
  _national_id text, _phone text, _updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_h public.households%ROWTYPE;
  v_clean text;
  v_match boolean := false;
BEGIN
  IF _national_id IS NULL OR length(trim(_national_id)) = 0 THEN
    RETURN jsonb_build_object('error','invalid_input');
  END IF;

  SELECT * INTO v_h FROM public.households
   WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean <> '' AND v_h.parent_phone IS NOT NULL AND (
       v_h.parent_phone = v_clean
    OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) = right(v_clean, 9)
  ) THEN
    v_match := true;
  END IF;
  IF NOT v_match THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;

  UPDATE public.households SET
    parent_full_name = COALESCE(NULLIF(trim(_updates->>'parent_full_name'), ''), parent_full_name),
    parent_phone     = COALESCE(NULLIF(regexp_replace(COALESCE(_updates->>'parent_phone',''), '[^0-9+]', '', 'g'), ''), parent_phone),
    parent_email     = COALESCE(NULLIF(trim(_updates->>'parent_email'), ''), parent_email),
    parent_county    = COALESCE(NULLIF(trim(_updates->>'parent_county'), ''), parent_county),
    parent_ward      = COALESCE(NULLIF(trim(_updates->>'parent_ward'), ''), parent_ward),
    updated_at       = now()
  WHERE id = v_h.id;

  PERFORM public.log_audit('guardian_profile_update', 'household', v_h.id::text,
    jsonb_build_object('fields', (SELECT jsonb_agg(k) FROM jsonb_object_keys(_updates) k)));

  SELECT * INTO v_h FROM public.households WHERE id = v_h.id;

  RETURN jsonb_build_object('found', true, 'updated', true, 'parent', jsonb_build_object(
    'full_name', v_h.parent_full_name,
    'national_id', v_h.parent_national_id,
    'phone', v_h.parent_phone,
    'email', v_h.parent_email,
    'county', v_h.parent_county,
    'ward', v_h.parent_ward
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.update_guardian_profile(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.update_guardian_profile(text, text, jsonb) TO anon, authenticated;
