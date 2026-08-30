CREATE OR REPLACE FUNCTION public.get_reusable_guardian_profile(
  _national_id text,
  _phone text,
  _consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household public.households%ROWTYPE;
  v_clean text;
  v_match boolean := false;
  v_students jsonb;
  v_last_app public.parent_applications%ROWTYPE;
BEGIN
  IF _national_id IS NULL OR length(trim(_national_id)) = 0 THEN
    RETURN jsonb_build_object('error','invalid_input');
  END IF;

  SELECT * INTO v_household
    FROM public.households
   WHERE parent_national_id = trim(_national_id)
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Second factor: the phone on file must match the phone supplied.
  v_clean := regexp_replace(COALESCE(_phone,''), '[^0-9]', '', 'g');
  IF v_clean <> '' AND v_household.parent_phone IS NOT NULL AND (
       v_household.parent_phone = v_clean
    OR v_household.parent_phone = '0' || right(v_clean, 9)
    OR v_household.parent_phone = '+254' || right(v_clean, 9)
    OR v_household.parent_phone = '254' || right(v_clean, 9)
    OR right(regexp_replace(v_household.parent_phone, '[^0-9]', '', 'g'), 9) = right(v_clean, 9)
  ) THEN
    v_match := true;
  END IF;

  IF NOT v_match THEN
    RETURN jsonb_build_object('error','verification_failed');
  END IF;

  SELECT * INTO v_last_app
    FROM public.parent_applications
   WHERE parent_national_id = v_household.parent_national_id
   ORDER BY created_at DESC
   LIMIT 1;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'created_at'), '[]'::jsonb)
    INTO v_students
  FROM (
    SELECT DISTINCT ON (lower(sb.student_full_name), sb.student_identifier)
      jsonb_build_object(
        'student_full_name', sb.student_full_name,
        'student_identifier', sb.student_identifier,
        'student_type', sb.student_type,
        'education_category', sb.education_category,
        'institution_name', sb.institution_name,
        'admission_number', sb.admission_number,
        'class_form', sb.class_form,
        'year_of_study', sb.year_of_study,
        'disability_status', sb.disability_status,
        'disability_type', sb.disability_type,
        'ncpwd_registration_number', sb.ncpwd_registration_number,
        'disability_verified', sb.disability_verified,
        'created_at', sb.created_at
      ) AS x
    FROM public.student_beneficiaries sb
    JOIN public.parent_applications pa ON pa.id = sb.parent_application_id
    WHERE pa.parent_national_id = v_household.parent_national_id
    ORDER BY lower(sb.student_full_name), sb.student_identifier, sb.created_at DESC
  ) s;

  PERFORM public.log_audit(
    CASE WHEN _consent THEN 'guardian_reuse_consent' ELSE 'guardian_reuse_lookup' END,
    'household',
    v_household.id::text,
    jsonb_build_object(
      'household_tracking_id', v_household.household_tracking_id,
      'consent', COALESCE(_consent, false)
    )
  );

  RETURN jsonb_build_object(
    'found', true,
    'household_tracking_id', v_household.household_tracking_id,
    'parent', jsonb_build_object(
      'full_name', COALESCE(v_household.parent_full_name, v_last_app.parent_full_name),
      'national_id', v_household.parent_national_id,
      'phone', COALESCE(v_household.parent_phone, v_last_app.parent_phone),
      'email', COALESCE(v_household.parent_email, v_last_app.parent_email),
      'county', COALESCE(v_household.parent_county, v_last_app.parent_county),
      'ward', COALESCE(v_household.parent_ward, v_last_app.parent_ward)
    ),
    'students', v_students,
    'last_application_at', v_last_app.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_reusable_guardian_profile(text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.get_reusable_guardian_profile(text, text, boolean) TO anon, authenticated, service_role;