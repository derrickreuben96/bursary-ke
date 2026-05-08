
DROP FUNCTION IF EXISTS public.submit_parent_application(uuid, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.submit_parent_application(
  _advert_id uuid,
  _parent jsonb,
  _students jsonb,
  _tracking text DEFAULT NULL
) RETURNS TABLE(parent_id uuid, tracking_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tracking text; v_parent_id uuid; v_count int; v_student jsonb; v_existing int;
BEGIN
  IF _advert_id IS NULL THEN RAISE EXCEPTION 'advert_id is required'; END IF;
  SELECT jsonb_array_length(_students) INTO v_count;
  IF v_count IS NULL OR v_count < 1 OR v_count > 3 THEN
    RAISE EXCEPTION 'You must include between 1 and 3 students';
  END IF;
  SELECT count(*) INTO v_existing FROM public.parent_applications
  WHERE advert_id = _advert_id AND parent_national_id = (_parent->>'parent_national_id');
  IF v_existing > 0 THEN
    RAISE EXCEPTION 'You have already submitted the maximum allowed bursary application for this cycle.' USING ERRCODE='23505';
  END IF;
  v_tracking := COALESCE(_tracking, public.generate_tracking_number());
  INSERT INTO public.parent_applications (
    tracking_number, advert_id, parent_national_id, parent_full_name, parent_phone, parent_email,
    parent_county, parent_ward, sms_consent, household_income, household_dependents,
    poverty_score, poverty_tier, total_students, document_urls
  ) VALUES (
    v_tracking, _advert_id, _parent->>'parent_national_id', _parent->>'parent_full_name',
    _parent->>'parent_phone', _parent->>'parent_email', _parent->>'parent_county', _parent->>'parent_ward',
    COALESCE((_parent->>'sms_consent')::boolean,false),
    COALESCE((_parent->>'household_income')::int,0),
    COALESCE((_parent->>'household_dependents')::int,0),
    COALESCE((_parent->>'poverty_score')::int,0),
    _parent->>'poverty_tier', v_count, COALESCE(_parent->'document_urls','[]'::jsonb)
  ) RETURNING id INTO v_parent_id;
  FOR v_student IN SELECT * FROM jsonb_array_elements(_students) LOOP
    INSERT INTO public.student_beneficiaries (
      parent_application_id, student_full_name, student_identifier, student_type,
      institution_name, admission_number, class_form, year_of_study, fee_balance
    ) VALUES (
      v_parent_id, v_student->>'student_full_name', v_student->>'student_identifier',
      COALESCE(v_student->>'student_type','secondary'), v_student->>'institution_name',
      v_student->>'admission_number', v_student->>'class_form', v_student->>'year_of_study',
      COALESCE((v_student->>'fee_balance')::numeric,0)
    );
  END LOOP;
  RETURN QUERY SELECT v_parent_id, v_tracking;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_parent_application(uuid, jsonb, jsonb, text) TO anon, authenticated;
