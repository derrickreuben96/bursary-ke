
CREATE OR REPLACE FUNCTION public.submit_parent_application(_advert_id uuid, _parent jsonb, _students jsonb, _tracking text DEFAULT NULL::text)
 RETURNS TABLE(parent_id uuid, tracking_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tracking text; v_parent_id uuid; v_count int;
  v_student jsonb; v_existing int; v_first jsonb;
  v_score int; v_tier text;
  v_answers jsonb;
  v_idx int := 0;
  v_disability text;
  v_health text;
  v_inserted_id uuid;
  v_ec public.education_category;
  v_ec_txt text;
  v_household_disability boolean;
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

  v_answers := COALESCE(_parent->'poverty_answers', '{}'::jsonb)
               || jsonb_build_object(
                    'householdIncome',     COALESCE((_parent->>'household_income')::int, 0),
                    'numberOfDependents',  COALESCE((_parent->>'household_dependents')::int, 0)
                  );
  SELECT s.score, s.tier INTO v_score, v_tier FROM public.compute_poverty_score(v_answers) s;

  v_household_disability := COALESCE((_parent->>'household_disability_burden')::boolean, false);

  INSERT INTO public.parent_applications (
    tracking_number, advert_id, parent_national_id, parent_full_name, parent_phone, parent_email,
    parent_county, parent_ward, sms_consent, household_income, household_dependents,
    poverty_score, poverty_tier, total_students, document_urls, poverty_answers,
    household_disability_burden
  ) VALUES (
    v_tracking, _advert_id, _parent->>'parent_national_id', _parent->>'parent_full_name',
    _parent->>'parent_phone', _parent->>'parent_email', _parent->>'parent_county', _parent->>'parent_ward',
    COALESCE((_parent->>'sms_consent')::boolean,false),
    COALESCE((_parent->>'household_income')::int,0),
    COALESCE((_parent->>'household_dependents')::int,0),
    v_score, v_tier, v_count, COALESCE(_parent->'document_urls','[]'::jsonb),
    v_answers,
    v_household_disability
  ) RETURNING id INTO v_parent_id;

  v_idx := 0;
  FOR v_student IN SELECT * FROM jsonb_array_elements(_students) LOOP
    v_disability := COALESCE(
      v_answers->>('disability_student::s' || v_idx::text),
      v_answers->>'disability_student'
    );
    v_health := COALESCE(
      v_answers->>('health_challenges::s' || v_idx::text),
      v_answers->>'health_challenges'
    );

    v_ec_txt := v_student->>'education_category';
    v_ec := NULL;
    IF v_ec_txt IS NOT NULL AND v_ec_txt <> '' THEN
      BEGIN
        v_ec := v_ec_txt::public.education_category;
      EXCEPTION WHEN OTHERS THEN
        v_ec := NULL;
      END;
    END IF;

    INSERT INTO public.student_beneficiaries (
      parent_application_id, student_full_name, student_identifier, student_type,
      institution_name, admission_number, class_form, year_of_study, fee_balance,
      disability_status, health_status, education_category,
      ncpwd_registration_number, disability_type, disability_card_url
    ) VALUES (
      v_parent_id, v_student->>'student_full_name', v_student->>'student_identifier',
      COALESCE(v_student->>'student_type','secondary'), v_student->>'institution_name',
      v_student->>'admission_number', v_student->>'class_form', v_student->>'year_of_study',
      COALESCE((v_student->>'fee_balance')::numeric,0),
      v_disability, v_health, v_ec,
      NULLIF(v_student->>'ncpwd_registration_number',''),
      NULLIF(v_student->>'disability_type',''),
      NULLIF(v_student->>'disability_card_url','')
    ) RETURNING id INTO v_inserted_id;

    v_idx := v_idx + 1;
  END LOOP;

  BEGIN
    v_first := _students->0;
    INSERT INTO public.bursary_applications (
      tracking_number, student_type, status, advert_id,
      parent_national_id, parent_full_name, parent_phone, parent_email,
      parent_county, parent_ward, sms_consent,
      student_full_name, student_id, institution_name,
      year_of_study, class_form, household_income, household_dependents,
      poverty_score, poverty_tier
    ) VALUES (
      v_tracking,
      COALESCE(v_first->>'student_type','secondary')::student_type,
      'received'::application_status,
      _advert_id,
      _parent->>'parent_national_id', _parent->>'parent_full_name',
      _parent->>'parent_phone', _parent->>'parent_email',
      _parent->>'parent_county', _parent->>'parent_ward',
      COALESCE((_parent->>'sms_consent')::boolean,false),
      v_first->>'student_full_name', v_first->>'student_identifier', v_first->>'institution_name',
      v_first->>'year_of_study', v_first->>'class_form',
      COALESCE((_parent->>'household_income')::int,0),
      COALESCE((_parent->>'household_dependents')::int,0),
      v_score, v_tier::poverty_tier
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN QUERY SELECT v_parent_id, v_tracking;
END
$function$;
