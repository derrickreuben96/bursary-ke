ALTER TABLE public.disbursements DROP CONSTRAINT IF EXISTS disbursements_status_check;
ALTER TABLE public.disbursements ADD COLUMN IF NOT EXISTS paid_amount numeric;

CREATE OR REPLACE FUNCTION public.get_guardian_profile_history(_national_id text, _phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_h public.households%ROWTYPE; v_clean text;
BEGIN
  SELECT * INTO v_h FROM public.households WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean = '' OR v_h.parent_phone IS NULL OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) <> right(v_clean, 9) THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;
  RETURN jsonb_build_object('found', true,'confirmed_at', v_h.parent_data_confirmed_at,'flagged_outdated_at', v_h.data_flagged_outdated_at,
    'is_stale', v_h.data_flagged_outdated_at IS NOT NULL OR v_h.parent_data_confirmed_at IS NULL OR v_h.parent_data_confirmed_at < now() - interval '12 months',
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'field', field_name, 'old_value', old_value, 'new_value', new_value, 'source', source, 'changed_at', changed_at) ORDER BY changed_at DESC) FROM public.guardian_profile_history WHERE household_id = v_h.id), '[]'::jsonb));
END; $$;

CREATE OR REPLACE FUNCTION public.rollback_guardian_profile_field(_national_id text, _phone text, _history_id uuid, _consent boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_h public.households%ROWTYPE; v_clean text; v_e public.guardian_profile_history%ROWTYPE; v_cur text;
BEGIN
  IF COALESCE(_consent,false) = false THEN RETURN jsonb_build_object('error','consent_required'); END IF;
  SELECT * INTO v_h FROM public.households WHERE parent_national_id = trim(_national_id) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean = '' OR v_h.parent_phone IS NULL OR right(regexp_replace(v_h.parent_phone, '[^0-9]', '', 'g'), 9) <> right(v_clean, 9) THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;
  SELECT * INTO v_e FROM public.guardian_profile_history WHERE id = _history_id AND household_id = v_h.id;
  IF NOT FOUND OR v_e.old_value IS NULL THEN RETURN jsonb_build_object('error','not_restorable'); END IF;
  v_cur := CASE v_e.field_name WHEN 'full_name' THEN v_h.parent_full_name WHEN 'phone' THEN v_h.parent_phone
    WHEN 'email' THEN v_h.parent_email WHEN 'county' THEN v_h.parent_county WHEN 'ward' THEN v_h.parent_ward END;
  IF v_e.field_name NOT IN ('full_name','phone','email','county','ward') THEN RETURN jsonb_build_object('error','not_restorable'); END IF;
  UPDATE public.households SET
    parent_full_name = CASE WHEN v_e.field_name='full_name' THEN v_e.old_value ELSE parent_full_name END,
    parent_phone = CASE WHEN v_e.field_name='phone' THEN v_e.old_value ELSE parent_phone END,
    parent_email = CASE WHEN v_e.field_name='email' THEN v_e.old_value ELSE parent_email END,
    parent_county = CASE WHEN v_e.field_name='county' THEN v_e.old_value ELSE parent_county END,
    parent_ward = CASE WHEN v_e.field_name='ward' THEN v_e.old_value ELSE parent_ward END,
    parent_data_confirmed_at = now(), updated_at = now()
  WHERE id = v_h.id;
  INSERT INTO public.guardian_profile_history(household_id, field_name, old_value, new_value, source)
  VALUES (v_h.id, v_e.field_name, v_cur, v_e.old_value, 'rollback');
  PERFORM public.log_audit('guardian_profile_rollback','household',v_h.id::text, jsonb_build_object('field', v_e.field_name, 'history_id', _history_id));
  RETURN jsonb_build_object('restored', true, 'field', v_e.field_name);
END; $$;
REVOKE ALL ON FUNCTION public.rollback_guardian_profile_field(text,text,uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.rollback_guardian_profile_field(text,text,uuid,boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.treasury_flag_payment_overpaid(_disbursement_id uuid, _paid_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_county text; v_is_admin boolean; v_d public.disbursements%ROWTYPE;
BEGIN
  v_is_admin := public.has_role(auth.uid(),'admin');
  IF NOT (v_is_admin OR public.has_role(auth.uid(),'county_treasury')) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_county := public.get_user_assigned_county(auth.uid());
  SELECT * INTO v_d FROM public.disbursements WHERE id=_disbursement_id AND (v_is_admin OR county=v_county) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('flagged',false,'error','not_found_or_not_allowed'); END IF;
  IF _paid_amount IS NULL OR _paid_amount <= v_d.amount THEN RETURN jsonb_build_object('flagged',false,'error','amount_not_above_allocation'); END IF;
  UPDATE public.disbursements SET status='overpaid', paid_amount=_paid_amount,
    last_error = 'Overpaid by '||(_paid_amount - v_d.amount)::text, completed_at=COALESCE(completed_at,now()), updated_at=now() WHERE id=v_d.id;
  PERFORM public.log_audit('treasury_payment_overpaid','disbursement',v_d.id::text, jsonb_build_object('reference',v_d.payment_reference,'allocated',v_d.amount,'paid',_paid_amount));
  RETURN jsonb_build_object('flagged',true,'reference',v_d.payment_reference,'excess',_paid_amount - v_d.amount);
END; $$;
REVOKE ALL ON FUNCTION public.treasury_flag_payment_overpaid(uuid,numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.treasury_flag_payment_overpaid(uuid,numeric) TO authenticated;