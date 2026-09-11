ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS parent_data_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_flagged_outdated_at timestamptz;

CREATE TABLE public.guardian_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  source text NOT NULL DEFAULT 'guardian_self_service',
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guardian_profile_history TO authenticated;
GRANT ALL ON public.guardian_profile_history TO service_role;
ALTER TABLE public.guardian_profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view guardian profile history"
ON public.guardian_profile_history FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX guardian_profile_history_household_changed_idx
ON public.guardian_profile_history(household_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.update_guardian_profile(
  _national_id text, _phone text, _updates jsonb, _consent boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_h public.households%ROWTYPE;
  v_new public.households%ROWTYPE;
  v_clean text;
BEGIN
  IF COALESCE(_consent, false) = false THEN
    RETURN jsonb_build_object('error','consent_required');
  END IF;
  IF _national_id IS NULL OR length(trim(_national_id)) = 0 THEN
    RETURN jsonb_build_object('error','invalid_input');
  END IF;

  SELECT * INTO v_h FROM public.households
   WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean = '' OR v_h.parent_phone IS NULL OR NOT (
       v_h.parent_phone = v_clean
    OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) = right(v_clean, 9)
  ) THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;

  INSERT INTO public.guardian_profile_history(household_id, field_name, old_value, new_value)
  SELECT v_h.id, d.field_name, d.old_value, d.new_value
  FROM (VALUES
    ('full_name', v_h.parent_full_name, NULLIF(trim(_updates->>'parent_full_name'), '')),
    ('phone', v_h.parent_phone, NULLIF(regexp_replace(COALESCE(_updates->>'parent_phone',''), '[^0-9+]', '', 'g'), '')),
    ('email', v_h.parent_email, NULLIF(trim(_updates->>'parent_email'), '')),
    ('county', v_h.parent_county, NULLIF(trim(_updates->>'parent_county'), '')),
    ('ward', v_h.parent_ward, NULLIF(trim(_updates->>'parent_ward'), ''))
  ) AS d(field_name, old_value, new_value)
  WHERE d.new_value IS NOT NULL AND d.new_value IS DISTINCT FROM d.old_value;

  UPDATE public.households SET
    parent_full_name = COALESCE(NULLIF(trim(_updates->>'parent_full_name'), ''), parent_full_name),
    parent_phone = COALESCE(NULLIF(regexp_replace(COALESCE(_updates->>'parent_phone',''), '[^0-9+]', '', 'g'), ''), parent_phone),
    parent_email = COALESCE(NULLIF(trim(_updates->>'parent_email'), ''), parent_email),
    parent_county = COALESCE(NULLIF(trim(_updates->>'parent_county'), ''), parent_county),
    parent_ward = COALESCE(NULLIF(trim(_updates->>'parent_ward'), ''), parent_ward),
    parent_data_confirmed_at = now(),
    data_flagged_outdated_at = NULL,
    updated_at = now()
  WHERE id = v_h.id RETURNING * INTO v_new;

  PERFORM public.log_audit('guardian_profile_update_consent', 'household', v_h.id::text,
    jsonb_build_object('consent', true, 'changed_fields', (SELECT count(*) FROM public.guardian_profile_history WHERE household_id = v_h.id AND changed_at >= now() - interval '5 seconds')));

  RETURN jsonb_build_object('found', true, 'updated', true, 'is_stale', false,
    'confirmed_at', v_new.parent_data_confirmed_at,
    'parent', jsonb_build_object('full_name', v_new.parent_full_name, 'national_id', v_new.parent_national_id,
      'phone', v_new.parent_phone, 'email', v_new.parent_email, 'county', v_new.parent_county, 'ward', v_new.parent_ward));
END;
$$;
REVOKE ALL ON FUNCTION public.update_guardian_profile(text, text, jsonb, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.update_guardian_profile(text, text, jsonb, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_guardian_profile_history(_national_id text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_h public.households%ROWTYPE; v_clean text;
BEGIN
  SELECT * INTO v_h FROM public.households WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean = '' OR v_h.parent_phone IS NULL OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) <> right(v_clean, 9) THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;
  RETURN jsonb_build_object(
    'found', true,
    'confirmed_at', v_h.parent_data_confirmed_at,
    'flagged_outdated_at', v_h.data_flagged_outdated_at,
    'is_stale', v_h.data_flagged_outdated_at IS NOT NULL OR v_h.parent_data_confirmed_at IS NULL OR v_h.parent_data_confirmed_at < now() - interval '12 months',
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('field', field_name, 'old_value', old_value, 'new_value', new_value, 'changed_at', changed_at) ORDER BY changed_at DESC) FROM public.guardian_profile_history WHERE household_id = v_h.id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_guardian_profile_history(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_guardian_profile_history(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.flag_guardian_profile_outdated(_national_id text, _phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_h public.households%ROWTYPE; v_clean text;
BEGIN
  SELECT * INTO v_h FROM public.households WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean = '' OR v_h.parent_phone IS NULL OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) <> right(v_clean, 9) THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;
  UPDATE public.households SET data_flagged_outdated_at = now(), updated_at = now() WHERE id = v_h.id;
  PERFORM public.log_audit('guardian_profile_flagged_outdated', 'household', v_h.id::text, '{}'::jsonb);
  RETURN jsonb_build_object('flagged', true);
END;
$$;
REVOKE ALL ON FUNCTION public.flag_guardian_profile_outdated(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.flag_guardian_profile_outdated(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_newly_approved_student()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND COALESCE(NEW.released_to_treasury, false) = false
     AND EXISTS (SELECT 1 FROM public.parent_applications pa WHERE pa.id = NEW.parent_application_id AND pa.released_to_treasury = true) THEN
    NEW.released_to_treasury := true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_release_newly_approved_student ON public.student_beneficiaries;
CREATE TRIGGER trg_release_newly_approved_student
BEFORE INSERT OR UPDATE OF status ON public.student_beneficiaries
FOR EACH ROW EXECUTE FUNCTION public.release_newly_approved_student();

CREATE OR REPLACE FUNCTION public.treasury_disburse_students(_student_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_county text; v_is_admin boolean; v_rec record; v_ref text; v_disb public.disbursements%ROWTYPE; v_created int := 0; v_skipped int := 0; v_total numeric := 0; v_refs jsonb := '[]'::jsonb;
BEGIN
  v_is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT (v_is_admin OR public.has_role(auth.uid(), 'county_treasury')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_county := public.get_user_assigned_county(auth.uid());
  FOR v_rec IN SELECT sb.id, sb.allocated_amount, sb.institution_name, sb.parent_application_id, pa.parent_county
    FROM public.student_beneficiaries sb JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
    WHERE sb.id = ANY(_student_ids) AND sb.status = 'approved' AND sb.released_to_treasury = true
      AND COALESCE(sb.allocated_amount,0) > 0 AND (v_is_admin OR pa.parent_county = v_county)
  LOOP
    IF EXISTS (SELECT 1 FROM public.disbursements d WHERE d.student_id = v_rec.id AND d.status <> 'failed') THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    v_ref := 'TRS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    INSERT INTO public.disbursements(parent_application_id, student_id, school_name, county, amount, status, provider, payment_reference, triggered_by)
    VALUES(v_rec.parent_application_id, v_rec.id, v_rec.institution_name, v_rec.parent_county, v_rec.allocated_amount, 'pending', 'treasury-portal', v_ref, auth.uid()) RETURNING * INTO v_disb;
    INSERT INTO public.payment_transactions(disbursement_id, provider, provider_reference, status, request_payload, response_payload)
    VALUES(v_disb.id, 'treasury-portal', v_ref, 'pending', jsonb_build_object('student_id',v_rec.id,'amount',v_rec.allocated_amount,'school',v_rec.institution_name), '{}'::jsonb);
    v_created := v_created + 1; v_total := v_total + v_rec.allocated_amount;
    v_refs := v_refs || jsonb_build_object('student_id',v_rec.id,'reference',v_ref,'amount',v_rec.allocated_amount);
  END LOOP;
  PERFORM public.log_audit('treasury_payment_created','disbursement',NULL,jsonb_build_object('created',v_created,'skipped',v_skipped,'total',v_total));
  RETURN jsonb_build_object('paid',v_created,'created',v_created,'skipped',v_skipped,'total_amount',v_total,'payments',v_refs);
END;
$$;
REVOKE ALL ON FUNCTION public.treasury_disburse_students(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.treasury_disburse_students(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.treasury_mark_payment_processed(_disbursement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_county text; v_is_admin boolean; v_d public.disbursements%ROWTYPE;
BEGIN
  v_is_admin := public.has_role(auth.uid(),'admin');
  IF NOT (v_is_admin OR public.has_role(auth.uid(),'county_treasury')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_county := public.get_user_assigned_county(auth.uid());
  SELECT * INTO v_d FROM public.disbursements WHERE id = _disbursement_id AND status IN ('pending','processing') AND (v_is_admin OR county = v_county) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('processed',false,'error','not_found_or_not_allowed'); END IF;
  UPDATE public.disbursements SET status='paid', completed_at=now(), updated_at=now() WHERE id=v_d.id;
  UPDATE public.payment_transactions SET status='paid', response_payload=jsonb_build_object('accepted',true,'reference',v_d.payment_reference,'processed_at',now()) WHERE disbursement_id=v_d.id;
  UPDATE public.student_beneficiaries SET status='disbursed', allocation_date=COALESCE(allocation_date,now()) WHERE id=v_d.student_id;
  INSERT INTO public.erp_notifications(disbursement_id,school_name,student_id,payload_json,delivery_status)
  VALUES(v_d.id,v_d.school_name,v_d.student_id,jsonb_build_object('student_id',v_d.student_id,'amount',v_d.amount,'reference',v_d.payment_reference,'status','PAID'),'sent');
  PERFORM public.log_audit('treasury_payment_processed','disbursement',v_d.id::text,jsonb_build_object('reference',v_d.payment_reference,'amount',v_d.amount));
  RETURN jsonb_build_object('processed',true,'reference',v_d.payment_reference);
END;
$$;
REVOKE ALL ON FUNCTION public.treasury_mark_payment_processed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.treasury_mark_payment_processed(uuid) TO authenticated;